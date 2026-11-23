import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { APP_CONFIG, App_Config } from '../../Common/Config/App_Config';
import { Db_Client } from '../../Common/Database/Db_Client';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';
import { Access_Claims } from '../../Common/Auth/Tenant_Context_Guard';
import { currentTenant } from '../../Common/Tenant_Context/Tenant_Store';
import { Station_Lookup } from '../Devices/Station_Lookup';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

interface User_Row {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  status: string;
  must_change_password: boolean;
  locale: string;
  perm_version: number;
}

export interface Login_Input {
  stationCode: string;
  deviceId: string;
  username: string;
  password: string;
  ip?: string;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class Auth_Service {
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'), { type: argon2.argon2id });

  constructor(
    private readonly db: Db_Client,
    private readonly stations: Station_Lookup,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: App_Config,
  ) {}

  async login(input: Login_Input) {
    const station = await this.stations.findActive(input.stationCode);

    return this.db.withTenant(station.id, async (db) => {
      await this.assertDeviceBound(db, input.deviceId);

      const failed = await db.query<{ n: string }>(
        `SELECT count(*) AS n FROM app.login_attempts
          WHERE username = $1 AND success = false AND at > now() - make_interval(mins => $2)`,
        [input.username, LOCK_MINUTES],
      );
      if (Number(failed.rows[0].n) >= MAX_FAILED) {
        throw new Api_Error(HttpStatus.LOCKED, 'ACCOUNT_LOCKED', `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`);
      }

      const { rows } = await db.query<User_Row>(
        `SELECT id, username, display_name, password_hash, status, must_change_password, locale, perm_version
           FROM app.users WHERE username = $1`,
        [input.username],
      );
      const user = rows[0];
      // Always run argon2 so response time does not reveal whether the username exists
      const ok = user
        ? await argon2.verify(user.password_hash, input.password)
        : await argon2.verify(await this.dummyHash, input.password).then(() => false);

      if (!user || !ok || user.status !== 'active') {
        // Stored in its OWN transaction: throwing here rolls this one back, the attempt must survive.
        const reason = !user ? 'unknown_user' : !ok ? 'bad_password' : user.status;
        await this.db.withTenant(station.id, (other) => this.recordAttempt(other, station.id, input, false, reason));
        throw new Api_Error(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Username or password is incorrect');
      }

      await this.recordAttempt(db, station.id, input, true, null);
      await db.query(`UPDATE app.users SET last_login_at = now() WHERE id = $1`, [user.id]);
      await db.query(`UPDATE app.devices SET user_id = $1 WHERE id = $2`, [user.id, input.deviceId]);

      const roles = await this.rolesOf(db, user.id);
      const tokens = await this.issueTokens(db, station.id, user, input.deviceId, roles, randomUUID());
      return {
        ...tokens,
        mustChangePassword: user.must_change_password,
        user: { id: user.id, username: user.username, displayName: user.display_name, roles, stationName: station.display_name, locale: user.locale },
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

      await db.query(`UPDATE app.refresh_tokens SET rotated_at = now() WHERE id = $1`, [row.id]);
      const users = await db.query<User_Row>(
        `SELECT id, username, display_name, password_hash, status, must_change_password, locale, perm_version
           FROM app.users WHERE id = $1 AND status = 'active'`,
        [row.user_id],
      );
      if (!users.rows[0]) throw new Api_Error(HttpStatus.UNAUTHORIZED, 'USER_INACTIVE', 'Account is not active');
      const roles = await this.rolesOf(db, row.user_id);
      return this.issueTokens(db, tenantId, users.rows[0], row.device_id, roles, row.family_id);
    }).catch((error) => {
      if (error instanceof Api_Error) throw error;
      throw new Api_Error(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Refresh token is invalid');
    });
  }

  async me() {
    return this.db.inCurrentTenant(async (db) => {
      const { rows } = await db.query<{ id: string; username: string; display_name: string; locale: string; station_name: string }>(
        `SELECT u.id, u.username, u.display_name, u.locale, t.display_name AS station_name
           FROM app.users u JOIN app.tenants t ON t.id = u.tenant_id
          WHERE u.id = $1`,
        [currentTenant().userId],
      );
      const user = rows[0];
      // Another tenant's user id is simply invisible under RLS -> 404, never 403 (spec section 3.2)
      if (!user) throw new Api_Error(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found');
      const roles = await this.rolesOf(db, user.id);
      return { id: user.id, username: user.username, displayName: user.display_name, roles, stationName: user.station_name, locale: user.locale };
    });
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

  private async recordAttempt(db: PoolClient, tenantId: string, input: Login_Input, success: boolean, reason: string | null) {
    await db.query(
      `INSERT INTO app.login_attempts (tenant_id, username, device_id, ip, success, reason) VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, input.username, input.deviceId, input.ip ?? null, success, reason],
    );
  }

  private async issueTokens(db: PoolClient, tenantId: string, user: User_Row, deviceId: string, roles: string[], familyId: string) {
    const claims: Access_Claims = { sub: user.id, tid: tenantId, dev: deviceId, roles, perm_v: user.perm_version };
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
