import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../Common/Validation/Zod_Body';
import { Platform_Requires } from '../Common/Platform_Decorators';
import { Platform_Db } from '../Common/Platform_Db';
import { Stations_Service } from './Stations_Service';

const phone = z.string().trim().regex(/^\+?[0-9 ]{8,20}$/, 'phone number');

const Create_Schema = z.object({
  stationCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,12}$/, '4-12 letters or digits'),
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(120),
  taxRegNo: z.string().trim().max(40).optional(),
  country: z.string().length(2).default('EG'),
  currency: z.string().length(3).default('KWD'),
  timeZone: z.string().max(60).default('Asia/Kuwait'),
  defaultLocale: z.enum(['ar', 'en']).default('ar'),
  planCode: z.enum(['basic', 'pro', 'enterprise']),
  status: z.enum(['trial', 'active']).default('trial'),
  contact: z.object({ name: z.string().trim().min(2).max(120), phone, email: z.string().email().max(200).optional() }),
  owner: z.object({
    fullName: z.string().trim().min(2).max(120),
    username: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9._-]{2,31}$/, '3-32 chars, starts with a letter').default('owner'),
    phone,
  }),
  requestId: z.string().uuid().optional(),
}).strict();

const Update_Schema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  legalName: z.string().trim().min(2).max(160).optional(),
  taxRegNo: z.string().trim().max(40).nullable().optional(),
  planCode: z.enum(['basic', 'pro', 'enterprise']).optional(),
  contact: z.object({ name: z.string().trim().min(2).max(120).optional(), phone: phone.optional(), email: z.string().email().nullable().optional() }).optional(),
}).strict();

const Reason_Schema = z.object({ reason: z.string().trim().min(3).max(500) });
const Resend_Schema = z.object({ phone: phone.optional() });

@Controller('stations')
export class Stations_Controller {
  constructor(private readonly stations: Stations_Service, private readonly db: Platform_Db) {}

  @Get() @Platform_Requires('stations.view')
  list(@Query('status') status?: string, @Query('plan') plan?: string, @Query('q') q?: string) {
    return this.stations.list({ status: status || undefined, plan: plan || undefined, q: q?.slice(0, 60) || undefined });
  }

  @Get(':id') @Platform_Requires('stations.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.stations.get(id);
  }

  @Post() @Platform_Requires('stations.create')
  create(@Body() body: unknown) {
    return this.stations.create(parseBody(Create_Schema, body));
  }

  @Patch(':id') @Platform_Requires('stations.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.stations.update(id, parseBody(Update_Schema, body));
  }

  @Post(':id/suspend') @HttpCode(200) @Platform_Requires('stations.suspend')
  suspend(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.stations.setStatus(id, 'suspended', parseBody(Reason_Schema, body).reason);
  }

  @Post(':id/reactivate') @HttpCode(200) @Platform_Requires('stations.suspend')
  reactivate(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.stations.setStatus(id, 'active', parseBody(Reason_Schema, body).reason);
  }

  @Post(':id/schedule-deletion') @HttpCode(200) @Platform_Requires('stations.delete')
  scheduleDeletion(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.stations.setStatus(id, 'pending_deletion', parseBody(Reason_Schema, body).reason);
  }

  @Post(':id/resend-invitation') @HttpCode(200) @Platform_Requires('stations.create')
  async resend(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseBody(Resend_Schema, body ?? {});
    const [station] = await this.db.query<{ contact_phone: string | null }>(`SELECT contact_phone FROM app.tenants WHERE id = $1`, [id]);
    return this.stations.resendInvitation(id, input.phone ?? station?.contact_phone ?? '');
  }
}
