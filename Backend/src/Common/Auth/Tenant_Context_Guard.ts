import { CanActivate, ExecutionContext, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Db_Client } from '../Database/Db_Client';
import { Api_Error } from '../Errors/Problem_Json_Filter';
import { setCurrentTenant } from '../Tenant_Context/Tenant_Store';
import { ACCESS_ALLOW_SETUP, ACCESS_ANY_USER, ACCESS_PUBLIC, ACCESS_REQUIRES } from './Access_Decorators';

export interface Access_Claims {
  sub: string;      // user id
  tid: string;      // tenant id - the ONLY source of the tenant
  dev: string;      // device id
  roles: string[];
  perm_v: number;
  typ?: 'access';   // MFA challenge tokens carry typ 'mfa' and are never accepted here
  rst?: 'setup';    // restricted: the account must change its password / set up 2FA first
}

interface Session_Row {
  tenant_status: string;
  user_status: string;
  perm_version: number;
  device_ok: boolean;
  roles: string[];
  permissions: string[];
}

/**
 * Global station guard (registered as APP_GUARD). Default deny:
 * 1. The route must declare @Public, @Any_User or @Requires - otherwise it is refused.
 * 2. Verifies the Bearer JWT (HS256 only, issuer checked, typ must be an access token).
 * 3. Re-checks in the database that the station and user are active, the permission version did not change
 *    (role edits, password change, "sign out everywhere" revoke old tokens at once) and this device is still
 *    signed in for this user (logout on this phone kills its token immediately).
 * 4. Loads the user's CURRENT roles and permission codes from the database (never trusted from the token)
 *    and checks @Requires.
 * 5. Restricted set-up tokens are only accepted on @Allow_Setup routes.
 * TODO(P1): cache the session row in Redis for 30 s (key t:{tid}:sess:{sub}) to save a round trip.
 */
@Injectable()
export class Station_Access_Guard implements CanActivate {
  private readonly logger = new Logger('Access');

  constructor(private readonly jwt: JwtService, private readonly db: Db_Client, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ACCESS_PUBLIC, targets)) return true;
    const required = this.reflector.getAllAndOverride<string[]>(ACCESS_REQUIRES, targets);
    const anyUser = this.reflector.getAllAndOverride<boolean>(ACCESS_ANY_USER, targets);
    if (!required && !anyUser) {
      this.logger.error(`Route ${context.getClass().name}.${context.getHandler().name} declares no access rule - refused`);
      throw new Api_Error(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not allowed');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_MISSING', 'Bearer token required');

    let claims: Access_Claims;
    try {
      claims = await this.jwt.verifyAsync<Access_Claims>(token);
    } catch {
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Token is invalid or expired');
    }
    if (!claims.sub || !claims.tid || !claims.dev || (claims.typ !== undefined && claims.typ !== 'access')) {
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Token is invalid or expired');
    }

    let row: Session_Row | undefined;
    try {
      row = await this.db.withTenant(claims.tid, async (db) => {
        const { rows } = await db.query<Session_Row>(
          `SELECT t.status::text AS tenant_status, u.status::text AS user_status, u.perm_version,
                  EXISTS (SELECT 1 FROM app.devices d WHERE d.id = $2 AND d.revoked_at IS NULL AND d.user_id = u.id) AS device_ok,
                  ARRAY(SELECT r.name FROM app.user_roles ur JOIN app.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
                         WHERE ur.user_id = u.id ORDER BY r.name) AS roles,
                  ARRAY(SELECT DISTINCT rp.permission_code FROM app.user_roles ur
                          JOIN app.role_permissions rp ON rp.tenant_id = ur.tenant_id AND rp.role_id = ur.role_id
                         WHERE ur.user_id = u.id) AS permissions
             FROM app.users u JOIN app.tenants t ON t.id = u.tenant_id
            WHERE u.id = $1`,
          [claims.sub, claims.dev],
        );
        return rows[0];
      });
    } catch {
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Token is invalid or expired');
    }

    if (!row) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Token is invalid or expired');
    if (row.tenant_status !== 'active' && row.tenant_status !== 'trial') {
      throw new Api_Error(HttpStatus.FORBIDDEN, 'STATION_SUSPENDED', 'This station is not active');
    }
    if (row.user_status !== 'active') throw new Api_Error(HttpStatus.UNAUTHORIZED, 'USER_INACTIVE', 'Account is not active');
    if (!row.device_ok) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'SIGNED_OUT', 'You were signed out on this device');
    if (row.perm_version !== claims.perm_v) {
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_STALE', 'Permissions changed, refresh the token');
    }

    const restricted = claims.rst === 'setup';
    if (restricted && !this.reflector.getAllAndOverride<boolean>(ACCESS_ALLOW_SETUP, targets)) {
      throw new Api_Error(HttpStatus.FORBIDDEN, 'SETUP_REQUIRED', 'Finish setting up your account first');
    }
    if (required?.length) {
      const held = new Set(row.permissions);
      const missing = required.filter((p) => !held.has(p));
      if (missing.length) throw new Api_Error(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'You do not have permission for this action');
    }

    setCurrentTenant({
      tenantId: claims.tid,
      userId: claims.sub,
      deviceId: claims.dev,
      roles: row.roles,
      permissions: row.permissions,
      permVersion: claims.perm_v,
      restricted,
    });
    return true;
  }
}
