import { Body, Controller, Get, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Tenant_Context_Guard } from '../../Common/Auth/Tenant_Context_Guard';
import { parseBody } from '../../Common/Validation/Zod_Body';
import { Auth_Service } from './Auth_Service';

const Login_Schema = z.object({
  stationCode: z.string().min(4).max(12),
  deviceId: z.string().uuid(),
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

const Refresh_Schema = z.object({ refreshToken: z.string().min(20) });

@Controller('auth')
export class Auth_Controller {
  constructor(private readonly auth: Auth_Service) {}

  /** POST /v1/auth/login - screen 01. Station code comes from the device binding. */
  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Ip() ip: string) {
    return this.auth.login({ ...parseBody(Login_Schema, body), ip });
  }

  /** POST /v1/auth/refresh - rotate the refresh token, get a new 15-minute access token. */
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: unknown) {
    return this.auth.refresh(parseBody(Refresh_Schema, body).refreshToken);
  }

  /** GET /v1/auth/me - who am I (requires Bearer token). */
  @Get('me')
  @UseGuards(Tenant_Context_Guard)
  me() {
    return this.auth.me();
  }
}
