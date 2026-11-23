-- 0001_Platform_Tables.sql
-- Private schema "app" is NOT exposed by the Supabase Data API (PostgREST),
-- so the publishable/anon keys can never reach these tables.
CREATE SCHEMA IF NOT EXISTS app;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector   WITH SCHEMA extensions;

-- UUIDv7 (time-ordered, not guessable) - spec section 3.2
CREATE OR REPLACE FUNCTION app.uuidv7() RETURNS uuid
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  ts_ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000);
  b bytea := extensions.gen_random_bytes(16);
BEGIN
  b := set_byte(b, 0, ((ts_ms >> 40) & 255)::int);
  b := set_byte(b, 1, ((ts_ms >> 32) & 255)::int);
  b := set_byte(b, 2, ((ts_ms >> 24) & 255)::int);
  b := set_byte(b, 3, ((ts_ms >> 16) & 255)::int);
  b := set_byte(b, 4, ((ts_ms >> 8) & 255)::int);
  b := set_byte(b, 5, (ts_ms & 255)::int);
  b := set_byte(b, 6, (get_byte(b, 6) & 15) | 112);  -- version 7
  b := set_byte(b, 8, (get_byte(b, 8) & 63) | 128);  -- RFC 4122 variant
  RETURN encode(b, 'hex')::uuid;
END $$;

-- Current tenant of the transaction (SET LOCAL app.tenant_id). NULL when unset -> zero rows.
CREATE OR REPLACE FUNCTION app.current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Applied to EVERY tenant-owned table: ENABLE + FORCE + policy (spec section 3.3)
CREATE OR REPLACE FUNCTION app.enable_tenant_rls(tbl regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', tbl);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s USING (tenant_id = app.current_tenant_id()) '
    'WITH CHECK (tenant_id = app.current_tenant_id())', tbl);
END $$;

CREATE OR REPLACE FUNCTION app.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

-- ---------- Platform tables (no tenant_id, no RLS; API may only read) ----------
CREATE TABLE IF NOT EXISTS app.plans (
  id            uuid PRIMARY KEY DEFAULT app.uuidv7(),
  code          text NOT NULL UNIQUE CHECK (code IN ('basic','pro','enterprise')),
  name          text NOT NULL,
  limits        jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'EGP',
  is_active     boolean NOT NULL DEFAULT true
);

DO $$ BEGIN
  CREATE TYPE app.tenant_status AS ENUM ('trial','active','suspended','pending_deletion','deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app.isolation_mode AS ENUM ('pooled','silo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app.tenants (
  id                    uuid PRIMARY KEY DEFAULT app.uuidv7(),
  station_code          extensions.citext NOT NULL UNIQUE CHECK (length(station_code) BETWEEN 4 AND 12),
  legal_name            text NOT NULL,
  display_name          text NOT NULL,
  tax_reg_no            text,
  country               text NOT NULL DEFAULT 'EG',
  currency              text NOT NULL DEFAULT 'EGP',
  time_zone             text NOT NULL DEFAULT 'Africa/Cairo',
  default_locale        text NOT NULL DEFAULT 'ar',
  plan_id               uuid NOT NULL REFERENCES app.plans(id),
  status                app.tenant_status NOT NULL DEFAULT 'trial',
  isolation_mode        app.isolation_mode NOT NULL DEFAULT 'pooled',
  db_route              text,
  storage_prefix        text NOT NULL DEFAULT '',
  kms_key_ref           text,
  logo_uri              text,
  accent_color          text,
  deletion_scheduled_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_tenants_updated ON app.tenants;
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON app.tenants
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TABLE IF NOT EXISTS app.tenant_usage (
  tenant_id      uuid NOT NULL REFERENCES app.tenants(id),
  period         date NOT NULL,
  active_workers int NOT NULL DEFAULT 0,
  branches       int NOT NULL DEFAULT 0,
  plate_scans    int NOT NULL DEFAULT 0,
  face_checks    int NOT NULL DEFAULT 0,
  whatsapp_sent  int NOT NULL DEFAULT 0,
  storage_mb     int NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, period)
);
