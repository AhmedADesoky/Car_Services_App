import { Public } from '../../Common/Auth/Access_Decorators';
import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as argon2 from 'argon2';
import { createHash, createHmac, randomUUID } from 'crypto';
import { z } from 'zod';
import { Db_Client } from '../../Common/Database/Db_Client';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { checkPassword } from '../../Common/Security/Password_Policy';
import { parseBody } from '../../Common/Validation/Zod_Body';

const OWNER_PASSWORD_MIN = 10;

/**
 * Own secret for hashing visitor IPs (abuse limits). Never reuse the login-token secret for another purpose:
 * a key that signs tokens must not be exposed to other uses.
 */
function ipHashSecret(): string {
  const secret = process.env.PUBLIC_IP_HASH_SECRET ?? '';
  if (secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('PUBLIC_IP_HASH_SECRET (32+ chars) is required in production');
  return 'development-only-ip-hash-secret-not-for-production';
}

const Request_Schema = z.object({
  planCode: z.enum(['basic', 'pro', 'enterprise']),
  businessName: z.string().trim().min(2).max(120),
  businessNameAr: z.string().trim().max(120).optional(),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().regex(/^\+?[0-9 ]{8,20}$/),
  contactEmail: z.string().trim().email().max(200).optional().or(z.literal('').transform(() => undefined)),
  city: z.string().trim().max(80).optional(),
  branchesCount: z.number().int().min(1).max(500),
  workersCount: z.number().int().min(1).max(5000),
  message: z.string().trim().max(1000).optional(),
  locale: z.enum(['ar', 'en']).default('en'),
  website: z.string().max(0).optional(),   // honeypot: real people never fill this hidden field
}).strict();

const Activate_Schema = z.object({ token: z.string().min(40).max(200), password: z.string().min(1).max(200) }).strict();

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Public website endpoints (no login). Strict rate limits; never reveal whether something exists beyond what the token proves. */
@Controller('public')
@Public()
export class Public_Controller {
  constructor(private readonly db: Db_Client) {}

  /** "Request your station" form. Creates a REQUEST only - a company Super Admin / Sales reviews it. */
  @Post('station-requests') @HttpCode(202) @Throttle({ default: { ttl: 600_000, limit: 3 } })
  async requestStation(@Body() body: unknown, @Ip() ip: string) {
    const input = parseBody(Request_Schema, body);
    if (input.website) return { received: true };   // bot: pretend success, store nothing
    const ipHash = createHmac('sha256', ipHashSecret()).update(ip).digest('hex').slice(0, 32);
    await this.db.platformQuery(
      `INSERT INTO app.station_requests (id, plan_code, business_name, business_name_ar, contact_name, contact_phone, contact_email,
                                         city, branches_count, workers_count, message, locale, source_ip_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [randomUUID(), input.planCode, input.businessName, input.businessNameAr ?? null, input.contactName, input.contactPhone,
        input.contactEmail ?? null, input.city ?? null, input.branchesCount, input.workersCount, input.message ?? null, input.locale, ipHash]);
    return { received: true };
  }

  /** Activation page: shows which station / username the link is for (proves possession of the link only). */
  @Get('invitations/:token') @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async invitation(@Param('token') token: string) {
    const found = await this.findInvitation(token);
    return { stationName: found.station_name, stationCode: found.station_code, username: found.username, displayName: found.display_name,
      expiresAt: found.expires_at, passwordMinLength: OWNER_PASSWORD_MIN };
  }

  /** Owner chooses their own password. Single use. Afterwards they sign in in the mobile app (2FA set-up there). */
  @Post('invitations/activate') @HttpCode(200) @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async activate(@Body() body: unknown) {
    const input = parseBody(Activate_Schema, body);
    const found = await this.findInvitation(input.token);
    const problems = checkPassword(input.password, { minLength: OWNER_PASSWORD_MIN, username: found.username });
    if (problems.length) throw new Api_Error(HttpStatus.UNPROCESSABLE_ENTITY, 'PASSWORD_POLICY', 'Password does not meet the policy', problems);
    const hash = await argon2.hash(input.password, { type: argon2.argon2id });
    await this.db.withTenant(found.tenant_id, async (db) => {
      const used = await db.query(
        `UPDATE app.owner_invitations SET used_at = now() WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`,
        [found.id]);
      if (!used.rowCount) throw new Api_Error(HttpStatus.GONE, 'INVITATION_INVALID', 'This link was already used or expired');
      await db.query(
        `UPDATE app.users SET password_hash = $2, status = 'active', must_change_password = false, perm_version = perm_version + 1
          WHERE id = $1 AND status = 'invited'`, [found.user_id, hash]);
    });
    return { activated: true, stationCode: found.station_code, username: found.username };
  }

  private async findInvitation(token: string) {
    const [tenantPart] = token.split('.');
    let tenantId = '';
    try { tenantId = Buffer.from(tenantPart, 'base64url').toString('utf8'); } catch { /* invalid */ }
    const invalid = new Api_Error(HttpStatus.GONE, 'INVITATION_INVALID', 'This link is invalid, used or expired. Ask for a new one.');
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw invalid;
    const [station] = await this.db.platformQuery<{ display_name: string; station_code: string; status: string }>(
      `SELECT display_name, station_code, status::text AS status FROM app.tenants WHERE id = $1`, [tenantId]).catch(() => []);
    if (!station || !['trial', 'active'].includes(station.status)) throw invalid;
    const row = await this.db.withTenant(tenantId, async (db) => {
      const { rows } = await db.query<{ id: string; user_id: string; expires_at: Date; username: string; display_name: string }>(
        `SELECT i.id, i.user_id, i.expires_at, u.username, u.display_name FROM app.owner_invitations i
           JOIN app.users u ON u.id = i.user_id
          WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now() AND u.status = 'invited'`,
        [sha256(token)]);
      return rows[0];
    });
    if (!row) throw invalid;
    return { ...row, tenant_id: tenantId, station_name: station.display_name, station_code: station.station_code };
  }
}
