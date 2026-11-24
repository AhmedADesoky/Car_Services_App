import { readFileSync } from 'fs';
import { ConnectionOptions } from 'tls';

/**
 * TLS settings for Supabase connections.
 * - Set DB_SSL_CA_PATH to the Supabase CA certificate (Dashboard -> Database -> SSL -> Download
 *   certificate) to verify the server certificate. REQUIRED when NODE_ENV=production.
 * - Without it (local development only) the connection is still encrypted but the server
 *   certificate is not verified.
 */
export function dbSslOptions(): ConnectionOptions {
  const caPath = process.env.DB_SSL_CA_PATH;
  if (caPath) {
    return { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DB_SSL_CA_PATH is required in production (verify the Supabase certificate)');
  }
  return { rejectUnauthorized: false };
}
