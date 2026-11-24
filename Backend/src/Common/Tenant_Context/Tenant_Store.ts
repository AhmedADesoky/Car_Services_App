import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';

/** Request-scoped identity. The tenant comes ONLY from the verified JWT (spec section 3.1). */
export interface Tenant_Context {
  tenantId: string;
  userId: string;
  deviceId: string;
  roles: string[];
  permissions: string[];   // current permission codes, loaded from the database on every request
  permVersion: number;
  restricted: boolean;     // true while the account must still change its password / set up 2FA
}

interface Request_Holder {
  context?: Tenant_Context;
}

export const tenantStore = new AsyncLocalStorage<Request_Holder>();

/**
 * Express middleware: every request runs inside its OWN empty holder (AsyncLocalStorage.run).
 * The guard fills holder.context after verifying the JWT; nothing can leak between requests.
 */
export function tenantStoreMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  tenantStore.run({}, () => next());
}

export function setCurrentTenant(context: Tenant_Context): void {
  const holder = tenantStore.getStore();
  if (!holder) throw new Error('tenantStoreMiddleware is not installed');
  holder.context = Object.freeze({ ...context });
}

export function currentTenant(): Tenant_Context {
  const context = tenantStore.getStore()?.context;
  if (!context) {
    throw new Error('No tenant context: route is @Public (no signed-in user)');
  }
  return context;
}
