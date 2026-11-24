import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { sendMessage } from '../../Common/Messaging/Messaging';
import { ROLE_PERMS } from '../../Common/Rbac/Default_Roles';
import { Platform_Audit } from '../Common/Platform_Audit';
import { PLATFORM_CONFIG, Platform_Config } from '../Common/Platform_Config';
import { currentActor } from '../Common/Platform_Context';
import { sha256Hex } from '../Common/Platform_Crypto';
import { Platform_Db } from '../Common/Platform_Db';

export interface Create_Station_Input {
  stationCode: string;
  legalName: string;
  displayName: string;
  taxRegNo?: string;
  country: string;
  currency: string;
  timeZone: string;
  defaultLocale: 'ar' | 'en';
  planCode: 'basic' | 'pro' | 'enterprise';
  status: 'trial' | 'active';
  contact: { name: string; phone: string; email?: string };
  owner: { fullName: string; username: string; phone: string };
  requestId?: string;
}

@Injectable()
export class Stations_Service {
  private readonly logger = new Logger('Stations');

  constructor(
    private readonly db: Platform_Db,
    private readonly audit: Platform_Audit,
    @Inject(PLATFORM_CONFIG) private readonly config: Platform_Config,
  ) {}

  async list(filters: { status?: string; plan?: string; q?: string }) {
    return this.db.query(
      `SELECT t.id, t.station_code, t.display_name, t.legal_name, t.status::text AS status, p.code AS plan, t.country, t.currency,
              t.created_at, coalesce(c.active_users, 0) AS active_users, coalesce(c.invited_users, 0) AS invited_users,
              coalesce(c.devices, 0) AS devices, coalesce(u.plate_scans, 0) AS plate_scans_month
         FROM app.tenants t
         JOIN app.plans p ON p.id = t.plan_id
         LEFT JOIN app.platform_tenant_counts() c ON c.tenant_id = t.id
         LEFT JOIN app.tenant_usage u ON u.tenant_id = t.id AND u.period = date_trunc('month', now())::date
        WHERE t.status <> 'deleted'
          AND ($1::text IS NULL OR t.status::text = $1)
          AND ($2::text IS NULL OR p.code = $2)
          AND ($3::text IS NULL OR t.display_name ILIKE '%' || $3 || '%' OR t.station_code ILIKE '%' || $3 || '%')
        ORDER BY t.created_at DESC LIMIT 200`,
      [filters.status ?? null, filters.plan ?? null, filters.q ?? null]);
  }

  async get(id: string) {
    const [station] = await this.db.query(
      `SELECT t.*, t.status::text AS status, p.code AS plan_code, p.name AS plan_name, p.limits AS plan_limits
         FROM app.tenants t JOIN app.plans p ON p.id = t.plan_id WHERE t.id = $1`, [id]);
    if (!station) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Station not found');
    const [counts] = await this.db.query(`SELECT * FROM app.platform_tenant_counts() WHERE tenant_id = $1`, [id]);
    const invitation = await this.db.tx(async (tx) => {
      await this.db.enterTenant(tx, id);
      const { rows } = await tx.query(
        `SELECT i.created_at, i.expires_at, i.used_at, i.revoked_at, u.username, u.display_name, u.status::text AS owner_status
           FROM app.owner_invitations i JOIN app.users u ON u.id = i.user_id ORDER BY i.created_at DESC LIMIT 1`);
      return rows[0] ?? null;
    });
    // Business data (customers, orders, money) is intentionally NOT available to the company.
    delete (station as Record<string, unknown>).kms_key_ref;
    delete (station as Record<string, unknown>).db_route;
    return { station, counts: counts ?? null, ownerInvitation: invitation };
  }

  /** Creates a station and everything it needs, in ONE transaction, then sends the owner invitation. */
  async create(input: Create_Station_Input) {
    const actor = currentActor();
    const result = await this.db.tx(async (tx) => {
      const [plan] = (await tx.query<{ id: string }>(`SELECT id FROM app.plans WHERE code = $1 AND is_active`, [input.planCode])).rows;
      if (!plan) throw new Api_Error(HttpStatus.UNPROCESSABLE_ENTITY, 'PLAN_NOT_FOUND', 'Unknown plan');
      const exists = await tx.query(`SELECT 1 FROM app.tenants WHERE station_code = $1`, [input.stationCode]);
      if (exists.rowCount) throw new Api_Error(HttpStatus.CONFLICT, 'STATION_CODE_TAKEN', 'This station code is already used');

      if (input.requestId) {
        const request = await tx.query(`SELECT status::text AS status FROM app.station_requests WHERE id = $1 FOR UPDATE`, [input.requestId]);
        if (!request.rowCount) throw new Api_Error(HttpStatus.NOT_FOUND, 'REQUEST_NOT_FOUND', 'Request not found');
        if (!['new', 'in_review'].includes(request.rows[0].status)) {
          throw new Api_Error(HttpStatus.CONFLICT, 'REQUEST_ALREADY_DECIDED', 'This request was already approved or rejected');
        }
      }

      const { rows: [tenant] } = await tx.query<{ id: string }>(
        `INSERT INTO app.tenants (station_code, legal_name, display_name, tax_reg_no, country, currency, time_zone, default_locale,
                                  plan_id, status, contact_name, contact_phone, contact_email, source_request_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [input.stationCode, input.legalName, input.displayName, input.taxRegNo ?? null, input.country, input.currency, input.timeZone,
          input.defaultLocale, plan.id, input.status, input.contact.name, input.contact.phone, input.contact.email ?? null, input.requestId ?? null]);
      await tx.query(`UPDATE app.tenants SET storage_prefix = $2 WHERE id = $1`, [tenant.id, `tenants/${tenant.id}/`]);
      // TODO(Crypto_Service, Ahmed A. P1): create the station's encryption key here (tenant_keys).

      // ---- inside the new station (RLS context) ----
      await this.db.enterTenant(tx, tenant.id);
      const roleIds: Record<string, string> = {};
      for (const [roleName, permissions] of Object.entries(ROLE_PERMS)) {
        const { rows: [role] } = await tx.query<{ id: string }>(
          `INSERT INTO app.roles (tenant_id, name, is_system) VALUES ($1,$2,true) RETURNING id`, [tenant.id, roleName]);
        roleIds[roleName] = role.id;
        // One statement per role (not one per permission): far fewer round trips to the database.
        await tx.query(
          `INSERT INTO app.role_permissions (tenant_id, role_id, permission_code) SELECT $1, $2, unnest($3::text[])`,
          [tenant.id, role.id, permissions]);
      }
      // Owner gets an unusable random password: nobody (including the company) ever knows it.
      const unusable = await argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id });
      const { rows: [owner] } = await tx.query<{ id: string }>(
        `INSERT INTO app.users (tenant_id, username, display_name, password_hash, status, must_change_password, locale)
         VALUES ($1,$2,$3,$4,'invited',false,$5) RETURNING id`,
        [tenant.id, input.owner.username, input.owner.fullName, unusable, input.defaultLocale]);
      await tx.query(`INSERT INTO app.user_roles (tenant_id, user_id, role_id) VALUES ($1,$2,$3)`, [tenant.id, owner.id, roleIds.owner]);
      const invitation = await this.newInvitation(tx, tenant.id, owner.id, actor.id);
      await this.db.leaveTenant(tx);
      // ---- back to company context ----

      if (input.requestId) {
        await tx.query(
          `UPDATE app.station_requests SET status = 'approved', reviewed_by = $2, reviewed_at = now(), tenant_id = $3 WHERE id = $1`,
          [input.requestId, actor.id, tenant.id]);
      }
      await this.audit.record(tx, {
        actorId: actor.id, actorEmail: actor.email, action: 'station.create', targetType: 'station', targetId: tenant.id,
        tenantId: tenant.id, details: { stationCode: input.stationCode, plan: input.planCode, requestId: input.requestId ?? null }, ip: actor.ip,
      });
      return { tenantId: tenant.id, ownerUsername: input.owner.username, invitation };
    });

    await this.deliverInvitation(input.owner.phone, input.displayName, result.ownerUsername, result.invitation.link);
    return {
      stationId: result.tenantId, stationCode: input.stationCode, ownerUsername: result.ownerUsername,
      invitationExpiresAt: result.invitation.expiresAt,
      // Development only, so a developer can finish the flow without SMS. Never returned in production.
      devActivationLink: this.config.NODE_ENV === 'production' ? undefined : result.invitation.link,
    };
  }

  async update(id: string, patch: { displayName?: string; legalName?: string; taxRegNo?: string | null; planCode?: string;
    contact?: { name?: string; phone?: string; email?: string | null } }) {
    const actor = currentActor();
    return this.db.tx(async (tx) => {
      const before = (await tx.query(`SELECT display_name, legal_name, tax_reg_no, plan_id FROM app.tenants WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!before) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Station not found');
      let planId: string | null = null;
      if (patch.planCode) {
        const plan = (await tx.query<{ id: string }>(`SELECT id FROM app.plans WHERE code = $1 AND is_active`, [patch.planCode])).rows[0];
        if (!plan) throw new Api_Error(HttpStatus.UNPROCESSABLE_ENTITY, 'PLAN_NOT_FOUND', 'Unknown plan');
        planId = plan.id;
      }
      await tx.query(
        `UPDATE app.tenants SET display_name = coalesce($2, display_name), legal_name = coalesce($3, legal_name),
                tax_reg_no = CASE WHEN $4::boolean THEN $5 ELSE tax_reg_no END, plan_id = coalesce($6, plan_id),
                contact_name = coalesce($7, contact_name), contact_phone = coalesce($8, contact_phone),
                contact_email = CASE WHEN $9::boolean THEN $10 ELSE contact_email END
          WHERE id = $1`,
        [id, patch.displayName ?? null, patch.legalName ?? null, patch.taxRegNo !== undefined, patch.taxRegNo ?? null, planId,
          patch.contact?.name ?? null, patch.contact?.phone ?? null, patch.contact?.email !== undefined, patch.contact?.email ?? null]);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'station.update', targetType: 'station',
        targetId: id, tenantId: id, details: { changed: Object.keys(patch), planCode: patch.planCode ?? null }, ip: actor.ip });
      return { ok: true };
    });
  }

  async setStatus(id: string, status: 'active' | 'suspended' | 'pending_deletion', reason: string) {
    const actor = currentActor();
    return this.db.tx(async (tx) => {
      const current = (await tx.query<{ status: string }>(`SELECT status::text AS status FROM app.tenants WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!current) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Station not found');
      const allowed: Record<string, string[]> = {
        trial: ['active', 'suspended', 'pending_deletion'], active: ['suspended', 'pending_deletion'],
        suspended: ['active', 'pending_deletion'], pending_deletion: ['active'],
      };
      if (!(allowed[current.status] ?? []).includes(status)) {
        throw new Api_Error(HttpStatus.CONFLICT, 'INVALID_STATUS_CHANGE', `Cannot change ${current.status} to ${status}`);
      }
      await tx.query(
        `UPDATE app.tenants SET status = $2::app.tenant_status,
                deletion_scheduled_at = CASE WHEN $2 = 'pending_deletion' THEN now() + interval '30 days' ELSE NULL END
          WHERE id = $1`, [id, status]);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: `station.${status}`, targetType: 'station',
        targetId: id, tenantId: id, details: { from: current.status, reason }, ip: actor.ip });
      return { status };
    });
  }

  async resendInvitation(id: string, phone: string) {
    const actor = currentActor();
    const result = await this.db.tx(async (tx) => {
      const station = (await tx.query<{ display_name: string }>(`SELECT display_name FROM app.tenants WHERE id = $1`, [id])).rows[0];
      if (!station) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Station not found');
      await this.db.enterTenant(tx, id);
      const owner = (await tx.query<{ id: string; username: string; status: string }>(
        `SELECT u.id, u.username, u.status::text AS status FROM app.owner_invitations i JOIN app.users u ON u.id = i.user_id
          ORDER BY i.created_at DESC LIMIT 1`)).rows[0];
      if (!owner) throw new Api_Error(HttpStatus.NOT_FOUND, 'NO_OWNER_INVITATION', 'No owner invitation exists');
      if (owner.status !== 'invited') throw new Api_Error(HttpStatus.CONFLICT, 'OWNER_ALREADY_ACTIVE', 'The owner already activated the account');
      await tx.query(`UPDATE app.owner_invitations SET revoked_at = now() WHERE used_at IS NULL AND revoked_at IS NULL`);
      const invitation = await this.newInvitation(tx, id, owner.id, actor.id);
      await this.db.leaveTenant(tx);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'station.owner_invitation_resent',
        targetType: 'station', targetId: id, tenantId: id, ip: actor.ip });
      return { invitation, username: owner.username, stationName: station.display_name };
    });
    await this.deliverInvitation(phone, result.stationName, result.username, result.invitation.link);
    return {
      invitationExpiresAt: result.invitation.expiresAt,
      devActivationLink: this.config.NODE_ENV === 'production' ? undefined : result.invitation.link,
    };
  }

  // Token = base64url(tenantId) + "." + 32 random bytes. Only the SHA-256 is stored; single use; 48 h.
  private async newInvitation(tx: PoolClient, tenantId: string, userId: string, actorId: string) {
    const token = `${Buffer.from(tenantId).toString('base64url')}.${randomBytes(32).toString('base64url')}`;
    const { rows: [row] } = await tx.query<{ expires_at: Date }>(
      `INSERT INTO app.owner_invitations (tenant_id, user_id, token_hash, expires_at, created_by_platform_user)
       VALUES ($1,$2,$3, now() + make_interval(hours => $4), $5) RETURNING expires_at`,
      [tenantId, userId, sha256Hex(token), this.config.OWNER_INVITE_TTL_HOURS, actorId]);
    return { link: `${this.config.PUBLIC_SITE_URL.replace(/\/$/, '')}/activate?token=${token}`, expiresAt: row.expires_at };
  }

  private async deliverInvitation(phone: string, stationName: string, username: string, link: string) {
    try {
      await sendMessage({ channel: 'sms', to: phone, template: 'owner_invitation',
        text: `${stationName}: your owner account "${username}" is ready. Activate within 48 hours: ${link}` });
    } catch (error) {
      // The station exists; staff can press "Resend invitation".
      this.logger.error(`Invitation delivery failed: ${(error as Error).message}`);
    }
  }
}
