import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Platform_Access_Guard } from './Common/Platform_Access_Guard';
import { Platform_Audit } from './Common/Platform_Audit';
import { loadPlatformConfig, PLATFORM_CONFIG } from './Common/Platform_Config';
import { Platform_Crypto } from './Common/Platform_Crypto';
import { Platform_Db } from './Common/Platform_Db';
import { Overview_Controller } from './Modules/Overview_Controller';
import { Platform_Auth_Controller } from './Modules/Platform_Auth_Controller';
import { Platform_Auth_Service } from './Modules/Platform_Auth_Service';
import { Requests_Controller } from './Modules/Requests_Controller';
import { Roles_Controller } from './Modules/Roles_Controller';
import { Stations_Controller } from './Modules/Stations_Controller';
import { Stations_Service } from './Modules/Stations_Service';
import { Team_Controller } from './Modules/Team_Controller';

/**
 * Admin Console API (company side). A SEPARATE Nest application and process from the station API:
 * own port, own DB role (platform_rw), own JWT secret + audience, IP allowlist, default-deny guard.
 */
@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }])],
  controllers: [
    Platform_Auth_Controller, Overview_Controller, Requests_Controller, Stations_Controller, Team_Controller, Roles_Controller,
  ],
  providers: [
    { provide: PLATFORM_CONFIG, useFactory: loadPlatformConfig },
    { provide: 'PLATFORM_JWT', useValue: new JwtService({}) },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: Platform_Access_Guard },
    Platform_Db, Platform_Crypto, Platform_Audit, Platform_Auth_Service, Stations_Service,
  ],
})
export class Platform_App_Module {}
