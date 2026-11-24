import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { Allow_Setup, Any_User, Public } from '../../Common/Auth/Access_Decorators';
import { parseBody } from '../../Common/Validation/Zod_Body';
import { Auth_Service } from './Auth_Service';

const Login_Schema = z.object({
  stationCode: z.string().min(4).max(12),
  deviceId: z.string().uuid(),
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
}).strict();
const Refresh_Schema = z.object({ refreshToken: z.string().min(20).max(400) }).strict();
const Mfa_Verify_Schema = z.object({ mfaToken: z.string().min(20).max(2000), code: z.string().trim().min(6).max(12) }).strict();
const Password_Schema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) }).strict();
const Mfa_Enable_Schema = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).strict();

@Controller('auth')
export class Auth_Controller {
  constructor(private readonly auth: Auth_Service) {}

  /** POST /v1/auth/login - screen 01. Returns a session, a 2FA challenge, or a restricted "finish set-up" token. */
  @Post('login') @Public() @HttpCode(200) @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() body: unknown, @Ip() ip: string) {
    return this.auth.login({ ...parseBody(Login_Schema, body), ip });
  }

  /** POST /v1/auth/mfa/verify - second step: 6-digit code or a recovery code. */
  @Post('mfa/verify') @Public() @HttpCode(200) @Throttle({ default: { ttl: 60_000, limit: 10 } })
  verifyMfa(@Body() body: unknown, @Ip() ip: string) {
    const input = parseBody(Mfa_Verify_Schema, body);
    return this.auth.verifyMfa(input.mfaToken, input.code, ip);
  }

  /** POST /v1/auth/refresh - rotate the refresh token, get a new 15-minute access token. */
  @Post('refresh') @Public() @HttpCode(200) @Throttle({ default: { ttl: 60_000, limit: 30 } })
  refresh(@Body() body: unknown) {
    return this.auth.refresh(parseBody(Refresh_Schema, body).refreshToken);
  }

  /** GET /v1/auth/me - who am I, my permissions, and what set-up is still needed. */
  @Get('me') @Any_User() @Allow_Setup()
  me() {
    return this.auth.me();
  }

  /** POST /v1/auth/password - change password (screen S2 / first sign-in). Other devices are signed out. */
  @Post('password') @Any_User() @Allow_Setup() @HttpCode(200) @Throttle({ default: { ttl: 60_000, limit: 5 } })
  changePassword(@Body() body: unknown) {
    const input = parseBody(Password_Schema, body);
    return this.auth.changePassword(input.currentPassword, input.newPassword);
  }

  /** POST /v1/auth/mfa/setup - new authenticator secret + otpauth:// link for the QR code. */
  @Post('mfa/setup') @Any_User() @Allow_Setup() @HttpCode(200) @Throttle({ default: { ttl: 60_000, limit: 5 } })
  startMfaSetup() {
    return this.auth.startMfaSetup();
  }

  /** POST /v1/auth/mfa/enable - confirm with the first code; returns recovery codes (shown once) and a full session. */
  @Post('mfa/enable') @Any_User() @Allow_Setup() @HttpCode(200) @Throttle({ default: { ttl: 60_000, limit: 10 } })
  enableMfa(@Body() body: unknown) {
    return this.auth.enableMfa(parseBody(Mfa_Enable_Schema, body).code);
  }

  /** POST /v1/auth/logout - sign out on this phone. */
  @Post('logout') @Any_User() @Allow_Setup() @HttpCode(200)
  logout() {
    return this.auth.logout();
  }

  /** POST /v1/auth/logout-all - sign out on every phone (lost phone). */
  @Post('logout-all') @Any_User() @HttpCode(200)
  logoutEverywhere() {
    return this.auth.logoutEverywhere();
  }

  /** GET /v1/auth/sessions - phones where I am signed in. */
  @Get('sessions') @Any_User()
  sessions() {
    return this.auth.sessions();
  }
}
