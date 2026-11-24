import { Body, Controller, Get, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { z } from 'zod';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { parseBody } from '../../Common/Validation/Zod_Body';
import { Platform_Audit } from '../Common/Platform_Audit';
import { currentActor } from '../Common/Platform_Context';
import { Platform_Requires } from '../Common/Platform_Decorators';
import { Platform_Db } from '../Common/Platform_Db';

const Plan_Schema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  priceMonthly: z.number().min(0).max(1_000_000).optional(),
  limits: z.object({
    branches: z.number().int().positive().nullable().optional(),
    workers: z.number().int().positive().nullable().optional(),
    plate_scans_month: z.number().int().positive().nullable().optional(),
    fine_tune: z.union([z.boolean(), z.enum(['quarterly', 'monthly'])]).optional(),
    custom_roles: z.boolean().optional(),
    import: z.boolean().optional(),
  }).strict().optional(),
  isActive: z.boolean().optional(),
}).strict();

/** Dashboard (totals only), plans, audit log. No station business data is ever returned here. */
@Controller()
export class Overview_Controller {
  constructor(private readonly db: Platform_Db, private readonly audit: Platform_Audit) {}

  @Get('dashboard') @Platform_Requires('dashboard.view')
  async dashboard() {
    const [byStatus, byPlan, requests, monthly, totals, recentRequests] = await Promise.all([
      this.db.query(`SELECT status::text AS status, count(*)::int AS count FROM app.tenants WHERE status <> 'deleted' GROUP BY status`),
      this.db.query(`SELECT p.code AS plan, count(t.id)::int AS count FROM app.plans p
                       LEFT JOIN app.tenants t ON t.plan_id = p.id AND t.status NOT IN ('deleted') GROUP BY p.code ORDER BY p.code`),
      this.db.query(`SELECT status::text AS status, count(*)::int AS count FROM app.station_requests GROUP BY status`),
      this.db.query(`SELECT to_char(m, 'YYYY-MM') AS month,
                            (SELECT count(*)::int FROM app.tenants t WHERE date_trunc('month', t.created_at) = m) AS stations,
                            (SELECT count(*)::int FROM app.station_requests r WHERE date_trunc('month', r.created_at) = m) AS requests
                       FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
                      ORDER BY m`),
      this.db.query(`SELECT coalesce(sum(active_users), 0)::int AS active_users, coalesce(sum(invited_users), 0)::int AS invited_users,
                            coalesce(sum(devices), 0)::int AS devices FROM app.platform_tenant_counts()`),
      this.db.query(`SELECT id, business_name, plan_code, status::text AS status, created_at FROM app.station_requests
                      ORDER BY created_at DESC LIMIT 5`),
    ]);
    return { stationsByStatus: byStatus, stationsByPlan: byPlan, requestsByStatus: requests, monthly, totals: totals[0], recentRequests };
  }

  @Get('plans') @Platform_Requires('stations.view')
  plans() {
    return this.db.query(
      `SELECT p.code, p.name, p.limits, p.price_monthly, p.currency, p.is_active,
              (SELECT count(*)::int FROM app.tenants t WHERE t.plan_id = p.id AND t.status <> 'deleted') AS stations
         FROM app.plans p ORDER BY p.price_monthly, p.code`);
  }

  @Patch('plans/:code') @Platform_Requires('plans.manage')
  updatePlan(@Param('code') code: string, @Body() body: unknown) {
    const input = parseBody(Plan_Schema, body);
    const actor = currentActor();
    return this.db.tx(async (tx) => {
      const before = (await tx.query(`SELECT name, limits, price_monthly, is_active FROM app.plans WHERE code = $1 FOR UPDATE`, [code])).rows[0];
      if (!before) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Plan not found');
      await tx.query(
        `UPDATE app.plans SET name = coalesce($2, name), price_monthly = coalesce($3, price_monthly),
                limits = CASE WHEN $4::jsonb IS NULL THEN limits ELSE limits || $4::jsonb END, is_active = coalesce($5, is_active)
          WHERE code = $1`,
        [code, input.name ?? null, input.priceMonthly ?? null, input.limits ? JSON.stringify(input.limits) : null, input.isActive ?? null]);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'plan.update', targetType: 'plan',
        targetId: code, details: { before, change: input }, ip: actor.ip });
      return { ok: true };
    });
  }

  @Get('audit-logs') @Platform_Requires('audit.view')
  auditLogs(@Query('before') before?: string, @Query('action') action?: string) {
    const beforeSeq = before && /^\d+$/.test(before) ? before : null;
    return this.db.query(
      `SELECT seq, actor_email, action, target_type, target_id, tenant_id, details, ip, at FROM app.platform_audit_logs
        WHERE ($1::bigint IS NULL OR seq < $1) AND ($2::text IS NULL OR action LIKE $2 || '%')
        ORDER BY seq DESC LIMIT 100`, [beforeSeq, action?.slice(0, 40) || null]);
  }

  @Get('audit-logs/verify') @Platform_Requires('audit.view')
  verifyAudit() {
    return this.audit.verify();
  }
}
