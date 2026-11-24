/**
 * Tenant_Context.spec.ts - runs WITHOUT a database.
 * Proves the global Station_Access_Guard: the JWT tenant reaches the handler through AsyncLocalStorage, a tenant id
 * sent in a header is ignored, bad tokens are rejected, routes are default-deny, @Requires is enforced with
 * permissions loaded from the database, restricted set-up tokens only open @Allow_Setup routes, 2FA challenge
 * tokens never work as access tokens, and a signed-out device is refused at once.
 */
import 'reflect-metadata';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

process.env.DATABASE_URL ??= 'postgresql://app_rw:x@localhost:6543/postgres';
process.env.JWT_ACCESS_SECRET ??= 'test-secret-test-secret-test-secret-123456';

const TENANT_A = '01900000-0000-7000-8000-00000000000a';
const USER_A = '01900000-0000-7000-8000-0000000000a1';
const DEVICE_A = '01900000-0000-7000-8000-0000000000d1';

describe('Station access guard (no database)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const session = { tenantStatus: 'active', deviceOk: true, permissions: ['orders.view'] as string[] };

  beforeAll(async () => {
    const { Common_Module } = await import('../../src/Common/Common_Module');
    const { Db_Client } = await import('../../src/Common/Database/Db_Client');
    const { Allow_Setup, Any_User, Public, Requires } = await import('../../src/Common/Auth/Access_Decorators');
    const { currentTenant } = await import('../../src/Common/Tenant_Context/Tenant_Store');
    const { Problem_Json_Filter } = await import('../../src/Common/Errors/Problem_Json_Filter');
    const { configureApp } = await import('../../src/Main_Setup');

    @Controller('probe')
    class Probe_Controller {
      @Get() @Any_User()
      async probe() {
        await new Promise((resolve) => setTimeout(resolve, 5)); // context must survive async hops
        return currentTenant();
      }
      @Get('open') @Public() open() { return { ok: true }; }
      @Get('undeclared') undeclared() { return { leaked: true }; }
      @Get('orders') @Requires('orders.view') orders() { return { ok: true }; }
      @Get('refunds') @Requires('finance.correct') refunds() { return { ok: true }; }
      @Get('setup') @Any_User() @Allow_Setup() setup() { return currentTenant(); }
    }

    const fakeDb = {
      withTenant: async (_tenantId: string, fn: (db: unknown) => Promise<unknown>) =>
        fn({ query: async () => ({ rows: [{ tenant_status: session.tenantStatus, user_status: 'active', perm_version: 1,
          device_ok: session.deviceOk, roles: ['worker'], permissions: session.permissions }] }) }),
      platformQuery: async () => [],
      onModuleDestroy: async () => undefined,
    };

    const moduleRef = await Test.createTestingModule({ imports: [Common_Module], controllers: [Probe_Controller] })
      .overrideProvider(Db_Client).useValue(fakeDb)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    app.useGlobalFilters(new Problem_Json_Filter());
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => app?.close());

  const token = (extra: Record<string, unknown> = {}) =>
    jwt.signAsync({ sub: USER_A, tid: TENANT_A, dev: DEVICE_A, roles: ['owner'], perm_v: 1, typ: 'access', ...extra });
  const get = async (path: string, status: number, extra?: Record<string, unknown>) =>
    request(app.getHttpServer()).get(`/v1/probe${path}`).set('Authorization', `Bearer ${await token(extra)}`).expect(status);

  it('passes the JWT tenant to the handler, with roles + permissions from the database (not the token)', async () => {
    const res = await get('', 200);
    expect(res.body.tenantId).toBe(TENANT_A);
    expect(res.body.userId).toBe(USER_A);
    expect(res.body.roles).toEqual(['worker']);          // token said "owner": ignored
    expect(res.body.permissions).toEqual(['orders.view']);
  });

  it('ignores a tenant id smuggled in a header', async () => {
    const res = await request(app.getHttpServer()).get('/v1/probe')
      .set('Authorization', `Bearer ${await token()}`).set('X-Tenant-Id', '00000000-0000-0000-0000-000000000000').expect(200);
    expect(res.body.tenantId).toBe(TENANT_A);
  });

  it('rejects missing, forged and alg=none tokens', async () => {
    await request(app.getHttpServer()).get('/v1/probe').expect(401);
    const forged = new JwtService({ secret: 'another-secret-another-secret-another-1' });
    await request(app.getHttpServer()).get('/v1/probe').set('Authorization', `Bearer ${await forged.signAsync({ sub: USER_A, tid: TENANT_A })}`).expect(401);
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: USER_A, tid: TENANT_A, iss: 'car-services-api' })).toString('base64url');
    await request(app.getHttpServer()).get('/v1/probe').set('Authorization', `Bearer ${header}.${body}.`).expect(401);
  });

  it('blocks a suspended station even with a valid token', async () => {
    session.tenantStatus = 'suspended';
    await get('', 403);
    session.tenantStatus = 'active';
  });

  it('is default-deny: a route without an access rule is refused even with a valid token', async () => {
    await get('/undeclared', 403);
    await request(app.getHttpServer()).get('/v1/probe/open').expect(200);
  });

  it('enforces @Requires with the current database permissions', async () => {
    await get('/orders', 200);
    const res = await get('/refunds', 403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('accepts a restricted set-up token only on @Allow_Setup routes', async () => {
    const blocked = await get('', 403, { rst: 'setup' });
    expect(blocked.body.code).toBe('SETUP_REQUIRED');
    const ok = await get('/setup', 200, { rst: 'setup' });
    expect(ok.body.restricted).toBe(true);
  });

  it('never accepts a 2FA challenge token as an access token', async () => {
    await get('', 401, { typ: 'mfa' });
  });

  it('refuses a device that was signed out', async () => {
    session.deviceOk = false;
    const res = await get('', 401);
    expect(res.body.code).toBe('SIGNED_OUT');
    session.deviceOk = true;
  });
});
