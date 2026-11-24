import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { APP_CONFIG, App_Config } from '../Config/App_Config';
import { currentTenant } from '../Tenant_Context/Tenant_Store';
import { dbSslOptions } from './Db_Ssl';

/** Retries ONLY acquiring a connection (no SQL sent yet, so nothing can run twice). Supavisor can briefly refuse under load. */
export async function connectWithRetry(pool: Pool, attempts = 3): Promise<PoolClient> {
  for (let i = 1; ; i++) {
    try {
      return await pool.connect();
    } catch (error) {
      if (i >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * i));
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The ONLY way the API talks to Postgres.
 * Connects as app_rw (NOBYPASSRLS) through the Supabase transaction pooler.
 * Every tenant query runs inside BEGIN ... SET LOCAL app.tenant_id ... COMMIT, so RLS
 * filters rows even if a query forgets a WHERE tenant_id = ... (spec section 3.2).
 */
@Injectable()
export class Db_Client implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) config: App_Config) {
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: config.DB_POOL_MAX,
      ssl: dbSslOptions(),
      // Supavisor transaction mode: no session state survives between transactions.
      idleTimeoutMillis: 30_000,
    });
  }

  /** Run fn in a transaction bound to an explicit tenant (used by login / bind before a JWT exists). */
  async withTenant<T>(tenantId: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    if (!UUID_RE.test(tenantId)) throw new Error('Invalid tenant id');
    const client = await connectWithRetry(this.pool);
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Run fn in the tenant of the current request (from the JWT). */
  inCurrentTenant<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return this.withTenant(currentTenant().tenantId, fn);
  }

  /** Platform-level read (no tenant) - only platform tables such as app.tenants / app.plans are readable. */
  async platformQuery<R extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<R[]> {
    const result = await this.pool.query<R>(sql, params);
    return result.rows;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
