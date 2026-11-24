-- 202611241200_Platform_Counts_Fix.sql
-- Bug: app.platform_tenant_counts() relied on RLS inside a SECURITY DEFINER function. On Supabase the
-- function owner (postgres) bypasses RLS, so every station got the totals of ALL stations.
-- Fix: filter by tenant_id explicitly (RLS context is still set as a second wall).
CREATE OR REPLACE FUNCTION app.platform_tenant_counts()
RETURNS TABLE (tenant_id uuid, active_users int, invited_users int, devices int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, extensions, pg_temp AS $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM app.tenants WHERE status <> 'deleted' LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);
    tenant_id := t.id;
    SELECT count(*) FILTER (WHERE u.status = 'active'), count(*) FILTER (WHERE u.status = 'invited')
      INTO active_users, invited_users FROM app.users u WHERE u.tenant_id = t.id;
    SELECT count(*) INTO devices FROM app.devices d WHERE d.tenant_id = t.id AND d.revoked_at IS NULL;
    RETURN NEXT;
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END $$;
REVOKE ALL ON FUNCTION app.platform_tenant_counts() FROM PUBLIC, app_rw;
GRANT EXECUTE ON FUNCTION app.platform_tenant_counts() TO platform_rw;
