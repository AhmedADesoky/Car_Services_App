/**
 * Seed_Three_Tenants.ts - synthetic data for development and the cross-tenant tests (spec P1).
 * Creates 3 stations that deliberately share the same usernames, proving uniqueness is per tenant.
 * Test-only password comes from SEED_USER_PASSWORD in Backend/.env (never use a real password).
 * Usage: npm run Db_Seed   (idempotent - safe to run again)
 */
import * as argon2 from 'argon2';
import { Client } from 'pg';
import { migrationConfig } from '../Scripts/Db_Env';

const PERMISSIONS: Array<[string, string]> = [
  ['workers.create', 'Add workers'], ['workers.update', 'Edit workers'], ['workers.deactivate', 'Deactivate workers'],
  ['workers.view', 'View workers'], ['workers.face.enroll', 'Enroll / reset worker face'],
  ['branches.manage', 'Manage branches and geofences'],
  ['attendance.checkin', 'Check in / out'], ['attendance.view', 'View attendance'], ['attendance.correct', 'Correct attendance'],
  ['orders.create', 'Create orders, add items, checkout'], ['orders.view', 'View orders'], ['orders.cancel', 'Cancel orders'],
  ['customers.view', 'View customers'], ['customers.create', 'Create / update customers'], ['customers.delete', 'Delete / merge customers'],
  ['catalog.manage', 'Manage services and prices'], ['tax.manage', 'Manage tax rates'],
  ['payments.record', 'Record payments'], ['payments.view', 'View payments'], ['finance.correct', 'Corrections / refunds'],
  ['reports.operations', 'Operations reports'], ['reports.finance', 'Finance reports'],
  ['data.import', 'Excel import'], ['data.export', 'Excel export'], ['roles.manage', 'Manage roles'],
  ['audit.view', 'View audit log'], ['settings.manage', 'Station settings'], ['support_access.grant', 'Grant support access'],
];

const ROLE_PERMS: Record<string, string[]> = {
  owner: PERMISSIONS.map(([code]) => code),
  branch_manager: ['workers.view', 'workers.update', 'attendance.checkin', 'attendance.view', 'attendance.correct',
    'orders.create', 'orders.view', 'orders.cancel', 'customers.view', 'customers.create', 'payments.record', 'reports.operations'],
  worker: ['attendance.checkin', 'orders.create', 'orders.view', 'customers.view', 'customers.create', 'payments.record'],
  accountant: ['workers.view', 'orders.view', 'customers.view', 'payments.view', 'reports.finance', 'data.import', 'data.export', 'audit.view'],
};

const TENANTS = [
  { code: 'ALNOUR', legal: 'Al-Nour Auto Service LLC', display: 'Al-Nour Auto Service', plan: 'pro' },
  { code: 'SPEEDFIX', legal: 'Speed Fix Garage', display: 'Speed Fix', plan: 'basic' },
  { code: 'DELTA1', legal: 'Delta Car Care', display: 'Delta Car Care', plan: 'enterprise' },
];

const USERS = [
  { username: 'owner', display: 'Station Owner', role: 'owner', locale: 'ar' },
  { username: 'karim.adel', display: 'Karim Adel', role: 'worker', locale: 'en' },
  { username: 'accountant', display: 'Accountant', role: 'accountant', locale: 'ar' },
];

async function main(): Promise<void> {
  const password = process.env.SEED_USER_PASSWORD;
  if (!password || password.length < 8) throw new Error('Set SEED_USER_PASSWORD (8+ chars) in Backend/.env');
  const hash = await argon2.hash(password, { type: argon2.argon2id });

  const client = new Client(migrationConfig());
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const [code, name, limits] of [
      ['basic', 'Basic', { branches: 1, workers: 10, plate_scans_month: 3000, fine_tune: false }],
      ['pro', 'Pro', { branches: 5, workers: 50, plate_scans_month: 15000, fine_tune: 'quarterly' }],
      ['enterprise', 'Enterprise', { branches: null, workers: null, plate_scans_month: null, fine_tune: 'monthly' }],
    ] as const) {
      await client.query(
        `INSERT INTO app.plans(code, name, limits) VALUES ($1,$2,$3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, limits = EXCLUDED.limits`,
        [code, name, JSON.stringify(limits)],
      );
    }
    for (const [code, description] of PERMISSIONS) {
      await client.query(
        `INSERT INTO app.permissions(code, description) VALUES ($1,$2)
         ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description`,
        [code, description],
      );
    }
    await client.query('COMMIT');

    for (const t of TENANTS) {
      await client.query('BEGIN');
      const tenant = await client.query<{ id: string }>(
        `INSERT INTO app.tenants(station_code, legal_name, display_name, plan_id, status, storage_prefix)
         VALUES ($1,$2,$3,(SELECT id FROM app.plans WHERE code=$4),'active','')
         ON CONFLICT (station_code) DO UPDATE SET display_name = EXCLUDED.display_name
         RETURNING id`,
        [t.code, t.legal, t.display, t.plan],
      );
      const tenantId = tenant.rows[0].id;
      await client.query(`UPDATE app.tenants SET storage_prefix = $2 WHERE id = $1`, [tenantId, `tenants/${tenantId}/`]);
      // Work inside the tenant context exactly like the API does
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);

      const roleIds: Record<string, string> = {};
      for (const [roleName, perms] of Object.entries(ROLE_PERMS)) {
        const role = await client.query<{ id: string }>(
          `INSERT INTO app.roles(tenant_id, name, is_system) VALUES ($1,$2,true)
           ON CONFLICT (tenant_id, name) DO UPDATE SET is_system = true RETURNING id`,
          [tenantId, roleName],
        );
        roleIds[roleName] = role.rows[0].id;
        for (const perm of perms) {
          await client.query(
            `INSERT INTO app.role_permissions(tenant_id, role_id, permission_code) VALUES ($1,$2,$3)
             ON CONFLICT DO NOTHING`,
            [tenantId, roleIds[roleName], perm],
          );
        }
      }
      for (const u of USERS) {
        const user = await client.query<{ id: string }>(
          `INSERT INTO app.users(tenant_id, username, display_name, password_hash, locale)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (tenant_id, username) DO UPDATE SET password_hash = EXCLUDED.password_hash
           RETURNING id`,
          [tenantId, u.username, u.display, hash, u.locale],
        );
        await client.query(
          `INSERT INTO app.user_roles(tenant_id, user_id, role_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [tenantId, user.rows[0].id, roleIds[u.role]],
        );
      }
      await client.query('COMMIT');
      console.log(`seeded ${t.code} (${tenantId})`);
    }
    console.log('Seed done.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
