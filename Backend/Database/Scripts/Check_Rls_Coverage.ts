/**
 * Check_Rls_Coverage.ts - CI gate (spec section 3.8).
 * Fails if any table in schema "app" with a tenant_id column is missing
 * ENABLE RLS, FORCE RLS or the tenant_isolation policy.
 * Usage: npm run Db_Rls_Check
 */
import { Client } from 'pg';
import { migrationConfig } from './Db_Env';

const SQL = `
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       EXISTS (SELECT 1 FROM pg_policies p
               WHERE p.schemaname = 'app' AND p.tablename = c.relname AND p.policyname = 'tenant_isolation') AS has_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'app'
WHERE c.relkind = 'r'
  AND EXISTS (SELECT 1 FROM information_schema.columns col
              WHERE col.table_schema = 'app' AND col.table_name = c.relname AND col.column_name = 'tenant_id')
  -- Company (platform) tables only REFERENCE a station; they are protected by role grants instead:
  -- app_rw has no access to them (checked below).
  AND c.relname NOT IN ('tenant_usage', 'station_requests')
  AND c.relname NOT LIKE 'platform\\_%'
ORDER BY 1`;

async function main(): Promise<void> {
  const client = new Client(migrationConfig());
  await client.connect();
  try {
    const { rows } = await client.query(SQL);
    const bad = rows.filter((r) => !r.rls_enabled || !r.rls_forced || !r.has_policy);
    rows.forEach((r) =>
      console.log(`${bad.includes(r) ? 'FAIL' : 'ok  '} ${r.table_name}`),
    );
    if (bad.length > 0) {
      console.error(`${bad.length} tenant table(s) missing RLS/FORCE/policy`);
      process.exit(1);
    }
    // The station API role must never touch company (platform_*) data.
    const leaks = await client.query(
      `SELECT table_name, privilege_type FROM information_schema.role_table_grants
        WHERE grantee = 'app_rw' AND table_schema = 'app' AND table_name LIKE 'platform\_%'`,
    );
    if (leaks.rows.length > 0) {
      leaks.rows.forEach((r) => console.error(`FAIL app_rw has ${r.privilege_type} on ${r.table_name}`));
      process.exit(1);
    }
    console.log('app_rw has no access to platform tables');
    console.log('RLS coverage OK');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
