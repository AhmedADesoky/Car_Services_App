/**
 * Run_Migrations.ts - applies Database/Migrations/*.sql in name order, once each.
 * Usage: npm run Db_Migrate
 */
import { readdirSync, readFileSync } from 'fs';
import { PERMISSIONS } from '../../src/Common/Rbac/Default_Roles';
import { join } from 'path';
import { Client } from 'pg';
import { appDbPassword, migrationConfig, platformDbPassword } from './Db_Env';

const MIGRATIONS_DIR = join(__dirname, '..', 'Migrations');

/** Login roles used at runtime. Neither owns tables and neither can bypass RLS. */
async function ensureRole(client: Client, role: 'app_rw' | 'platform_rw', rawPassword: string): Promise<void> {
  const password = client.escapeLiteral(rawPassword);
  const { rowCount } = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [role]);
  if (rowCount === 0) {
    await client.query(`CREATE ROLE ${role} LOGIN NOBYPASSRLS NOINHERIT PASSWORD ${password}`);
    console.log(`Created role ${role}`);
  } else {
    await client.query(`ALTER ROLE ${role} WITH LOGIN NOBYPASSRLS PASSWORD ${password}`);
  }
}

async function main(): Promise<void> {
  const client = new Client(migrationConfig());
  await client.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS app');
    await client.query(`CREATE TABLE IF NOT EXISTS app.schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    await ensureRole(client, 'app_rw', appDbPassword());       // station API
    await ensureRole(client, 'platform_rw', platformDbPassword()); // admin console API

    const applied = new Set(
      (await client.query<{ name: string }>('SELECT name FROM app.schema_migrations')).rows.map((r) => r.name),
    );
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file}`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO app.schema_migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`apply ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }
    // Permission catalogue comes from code (src/Common/Rbac/Default_Roles.ts) - real stations need it, not just the seed.
    for (const [code, description] of PERMISSIONS) {
      await client.query(
        `INSERT INTO app.permissions(code, description) VALUES ($1,$2) ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description`,
        [code, description]);
    }
    console.log(`Permission catalogue synced (${PERMISSIONS.length}).`);
    // schema_migrations is internal: the API role must not see it
    await client.query('REVOKE ALL ON app.schema_migrations FROM app_rw, platform_rw');
    console.log('Migrations done.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
