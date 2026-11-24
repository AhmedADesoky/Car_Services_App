import { Body, Controller, Get, Headers, HttpCode, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { parseBody } from '../../Common/Validation/Zod_Body';
import { currentActor } from '../Common/Platform_Context';
import { Platform_Any_User, Platform_Public, Platform_Scopes } from '../Common/Platform_Decorators';
import { Platform_Auth_Service } from './Platform_Auth_Service';

const Login_Schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });
const Code_Schema = z.object({ code: z.string().regex(/^\d{6}$/) });
const Password_Schema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) });
const Refresh_Schema = z.object({ refreshToken: z.string().min(20).max(200) });
const Logout_Schema = z.object({ refreshToken: z.string().min(20).max(200).optional() });

@Controller('auth')
export class Platform_Auth_Controller {
  constructor(private readonly auth: Platform_Auth_Service) {}

  @Post('login') @HttpCode(200) @Platform_Public() @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() body: unknown, @Ip() ip: string) {
    const input = parseBody(Login_Schema, body);
    return this.auth.login(input.email.toLowerCase(), input.password, ip);
  }

  @Post('mfa/verify') @HttpCode(200) @Platform_Scopes('mfa') @Platform_Any_User() @Throttle({ default: { ttl: 60_000, limit: 10 } })
  verify(@Body() body: unknown, @Headers('user-agent') ua = '') {
    return this.auth.verifyMfa(currentActor(), parseBody(Code_Schema, body).code, ua);
  }

  @Post('password/change') @HttpCode(200) @Platform_Scopes('setup', 'full') @Platform_Any_User() @Throttle({ default: { ttl: 60_000, limit: 5 } })
  changePassword(@Body() body: unknown, @Headers('user-agent') ua = '') {
    const input = parseBody(Password_Schema, body);
    return this.auth.changePassword(currentActor(), input.currentPassword, input.newPassword, ua);
  }

  @Post('mfa/setup') @HttpCode(200) @Platform_Scopes('setup') @Platform_Any_User()
  mfaSetup() {
    return this.auth.startMfaSetup(currentActor());
  }

  @Post('mfa/enable') @HttpCode(200) @Platform_Scopes('setup') @Platform_Any_User() @Throttle({ default: { ttl: 60_000, limit: 10 } })
  mfaEnable(@Body() body: unknown, @Headers('user-agent') ua = '') {
    return this.auth.enableMfa(currentActor(), parseBody(Code_Schema, body).code, ua);
  }

  @Post('refresh') @HttpCode(200) @Platform_Public() @Throttle({ default: { ttl: 60_000, limit: 30 } })
  refresh(@Body() body: unknown, @Ip() ip: string, @Headers('user-agent') ua = '') {
    return this.auth.refresh(parseBody(Refresh_Schema, body).refreshToken, ip, ua);
  }

  @Post('logout') @HttpCode(204) @Platform_Any_User()
  async logout(@Body() body: unknown) {
    await this.auth.logout(parseBody(Logout_Schema, body ?? {}).refreshToken, currentActor());
  }

  @Get('me') @Platform_Any_User()
  me() {
    return this.auth.me(currentActor());
  }
}
