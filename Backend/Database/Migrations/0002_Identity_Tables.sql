-- 0002_Identity_Tables.sql (spec section 9.3) - every table is tenant-owned with RLS forced
DO $$ BEGIN
  CREATE TYPE app.user_status AS ENUM ('invited','active','suspended','deactivated','anonymized');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app.users (
  id                   uuid PRIMARY KEY DEFAULT app.uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES app.tenants(id),
  username             extensions.citext NOT NULL,
  display_name         text NOT NULL,
  password_hash        text NOT NULL,
  status               app.user_status NOT NULL DEFAULT 'active',
  must_change_password boolean NOT NULL DEFAULT false,
  mfa_type             text NOT NULL DEFAULT 'none' CHECK (mfa_type IN ('none','totp','sms')),
  mfa_secret           bytea,
  phone_e164           bytea,
  phone_hash           text,
  email                extensions.citext,
  locale               text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar','en')),
  perm_version         int NOT NULL DEFAULT 1,
  last_login_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  version              int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, username)
);

-- Global, read-only permission catalogue (platform-defined)
CREATE TABLE IF NOT EXISTS app.permissions (
  code        text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS app.roles (
  id          uuid PRIMARY KEY DEFAULT app.uuidv7(),
  tenant_id   uuid NOT NULL REFERENCES app.tenants(id),
  name        text NOT NULL,
  is_system   boolean NOT NULL DEFAULT false,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS app.role_permissions (
  tenant_id       uuid NOT NULL REFERENCES app.tenants(id),
  role_id         uuid NOT NULL,
  permission_code text NOT NULL REFERENCES app.permissions(code),
  scope           text NOT NULL DEFAULT 'all' CHECK (scope IN ('own','branch','all')),
  PRIMARY KEY (tenant_id, role_id, permission_code),
  FOREIGN KEY (tenant_id, role_id) REFERENCES app.roles (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app.user_roles (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  user_id   uuid NOT NULL,
  role_id   uuid NOT NULL,
  PRIMARY KEY (tenant_id, user_id, role_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES app.users (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, role_id) REFERENCES app.roles (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app.devices (
  id                 uuid PRIMARY KEY DEFAULT app.uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES app.tenants(id),
  user_id            uuid,
  platform           text NOT NULL CHECK (platform IN ('android','ios')),
  model              text,
  os_version         text,
  app_version        text,
  attestation_status text NOT NULL DEFAULT 'unchecked',
  bound_at           timestamptz NOT NULL DEFAULT now(),
  revoked_at         timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES app.users (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS app.refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT app.uuidv7(),
  tenant_id  uuid NOT NULL REFERENCES app.tenants(id),
  user_id    uuid NOT NULL,
  device_id  uuid NOT NULL,
  family_id  uuid NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, token_hash),
  FOREIGN KEY (tenant_id, user_id)   REFERENCES app.users   (tenant_id, id),
  FOREIGN KEY (tenant_id, device_id) REFERENCES app.devices (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS app.login_attempts (
  id        uuid PRIMARY KEY DEFAULT app.uuidv7(),
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  username  extensions.citext NOT NULL,
  device_id uuid,
  ip        text,
  success   boolean NOT NULL,
  reason    text,
  at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS login_attempts_lookup ON app.login_attempts (tenant_id, username, at DESC);

SELECT app.enable_tenant_rls('app.users');
SELECT app.enable_tenant_rls('app.roles');
SELECT app.enable_tenant_rls('app.role_permissions');
SELECT app.enable_tenant_rls('app.user_roles');
SELECT app.enable_tenant_rls('app.devices');
SELECT app.enable_tenant_rls('app.refresh_tokens');
SELECT app.enable_tenant_rls('app.login_attempts');
