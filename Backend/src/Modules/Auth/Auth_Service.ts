import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { Access_Claims } from '../../Common/Auth/Tenant_Context_Guard';
import { APP_CONFIG, App_Config } from '../../Common/Config/App_Config';
import { Db_Client } from '../../Common/Database/Db_Client';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { checkPassword } from '../../Common/Security/Password_Policy';
import { Secret_Box } from '../../Common/Security/Secret_Box';
import { newTotpSecret, otpauthUri, verifyTotp } from '../../Common/Security/Totp';
import { currentTenant } from '../../Common/Tenant_Context/Tenant_Store';
import { Station_Lookup } from '../Devices/Station_Lookup';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const MFA_TOKEN_SECONDS = 300;
/** Roles that see money or manage people must use 2-step verification (AUTH-05). */
export const MFA_REQUIRED_ROLES = ['owner', 'accountant'];
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface User_Row {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  status: string;
  must_change_password: boolean;
  mfa_type: string;
  locale: string;
  perm_version: number;
}

interface Mfa_Claims { sub: string; tid: string; dev: string; typ: 'mfa' }

export interface Login_Input {
  stationCode: string;
  deviceId: string;
  username: string;
  password: string;
  ip?: string;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const USER_COLUMNS = 'id, username, display_name, password_hash, status::text AS status, must_change_password, mfa_type, locale, perm_version';

@Injectable()
export class Auth_Service {
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'), { type: argon2.argon2id });

  constructor(
    private readonly db: Db_Client,
    private readonly stations: Station_Lookup,
    private readonly jwt: JwtService,
    private readonly box: Secret_Box,
    @Inject(APP_CONFIG) private readonly config: App_Config,
  ) {}

  /* ================================================================================== sign in */

  /**
   * Three possible outcomes:
   *  - 2FA is on              -> { mfaRequired, mfaToken }        then POST /auth/mfa/verify
   *  - set-up still needed    -> { setup: {password, mfa}, accessToken (restricted, no refresh token) }
   *  - otherwise              -> full session (access + refresh)
   */
  async login(input: Login_Input) {
    const station = await this.stations.findActive(input.stationCode);

    return this.db.withTenant(station.id, async (db) => {
      await this.assertDeviceBound(db, input.deviceId);
      await this.assertNotLocked(db, input.username);

      const { rows } = await db.query<User_Row>(`SELECT ${USER_COLUMNS} FROM app.users WHERE username = $1`, [input.username]);
      const user = rows[0];
      // Always run argon2 so response time does not reveal whether the username exists
      const ok = user
        ? await argon2.verify(user.password_hash, input.password)
        : await argon2.verify(await this.dummyHash, input.password).then(() => false);

      if (!user || !ok || user.status !== 'active') {
        // Stored in its OWN transaction: throwing here rolls this one back, the attempt must survive.
        const reason = !user ? 'unknown_user' : !ok ? 'bad_password' : user.status;
        await this.db.withTenant(station.id, (other) => this.recordAttempt(other, station.id, input.username, input.deviceId, input.ip, false, reason));
        throw new Api_Error(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Username or password is incorrect');
      }

      const roles = await this.rolesOf(db, user.id);
      const profile = { id: user.id, username: user.username, displayName: user.display_name, roles, stationName: station.display_name, locale: user.locale };

      if (user.mfa_type === 'totp') {
        // Password was right; the session starts only after the 6-digit code.
        const claims: Mfa_Claims = { sub: user.id, tid: station.id, dev: input.deviceId, typ: 'mfa' };
        const mfaToken = await this.jwt.signAsync(claims, { expiresIn: MFA_TOKEN_SECONDS });
        return { mfaRequired: true, mfaToken, user: profile };
      }

      await this.recordAttempt(db, station.id, input.username, input.deviceId, input.ip, true, null);
      await db.query(`UPDATE app.users SET last_login_at = now() WHERE id = $1`, [user.id]);
      await db.query(`UPDATE app.devices SET user_id = $1 WHERE id = $2`, [user.id, input.deviceId]);
      return { ...(await this.sessionFor(db, station.id, user, input.deviceId, roles)), user: profile };
    });
  }

  /** Second step for accounts with 2FA: 6-digit authenticator code or a one-time recovery code. */
  async verifyMfa(mfaToken: string, code: string, ip?: string) {
    let claims: Mfa_Claims;
    try {
      claims = await this.jwt.verifyAsync<Mfa_Claims>(mfaToken);
    } catch {
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'MFA_EXPIRED', 'This sign-in expired. Enter your password again.');
    }
    if (claims.typ !== 'mfa') throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Token is invalid');

    return this.db.withTenant(claims.tid, async (db) => {
      const user = await this.userById(db, claims.sub);
      if (!user || user.status !== 'active') throw new Api_Error(HttpStatus.UNAUTHORIZED, 'USER_INACTIVE', 'Account is not active');
      await this.assertDeviceBound(db, claims.dev);
      await this.assertNotLocked(db, user.username);

      const clean = code.replace(/\s+/g, '').toUpperCase();
      const accepted = /^\d{6}$/.test(clean) ? await this.acceptTotp(db, claims.tid, user.id, clean) : await this.acceptRecoveryCode(db, user.id, clean);
      if (!accepted) {
        await this.db.withTenant(claims.tid, (other) => this.recordAttempt(other, claims.tid, user.username, claims.dev, ip, false, 'bad_mfa'));
        throw new Api_Error(HttpStatus.UNAUTHORIZED, 'MFA_INVALID', 'The code is not correct');
      }

      await this.recordAttempt(db, claims.tid, user.username, claims.dev, ip, true, null);
      await db.query(`UPDATE app.users SET last_login_at = now() WHERE id = $1`, [user.id]);
      await db.query(`UPDATE app.devices SET user_id = $1 WHERE id = $2`, [user.id, claims.dev]);
      const roles = await this.rolesOf(db, user.id);
      const station = await db.query<{ display_name: string }>(`SELECT display_name FROM app.tenants WHERE id = $1`, [claims.tid]);
      return {
        ...(await this.sessionFor(db, claims.tid, user, claims.dev, roles)),
        recoveryCodeUsed: !/^\d{6}$/.test(clean),
        user: { id: user.id, username: user.username, displayName: user.display_name, roles, stationName: station.rows[0]?.display_name ?? '', locale: user.locale },
      };
    });
  }

  /** Rotating refresh tokens. Re-using an old token revokes the whole family (spec section 3.1). */
  async refresh(refreshToken: string) {
    const [tenantPart, secret] = refreshToken.split('.');
    let tenantId: string;
    try {
      tenantId = Buffer.from(tenantPart ?? '', 'base64url').toString('utf8');
      if (!secret) throw new Error();
    } catch {
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Refresh token is invalid');
    }

    return this.db.withTenant(tenantId, async (db) => {
      const { rows } = await db.query<{ id: string; user_id: string; device_id: string; family_id: string; expires_at: Date; rotated_at: Date | null; revoked_at: Date | null }>(
        `SELECT id, user_id, device_id, family_id, expires_at, rotated_at, revoked_at
           FROM app.refresh_tokens WHERE token_hash = $1`,
        [sha256(refreshToken)],
      );
      const row = rows[0];
      if (!row) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Refresh token is invalid');
      if (row.rotated_at || row.revoked_at) {
        await db.query(`UPDATE app.refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`, [row.family_id]);
        throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_REUSED', 'Session revoked, please sign in again');
      }
      if (row.expires_at < new Date()) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_EXPIRED', 'Please sign in again');
      await this.assertDeviceBound(db, row.device_id);
      const device = await db.query(`SELECT 1 FROM app.devices WHERE id = $1 AND user_id = $2`, [row.device_id, row.user_id]);
      if (!device.rowCount) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'SIGNED_OUT', 'You were signed out on this device');
      const tenant = await db.query<{ status: string }>(`SELECT status::text AS status FROM app.tenants WHERE id = $1`, [tenantId]);
      if (!['active', 'trial'].includes(tenant.rows[0]?.status ?? '')) {
        throw new Api_Error(HttpStatus.FORBIDDEN, 'STATION_SUSPENDED', 'This station is not active');
      }

      await db.query(`UPDATE app.refresh_tokens SET rotated_at = now() WHERE id = $1`, [row.id]);
      const user = await this.userById(db, row.user_id);
      if (!user || user.status !== 'active') throw new Api_Error(HttpStatus.UNAUTHORIZED, 'USER_INACTIVE', 'Account is not active');
      const roles = await this.rolesOf(db, row.user_id);
      return this.issueTokens(db, tenantId, user, row.device_id, roles, row.family_id);
    }).catch((error) => {
      if (error instanceof Api_Error) throw error;
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Refresh token is invalid');
    });
  }

  async me() {
    const ctx = currentTenant();
    return this.db.inCurrentTenant(async (db) => {
      const { rows } = await db.query<{ id: string; username: string; display_name: string; locale: string; station_name: string; mfa_type: string; must_change_password: boolean }>(
        `SELECT u.id, u.username, u.display_name, u.locale, u.mfa_type, u.must_change_password, t.display_name AS station_name
           FROM app.users u JOIN app.tenants t ON t.id = u.tenant_id
          WHERE u.id = $1`,
        [ctx.userId],
      );
      const user = rows[0];
      // Another tenant's user id is simply invisible under RLS -> 404, never 403 (spec section 3.2)
      if (!user) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
      return {
        id: user.id, username: user.username, displayName: user.display_name, roles: ctx.roles, permissions: [...ctx.permissions].sort(),
        stationName: user.station_name, locale: user.locale, mfaEnabled: user.mfa_type === 'totp',
        setup: this.setupNeeds(user.must_change_password, user.mfa_type, ctx.roles),
      };
    });
  }

  /* ========================================================================= account set-up (S2) */

  /** Change password (also the forced first-sign-in change). Signs out every other device. */
  async changePassword(currentPassword: string, newPassword: string) {
    const ctx = currentTenant();
    return this.db.inCurrentTenant(async (db) => {
      const user = await this.userById(db, ctx.userId);
      if (!user) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
      if (!(await argon2.verify(user.password_hash, currentPassword))) {
        throw new Api_Error(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Current password is incorrect');
      }
      const minLength = ctx.roles.some((r) => MFA_REQUIRED_ROLES.includes(r)) ? 10 : 8;
      const problems: string[] = checkPassword(newPassword, { minLength, username: user.username });
      if (await argon2.verify(user.password_hash, newPassword)) problems.push('SAME_AS_OLD');
      if (problems.length) throw new Api_Error(HttpStatus.UNPROCESSABLE_ENTITY, 'PASSWORD_POLICY', 'Password does not meet the policy', problems);

      const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
      const { rows } = await db.query<User_Row>(
        `UPDATE app.users SET password_hash = $2, must_change_password = false, password_changed_at = now(), perm_version = perm_version + 1, updated_at = now()
          WHERE id = $1 RETURNING ${USER_COLUMNS}`, [user.id, hash]);
      await db.query(`UPDATE app.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [user.id]);
      await db.query(`UPDATE app.devices SET user_id = NULL WHERE user_id = $1 AND id <> $2`, [user.id, ctx.deviceId]);
      return this.sessionFor(db, ctx.tenantId, rows[0], ctx.deviceId, ctx.roles);
    });
  }

  /** Start 2FA set-up: a new secret (kept encrypted, pending until confirmed) + the otpauth:// link for the QR code. */
  async startMfaSetup() {
    const ctx = currentTenant();
    return this.db.inCurrentTenant(async (db) => {
      const { rows } = await db.query<{ username: string; mfa_type: string; station_code: string }>(
        `SELECT u.username, u.mfa_type, t.station_code FROM app.users u JOIN app.tenants t ON t.id = u.tenant_id WHERE u.id = $1`, [ctx.userId]);
      const user = rows[0];
      if (!user) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
      if (user.mfa_type === 'totp') throw new Api_Error(HttpStatus.CONFLICT, 'MFA_ALREADY_ENABLED', '2-step verification is already on');
      const secret = newTotpSecret();
      await db.query(`UPDATE app.users SET mfa_pending_secret = $2 WHERE id = $1`, [ctx.userId, this.box.seal(secret, this.aad(ctx.tenantId, ctx.userId))]);
      return { secret, otpauthUri: otpauthUri('GarageOS', `${user.username}@${user.station_code}`, secret) };
    });
  }

  /** Confirm 2FA with the first code. Returns 8 one-time recovery codes (shown once) and a full session. */
  async enableMfa(code: string) {
    const ctx = currentTenant();
    return this.db.inCurrentTenant(async (db) => {
      const { rows } = await db.query<{ mfa_pending_secret: Buffer | null; mfa_type: string }>(
        `SELECT mfa_pending_secret, mfa_type FROM app.users WHERE id = $1`, [ctx.userId]);
      const pending = rows[0]?.mfa_pending_secret;
      if (rows[0]?.mfa_type === 'totp') throw new Api_Error(HttpStatus.CONFLICT, 'MFA_ALREADY_ENABLED', '2-step verification is already on');
      if (!pending) throw new Api_Error(HttpStatus.CONFLICT, 'MFA_NOT_STARTED', 'Start the 2-step set-up first');
      const secret = this.box.open(pending, this.aad(ctx.tenantId, ctx.userId));
      const step = verifyTotp(secret, code.replace(/\s+/g, ''));
      if (step === null) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'MFA_INVALID', 'The code is not correct. Check the time on your phone and try again.');

      const updated = await db.query<User_Row>(
        `UPDATE app.users SET mfa_type = 'totp', mfa_secret = mfa_pending_secret, mfa_pending_secret = NULL, mfa_last_step = $2,
                              mfa_enabled_at = now(), perm_version = perm_version + 1, updated_at = now()
          WHERE id = $1 RETURNING ${USER_COLUMNS}`, [ctx.userId, step]);
      const recoveryCodes = await this.newRecoveryCodes(db, ctx.tenantId, ctx.userId);
      return { recoveryCodes, ...(await this.sessionFor(db, ctx.tenantId, updated.rows[0], ctx.deviceId, ctx.roles)) };
    });
  }

  /* ================================================================================ sign out */

  /** Sign out on this phone: its refresh tokens are revoked and its access token stops working at once. */
  async logout() {
    const ctx = currentTenant();
    await this.db.inCurrentTenant(async (db) => {
      await db.query(`UPDATE app.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL`, [ctx.userId, ctx.deviceId]);
      await db.query(`UPDATE app.devices SET user_id = NULL WHERE id = $1 AND user_id = $2`, [ctx.deviceId, ctx.userId]);
    });
    return { signedOut: true };
  }

  /** Sign out everywhere (lost phone): every session of this account ends now. */
  async logoutEverywhere() {
    const ctx = currentTenant();
    await this.db.inCurrentTenant((db) => this.endAllSessions(db, ctx.userId));
    return { signedOut: true };
  }

  /** Used by owners/managers on another account (POST /v1/users/{id}/sign-out). */
  async endAllSessions(db: PoolClient, userId: string) {
    await db.query(`UPDATE app.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    await db.query(`UPDATE app.devices SET user_id = NULL WHERE user_id = $1`, [userId]);
    await db.query(`UPDATE app.users SET perm_version = perm_version + 1 WHERE id = $1`, [userId]);
  }

  /** Phones where this account is signed in. */
  async sessions() {
    const ctx = currentTenant();
    return this.db.inCurrentTenant(async (db) => {
      const { rows } = await db.query<{ id: string; platform: string; model: string | null; app_version: string | null; last_seen: Date | null }>(
        `SELECT d.id, d.platform, d.model, d.app_version,
                (SELECT max(r.created_at) FROM app.refresh_tokens r WHERE r.device_id = d.id AND r.user_id = d.user_id) AS last_seen
           FROM app.devices d WHERE d.user_id = $1 AND d.revoked_at IS NULL ORDER BY last_seen DESC NULLS LAST`, [ctx.userId]);
      return rows.map((r) => ({ deviceId: r.id, platform: r.platform, model: r.model, appVersion: r.app_version, lastSeen: r.last_seen, current: r.id === ctx.deviceId }));
    });
  }

  /* ================================================================================ internals */

  /** What the account still has to do before it gets a full session. */
  private setupNeeds(mustChangePassword: boolean, mfaType: string, roles: string[]) {
    const password = mustChangePassword;
    const mfa = mfaType !== 'totp' && roles.some((r) => MFA_REQUIRED_ROLES.includes(r));
    return password || mfa ? { password, mfa } : null;
  }

  /** Full session, or a restricted 15-minute token (no refresh token) while set-up is unfinished. */
  private async sessionFor(db: PoolClient, tenantId: string, user: User_Row, deviceId: string, roles: string[]) {
    const setup = this.setupNeeds(user.must_change_password, user.mfa_type, roles);
    if (setup) {
      await db.query(`UPDATE app.devices SET user_id = $1 WHERE id = $2`, [user.id, deviceId]);
      const claims: Access_Claims = { sub: user.id, tid: tenantId, dev: deviceId, roles, perm_v: user.perm_version, typ: 'access', rst: 'setup' };
      return { accessToken: await this.jwt.signAsync(claims), refreshToken: null, expiresIn: this.config.JWT_ACCESS_TTL_SECONDS, mustChangePassword: setup.password, setup };
    }
    return { ...(await this.issueTokens(db, tenantId, user, deviceId, roles, randomUUID())), mustChangePassword: false, setup: null };
  }

  private async acceptTotp(db: PoolClient, tenantId: string, userId: string, code: string): Promise<boolean> {
    const { rows } = await db.query<{ mfa_secret: Buffer | null; mfa_last_step: string | null }>(
      `SELECT mfa_secret, mfa_last_step FROM app.users WHERE id = $1 FOR UPDATE`, [userId]);
    const row = rows[0];
    if (!row?.mfa_secret) return false;
    const step = verifyTotp(this.box.open(row.mfa_secret, this.aad(tenantId, userId)), code);
    if (step === null || (row.mfa_last_step !== null && step <= Number(row.mfa_last_step))) return false;   // each code works once
    await db.query(`UPDATE app.users SET mfa_last_step = $2 WHERE id = $1`, [userId, step]);
    return true;
  }

  private async acceptRecoveryCode(db: PoolClient, userId: string, code: string): Promise<boolean> {
    if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code)) return false;
    const normal = code.includes('-') ? code : `${code.slice(0, 4)}-${code.slice(4)}`;
    const { rowCount } = await db.query(
      `UPDATE app.user_recovery_codes SET used_at = now() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`, [userId, sha256(normal)]);
    return (rowCount ?? 0) > 0;
  }

  private async newRecoveryCodes(db: PoolClient, tenantId: string, userId: string): Promise<string[]> {
    await db.query(`DELETE FROM app.user_recovery_codes WHERE user_id = $1`, [userId]);
    const codes = Array.from({ length: 8 }, () => {
      const bytes = randomBytes(8);
      const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
      return `${chars.slice(0, 4)}-${chars.slice(4)}`;
    });
    await db.query(
      `INSERT INTO app.user_recovery_codes (tenant_id, user_id, code_hash) SELECT $1, $2, unnest($3::text[])`,
      [tenantId, userId, codes.map(sha256)]);
    return codes;
  }

  private aad(tenantId: string, userId: string) { return `mfa:${tenantId}:${userId}`; }

  private async userById(db: PoolClient, id: string): Promise<User_Row | undefined> {
    const { rows } = await db.query<User_Row>(`SELECT ${USER_COLUMNS} FROM app.users WHERE id = $1`, [id]);
    return rows[0];
  }

  private async assertNotLocked(db: PoolClient, username: string) {
    const failed = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM app.login_attempts
        WHERE username = $1 AND success = false AND at > now() - make_interval(mins => $2)
          AND at > coalesce((SELECT max(at) FROM app.login_attempts WHERE username = $1 AND success), '-infinity')`,
      [username, LOCK_MINUTES],
    );
    if (Number(failed.rows[0].n) >= MAX_FAILED) {
      throw new Api_Error(HttpStatus.LOCKED, 'ACCOUNT_LOCKED', `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`);
    }
  }

  private async assertDeviceBound(db: PoolClient, deviceId: string): Promise<void> {
    const { rows } = await db.query(`SELECT 1 FROM app.devices WHERE id = $1 AND revoked_at IS NULL`, [deviceId]);
    if (rows.length === 0) {
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'DEVICE_NOT_BOUND', 'This device is not bound to this station');
    }
  }

  private async rolesOf(db: PoolClient, userId: string): Promise<string[]> {
    const { rows } = await db.query<{ name: string }>(
      `SELECT r.name FROM app.user_roles ur JOIN app.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
        WHERE ur.user_id = $1 ORDER BY r.name`,
      [userId],
    );
    return rows.map((r) => r.name);
  }

  private async recordAttempt(db: PoolClient, tenantId: string, username: string, deviceId: string, ip: string | undefined, success: boolean, reason: string | null) {
    await db.query(
      `INSERT INTO app.login_attempts (tenant_id, username, device_id, ip, success, reason) VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, username, deviceId, ip ?? null, success, reason],
    );
  }

  private async issueTokens(db: PoolClient, tenantId: string, user: User_Row, deviceId: string, roles: string[], familyId: string) {
    const claims: Access_Claims = { sub: user.id, tid: tenantId, dev: deviceId, roles, perm_v: user.perm_version, typ: 'access' };
    const accessToken = await this.jwt.signAsync(claims);
    const refreshToken = `${Buffer.from(tenantId).toString('base64url')}.${randomBytes(32).toString('base64url')}`;
    await db.query(
      `INSERT INTO app.refresh_tokens (tenant_id, user_id, device_id, family_id, token_hash, expires_at)
       VALUES ($1,$2,$3,$4,$5, now() + make_interval(days => $6))`,
      [tenantId, user.id, deviceId, familyId, sha256(refreshToken), this.config.REFRESH_TTL_DAYS],
    );
    return { accessToken, refreshToken, expiresIn: this.config.JWT_ACCESS_TTL_SECONDS };
  }
}
