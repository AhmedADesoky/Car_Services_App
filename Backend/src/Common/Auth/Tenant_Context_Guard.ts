import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Api_Error } from '../Errors/Problem_Json_Filter';
import { tenantStore } from '../Tenant_Context/Tenant_Store';

export interface Access_Claims {
  sub: string;   // user id
  tid: string;   // tenant id - the ONLY source of the tenant
  dev: string;   // device id
  roles: string[];
  perm_v: number;
}

/**
 * Verifies the Bearer JWT and stores the tenant in AsyncLocalStorage for the rest of the request.
 * Any tenant id in the URL, body or headers is ignored (spec section 3.1).
 */
@Injectable()
export class Tenant_Context_Guard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    tenantStore.enterWith({
      tenantId: claims.tid,
      userId: claims.sub,
      deviceId: claims.dev,
      roles: claims.roles ?? [],
      permVersion: claims.perm_v ?? 0,
    });
    return true;
  }
}
