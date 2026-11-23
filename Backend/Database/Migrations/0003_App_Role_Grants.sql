-- 0003_App_Role_Grants.sql
-- The API connects as app_rw: not the table owner, NOBYPASSRLS -> RLS policies always apply.
-- The role itself (with its password) is created by Run_Migrations.ts from APP_DB_PASSWORD.
GRANT USAGE ON SCHEMA app TO app_rw;
GRANT USAGE ON SCHEMA extensions TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_rw;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT EXECUTE ON FUNCTIONS TO app_rw;

-- Platform tables: the API may only READ plans / tenants / permissions (station-code lookup).
REVOKE INSERT, UPDATE, DELETE ON app.plans, app.tenants, app.permissions FROM app_rw;
-- Login attempts are append-only for the API
REVOKE UPDATE, DELETE ON app.login_attempts FROM app_rw;

-- The Supabase Data API roles must never touch the private schema
REVOKE ALL ON SCHEMA app FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon, authenticated;
