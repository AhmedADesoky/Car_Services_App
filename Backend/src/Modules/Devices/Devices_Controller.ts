import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { Db_Client } from '../../Common/Database/Db_Client';
import { parseBody } from '../../Common/Validation/Zod_Body';
import { Station_Lookup } from './Station_Lookup';

const Bind_Schema = z.object({
  stationCode: z.string().min(4).max(12),
  platform: z.enum(['android', 'ios']),
  model: z.string().max(100).optional(),
  osVersion: z.string().max(40).optional(),
  appVersion: z.string().max(40).optional(),
});

@Controller('devices')
export class Devices_Controller {
  constructor(private readonly db: Db_Client, private readonly stations: Station_Lookup) {}

  /** POST /v1/devices/bind - screen S1. Registers this phone to ONE station. */
  @Post('bind')
  @HttpCode(200)
  async bind(@Body() body: unknown) {
    const input = parseBody(Bind_Schema, body);
    const station = await this.stations.findActive(input.stationCode);
    const device = await this.db.withTenant(station.id, async (db) => {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO app.devices (tenant_id, platform, model, os_version, app_version)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [station.id, input.platform, input.model ?? null, input.osVersion ?? null, input.appVersion ?? null],
      );
      return rows[0];
    });
    return {
      deviceId: device.id,
      stationCode: station.station_code,
      stationName: station.display_name,
      defaultLocale: station.default_locale,
    };
  }
}
