import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_CONFIG, loadConfig } from './Config/App_Config';
import { Db_Client } from './Database/Db_Client';
import { Station_Access_Guard } from './Auth/Tenant_Context_Guard';
import { Secret_Box } from './Security/Secret_Box';

const config = loadConfig();

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: config.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: config.JWT_ACCESS_TTL_SECONDS, issuer: 'car-services-api', algorithm: 'HS256' },
      verifyOptions: { issuer: 'car-services-api', algorithms: ['HS256'] },
    }),
    // Default: 120 requests / minute per IP. Sensitive routes set stricter limits with @Throttle.
    // TODO(P1): Redis storage so limits are shared by all API instances, plus per-tenant quotas.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
  ],
  providers: [
    { provide: APP_CONFIG, useValue: config },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // default-deny access guard for every station route (see Access_Decorators)
    { provide: APP_GUARD, useClass: Station_Access_Guard },
    Db_Client,
    Secret_Box,
  ],
  exports: [APP_CONFIG, Db_Client, Secret_Box, JwtModule],
})
export class Common_Module {}
