import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { PoolClient } from 'pg';
import { z } from 'zod';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { parseBody } from '../../Common/Validation/Zod_Body';
import { Platform_Audit } from '../Common/Platform_Audit';
import { currentActor } from '../Common/Platform_Context';
import { Platform_Requires } from '../Common/Platform_Decorators';
import { Platform_Db } from '../Common/Platform_Db';

const Role_Schema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.string().max(60)).max(50),
}).strict();
const Perms_Schema = z.object({ permissions: z.array(z.string().max(60)).max(50) }).strict();
const Department_Schema = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).optional() }).strict();

/** Company RBAC: departments, roles and their permissions. */
@Controller()
export class Roles_Controller {
  constructor(private readonly db: Platform_Db, private readonly audit: Platform_Audit) {}

  @Get('permissions') @Platform_Requires('team.view')
  permissions() {
    return this.db.query(`SELECT code, category, description FROM app.platform_permissions ORDER BY category, code`);
  }

  @Get('departments') @Platform_Requires('team.view')
  departments() {
    return this.db.query(
      `SELECT d.id, d.name, d.description, count(u.id)::int AS members FROM app.platform_departments d
         LEFT JOIN app.platform_users u ON u.department_id = d.id AND u.status <> 'deactivated' GROUP BY d.id ORDER BY d.name`);
  }

  @Post('departments') @Platform_Requires('team.manage')
  createDepartment(@Body() body: unknown) {
    const input = parseBody(Department_Schema, body);
    const actor = currentActor();
    return this.db.tx(async (tx) => {
      const { rows: [d] } = await tx.query<{ id: string }>(
        `INSERT INTO app.platform_departments (name, description) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING RETURNING id`,
        [input.name, input.description ?? null]);
      if (!d) throw new Api_Error(HttpStatus.CONFLICT, 'DEPARTMENT_EXISTS', 'Department already exists');
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'department.create', targetType: 'department', targetId: d.id, ip: actor.ip });
      return d;
    });
  }

  @Get('roles') @Platform_Requires('team.view')
  roles() {
    return this.db.query(
      `SELECT r.id, r.name, r.description, r.is_system,
              coalesce(array_agg(DISTINCT rp.permission_code) FILTER (WHERE rp.permission_code IS NOT NULL), '{}') AS permissions,
              (SELECT count(*)::int FROM app.platform_user_roles ur WHERE ur.role_id = r.id) AS members
         FROM app.platform_roles r LEFT JOIN app.platform_role_permissions rp ON rp.role_id = r.id
        GROUP BY r.id ORDER BY r.is_system DESC, r.name`);
  }

  @Post('roles') @Platform_Requires('roles.manage')
  createRole(@Body() body: unknown) {
    const input = parseBody(Role_Schema, body);
    const actor = currentActor();
    return this.db.tx(async (tx) => {
      await this.assertGrantable(tx, input.permissions);
      const { rows: [role] } = await tx.query<{ id: string }>(
        `INSERT INTO app.platform_roles (name, description) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING RETURNING id`,
        [input.name, input.description ?? null]);
      if (!role) throw new Api_Error(HttpStatus.CONFLICT, 'ROLE_EXISTS', 'A role with this name exists');
      for (const code of input.permissions) {
        await tx.query(`INSERT INTO app.platform_role_permissions (role_id, permission_code) VALUES ($1,$2)`, [role.id, code]);
      }
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'role.create', targetType: 'role',
        targetId: role.id, details: { name: input.name, permissions: input.permissions }, ip: actor.ip });
      return role;
    });
  }

  @Put('roles/:id/permissions') @Platform_Requires('roles.manage')
  setPermissions(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseBody(Perms_Schema, body);
    const actor = currentActor();
    return this.db.tx(async (tx) => {
      const role = (await tx.query<{ name: string }>(`SELECT name FROM app.platform_roles WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!role) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Role not found');
      if (role.name === 'Super Admin') throw new Api_Error(HttpStatus.CONFLICT, 'ROLE_LOCKED', 'Super Admin always has every permission');
      await this.assertGrantable(tx, input.permissions);
      const before = (await tx.query<{ code: string }>(`SELECT permission_code AS code FROM app.platform_role_permissions WHERE role_id = $1`, [id])).rows.map((r) => r.code);
      await tx.query(`DELETE FROM app.platform_role_permissions WHERE role_id = $1`, [id]);
      for (const code of input.permissions) {
        await tx.query(`INSERT INTO app.platform_role_permissions (role_id, permission_code) VALUES ($1,$2)`, [id, code]);
      }
      // Everyone with this role gets new permissions immediately (their old tokens stop working).
      await tx.query(`UPDATE app.platform_users SET perm_version = perm_version + 1
                       WHERE id IN (SELECT user_id FROM app.platform_user_roles WHERE role_id = $1)`, [id]);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'role.update', targetType: 'role',
        targetId: id, details: { before, after: input.permissions }, ip: actor.ip });
      return { ok: true };
    });
  }

  @Delete('roles/:id') @HttpCode(204) @Platform_Requires('roles.manage')
  async deleteRole(@Param('id', ParseUUIDPipe) id: string) {
    const actor = currentActor();
    await this.db.tx(async (tx) => {
      const role = (await tx.query<{ is_system: boolean }>(`SELECT is_system FROM app.platform_roles WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!role) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Role not found');
      if (role.is_system) throw new Api_Error(HttpStatus.CONFLICT, 'ROLE_LOCKED', 'System roles cannot be deleted');
      const members = await tx.query(`SELECT 1 FROM app.platform_user_roles WHERE role_id = $1 LIMIT 1`, [id]);
      if (members.rowCount) throw new Api_Error(HttpStatus.CONFLICT, 'ROLE_IN_USE', 'Remove the role from all staff first');
      await tx.query(`DELETE FROM app.platform_roles WHERE id = $1`, [id]);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: 'role.delete', targetType: 'role', targetId: id, ip: actor.ip });
    });
  }

  /** Only existing permission codes, and only ones the editor holds (no privilege escalation). */
  private async assertGrantable(tx: PoolClient, codes: string[]) {
    const actor = currentActor();
    const { rows } = await tx.query<{ code: string }>(`SELECT code FROM app.platform_permissions WHERE code = ANY($1::text[])`, [codes]);
    const known = new Set(rows.map((r) => r.code));
    const unknown = codes.filter((c) => !known.has(c));
    if (unknown.length) throw new Api_Error(HttpStatus.UNPROCESSABLE_ENTITY, 'UNKNOWN_PERMISSION', 'Unknown permission', unknown);
    const notHeld = codes.filter((c) => !actor.permissions.has(c));
    if (notHeld.length) throw new Api_Error(HttpStatus.FORBIDDEN, 'CANNOT_GRANT', 'You cannot give permissions you do not have', notHeld);
  }
}
