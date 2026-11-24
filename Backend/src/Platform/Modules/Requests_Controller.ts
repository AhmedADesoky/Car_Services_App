import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { parseBody } from '../../Common/Validation/Zod_Body';
import { Platform_Audit } from '../Common/Platform_Audit';
import { currentActor } from '../Common/Platform_Context';
import { Platform_Requires } from '../Common/Platform_Decorators';
import { Platform_Db } from '../Common/Platform_Db';

const Decision_Schema = z.object({ note: z.string().trim().min(3).max(1000) });

/** Station requests from the public website. Approval = POST /stations with requestId (creates the station). */
@Controller('station-requests')
export class Requests_Controller {
  constructor(private readonly db: Platform_Db, private readonly audit: Platform_Audit) {}

  @Get() @Platform_Requires('requests.view')
  list(@Query('status') status?: string) {
    return this.db.query(
      `SELECT r.id, r.status::text AS status, r.plan_code, r.business_name, r.business_name_ar, r.contact_name, r.contact_phone,
              r.contact_email, r.city, r.branches_count, r.workers_count, r.locale, r.created_at, r.reviewed_at,
              u.full_name AS reviewed_by_name, r.tenant_id
         FROM app.station_requests r LEFT JOIN app.platform_users u ON u.id = r.reviewed_by
        WHERE ($1::text IS NULL OR r.status::text = $1)
        ORDER BY r.created_at DESC LIMIT 200`, [status || null]);
  }

  @Get(':id') @Platform_Requires('requests.view')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const [row] = await this.db.query(
      `SELECT r.*, r.status::text AS status, u.full_name AS reviewed_by_name FROM app.station_requests r
         LEFT JOIN app.platform_users u ON u.id = r.reviewed_by WHERE r.id = $1`, [id]);
    if (!row) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Request not found');
    delete (row as Record<string, unknown>).source_ip_hash;
    return row;
  }

  @Post(':id/in-review') @HttpCode(200) @Platform_Requires('requests.review')
  inReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.decide(id, 'in_review', null, ['new']);
  }

  @Post(':id/reject') @HttpCode(200) @Platform_Requires('requests.review')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.decide(id, 'rejected', parseBody(Decision_Schema, body).note, ['new', 'in_review']);
  }

  @Post(':id/spam') @HttpCode(200) @Platform_Requires('requests.review')
  spam(@Param('id', ParseUUIDPipe) id: string) {
    return this.decide(id, 'spam', null, ['new', 'in_review']);
  }

  private decide(id: string, status: string, note: string | null, from: string[]) {
    const actor = currentActor();
    return this.db.tx(async (tx) => {
      const current = (await tx.query<{ status: string }>(`SELECT status::text AS status FROM app.station_requests WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!current) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Request not found');
      if (!from.includes(current.status)) throw new Api_Error(HttpStatus.CONFLICT, 'REQUEST_ALREADY_DECIDED', `Request is ${current.status}`);
      await tx.query(
        `UPDATE app.station_requests SET status = $2::app.station_request_status, review_note = coalesce($3, review_note),
                reviewed_by = $4, reviewed_at = now() WHERE id = $1`, [id, status, note, actor.id]);
      await this.audit.record(tx, { actorId: actor.id, actorEmail: actor.email, action: `request.${status}`, targetType: 'request', targetId: id, ip: actor.ip });
      return { status };
    });
  }
}
