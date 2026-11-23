import { Controller, Get, HttpCode } from '@nestjs/common';
import { Db_Client } from '../../Common/Database/Db_Client';

@Controller('health')
export class Health_Controller {
  constructor(private readonly db: Db_Client) {}

  /** GET /v1/health - used by the apps on start and by uptime checks. */
  @Get()
  @HttpCode(200)
  async health(): Promise<{ status: string; db: string; time: string }> {
    let db = 'up';
    try {
      await this.db.platformQuery('SELECT 1');
    } catch {
      db = 'down';
    }
    return { status: db === 'up' ? 'ok' : 'degraded', db, time: new Date().toISOString() };
  }
}
