import { AsyncLocalStorage } from 'async_hooks';

/** Request-scoped identity. The tenant comes ONLY from the verified JWT (spec section 3.1). */
export interface Tenant_Context {
  tenantId: string;
  userId: string;
  deviceId: string;
  roles: string[];
  permVersion: number;
}

export const tenantStore = new AsyncLocalStorage<Tenant_Context>();

export function currentTenant(): Tenant_Context {
  const context = tenantStore.getStore();
  if (!context) {
    throw new Error('No tenant context: route is missing Tenant_Context_Guard');
  }
  return context;
}
