/**
 * Cross_Tenant_Isolation.spec.ts - spec section 3.8.
 * Needs a migrated + seeded database (npm run Db_Migrate && npm run Db_Seed).
 * Skipped automatically when Backend/.env is not filled in.
 */
import 'dotenv/config';
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';

const ready = !!process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('YOUR-')
  && !!process.env.MIGRATION_DATABASE_URL && !process.env.MIGRATION_DATABASE_URL.includes('YOUR-');
const describeDb = ready ? describe : describe.skip;
const PASSWORD = process.env.SEED_USER_PASSWORD ?? '';

describeDb('Tenant isolation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { App_Module } = await import('../../src/App_Module');
    const { Problem_Json_Filter } = await import('../../src/Common/Errors/Problem_Json_Filter');
    const moduleRef = await Test.createTestingModule({ imports: [App_Module] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new Problem_Json_Filter());
    await app.init();
  });

  afterAll(async () => app?.close());

  async function signIn(stationCode: string) {
    const bind = await request(app.getHttpServer()).post('/v1/devices/bind')
      .send({ stationCode, platform: 'android', model: 'jest' }).expect(200);
    const login = await request(app.getHttpServer()).post('/v1/auth/login')
      .send({ stationCode, deviceId: bind.body.deviceId, username: 'karim.adel', password: PASSWORD }).expect(200);
    return { deviceId: bind.body.deviceId as string, token: login.body.accessToken as string, userId: login.body.user.id as string };
  }

  it('same username in two stations are two different users', async () => {
    const a = await signIn('ALNOUR');
    const b = await signIn('SPEEDFIX');
    expect(a.userId).not.toEqual(b.userId);
    const meA = await request(app.getHttpServer()).get('/v1/auth/me').set('Authorization', `Bearer ${a.token}`).expect(200);
    expect(meA.body.stationName).toBe('Al-Nour Auto Service');
  });

  it('a device bound to station A cannot log in to station B', async () => {
    const a = await signIn('ALNOUR');
    await request(app.getHttpServer()).post('/v1/auth/login')
      .send({ stationCode: 'SPEEDFIX', deviceId: a.deviceId, username: 'karim.adel', password: PASSWORD })
      .expect(401);
  });

  it('as app_rw, queries without app.tenant_id return zero rows', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      for (const table of ['users', 'roles', 'devices', 'refresh_tokens', 'login_attempts']) {
        const { rows } = await client.query(`SELECT count(*)::int AS n FROM app.${table}`);
        expect(rows[0].n).toBe(0);
      }
    } finally {
      await client.end();
    }
  });

  it('a tenant id smuggled in a header is ignored', async () => {
    const a = await signIn('ALNOUR');
    const me = await request(app.getHttpServer()).get('/v1/auth/me')
      .set('Authorization', `Bearer ${a.token}`).set('X-Tenant-Id', '00000000-0000-0000-0000-000000000000').expect(200);
    expect(me.body.stationName).toBe('Al-Nour Auto Service');
  });
});
