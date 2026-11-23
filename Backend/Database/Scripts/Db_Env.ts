import 'dotenv/config';
import { ClientConfig } from 'pg';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.includes('YOUR-')) {
    throw new Error(`Missing ${name} in Backend/.env (see .env.example)`);
  }
  return value;
}

// Supabase requires TLS. For dev we accept the pooler certificate; in production pin the Supabase CA
// by setting DB_SSL_CA_PATH (see Docs/Setup_Guide.md).
export function sslOption(): ClientConfig['ssl'] {
  return { rejectUnauthorized: false };
}

/** Admin connection (role "postgres") through the SESSION pooler, port 5432 - migrations and seeds only. */
export function migrationConfig(): ClientConfig {
  return { connectionString: required('MIGRATION_DATABASE_URL'), ssl: sslOption() };
}

export function appDbPassword(): string {
  return required('APP_DB_PASSWORD');
}
