import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PoolClient } from 'pg';
import { Platform_Db } from './Platform_Db';

export interface Platform_Audit_Entry {
  actorId: string | null;
  actorEmail: string | null;
  action: string;          // e.g. station.create
  targetType: string;      // station | request | staff | role | plan | session
  targetId?: string | null;
  tenantId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}

/** Deterministic JSON (sorted keys) so the hash can be recomputed exactly when verifying. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((k) => `${JSON.stringify(k)}:${canonical(object[k])}`).join(',')}}`;
}

export function auditHash(prevHash: string, seq: number, entry: Platform_Audit_Entry, at: string): string {
  const body = canonical({
    seq, actorId: entry.actorId, action: entry.action, targetType: entry.targetType, targetId: entry.targetId ?? null,
    tenantId: entry.tenantId ?? null, details: entry.details ?? {}, at,
  });
  return createHash('sha256').update(prevHash + body).digest('hex');
}

/** Append-only, hash-chained company audit log. Call it INSIDE the business transaction. */
@Injectable()
export class Platform_Audit {
  constructor(private readonly db: Platform_Db) {}

  async record(tx: PoolClient, entry: Platform_Audit_Entry): Promise<void> {
    const { rows } = await tx.query<{ last_seq: string; last_hash: string }>(
      `SELECT last_seq, last_hash FROM app.platform_audit_head WHERE id = 1 FOR UPDATE`,
    );
    const seq = Number(rows[0].last_seq) + 1;
    const at = new Date().toISOString();
    const hash = auditHash(rows[0].last_hash, seq, entry, at);
    await tx.query(
      `INSERT INTO app.platform_audit_logs (seq, actor_id, actor_email, action, target_type, target_id, tenant_id, details, ip, at, prev_hash, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [seq, entry.actorId, entry.actorEmail, entry.action, entry.targetType, entry.targetId ?? null, entry.tenantId ?? null,
        JSON.stringify(entry.details ?? {}), entry.ip ?? null, at, rows[0].last_hash, hash],
    );
    await tx.query(`UPDATE app.platform_audit_head SET last_seq = $1, last_hash = $2 WHERE id = 1`, [seq, hash]);
  }

  /** Recomputes the whole chain. Returns the first broken seq, or null when intact. */
  async verify(): Promise<{ checked: number; brokenAt: number | null }> {
    const rows = await this.db.query<{
      seq: string; actor_id: string | null; action: string; target_type: string; target_id: string | null;
      tenant_id: string | null; details: Record<string, unknown>; at: Date; prev_hash: string; hash: string;
    }>(`SELECT seq, actor_id, action, target_type, target_id, tenant_id, details, at, prev_hash, hash
          FROM app.platform_audit_logs ORDER BY seq`);
    let prev = 'GENESIS';
    for (const row of rows) {
      const expected = auditHash(prev, Number(row.seq), {
        actorId: row.actor_id, actorEmail: null, action: row.action, targetType: row.target_type,
        targetId: row.target_id, tenantId: row.tenant_id, details: row.details,
      }, new Date(row.at).toISOString());
      if (row.prev_hash !== prev || row.hash !== expected) return { checked: rows.length, brokenAt: Number(row.seq) };
      prev = row.hash;
    }
    return { checked: rows.length, brokenAt: null };
  }
}
