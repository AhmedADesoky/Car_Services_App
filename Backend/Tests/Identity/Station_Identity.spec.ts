/**
 * Station_Identity.spec.ts - real accounts end to end (AUTH-03, AUTH-05, AUTH-07, roles API).
 * Needs a migrated + seeded database. A throwaway owner account is created and removed again.
 *
 *  first sign-in -> forced password change -> 2FA set-up -> full session
 *  -> roles API allowed for the owner, refused for a worker
 *  -> logout kills the token at once -> 2FA sign-in, codes cannot be replayed, recovery codes work once
 *  -> owner signs another person out everywhere
 */
import 'dotenv/config';
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { Client } from 'pg';
import request from 'supertest';

const ready = !!process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('YOUR-')
  && !!process.env.MIGRATION_DATABASE_URL && !process.env.MIGRATION_DATABASE_URL.includes('YOUR-');
const describeDb = ready ? describe : describe.skip;

const RUN = Date.now().toString(36);
const USERNAME = `idt.${RUN}`;
const TEMP_PASSWORD = `Temp-${RUN}-Pass#1`;
const NEW_PASSWORD = `Owner-${RUN}-Strong#26`;
const STATION = 'ALNOUR';

describeDb('Station identity: real accounts', () => {
  let app: INestApplication;
  let admin: Client;
  let tenantId = '';
  let userId = '';
  let planCode = '';
  let customRoleId: string | null = null;
  let totpCode: (secret: string, step: number) => string;
  let currentStep: () => number;
  const S = () => request(app.getHttpServer());

  beforeAll(async () => {
    const { App_Module } = await import('../../src/App_Module');
    const { Problem_Json_Filter } = await import('../../src/Common/Errors/Problem_Json_Filter');
    const { configureApp } = await import('../../src/Main_Setup');
    ({ totpCode, currentStep } = await import('../../src/Common/Security/Totp'));
    app = (await Test.createTestingModule({ imports: [App_Module] }).compile()).createNestApplication();
    configureApp(app);
    app.useGlobalFilters(new Problem_Json_Filter());
    await app.init();

    // throwaway owner with a temporary password (what the owner invitation / an owner reset produces)
    const { migrationConfig } = await import('../../Database/Scripts/Db_Env');
    admin = new Client(migrationConfig());
    await admin.connect();
    const t = await admin.query<{ id: string; plan: string }>(
      `SELECT t.id, p.code AS plan FROM app.tenants t JOIN app.plans p ON p.id = t.plan_id WHERE t.station_code = $1`, [STATION]);
    tenantId = t.rows[0].id;
    planCode = t.rows[0].plan;
    const hash = await argon2.hash(TEMP_PASSWORD, { type: argon2.argon2id });
    const u = await admin.query<{ id: string }>(
      `INSERT INTO app.users (tenant_id, username, display_name, password_hash, status, must_change_password, locale)
       VALUES ($1,$2,'Identity Test Owner',$3,'active',true,'en') RETURNING id`, [tenantId, USERNAME, hash]);
    userId = u.rows[0].id;
    await admin.query(
      `INSERT INTO app.user_roles (tenant_id, user_id, role_id) SELECT $1, $2, id FROM app.roles WHERE tenant_id = $1 AND name = 'owner'`, [tenantId, userId]);
  }, 60_000);

  afterAll(async () => {
    if (admin) {
      if (customRoleId) await admin.query(`DELETE FROM app.roles WHERE id = $1`, [customRoleId]);
      await admin.query(`DELETE FROM app.refresh_tokens WHERE user_id = $1`, [userId]);
      await admin.query(`UPDATE app.devices SET user_id = NULL WHERE user_id = $1`, [userId]);
      await admin.query(`DELETE FROM app.users WHERE id = $1`, [userId]);
      await admin.end();
    }
    await app?.close();
  });

  const bind = async () => (await S().post('/v1/devices/bind').send({ stationCode: STATION, platform: 'android', model: 'jest' }).expect(200)).body.deviceId as string;
  const login = (deviceId: string, username: string, password: string) =>
    S().post('/v1/auth/login').send({ stationCode: STATION, deviceId, username, password });
  const code = (secret: string) => totpCode(secret, currentStep());

  let deviceId = '';
  let secret = '';
  let accessToken = '';
  let refreshToken = '';
  let recoveryCodes: string[] = [];

  it('first sign-in only gives a restricted set-up token', async () => {
    deviceId = await bind();
    const res = await login(deviceId, USERNAME, TEMP_PASSWORD).expect(200);
    expect(res.body.setup).toEqual({ password: true, mfa: true });
    expect(res.body.refreshToken).toBeNull();
    const restricted = res.body.accessToken as string;
    const me = await S().get('/v1/auth/me').set('Authorization', `Bearer ${restricted}`).expect(200);
    expect(me.body.setup).toEqual({ password: true, mfa: true });
    const blocked = await S().get('/v1/roles').set('Authorization', `Bearer ${restricted}`).expect(403);
    expect(blocked.body.code).toBe('SETUP_REQUIRED');
    accessToken = restricted;
  });

  it('forced password change: policy enforced, then 2FA set-up is still required', async () => {
    const auth = { Authorization: `Bearer ${accessToken}` };
    await S().post('/v1/auth/password').set(auth).send({ currentPassword: 'wrong', newPassword: NEW_PASSWORD }).expect(401);
    const weak = await S().post('/v1/auth/password').set(auth).send({ currentPassword: TEMP_PASSWORD, newPassword: 'password123' }).expect(422);
    expect(weak.body.code).toBe('PASSWORD_POLICY');
    const ok = await S().post('/v1/auth/password').set(auth).send({ currentPassword: TEMP_PASSWORD, newPassword: NEW_PASSWORD }).expect(200);
    expect(ok.body.setup).toEqual({ password: false, mfa: true });
    // the old token is dead (permission version changed)
    await S().get('/v1/auth/me').set(auth).expect(401);
    accessToken = ok.body.accessToken;
  });

  it('2FA set-up: wrong code refused, right code gives recovery codes and a full session', async () => {
    const auth = { Authorization: `Bearer ${accessToken}` };
    const setup = await S().post('/v1/auth/mfa/setup').set(auth).expect(200);
    secret = setup.body.secret;
    expect(setup.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    await S().post('/v1/auth/mfa/enable').set(auth).send({ code: '000000' }).expect(401);
    const enabled = await S().post('/v1/auth/mfa/enable').set(auth).send({ code: code(secret) }).expect(200);
    expect(enabled.body.recoveryCodes).toHaveLength(8);
    expect(enabled.body.setup).toBeNull();
    expect(enabled.body.refreshToken).toBeTruthy();
    recoveryCodes = enabled.body.recoveryCodes;
    accessToken = enabled.body.accessToken;
    refreshToken = enabled.body.refreshToken;
  });

  it('roles API: the owner manages roles; a worker is refused', async () => {
    const auth = { Authorization: `Bearer ${accessToken}` };
    const perms = await S().get('/v1/permissions').set(auth).expect(200);
    expect(perms.body.length).toBeGreaterThanOrEqual(28);
    const roles = await S().get('/v1/roles').set(auth).expect(200);
    const owner = roles.body.find((r: { name: string }) => r.name === 'owner');
    expect(owner.isSystem).toBe(true);
    await S().put(`/v1/roles/${owner.id}/permissions`).set(auth).send({ permissions: ['orders.view'] }).expect(403);
    await S().delete(`/v1/roles/${owner.id}`).set(auth).expect(403);

    const created = await S().post('/v1/roles').set(auth).send({ name: `Night cashier ${RUN}`, permissions: ['payments.record', 'orders.view'] });
    if (planCode === 'basic') {
      expect(created.status).toBe(402);
    } else {
      expect(created.status).toBe(201);
      customRoleId = created.body.id;
      await S().put(`/v1/roles/${customRoleId}/permissions`).set(auth).send({ permissions: ['payments.record'] }).expect(200);
      await S().post('/v1/roles').set(auth).send({ name: `Night cashier ${RUN}`, permissions: ['orders.view'] }).expect(409);
      await S().post('/v1/roles').set(auth).send({ name: `Bad ${RUN}`, permissions: ['not.a_permission'] }).expect(422);
    }

    const worker = await login(await bind(), 'karim.adel', process.env.SEED_USER_PASSWORD ?? '').expect(200);
    await S().get('/v1/roles').set('Authorization', `Bearer ${worker.body.accessToken}`).expect(403);
  });

  it('logout ends this phone at once: access token and refresh token both stop working', async () => {
    await S().post('/v1/auth/logout').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const res = await S().get('/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
    expect(res.body.code).toBe('SIGNED_OUT');
    await S().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('2FA sign-in: code required, a used code cannot be replayed, recovery codes work once', async () => {
    const first = await login(deviceId, USERNAME, NEW_PASSWORD).expect(200);
    expect(first.body.mfaRequired).toBe(true);
    expect(first.body.accessToken).toBeUndefined();
    const used = code(secret);   // same 30-second window as the enable step above -> already used
    const replay = await S().post('/v1/auth/mfa/verify').send({ mfaToken: first.body.mfaToken, code: used });
    // Accepted only if the clock moved to a new 30 s step since enabling; never the same step twice.
    if (replay.status === 200) {
      accessToken = replay.body.accessToken;
      const again = await login(deviceId, USERNAME, NEW_PASSWORD).expect(200);
      await S().post('/v1/auth/mfa/verify').send({ mfaToken: again.body.mfaToken, code: used }).expect(401);
    } else {
      expect(replay.body.code).toBe('MFA_INVALID');
    }

    const viaRecovery = await login(deviceId, USERNAME, NEW_PASSWORD).expect(200);
    const ok = await S().post('/v1/auth/mfa/verify').send({ mfaToken: viaRecovery.body.mfaToken, code: recoveryCodes[0] }).expect(200);
    expect(ok.body.recoveryCodeUsed).toBe(true);
    accessToken = ok.body.accessToken;
    const reuse = await login(deviceId, USERNAME, NEW_PASSWORD).expect(200);
    await S().post('/v1/auth/mfa/verify').send({ mfaToken: reuse.body.mfaToken, code: recoveryCodes[0] }).expect(401);
  });

  it('the owner can sign another person out everywhere', async () => {
    const workerDevice = await bind();
    const worker = await login(workerDevice, 'karim.adel', process.env.SEED_USER_PASSWORD ?? '').expect(200);
    const me = await S().get('/v1/auth/me').set('Authorization', `Bearer ${worker.body.accessToken}`).expect(200);
    await S().post(`/v1/users/${me.body.id}/sign-out`).set('Authorization', `Bearer ${accessToken}`).expect(200);
    await S().get('/v1/auth/me').set('Authorization', `Bearer ${worker.body.accessToken}`).expect(401);
    await S().post('/v1/auth/refresh').send({ refreshToken: worker.body.refreshToken }).expect(401);
  });
});
