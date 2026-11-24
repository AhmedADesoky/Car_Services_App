import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';

export type Platform_Scope = 'full' | 'setup' | 'mfa';

export interface Platform_Actor {
  id: string;
  email: string;
  fullName: string;
  scope: Platform_Scope;
  permissions: ReadonlySet<string>;
  ip: string;
}

const store = new AsyncLocalStorage<{ actor?: Platform_Actor }>();

export function platformContextMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  store.run({}, () => next());
}

export function setPlatformActor(actor: Platform_Actor): void {
  const holder = store.getStore();
  if (!holder) throw new Error('platformContextMiddleware is not installed');
  holder.actor = Object.freeze(actor);
}

export function currentActor(): Platform_Actor {
  const actor = store.getStore()?.actor;
  if (!actor) throw new Error('No platform actor: route is missing authentication');
  return actor;
}
