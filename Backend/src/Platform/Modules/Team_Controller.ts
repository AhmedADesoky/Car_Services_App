import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PoolClient } from 'pg';
import { z } from 'zod';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { parseBody } from '../../Common/Validation/Zod_Body';
import { Platform_Audit } from '../Common/Platform_Audit';
import { currentActor, Platform_Actor } from '../Common/Platform_Context';
import { temporaryPassword } from '../Common/Platform_Crypto';
import { Platform_Requires } from '../Common/Platform_Decorators';
import { Platform_Db } from '../Common/Platform_Db';

const Create_Schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  fullName: z.string().trim().min(2).max(120),
  departmentId: z.string().uuid().nullable().optional(),
  roleIds: z.array(z.string().uuid()).min(1).max(10),
}).strict();
const Update_Schema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  roleIds: z.array(z.string().uuid()).min(1).max(10).optional(),
}).strict();
const Reset_Schema = z.object({ resetMfa: z.boolean().default(false) });

/** Company staff accounts (who can sign in to the Admin Console). */
@Controller('team')
export class Team_Controller {
  constructor(private readonly db: Platform_Db, private readonly audit: Platform_Audit) {}

  @Get() @Platform_Requires('team.view')
  list() {
    return this.db.query(
      `SELECT u.id, u.email, u.full_name, u.status::text AS status, u.mfa_enabled, u.last_login_at, u.created_at,
              d.id AS department_id, d.name AS department,
              coalesce(json_agg(json_build_object('id', r.id, 'name', r.name) ORDER BY r.name) FILTER (WHERE r.id IS NOT NULL), '[]') AS roles
         FROM app.platform_users u
         LEFT JOIN app.platform_departments d ON d.id = u.department_id
         LEFT JOIN app.platform_user_roles ur ON ur.user_id = u.id
         LEFT JOIN app.platform_roles r ON r.id = ur.role_id
        GROUP BY u.id, d.id ORDER BY u.created_at`);
  }

  /** The temporary password is returned ONCE to the creator, who hands it over in person. Change + 2FA are forced at first sign-in. */
  @Post() @Platform_Requires('team.manage')
  async create(@Body() body: unknown) {
    const input = parseBody(Create_Schema, body);
    const actor = currentActor();
    const password = temporaryPassword();
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    return this.db.tx(async (tx) => {
      await this.assertCanGrant(tx, actor, input.roleIds);
      const exists = await tx.query(`SELECT 1 FROM app.platform_users WHERE email = $1`, [input.email]);
      if (exists.rowCount) throw new Api_Error(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'A staff account with this email exists');
      const { rows: [user] } = await tx.query<{ id: string }>(
        `INSERT INTO app.platform_users (email, full_name, password_hash, status, department_id, must_change_password, created_by)
         VALUES ($1,$2,$3,'invited',$4,true,$5) RETURNING id`, [input.email, input.fullName, hash, input.departmentId ?? null, actor.id]);
      for (const roleId of input.roleIds) {
        await tx.query(`INSERT INTO app.platform_user_roles (user_id, role_id) VALUES ($1,$2)`, [user.id, roleId]);
      }
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'staff.create', targetType: 'staff',
        targetId: user.id, details: { email: input.email, roleIds: input.roleIds }, ip: actor.ip });
      return { id: user.id, email: input.email, temporaryPassword: password };
    });
  }

  @Patch(':id') @Platform_Requires('team.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseBody(Update_Schema, body);
    const actor = currentActor();
    return this.db.tx(async (tx) => {
      await this.mustExist(tx, id);
      if (input.roleIds) {
        await this.assertCanGrant(tx, actor, input.roleIds);
        await this.assertNotRemovingLastSuperAdmin(tx, id, input.roleIds);
        if (id === actor.id) throw new Api_Error(HttpStatus.CONFLICT, 'CANNOT_CHANGE_OWN_ROLES', 'Ask another administrator to change your roles');
        await tx.query(`DELETE FROM app.platform_user_roles WHERE user_id = $1`, [id]);
        for (const roleId of input.roleIds) await tx.query(`INSERT INTO app.platform_user_roles (user_id, role_id) VALUES ($1,$2)`, [id, roleId]);
      }
      await tx.query(
        `UPDATE app.platform_users SET full_name = coalesce($2, full_name),
                department_id = CASE WHEN $3::boolean THEN $4 ELSE department_id END,
                perm_version = perm_version + CASE WHEN $5::boolean THEN 1 ELSE 0 END WHERE id = $1`,
        [id, input.fullName ?? null, input.departmentId !== undefined, input.departmentId ?? null, !!input.roleIds]);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'staff.update', targetType: 'staff',
        targetId: id, details: { changed: Object.keys(input), roleIds: input.roleIds ?? null }, ip: actor.ip });
      return { ok: true };
    });
  }

  @Post(':id/suspend') @HttpCode(200) @Platform_Requires('team.manage')
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    const actor = currentActor();
    return this.db.tx(async (tx) => {
      await this.mustExist(tx, id);
      if (id === actor.id) throw new Api_Error(HttpStatus.CONFLICT, 'CANNOT_SUSPEND_SELF', 'You cannot suspend your own account');
      await this.assertNotRemovingLastSuperAdmin(tx, id, []);
      await tx.query(`UPDATE app.platform_users SET status = 'suspended', perm_version = perm_version + 1 WHERE id = $1`, [id]);
      await tx.query(`UPDATE app.platform_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'staff.suspend', targetType: 'staff', targetId: id, ip: actor.ip });
      return { status: 'suspended' };
    });
  }

  @Post(':id/reactivate') @HttpCode(200) @Platform_Requires('team.manage')
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    const actor = currentActor();
    return this.db.tx(async (tx) => {
      const user = await this.mustExist(tx, id);
      const next = user.mfa_enabled ? 'active' : 'invited';
      await tx.query(`UPDATE app.platform_users SET status = $2::app.platform_user_status WHERE id = $1`, [id, next]);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'staff.reactivate', targetType: 'staff', targetId: id, ip: actor.ip });
      return { status: next };
    });
  }

  @Post(':id/reset-password') @HttpCode(200) @Platform_Requires('team.manage')
  async resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseBody(Reset_Schema, body ?? {});
    const actor = currentActor();
    if (id === actor.id) throw new Api_Error(HttpStatus.CONFLICT, 'USE_CHANGE_PASSWORD', 'Use "change password" for your own account');
    const password = temporaryPassword();
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    return this.db.tx(async (tx) => {
      await this.mustExist(tx, id);
      await tx.query(
        `UPDATE app.platform_users SET password_hash = $2, must_change_password = true, perm_version = perm_version + 1,
                mfa_enabled = CASE WHEN $3 THEN false ELSE mfa_enabled END, mfa_secret = CASE WHEN $3 THEN NULL ELSE mfa_secret END,
                status = CASE WHEN $3 THEN 'invited'::app.platform_user_status ELSE status END
          WHERE id = $1`, [id, hash, input.resetMfa]);
      await tx.query(`UPDATE app.platform_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'staff.reset_password', targetType: 'staff',
        targetId: id, details: { resetMfa: input.resetMfa }, ip: actor.ip });
      return { temporaryPassword: password };
    });
  }

  private async mustExist(tx: PoolClient, id: string) {
    const user = (await tx.query<{ id: string; mfa_enabled: boolean }>(`SELECT id, mfa_enabled FROM app.platform_users WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!user) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff account not found');
    return user;
  }

  /** No privilege escalation: you can only give roles whose permissions you already have. */
  private async assertCanGrant(tx: PoolClient, actor: Platform_Actor, roleIds: string[]) {
    const { rows } = await tx.query<{ role_id: string; code: string | null }>(
      `SELECT r.id AS role_id, rp.permission_code AS code FROM app.platform_roles r
         LEFT JOIN app.platform_role_permissions rp ON rp.role_id = r.id WHERE r.id = ANY($1::uuid[])`, [roleIds]);
    const found = new Set(rows.map((r) => r.role_id));
    if (roleIds.some((id) => !found.has(id))) throw new Api_Error(HttpStatus.UNPROCESSABLE_ENTITY, 'ROLE_NOT_FOUND', 'Unknown role');
    const missing = rows.filter((r) => r.code && !actor.permissions.has(r.code)).map((r) => r.code);
    if (missing.length) throw new Api_Error(HttpStatus.FORBIDDEN, 'CANNOT_GRANT', 'You cannot give permissions you do not have', missing);
  }

  /** The company must always keep at least one active Super Admin with 2FA. */
  private async assertNotRemovingLastSuperAdmin(tx: PoolClient, userId: string, newRoleIds: string[]) {
    const { rows: [sa] } = await tx.query<{ id: string }>(`SELECT id FROM app.platform_roles WHERE name = 'Super Admin'`);
    if (!sa || newRoleIds.includes(sa.id)) return;
    const { rows: [count] } = await tx.query<{ others: number; target_is_sa: boolean }>(
      `SELECT count(*) FILTER (WHERE u.id <> $1)::int AS others, bool_or(u.id = $1) AS target_is_sa
         FROM app.platform_user_roles ur JOIN app.platform_users u ON u.id = ur.user_id
        WHERE ur.role_id = $2 AND u.status = 'active' AND u.mfa_enabled`, [userId, sa.id]);
    if (count.target_is_sa && count.others === 0) {
      throw new Api_Error(HttpStatus.CONFLICT, 'LAST_SUPER_ADMIN', 'At least one active Super Admin must remain');
    }
  }
}
