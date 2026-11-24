import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { PoolClient } from 'pg';
import { z } from 'zod';
import { Requires } from '../../Common/Auth/Access_Decorators';
import { Db_Client } from '../../Common/Database/Db_Client';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { currentTenant } from '../../Common/Tenant_Context/Tenant_Store';
import { parseBody } from '../../Common/Validation/Zod_Body';
import { Auth_Service } from '../Auth/Auth_Service';

const Code = z.string().regex(/^[a-z_]+(\.[a-z_]+)+$/).max(60);
const Role_Create_Schema = z.object({
  name: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N} _-]+$/u),
  description: z.string().trim().max(200).optional(),
  permissions: z.array(Code).min(1).max(100),
}).strict();
const Role_Permissions_Schema = z.object({ permissions: z.array(Code).min(1).max(100) }).strict();
const User_Roles_Schema = z.object({ roleIds: z.array(z.string().uuid()).min(1).max(5) }).strict();

interface Role_Row { id: string; name: string; is_system: boolean; description: string | null; permissions: string[]; users: number }

/**
 * Roles & permissions (screens 21 and S12) + account controls owners use on other people.
 * Anti-escalation rule: you can only grant permissions you hold yourself.
 * TODO(#4): write every change to the station audit log once Audit_Service exists.
 */
@Controller()
export class Access_Controller {
  constructor(private readonly db: Db_Client, private readonly auth: Auth_Service) {}

  /** GET /v1/permissions - the catalogue of permission codes. */
  @Get('permissions') @Requires('roles.manage')
  permissions() {
    return this.db.inCurrentTenant(async (db) =>
      (await db.query<{ code: string; description: string }>(`SELECT code, description FROM app.permissions ORDER BY code`)).rows);
  }

  /** GET /v1/roles - roles with their permissions and how many people hold them. */
  @Get('roles') @Requires('roles.manage')
  roles() {
    return this.db.inCurrentTenant((db) => this.listRoles(db));
  }

  /** POST /v1/roles - custom role (plan must include custom roles). */
  @Post('roles') @Requires('roles.manage')
  create(@Body() body: unknown) {
    const input = parseBody(Role_Create_Schema, body);
    const ctx = currentTenant();
    return this.db.inCurrentTenant(async (db) => {
      await this.assertCustomRolesAllowed(db, ctx.tenantId);
      await this.assertGrantable(db, input.permissions);
      const exists = await db.query(`SELECT 1 FROM app.roles WHERE lower(name) = lower($1)`, [input.name]);
      if (exists.rowCount) throw new Api_Error(HttpStatus.CONFLICT, 'ROLE_EXISTS', 'A role with this name already exists');
      const { rows: [role] } = await db.query<{ id: string }>(
        `INSERT INTO app.roles (tenant_id, name, is_system, description) VALUES ($1,$2,false,$3) RETURNING id`,
        [ctx.tenantId, input.name, input.description ?? null]);
      await db.query(`INSERT INTO app.role_permissions (tenant_id, role_id, permission_code) SELECT $1, $2, unnest($3::text[])`,
        [ctx.tenantId, role.id, [...new Set(input.permissions)]]);
      return (await this.listRoles(db, role.id))[0];
    });
  }

  /** PUT /v1/roles/{id}/permissions - replace a role's permissions; holders get new rights at once. */
  @Put('roles/:id/permissions') @Requires('roles.manage')
  setPermissions(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseBody(Role_Permissions_Schema, body);
    const ctx = currentTenant();
    return this.db.inCurrentTenant(async (db) => {
      const role = await this.findRole(db, id);
      if (role.is_system && role.name === 'owner') throw new Api_Error(HttpStatus.FORBIDDEN, 'OWNER_ROLE_LOCKED', 'The owner role always has every permission');
      await this.assertGrantable(db, input.permissions);
      await db.query(`DELETE FROM app.role_permissions WHERE role_id = $1`, [id]);
      await db.query(`INSERT INTO app.role_permissions (tenant_id, role_id, permission_code) SELECT $1, $2, unnest($3::text[])`,
        [ctx.tenantId, id, [...new Set(input.permissions)]]);
      await db.query(`UPDATE app.users SET perm_version = perm_version + 1 WHERE id IN (SELECT user_id FROM app.user_roles WHERE role_id = $1)`, [id]);
      return (await this.listRoles(db, id))[0];
    });
  }

  /** DELETE /v1/roles/{id} - only custom roles that nobody holds. */
  @Delete('roles/:id') @Requires('roles.manage') @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.db.inCurrentTenant(async (db) => {
      const role = await this.findRole(db, id);
      if (role.is_system) throw new Api_Error(HttpStatus.FORBIDDEN, 'SYSTEM_ROLE', 'Built-in roles cannot be deleted');
      if (role.users > 0) throw new Api_Error(HttpStatus.CONFLICT, 'ROLE_IN_USE', 'Move the people in this role to another role first');
      await db.query(`DELETE FROM app.roles WHERE id = $1`, [id]);
    });
  }

  /** PUT /v1/users/{id}/roles - set a person's roles. The station always keeps at least one owner. */
  @Put('users/:id/roles') @Requires('roles.manage')
  setUserRoles(@Param('id', ParseUUIDPipe) userId: string, @Body() body: unknown) {
    const input = parseBody(User_Roles_Schema, body);
    const ctx = currentTenant();
    return this.db.inCurrentTenant(async (db) => {
      const user = await db.query(`SELECT 1 FROM app.users WHERE id = $1`, [userId]);
      if (!user.rowCount) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');   // other stations are invisible (RLS)
      const roleIds = [...new Set(input.roleIds)];
      const roles = await db.query<{ id: string; name: string; is_system: boolean; permissions: string[] }>(
        `SELECT r.id, r.name, r.is_system, ARRAY(SELECT permission_code FROM app.role_permissions rp WHERE rp.role_id = r.id) AS permissions
           FROM app.roles r WHERE r.id = ANY($1::uuid[])`, [roleIds]);
      if (roles.rowCount !== roleIds.length) throw new Api_Error(HttpStatus.UNPROCESSABLE_ENTITY, 'ROLE_UNKNOWN', 'One of the roles does not exist');
      const isOwnerRole = (r: { name: string; is_system: boolean }) => r.is_system && r.name === 'owner';
      if (roles.rows.some(isOwnerRole) && !ctx.roles.includes('owner')) throw new Api_Error(HttpStatus.FORBIDDEN, 'OWNER_ONLY', 'Only an owner can make someone an owner');
      await this.assertGrantable(db, roles.rows.flatMap((r) => r.permissions));

      if (!roles.rows.some(isOwnerRole)) {
        const owners = await db.query<{ n: string }>(
          `SELECT count(DISTINCT ur.user_id) AS n FROM app.user_roles ur JOIN app.roles r ON r.id = ur.role_id
             JOIN app.users u ON u.id = ur.user_id
            WHERE r.is_system AND r.name = 'owner' AND u.status = 'active' AND ur.user_id <> $1`, [userId]);
        const wasOwner = await db.query(`SELECT 1 FROM app.user_roles ur JOIN app.roles r ON r.id = ur.role_id WHERE ur.user_id = $1 AND r.is_system AND r.name = 'owner'`, [userId]);
        if (wasOwner.rowCount && Number(owners.rows[0].n) === 0) throw new Api_Error(HttpStatus.CONFLICT, 'LAST_OWNER', 'The station must keep at least one owner');
      }
      await db.query(`DELETE FROM app.user_roles WHERE user_id = $1`, [userId]);
      await db.query(`INSERT INTO app.user_roles (tenant_id, user_id, role_id) SELECT $1, $2, unnest($3::uuid[])`, [ctx.tenantId, userId, roleIds]);
      await db.query(`UPDATE app.users SET perm_version = perm_version + 1 WHERE id = $1`, [userId]);
      return { userId, roles: roles.rows.map((r) => r.name).sort() };
    });
  }

  /** POST /v1/users/{id}/sign-out - end every session of another person (lost phone, suspicion). */
  @Post('users/:id/sign-out') @Requires('workers.update') @HttpCode(200)
  signOutUser(@Param('id', ParseUUIDPipe) userId: string) {
    const ctx = currentTenant();
    return this.db.inCurrentTenant(async (db) => {
      const target = await db.query<{ is_owner: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM app.user_roles ur JOIN app.roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.is_system AND r.name = 'owner') AS is_owner
           FROM app.users u WHERE u.id = $1`, [userId]);
      if (!target.rowCount) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
      if (target.rows[0].is_owner && !ctx.roles.includes('owner')) throw new Api_Error(HttpStatus.FORBIDDEN, 'OWNER_ONLY', 'Only an owner can sign out an owner');
      await this.auth.endAllSessions(db, userId);
      return { signedOut: true };
    });
  }

  /* ---------------------------------------------------------------------------------- helpers */

  private async listRoles(db: PoolClient, id?: string): Promise<Array<Omit<Role_Row, 'is_system'> & { isSystem: boolean }>> {
    const { rows } = await db.query<Role_Row>(
      `SELECT r.id, r.name, r.is_system, r.description,
              ARRAY(SELECT rp.permission_code FROM app.role_permissions rp WHERE rp.role_id = r.id ORDER BY 1) AS permissions,
              (SELECT count(*)::int FROM app.user_roles ur WHERE ur.role_id = r.id) AS users
         FROM app.roles r ${id ? 'WHERE r.id = $1' : ''} ORDER BY r.is_system DESC, r.name`, id ? [id] : []);
    return rows.map(({ is_system, ...rest }) => ({ ...rest, isSystem: is_system }));
  }

  private async findRole(db: PoolClient, id: string): Promise<Role_Row> {
    const { rows } = await db.query<Role_Row>(
      `SELECT r.id, r.name, r.is_system, r.description, '{}'::text[] AS permissions,
              (SELECT count(*)::int FROM app.user_roles ur WHERE ur.role_id = r.id) AS users
         FROM app.roles r WHERE r.id = $1`, [id]);
    if (!rows[0]) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Role not found');
    return rows[0];
  }

  /** Every code must exist, and the caller must hold it (no privilege escalation through roles). */
  private async assertGrantable(db: PoolClient, codes: string[]) {
    const unique = [...new Set(codes)];
    const known = await db.query<{ code: string }>(`SELECT code FROM app.permissions WHERE code = ANY($1::text[])`, [unique]);
    if (known.rowCount !== unique.length) throw new Api_Error(HttpStatus.UNPROCESSABLE_ENTITY, 'PERMISSION_UNKNOWN', 'Unknown permission code');
    const held = new Set(currentTenant().permissions);
    if (unique.some((c) => !held.has(c))) throw new Api_Error(HttpStatus.FORBIDDEN, 'CANNOT_GRANT', 'You can only give permissions that you have yourself');
  }

  private async assertCustomRolesAllowed(db: PoolClient, tenantId: string) {
    const { rows } = await db.query<{ code: string; custom_roles: boolean | null }>(
      `SELECT p.code, (p.limits->>'custom_roles')::boolean AS custom_roles FROM app.tenants t JOIN app.plans p ON p.id = t.plan_id WHERE t.id = $1`, [tenantId]);
    const plan = rows[0];
    const allowed = plan?.custom_roles ?? (plan ? plan.code !== 'basic' : false);
    if (!allowed) throw new Api_Error(HttpStatus.PAYMENT_REQUIRED, 'PLAN_LIMIT', 'Custom roles are part of the Pro and Enterprise plans');
  }
}
