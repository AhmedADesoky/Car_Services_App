/**
 * Platform_Onboarding.spec.ts - the real onboarding chain, end to end, against the dev database:
 *   Super Admin (password change + 2FA) -> public station request -> create station -> owner activation link
 *   -> owner signs in on the station API. Plus company RBAC and token separation.
 * Skipped when Backend/.env is not configured. Cleans up everything it creates.
 */
import 'dotenv/config';
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';
import { totpCode, currentStep } from '../../src/Common/Security/Totp';

const ready = ['DATABASE_URL', 'MIGRATION_DATABASE_URL', 'PLATFORM_DATABASE_URL', 'PLATFORM_JWT_SECRET']
  .every((k) => process.env[k] && !process.env[k]!.includes('YOUR-'));
const describeDb = ready ? describe : describe.skip;

const RUN = randomBytes(3).toString('hex').toUpperCase();
const SA_EMAIL = `sa.${RUN.toLowerCase()}@example.test`;
const SA_TEMP = `Temp-${RUN}-Pass!9x`;
const SA_NEW = `Admin-${RUN}-Strong#2026`;
const STATION_CODE = `T${RUN}`;
const OWNER_PASSWORD = `Owner-${RUN}-Secure#1`;

describeDb('Platform onboarding chain', () => {
  let platform: INestApplication;
  let station: INestApplication;
  let admin: Client;
  let saToken = '';
  let stationId = '';
  let requestId = '';
  const staffIds: string[] = [];

  beforeAll(async () => {
    admin = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await admin.connect();
    // Bootstrap a Super Admin exactly like Create_Super_Admin.ts does
    const { rows: [role] } = await admin.query(`SELECT id FROM app.platform_roles WHERE name = 'Super Admin'`);
    const { rows: [user] } = await admin.query(
      `INSERT INTO app.platform_users (email, full_name, password_hash, status, must_change_password) VALUES ($1,'Test SA',$2,'invited',true) RETURNING id`,
      [SA_EMAIL, await argon2.hash(SA_TEMP, { type: argon2.argon2id })]);
    staffIds.push(user.id);
    await admin.query(`INSERT INTO app.platform_user_roles (user_id, role_id) VALUES ($1,$2)`, [user.id, role.id]);

    const { Platform_App_Module } = await import('../../src/Platform/Platform_App_Module');
    const { configurePlatformApp } = await import('../../src/Platform/Platform_Setup');
    platform = (await Test.createTestingModule({ imports: [Platform_App_Module] }).compile()).createNestApplication();
    configurePlatformApp(platform);
    await platform.init();

    const { App_Module } = await import('../../src/App_Module');
    const { configureApp } = await import('../../src/Main_Setup');
    const { Problem_Json_Filter } = await import('../../src/Common/Errors/Problem_Json_Filter');
    station = (await Test.createTestingModule({ imports: [App_Module] }).compile()).createNestApplication();
    configureApp(station);
    station.useGlobalFilters(new Problem_Json_Filter());
    await station.init();
  });

  afterAll(async () => {
    // Best-effort cleanup of everything this run created
    if (stationId) {
      await admin.query('BEGIN');
      await admin.query(`SELECT set_config('app.tenant_id', $1, true)`, [stationId]);
      for (const t of ['refresh_tokens', 'login_attempts', 'devices', 'owner_invitations', 'user_roles', 'role_permissions', 'roles', 'users']) {
        await admin.query(`DELETE FROM app.${t} WHERE tenant_id = $1`, [stationId]);
      }
      await admin.query(`UPDATE app.station_requests SET tenant_id = NULL WHERE tenant_id = $1`, [stationId]);
      await admin.query(`DELETE FROM app.tenants WHERE id = $1`, [stationId]);
      await admin.query('COMMIT');
    }
    if (requestId) await admin.query(`DELETE FROM app.station_requests WHERE id = $1`, [requestId]);
    for (const id of staffIds) await admin.query(`DELETE FROM app.platform_users WHERE id = $1`, [id]);
    await admin.query(`DELETE FROM app.platform_login_attempts WHERE email LIKE $1`, [`%.${RUN.toLowerCase()}@example.test`]);
    await admin?.end();
    await platform?.close();
    await station?.close();
  });

  const P = () => request(platform.getHttpServer());
  const S = () => request(station.getHttpServer());

  async function finishSetup(email: string, temp: string, newPassword: string): Promise<string> {
    const login = await P().post('/platform/v1/auth/login').send({ email, password: temp }).expect(200);
    expect(login.body.next).toBe('setup');
    // setup token must NOT open normal routes
    await P().get('/platform/v1/dashboard').set('Authorization', `Bearer ${login.body.setupToken}`).expect(403);
    const changed = await P().post('/platform/v1/auth/password/change').set('Authorization', `Bearer ${login.body.setupToken}`)
      .send({ currentPassword: temp, newPassword }).expect(200);
    const setup = await P().post('/platform/v1/auth/mfa/setup').set('Authorization', `Bearer ${changed.body.setupToken}`).expect(200);
    expect(setup.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    const enabled = await P().post('/platform/v1/auth/mfa/enable').set('Authorization', `Bearer ${changed.body.setupToken}`)
      .send({ code: totpCode(setup.body.secret, currentStep()) }).expect(200);
    expect(enabled.body.next).toBe('done');
    return enabled.body.accessToken as string;
  }

  it('Super Admin must change password and enable 2FA before getting a session', async () => {
    await P().post('/platform/v1/auth/login').send({ email: SA_EMAIL, password: 'wrong-password' }).expect(401);
    saToken = await finishSetup(SA_EMAIL, SA_TEMP, SA_NEW);
    const me = await P().get('/platform/v1/auth/me').set('Authorization', `Bearer ${saToken}`).expect(200);
    expect(me.body.permissions).toEqual(expect.arrayContaining(['stations.create', 'roles.manage', 'audit.view']));
  });

  it('a station token can never be used on the Admin API', async () => {
    const bind = await S().post('/v1/devices/bind').send({ stationCode: 'ALNOUR', platform: 'android' }).expect(200);
    const login = await S().post('/v1/auth/login')
      .send({ stationCode: 'ALNOUR', deviceId: bind.body.deviceId, username: 'owner', password: process.env.SEED_USER_PASSWORD }).expect(200);
    await P().get('/platform/v1/dashboard').set('Authorization', `Bearer ${login.body.accessToken}`).expect(401);
    // ...and an admin token is useless on the station API
    await S().get('/v1/auth/me').set('Authorization', `Bearer ${saToken}`).expect(401);
  });

  it('public request -> Super Admin creates the station -> owner activates -> owner signs in', async () => {
    await S().post('/v1/public/station-requests').send({
      planCode: 'pro', businessName: `Test Garage ${RUN}`, contactName: 'Mona Test', contactPhone: '+20 100 000 0000',
      branchesCount: 2, workersCount: 12, locale: 'en',
    }).expect(202);
    const list = await P().get('/platform/v1/station-requests?status=new').set('Authorization', `Bearer ${saToken}`).expect(200);
    requestId = list.body.find((r: { business_name: string }) => r.business_name === `Test Garage ${RUN}`).id;

    const created = await P().post('/platform/v1/stations').set('Authorization', `Bearer ${saToken}`).send({
      stationCode: STATION_CODE, legalName: `Test Garage ${RUN} LLC`, displayName: `Test Garage ${RUN}`, planCode: 'pro',
      contact: { name: 'Mona Test', phone: '+20 100 000 0000' }, owner: { fullName: 'Mona Test', username: 'mona', phone: '+20 100 000 0000' },
      requestId,
    }).expect(201);
    stationId = created.body.stationId;
    expect(created.body.devActivationLink).toContain('/activate?token=');
    const token = new URL(created.body.devActivationLink).searchParams.get('token')!;

    // same request cannot be approved twice
    await P().post('/platform/v1/stations').set('Authorization', `Bearer ${saToken}`).send({
      stationCode: `${STATION_CODE}X`, legalName: 'x x', displayName: 'x x', planCode: 'basic',
      contact: { name: 'x x', phone: '+20 100 000 0000' }, owner: { fullName: 'x x', phone: '+20 100 000 0000' }, requestId,
    }).expect(409);

    const info = await S().get(`/v1/public/invitations/${token}`).expect(200);
    expect(info.body).toMatchObject({ stationCode: STATION_CODE, username: 'mona' });
    await S().post('/v1/public/invitations/activate').send({ token, password: 'password123' }).expect(422);
    await S().post('/v1/public/invitations/activate').send({ token, password: OWNER_PASSWORD }).expect(200);
    await S().post('/v1/public/invitations/activate').send({ token, password: OWNER_PASSWORD }).expect(410);

    const bind = await S().post('/v1/devices/bind').send({ stationCode: STATION_CODE, platform: 'ios' }).expect(200);
    const login = await S().post('/v1/auth/login')
      .send({ stationCode: STATION_CODE, deviceId: bind.body.deviceId, username: 'mona', password: OWNER_PASSWORD }).expect(200);
    expect(login.body.user.roles).toEqual(['owner']);

    const detail = await P().get(`/platform/v1/stations/${stationId}`).set('Authorization', `Bearer ${saToken}`).expect(200);
    expect(detail.body.ownerInvitation.owner_status).toBe('active');
    // Regression: counts must be THIS station's only (SECURITY DEFINER functions bypass RLS on Supabase)
    expect(detail.body.counts).toMatchObject({ active_users: 1, invited_users: 0, devices: 1 });
    expect(detail.body.station.kms_key_ref).toBeUndefined();
  });

  it('company RBAC: Support can view stations but cannot create them or manage the team', async () => {
    const roles = await P().get('/platform/v1/roles').set('Authorization', `Bearer ${saToken}`).expect(200);
    const supportRole = roles.body.find((r: { name: string }) => r.name === 'Support');
    const email = `support.${RUN.toLowerCase()}@example.test`;
    const created = await P().post('/platform/v1/team').set('Authorization', `Bearer ${saToken}`)
      .send({ email, fullName: 'Support Person', roleIds: [supportRole.id] }).expect(201);
    staffIds.push(created.body.id);
    const supportToken = await finishSetup(email, created.body.temporaryPassword, `Support-${RUN}-Strong#26`);

    await P().get('/platform/v1/stations').set('Authorization', `Bearer ${supportToken}`).expect(200);
    await P().post('/platform/v1/stations').set('Authorization', `Bearer ${supportToken}`).send({}).expect(403);
    await P().get('/platform/v1/team').set('Authorization', `Bearer ${supportToken}`).expect(403);
    await P().get('/platform/v1/audit-logs').set('Authorization', `Bearer ${supportToken}`).expect(403);
  });

  it('the company audit log is hash-chained and intact', async () => {
    const result = await P().get('/platform/v1/audit-logs/verify').set('Authorization', `Bearer ${saToken}`).expect(200);
    expect(result.body.brokenAt).toBeNull();
    const logs = await P().get('/platform/v1/audit-logs').set('Authorization', `Bearer ${saToken}`).expect(200);
    expect(logs.body.map((l: { action: string }) => l.action)).toEqual(expect.arrayContaining(['station.create', 'staff.create']));
  });
});
