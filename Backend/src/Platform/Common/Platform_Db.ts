import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { connectWithRetry } from '../../Common/Database/Db_Client';
import { dbSslOptions } from '../../Common/Database/Db_Ssl';
import { PLATFORM_CONFIG, Platform_Config } from './Platform_Config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Database access for the Admin API. Connects as platform_rw: full access to company tables,
 * INSERT-only provisioning into a station (under that station's RLS context), and NO read access
 * to station business data (customers, orders, payments, attendance...).
 */
@Injectable()
export class Platform_Db implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(PLATFORM_CONFIG) config: Platform_Config) {
    this.pool = new Pool({ connectionString: config.PLATFORM_DATABASE_URL, max: 5, ssl: dbSslOptions(), idleTimeoutMillis: 30_000 });
  }

  async query<R extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<R[]> {
    return (await this.pool.query<R>(sql, params)).rows;
  }

  async tx<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
    const client = await connectWithRetry(this.pool);
    try {
      await client.query('BEGIN');
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

  /** Inside tx(): switch the RLS context to one station (provisioning, invitations). */
  async enterTenant(db: PoolClient, tenantId: string): Promise<void> {
    if (!UUID_RE.test(tenantId)) throw new Error('Invalid tenant id');
    await db.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
  }

  async leaveTenant(db: PoolClient): Promise<void> {
    await db.query(`SELECT set_config('app.tenant_id', '', true)`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
