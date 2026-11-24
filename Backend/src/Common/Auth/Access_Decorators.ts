import { SetMetadata } from '@nestjs/common';

/**
 * Every station route MUST declare who may call it (default deny). A route with none of these is refused.
 *   @Public()            no token (login, device binding, health, public website)
 *   @Any_User()          any signed-in user of the station
 *   @Requires('a', 'b')  signed-in user holding ALL listed permission codes
 *   @Allow_Setup()       also accept the restricted "finish your account set-up" token (password change, 2FA set-up)
 */
export const ACCESS_PUBLIC = 'access:public';
export const ACCESS_ANY_USER = 'access:any_user';
export const ACCESS_REQUIRES = 'access:requires';
export const ACCESS_ALLOW_SETUP = 'access:allow_setup';

export const Public = () => SetMetadata(ACCESS_PUBLIC, true);
export const Any_User = () => SetMetadata(ACCESS_ANY_USER, true);
export const Requires = (...permissions: string[]) => SetMetadata(ACCESS_REQUIRES, permissions);
export const Allow_Setup = () => SetMetadata(ACCESS_ALLOW_SETUP, true);
