import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { PLATFORM_ANY_USER, PLATFORM_PUBLIC, PLATFORM_REQUIRES, PLATFORM_SCOPES } from './Platform_Decorators';
import { Platform_Scope, setPlatformActor } from './Platform_Context';
import { Platform_Db } from './Platform_Db';
import { PLATFORM_AUDIENCE, PLATFORM_CONFIG, PLATFORM_ISSUER, Platform_Config } from './Platform_Config';

export interface Platform_Claims {
  sub: string;
  scp: Platform_Scope;
  pv: number;
}

/**
 * DEFAULT DENY for the whole Admin API:
 *  - @Platform_Public            -> open
 *  - otherwise a valid platform JWT (HS256, audience "platform", platform secret) is required,
 *    the user must be active, perm_version must match, the token scope must be allowed,
 *  - and the route must declare @Platform_Requires(...) or @Platform_Any_User(), else it is refused.
 * Station tokens are signed with another secret + audience, so they can never pass this guard.
 */
@Injectable()
export class Platform_Access_Guard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: Platform_Db,
    @Inject('PLATFORM_JWT') private readonly jwt: JwtService,
    @Inject(PLATFORM_CONFIG) private readonly config: Platform_Config,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PLATFORM_PUBLIC, targets)) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PLATFORM_REQUIRES, targets);
    const anyUser = this.reflector.getAllAndOverride<boolean>(PLATFORM_ANY_USER, targets);
    const scopes = this.reflector.getAllAndOverride<Platform_Scope[]>(PLATFORM_SCOPES, targets) ?? ['full'];
    if (!required && !anyUser) {
      throw new Api_Error(
        this.config.NODE_ENV === 'production' ? HttpStatus.FORBIDDEN : HttpStatus.INTERNAL_SERVER_ERROR,
        'ROUTE_NOT_CLASSIFIED', 'Route has no access rule',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_MISSING', 'Sign in required');

    let claims: Platform_Claims;
    try {
      claims = await this.jwt.verifyAsync<Platform_Claims>(token, {
        secret: this.config.PLATFORM_JWT_SECRET, algorithms: ['HS256'], issuer: PLATFORM_ISSUER, audience: PLATFORM_AUDIENCE,
      });
    } catch {
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Session expired, sign in again');
    }
    if (!scopes.includes(claims.scp)) throw new Api_Error(HttpStatus.FORBIDDEN, 'SCOPE_NOT_ALLOWED', 'Finish sign-in first');

    const [user] = await this.db.query<{ id: string; email: string; full_name: string; status: string; perm_version: number }>(
      `SELECT id, email, full_name, status::text AS status, perm_version FROM app.platform_users WHERE id = $1`, [claims.sub],
    );
    const statusOk = user && (user.status === 'active' || (claims.scp !== 'full' && user.status === 'invited'));
    if (!user || !statusOk) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'USER_INACTIVE', 'Account is not active');
    if (user.perm_version !== claims.pv) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_STALE', 'Session changed, sign in again');

    const rows = await this.db.query<{ code: string }>(
      `SELECT DISTINCT rp.permission_code AS code FROM app.platform_user_roles ur
         JOIN app.platform_role_permissions rp ON rp.role_id = ur.role_id WHERE ur.user_id = $1`, [user.id],
    );
    const permissions = new Set(claims.scp === 'full' ? rows.map((r) => r.code) : []);
    for (const code of required ?? []) {
      if (!permissions.has(code)) throw new Api_Error(HttpStatus.FORBIDDEN, 'PERMISSION_DENIED', `Missing permission ${code}`);
    }

    setPlatformActor({ id: user.id, email: user.email, fullName: user.full_name, scope: claims.scp, permissions, ip: request.ip ?? '' });
    return true;
  }
}
