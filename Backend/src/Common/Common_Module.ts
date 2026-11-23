import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, loadConfig } from './Config/App_Config';
import { Db_Client } from './Database/Db_Client';
import { Tenant_Context_Guard } from './Auth/Tenant_Context_Guard';

const config = loadConfig();

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: config.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: config.JWT_ACCESS_TTL_SECONDS, issuer: 'car-services-api' },
      verifyOptions: { issuer: 'car-services-api' },
    }),
  ],
  providers: [{ provide: APP_CONFIG, useValue: config }, Db_Client, Tenant_Context_Guard],
  exports: [APP_CONFIG, Db_Client, Tenant_Context_Guard, JwtModule],
})
export class Common_Module {}
