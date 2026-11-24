import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { checkPassword } from '../../Common/Security/Password_Policy';
import { newTotpSecret, otpauthUri, verifyTotp } from '../../Common/Security/Totp';
import { Platform_Audit } from '../Common/Platform_Audit';
import { Platform_Claims } from '../Common/Platform_Access_Guard';
import { PLATFORM_AUDIENCE, PLATFORM_CONFIG, PLATFORM_ISSUER, Platform_Config, STAFF_PASSWORD_MIN } from '../Common/Platform_Config';
import { Platform_Actor, Platform_Scope } from '../Common/Platform_Context';
import { Platform_Crypto, sha256Hex } from '../Common/Platform_Crypto';
import { Platform_Db } from '../Common/Platform_Db';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
export const ISSUER_NAME = 'GarageOS Admin';

interface Staff_Row {
  id: string; email: string; full_name: string; password_hash: string; status: string; must_change_password: boolean;
  mfa_enabled: boolean; mfa_secret: Buffer | null; mfa_last_step: string | null; perm_version: number;
}

export type Login_Result =
  | { next: 'setup'; setupToken: string; mustChangePassword: boolean; mfaEnabled: boolean }
  | { next: 'mfa'; mfaToken: string }
  | { next: 'done'; accessToken: string; refreshToken: string; expiresIn: number };

@Injectable()
export class Platform_Auth_Service {
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'), { type: argon2.argon2id });

  constructor(
    private readonly db: Platform_Db,
    private readonly crypto: Platform_Crypto,
    private readonly audit: Platform_Audit,
    @Inject('PLATFORM_JWT') private readonly jwt: JwtService,
    @Inject(PLATFORM_CONFIG) private readonly config: Platform_Config,
  ) {}

  // ------------------------------------------------------------------ step 1: password
  async login(email: string, password: string, ip: string): Promise<Login_Result> {
    await this.assertNotLocked(email);
    const [user] = await this.db.query<Staff_Row>(`SELECT * FROM app.platform_users WHERE email = $1`, [email]);
    const ok = user
      ? await argon2.verify(user.password_hash, password)
      : await argon2.verify(await this.dummyHash, password).then(() => false);
    if (!user || !ok || !['active', 'invited'].includes(user.status)) {
      await this.recordAttempt(email, false, !user ? 'unknown_user' : !ok ? 'bad_password' : user.status, ip);
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    await this.recordAttempt(email, true, 'password_ok', ip);
    if (user.must_change_password || !user.mfa_enabled) {
      return { next: 'setup', setupToken: await this.sign(user, 'setup', 15 * 60), mustChangePassword: user.must_change_password, mfaEnabled: user.mfa_enabled };
    }
    return { next: 'mfa', mfaToken: await this.sign(user, 'mfa', 5 * 60) };
  }

  // ------------------------------------------------------------------ step 2: TOTP
  async verifyMfa(actor: Platform_Actor, code: string, userAgent: string): Promise<Login_Result> {
    const user = await this.staff(actor.id);
    await this.assertNotLocked(user.email);
    if (!user.mfa_enabled || !user.mfa_secret) throw new Api_Error(HttpStatus.CONFLICT, 'MFA_NOT_ENABLED', 'Set up 2FA first');
    const step = verifyTotp(this.crypto.decrypt(user.mfa_secret, `mfa:${user.id}`), code);
    if (step === null || (user.mfa_last_step && step <= Number(user.mfa_last_step))) {
      await this.recordAttempt(user.email, false, 'bad_totp', actor.ip);
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'INVALID_CODE', 'The code is wrong or already used');
    }
    await this.recordAttempt(user.email, true, 'mfa_ok', actor.ip);
    return this.db.tx(async (tx) => {
      await tx.query(`UPDATE app.platform_users SET mfa_last_step = $2, last_login_at = now() WHERE id = $1`, [user.id, step]);
      await this.audit.record(tx, { actorId: user.id, actorEmail: user.email, action: 'session.login', targetType: 'session', ip: actor.ip });
      return this.issue(tx, user, actor.ip, userAgent, randomUUID());
    });
  }

  // ------------------------------------------------------------------ setup: password change
  async changePassword(actor: Platform_Actor, currentPassword: string, newPassword: string, userAgent: string): Promise<Login_Result> {
    const user = await this.staff(actor.id);
    if (!(await argon2.verify(user.password_hash, currentPassword))) {
      await this.recordAttempt(user.email, false, 'bad_password_change', actor.ip);
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }
    const problems = checkPassword(newPassword, { minLength: STAFF_PASSWORD_MIN, username: user.email });
    if (newPassword === currentPassword) problems.push('TOO_COMMON');
    if (problems.length) throw new Api_Error(HttpStatus.UNPROCESSABLE_ENTITY, 'PASSWORD_POLICY', 'Password does not meet the policy', problems);
    const hash = await argon2.hash(newPassword, { type: argon2.argon2id });

    return this.db.tx(async (tx) => {
      const { rows } = await tx.query<Staff_Row>(
        `UPDATE app.platform_users SET password_hash = $2, must_change_password = false, perm_version = perm_version + 1
          WHERE id = $1 RETURNING *`, [user.id, hash]);
      await tx.query(`UPDATE app.platform_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [user.id]);
      await this.audit.record(tx, { actorId: user.id, actorEmail: user.email, action: 'staff.password_change', targetType: 'staff', targetId: user.id, ip: actor.ip });
      const updated = rows[0];
      if (!updated.mfa_enabled) {
        return { next: 'setup', setupToken: await this.sign(updated, 'setup', 15 * 60), mustChangePassword: false, mfaEnabled: false } as Login_Result;
      }
      // 2FA already on: the new password alone is not enough, ask for the code again
      return { next: 'mfa', mfaToken: await this.sign(updated, 'mfa', 5 * 60) } as Login_Result;
    });
  }

  // ------------------------------------------------------------------ setup: 2FA
  async startMfaSetup(actor: Platform_Actor): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.staff(actor.id);
    if (user.mfa_enabled) throw new Api_Error(HttpStatus.CONFLICT, 'MFA_ALREADY_ENABLED', '2FA is already enabled');
    if (user.must_change_password) throw new Api_Error(HttpStatus.CONFLICT, 'PASSWORD_CHANGE_REQUIRED', 'Change your password first');
    const secret = newTotpSecret();
    await this.db.query(`UPDATE app.platform_users SET mfa_secret = $2 WHERE id = $1`, [user.id, this.crypto.encrypt(secret, `mfa:${user.id}`)]);
    return { secret, otpauthUri: otpauthUri(ISSUER_NAME, user.email, secret) };
  }

  async enableMfa(actor: Platform_Actor, code: string, userAgent: string): Promise<Login_Result> {
    const user = await this.staff(actor.id);
    if (user.mfa_enabled) throw new Api_Error(HttpStatus.CONFLICT, 'MFA_ALREADY_ENABLED', '2FA is already enabled');
    if (user.must_change_password) throw new Api_Error(HttpStatus.CONFLICT, 'PASSWORD_CHANGE_REQUIRED', 'Change your password first');
    if (!user.mfa_secret) throw new Api_Error(HttpStatus.CONFLICT, 'MFA_SETUP_NOT_STARTED', 'Start 2FA setup first');
    const step = verifyTotp(this.crypto.decrypt(user.mfa_secret, `mfa:${user.id}`), code);
    if (step === null) {
      await this.recordAttempt(user.email, false, 'bad_totp_setup', actor.ip);
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'INVALID_CODE', 'The code is wrong, check the time on your phone');
    }
    await this.recordAttempt(user.email, true, 'mfa_ok', actor.ip);
    return this.db.tx(async (tx) => {
      const { rows } = await tx.query<Staff_Row>(
        `UPDATE app.platform_users SET mfa_enabled = true, mfa_last_step = $2, status = 'active', last_login_at = now(),
                perm_version = perm_version + 1 WHERE id = $1 RETURNING *`, [user.id, step]);
      await this.audit.record(tx, { actorId: user.id, actorEmail: user.email, action: 'staff.mfa_enabled', targetType: 'staff', targetId: user.id, ip: actor.ip });
      return this.issue(tx, rows[0], actor.ip, userAgent, randomUUID());
    });
  }

  // ------------------------------------------------------------------ sessions
  async refresh(refreshToken: string, ip: string, userAgent: string): Promise<Login_Result> {
    const hash = sha256Hex(refreshToken);
    return this.db.tx(async (tx) => {
      const { rows } = await tx.query<{ id: string; user_id: string; family_id: string; expires_at: Date; rotated_at: Date | null; revoked_at: Date | null }>(
        `SELECT id, user_id, family_id, expires_at, rotated_at, revoked_at FROM app.platform_refresh_tokens WHERE token_hash = $1 FOR UPDATE`, [hash]);
      const row = rows[0];
      if (!row) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Session expired, sign in again');
      if (row.rotated_at || row.revoked_at) {
        await tx.query(`UPDATE app.platform_refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`, [row.family_id]);
        return { reused: true } as never;
      }
      if (row.expires_at < new Date()) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_EXPIRED', 'Session expired, sign in again');
      const user = (await tx.query<Staff_Row>(`SELECT * FROM app.platform_users WHERE id = $1`, [row.user_id])).rows[0];
      if (!user || user.status !== 'active' || !user.mfa_enabled) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'USER_INACTIVE', 'Account is not active');
      await tx.query(`UPDATE app.platform_refresh_tokens SET rotated_at = now() WHERE id = $1`, [row.id]);
      return this.issue(tx, user, ip, userAgent, row.family_id);
    }).then((result) => {
      if ((result as unknown as { reused?: boolean }).reused) {
        throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_REUSED', 'Session revoked, sign in again');
      }
      return result;
    });
  }

  async logout(refreshToken: string | undefined, actor: Platform_Actor): Promise<void> {
    if (refreshToken) {
      await this.db.query(
        `UPDATE app.platform_refresh_tokens SET revoked_at = now()
          WHERE family_id = (SELECT family_id FROM app.platform_refresh_tokens WHERE token_hash = $1 AND user_id = $2) AND revoked_at IS NULL`,
        [sha256Hex(refreshToken), actor.id]);
    }
  }

  async me(actor: Platform_Actor) {
    const [row] = await this.db.query<{ id: string; email: string; full_name: string; department: string | null; roles: string[]; last_login_at: Date | null }>(
      `SELECT u.id, u.email, u.full_name, d.name AS department, u.last_login_at,
              coalesce(array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
         FROM app.platform_users u
         LEFT JOIN app.platform_departments d ON d.id = u.department_id
         LEFT JOIN app.platform_user_roles ur ON ur.user_id = u.id
         LEFT JOIN app.platform_roles r ON r.id = ur.role_id
        WHERE u.id = $1 GROUP BY u.id, d.name`, [actor.id]);
    return { id: row.id, email: row.email, fullName: row.full_name, department: row.department, roles: row.roles,
      permissions: [...actor.permissions].sort(), lastLoginAt: row.last_login_at };
  }

  // ------------------------------------------------------------------ helpers
  private async staff(id: string): Promise<Staff_Row> {
    const [user] = await this.db.query<Staff_Row>(`SELECT * FROM app.platform_users WHERE id = $1`, [id]);
    if (!user) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'USER_INACTIVE', 'Account is not active');
    return user;
  }

  private async assertNotLocked(email: string): Promise<void> {
    const [row] = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM app.platform_login_attempts
        WHERE email = $1 AND success = false AND at > now() - make_interval(mins => $2)
          AND at > coalesce((SELECT max(at) FROM app.platform_login_attempts WHERE email = $1 AND success AND reason <> 'password_ok'), '-infinity')`,
      [email, LOCK_MINUTES]);
    if (row.n >= MAX_FAILED) throw new Api_Error(HttpStatus.LOCKED, 'ACCOUNT_LOCKED', `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`);
  }

  private async recordAttempt(email: string, success: boolean, reason: string, ip: string): Promise<void> {
    await this.db.query(`INSERT INTO app.platform_login_attempts (email, success, reason, ip) VALUES ($1,$2,$3,$4)`, [email, success, reason, ip]);
  }

  private sign(user: Staff_Row, scope: Platform_Scope, ttlSeconds: number): Promise<string> {
    const claims: Platform_Claims = { sub: user.id, scp: scope, pv: user.perm_version };
    return this.jwt.signAsync(claims, {
      secret: this.config.PLATFORM_JWT_SECRET, algorithm: 'HS256', issuer: PLATFORM_ISSUER, audience: PLATFORM_AUDIENCE, expiresIn: ttlSeconds,
    });
  }

  private async issue(tx: PoolClient, user: Staff_Row, ip: string, userAgent: string, familyId: string): Promise<Login_Result> {
    const accessToken = await this.sign(user, 'full', this.config.PLATFORM_ACCESS_TTL_SECONDS);
    const refreshToken = randomBytes(32).toString('base64url');
    await tx.query(
      `INSERT INTO app.platform_refresh_tokens (user_id, family_id, token_hash, expires_at, ip, user_agent)
       VALUES ($1,$2,$3, now() + make_interval(hours => $4), $5, $6)`,
      [user.id, familyId, sha256Hex(refreshToken), this.config.PLATFORM_REFRESH_TTL_HOURS, ip, userAgent.slice(0, 200)]);
    return { next: 'done', accessToken, refreshToken, expiresIn: this.config.PLATFORM_ACCESS_TTL_SECONDS };
  }
}
