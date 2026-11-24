/**
 * Create_Super_Admin.ts - creates the FIRST company Super Admin. There is deliberately no API for this.
 * Run it on a trusted machine:
 *   npm run Platform_Create_Super_Admin -- --email you@company.com --name "Your Name"
 * It prints a one-time temporary password. At first sign-in on the Admin Console the person MUST
 * change it and set up 2FA. Running it again for the same email resets that account the same way.
 */
import * as argon2 from 'argon2';
import { Client } from 'pg';
import { temporaryPassword } from '../../src/Platform/Common/Platform_Crypto';
import { migrationConfig } from './Db_Env';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const email = arg('email')?.trim().toLowerCase();
  const name = arg('name')?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    throw new Error('Usage: npm run Platform_Create_Super_Admin -- --email you@company.com --name "Your Name"');
  }
  const password = temporaryPassword();
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const client = new Client(migrationConfig());
  await client.connect();
  try {
    await client.query('BEGIN');
    const { rows: [role] } = await client.query<{ id: string }>(`SELECT id FROM app.platform_roles WHERE name = 'Super Admin'`);
    if (!role) throw new Error('Run npm run Db_Migrate first');
    const { rows: [dept] } = await client.query<{ id: string }>(`SELECT id FROM app.platform_departments WHERE name = 'Management'`);
    const { rows: [user] } = await client.query<{ id: string }>(
      `INSERT INTO app.platform_users (email, full_name, password_hash, status, department_id, must_change_password, mfa_enabled, mfa_secret)
       VALUES ($1,$2,$3,'invited',$4,true,false,NULL)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'invited', must_change_password = true,
              mfa_enabled = false, mfa_secret = NULL, perm_version = app.platform_users.perm_version + 1
       RETURNING id`, [email, name, hash, dept?.id ?? null]);
    await client.query(`INSERT INTO app.platform_user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [user.id, role.id]);
    await client.query(`UPDATE app.platform_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [user.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
  console.log('\nSuper Admin ready.');
  console.log(`  Email:              ${email}`);
  console.log(`  Temporary password: ${password}`);
  console.log('Sign in to the Admin Console now: you will be asked to change it and to set up 2FA.\n');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
