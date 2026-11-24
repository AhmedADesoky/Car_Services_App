-- 202611250900_Station_Identity.sql - station accounts: 2FA set-up, recovery codes, session lookups (AUTH-03/05/07)

ALTER TABLE app.users ADD COLUMN IF NOT EXISTS mfa_pending_secret bytea;     -- set by /auth/mfa/setup, moved to mfa_secret on enable
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS mfa_last_step     bigint;     -- last accepted TOTP step: a code can be used only once
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS mfa_enabled_at    timestamptz;
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

CREATE TABLE IF NOT EXISTS app.user_recovery_codes (
  id         uuid PRIMARY KEY DEFAULT app.uuidv7(),
  tenant_id  uuid NOT NULL REFERENCES app.tenants(id),
  user_id    uuid NOT NULL,
  code_hash  text NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code_hash),
  FOREIGN KEY (tenant_id, user_id) REFERENCES app.users (tenant_id, id) ON DELETE CASCADE
);
SELECT app.enable_tenant_rls('app.user_recovery_codes');

CREATE INDEX IF NOT EXISTS refresh_tokens_user_open ON app.refresh_tokens (tenant_id, user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS devices_user ON app.devices (tenant_id, user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON app.user_recovery_codes TO app_rw;
