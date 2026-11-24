import 'dotenv/config';
import { ClientConfig } from 'pg';
import { dbSslOptions } from '../../src/Common/Database/Db_Ssl';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.includes('YOUR-')) {
    throw new Error(`Missing ${name} in Backend/.env (see .env.example)`);
  }
  return value;
}

// Supabase requires TLS. Set DB_SSL_CA_PATH to verify the server certificate (see Db_Ssl.ts).
export function sslOption(): ClientConfig['ssl'] {
  return dbSslOptions();
}

/** Admin connection (role "postgres") through the SESSION pooler, port 5432 - migrations and seeds only. */
export function migrationConfig(): ClientConfig {
  return { connectionString: required('MIGRATION_DATABASE_URL'), ssl: sslOption() };
}

export function platformDbPassword(): string {
  return required('PLATFORM_DB_PASSWORD');
}

export function appDbPassword(): string {
  return required('APP_DB_PASSWORD');
}
