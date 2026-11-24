-- 202611241000_Platform_Admin.sql
-- Company-side ("platform") data for the Admin Console:
--   staff accounts, departments, company roles + permissions (RBAC), sessions, hash-chained audit,
--   public station requests, and owner invitations (tenant-side, RLS).
-- The Admin API connects as role platform_rw (created by Run_Migrations.ts from PLATFORM_DB_PASSWORD).
-- The station API role app_rw must NEVER read these platform tables (see REVOKEs at the end).

-- ---------------------------------------------------------------- tenants: business contact (platform metadata)
ALTER TABLE app.tenants ADD COLUMN IF NOT EXISTS contact_name  text;
ALTER TABLE app.tenants ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE app.tenants ADD COLUMN IF NOT EXISTS contact_email extensions.citext;
ALTER TABLE app.tenants ADD COLUMN IF NOT EXISTS source_request_id uuid;

-- ---------------------------------------------------------------- company structure + RBAC
CREATE TABLE IF NOT EXISTS app.platform_departments (
  id          uuid PRIMARY KEY DEFAULT app.uuidv7(),
  name        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.platform_permissions (
  code        text PRIMARY KEY,                 -- e.g. stations.create
  category    text NOT NULL,                    -- Stations, Requests, Billing, Team, Security, Health
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS app.platform_roles (
  id          uuid PRIMARY KEY DEFAULT app.uuidv7(),
  name        text NOT NULL UNIQUE,
  description text,
  is_system   boolean NOT NULL DEFAULT false,   -- system roles cannot be deleted; Super Admin cannot be reduced
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.platform_role_permissions (
  role_id         uuid NOT NULL REFERENCES app.platform_roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES app.platform_permissions(code),
  PRIMARY KEY (role_id, permission_code)
);

DO $$ BEGIN
  CREATE TYPE app.platform_user_status AS ENUM ('invited','active','suspended','deactivated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app.platform_users (
  id                   uuid PRIMARY KEY DEFAULT app.uuidv7(),
  email                extensions.citext NOT NULL UNIQUE,
  full_name            text NOT NULL,
  password_hash        text NOT NULL,
  status               app.platform_user_status NOT NULL DEFAULT 'invited',
  department_id        uuid REFERENCES app.platform_departments(id),
  must_change_password boolean NOT NULL DEFAULT true,
  mfa_secret           bytea,                   -- AES-256-GCM with PLATFORM_ENCRYPTION_KEY
  mfa_enabled          boolean NOT NULL DEFAULT false,
  mfa_last_step        bigint,                  -- TOTP replay protection
  perm_version         int NOT NULL DEFAULT 1,  -- bump = all tokens of this user die
  last_login_at        timestamptz,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_platform_users_updated ON app.platform_users;
CREATE TRIGGER trg_platform_users_updated BEFORE UPDATE ON app.platform_users
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TABLE IF NOT EXISTS app.platform_user_roles (
  user_id uuid NOT NULL REFERENCES app.platform_users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.platform_roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS app.platform_refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT app.uuidv7(),
  user_id    uuid NOT NULL REFERENCES app.platform_users(id) ON DELETE CASCADE,
  family_id  uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  rotated_at timestamptz,
  revoked_at timestamptz,
  ip         text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_refresh_family ON app.platform_refresh_tokens (family_id);

CREATE TABLE IF NOT EXISTS app.platform_login_attempts (
  id      uuid PRIMARY KEY DEFAULT app.uuidv7(),
  email   extensions.citext NOT NULL,
  success boolean NOT NULL,
  reason  text,
  ip      text,
  at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_login_attempts_lookup ON app.platform_login_attempts (email, at DESC);

-- Replaces the planned simple platform_audit_logs with a hash chain (tamper evident)
CREATE TABLE IF NOT EXISTS app.platform_audit_logs (
  id          uuid PRIMARY KEY DEFAULT app.uuidv7(),
  seq         bigint NOT NULL UNIQUE,
  actor_id    uuid,                             -- platform user (NULL = system / public form)
  actor_email text,
  action      text NOT NULL,                    -- station.create, request.reject, role.update ...
  target_type text NOT NULL,
  target_id   text,
  tenant_id   uuid,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  at          timestamptz NOT NULL DEFAULT now(),
  prev_hash   text NOT NULL,
  hash        text NOT NULL
);
CREATE TABLE IF NOT EXISTS app.platform_audit_head (
  id        int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_seq  bigint NOT NULL,
  last_hash text NOT NULL
);
INSERT INTO app.platform_audit_head (id, last_seq, last_hash) VALUES (1, 0, 'GENESIS') ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- public "Request your station" form
DO $$ BEGIN
  CREATE TYPE app.station_request_status AS ENUM ('new','in_review','approved','rejected','spam');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app.station_requests (
  id               uuid PRIMARY KEY,
  status           app.station_request_status NOT NULL DEFAULT 'new',
  plan_code        text NOT NULL CHECK (plan_code IN ('basic','pro','enterprise')),
  business_name    text NOT NULL,
  business_name_ar text,
  contact_name     text NOT NULL,
  contact_phone    text NOT NULL,
  contact_email    extensions.citext,
  city             text,
  branches_count   int CHECK (branches_count BETWEEN 1 AND 500),
  workers_count    int CHECK (workers_count BETWEEN 1 AND 5000),
  message          text,
  locale           text NOT NULL DEFAULT 'en' CHECK (locale IN ('ar','en')),
  source_ip_hash   text,                        -- salted hash only, for abuse limits
  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_by      uuid REFERENCES app.platform_users(id),
  reviewed_at      timestamptz,
  review_note      text,
  tenant_id        uuid REFERENCES app.tenants(id)
);
CREATE INDEX IF NOT EXISTS station_requests_status ON app.station_requests (status, created_at DESC);

-- ---------------------------------------------------------------- owner invitations (tenant-side, RLS)
CREATE TABLE IF NOT EXISTS app.owner_invitations (
  id                      uuid PRIMARY KEY DEFAULT app.uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES app.tenants(id),
  user_id                 uuid NOT NULL,
  token_hash              text NOT NULL,
  expires_at              timestamptz NOT NULL,
  used_at                 timestamptz,
  revoked_at              timestamptz,
  created_by_platform_user uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, token_hash),
  FOREIGN KEY (tenant_id, user_id) REFERENCES app.users (tenant_id, id) ON DELETE CASCADE
);
SELECT app.enable_tenant_rls('app.owner_invitations');

-- ---------------------------------------------------------------- aggregates for the Admin dashboard
-- Counts per station WITHOUT giving platform_rw read access to station tables.
-- It sets the tenant context station by station, so RLS still applies inside.
CREATE OR REPLACE FUNCTION app.platform_tenant_counts()
RETURNS TABLE (tenant_id uuid, active_users int, invited_users int, devices int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, extensions, pg_temp AS $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM app.tenants WHERE status <> 'deleted' LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);
    tenant_id := t.id;
    SELECT count(*) FILTER (WHERE status = 'active'), count(*) FILTER (WHERE status = 'invited')
      INTO active_users, invited_users FROM app.users;
    SELECT count(*) INTO devices FROM app.devices WHERE revoked_at IS NULL;
    RETURN NEXT;
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END $$;
REVOKE ALL ON FUNCTION app.platform_tenant_counts() FROM PUBLIC;

-- ---------------------------------------------------------------- catalogue of company permissions
INSERT INTO app.platform_permissions (code, category, description) VALUES
  ('dashboard.view',         'Health',   'See the company dashboard (totals only)'),
  ('requests.view',          'Requests', 'See station requests from the public website'),
  ('requests.review',        'Requests', 'Approve or reject station requests'),
  ('stations.view',          'Stations', 'See stations, plans, status and usage totals'),
  ('stations.create',        'Stations', 'Create stations and invite their owners'),
  ('stations.update',        'Stations', 'Edit station details and change plans'),
  ('stations.suspend',       'Stations', 'Suspend and reactivate stations'),
  ('stations.delete',        'Stations', 'Schedule station deletion'),
  ('plans.manage',           'Billing',  'Edit subscription plans and limits'),
  ('billing.view',           'Billing',  'See billing status of stations'),
  ('team.view',              'Team',     'See company staff accounts'),
  ('team.manage',            'Team',     'Create, edit, suspend company staff accounts'),
  ('roles.manage',           'Team',     'Create roles and change their permissions'),
  ('audit.view',             'Security', 'Read the company audit log'),
  ('health.view',            'Health',   'See platform health and error rates'),
  ('support.access',         'Security', 'Use support access that a station owner granted')
ON CONFLICT (code) DO UPDATE SET category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO app.platform_departments (name, description) VALUES
  ('Management',  'Founders and managers'),
  ('Sales',       'Handles station requests and onboarding'),
  ('Support',     'Helps stations, only with owner-granted access'),
  ('Finance',     'Billing and subscriptions'),
  ('Engineering', 'Platform health and operations')
ON CONFLICT (name) DO NOTHING;

INSERT INTO app.platform_roles (name, description, is_system) VALUES
  ('Super Admin', 'Everything on the platform. Cannot be reduced.', true),
  ('Sales',       'Reviews requests and creates stations', true),
  ('Support',     'Read-only station overview + support access', true),
  ('Finance',     'Plans and billing', true),
  ('Engineering', 'Health, audit, read-only stations', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO app.platform_role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM app.platform_roles r CROSS JOIN app.platform_permissions p
WHERE r.name = 'Super Admin'
   OR (r.name = 'Sales'       AND p.code IN ('dashboard.view','requests.view','requests.review','stations.view','stations.create'))
   OR (r.name = 'Support'     AND p.code IN ('dashboard.view','stations.view','health.view','support.access'))
   OR (r.name = 'Finance'     AND p.code IN ('dashboard.view','stations.view','stations.update','plans.manage','billing.view'))
   OR (r.name = 'Engineering' AND p.code IN ('dashboard.view','stations.view','health.view','audit.view'))
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- grants
-- 1) Station API (app_rw): no access to company data. Only: insert a public request; RLS-scoped invitations.
REVOKE ALL ON app.platform_departments, app.platform_permissions, app.platform_roles, app.platform_role_permissions,
              app.platform_users, app.platform_user_roles, app.platform_refresh_tokens, app.platform_login_attempts,
              app.platform_audit_logs, app.platform_audit_head, app.station_requests FROM app_rw;
GRANT INSERT ON app.station_requests TO app_rw;
GRANT SELECT, INSERT, UPDATE ON app.owner_invitations TO app_rw;
REVOKE DELETE ON app.owner_invitations FROM app_rw;
REVOKE ALL ON FUNCTION app.platform_tenant_counts() FROM app_rw;

-- 2) Admin API (platform_rw): company tables + tenant provisioning, NOT station business data.
GRANT USAGE ON SCHEMA app, extensions TO platform_rw;
GRANT EXECUTE ON FUNCTION app.uuidv7(), app.current_tenant_id(), app.touch_updated_at(), app.platform_tenant_counts() TO platform_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.platform_departments, app.platform_roles, app.platform_role_permissions,
              app.platform_users, app.platform_user_roles, app.platform_refresh_tokens TO platform_rw;
GRANT SELECT ON app.platform_permissions TO platform_rw;
GRANT SELECT, INSERT ON app.platform_login_attempts, app.platform_audit_logs TO platform_rw;
GRANT SELECT, UPDATE ON app.platform_audit_head TO platform_rw;
GRANT SELECT, UPDATE ON app.station_requests TO platform_rw;
GRANT SELECT, INSERT, UPDATE ON app.plans, app.tenants TO platform_rw;
GRANT SELECT ON app.tenant_usage, app.permissions TO platform_rw;
-- provisioning a new station (runs with app.tenant_id = the new station, so RLS still applies)
GRANT INSERT ON app.roles, app.role_permissions, app.users, app.user_roles TO platform_rw;
GRANT SELECT (id, name) ON app.roles TO platform_rw;
GRANT SELECT (id, tenant_id, username, display_name, status) ON app.users TO platform_rw;
GRANT SELECT, INSERT, UPDATE ON app.owner_invitations TO platform_rw;
