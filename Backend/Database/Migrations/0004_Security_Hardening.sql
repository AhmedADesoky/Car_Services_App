-- 0004_Security_Hardening.sql
-- Least privilege for the API role on platform tables (no RLS there, so restrict COLUMNS instead).
-- The API only needs to resolve a station code and show station branding; it must never read
-- KMS references, DB routing, deletion schedules or other stations' usage.
REVOKE SELECT ON app.tenants FROM app_rw;
GRANT SELECT (id, station_code, display_name, default_locale, status, currency, country, time_zone,
              logo_uri, accent_color, plan_id)
  ON app.tenants TO app_rw;

REVOKE ALL ON app.tenant_usage FROM app_rw;   -- metering is written by the platform worker role later

-- Login attempts and refresh tokens: the API never deletes them (retention job runs as migrator).
REVOKE DELETE ON app.refresh_tokens FROM app_rw;
