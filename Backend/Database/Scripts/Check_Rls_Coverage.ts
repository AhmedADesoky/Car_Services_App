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
  AND c.relname NOT IN ('tenant_usage')   -- platform metering table (platform role only)
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
    console.log('RLS coverage OK');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
