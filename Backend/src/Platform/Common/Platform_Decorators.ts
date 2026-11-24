import { SetMetadata } from '@nestjs/common';
import { Platform_Scope } from './Platform_Context';

export const PLATFORM_PUBLIC = 'platform:public';
export const PLATFORM_REQUIRES = 'platform:requires';
export const PLATFORM_ANY_USER = 'platform:any-user';
export const PLATFORM_SCOPES = 'platform:scopes';

/** No login needed (login, refresh). Use sparingly. */
export const Platform_Public = () => SetMetadata(PLATFORM_PUBLIC, true);

/** Every listed company permission is required, e.g. @Platform_Requires('stations.create'). */
export const Platform_Requires = (...permissions: string[]) => SetMetadata(PLATFORM_REQUIRES, permissions);

/** Any signed-in staff member (own profile, logout). */
export const Platform_Any_User = () => SetMetadata(PLATFORM_ANY_USER, true);

/** Which token scopes may call the route (default: only 'full'). */
export const Platform_Scopes = (...scopes: Platform_Scope[]) => SetMetadata(PLATFORM_SCOPES, scopes);
