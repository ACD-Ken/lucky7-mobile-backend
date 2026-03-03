-- ============================================================
-- Migration 001: Enable RLS on all LuckyMobile7 tables
-- Safe for server-side service role usage (bypass policy added)
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. draws table ───────────────────────────────────────────
ALTER TABLE draws ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (server still works normally)
CREATE POLICY "service_role_all_draws"
  ON draws
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public read-only access to draws (lottery history is public data)
CREATE POLICY "public_read_draws"
  ON draws
  FOR SELECT
  TO anon, authenticated
  USING (true);


-- ── 2. device_usage table ────────────────────────────────────
ALTER TABLE device_usage ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (server still works normally)
CREATE POLICY "service_role_all_device_usage"
  ON device_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No anon/authenticated access — server-only table


-- ── 3. lucky7_log table (PII) ────────────────────────────────
ALTER TABLE lucky7_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (server still works normally)
CREATE POLICY "service_role_all_lucky7_log"
  ON lucky7_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No anon/authenticated access — PII table, server-only

-- ============================================================
-- Verification: check RLS is enabled on all 3 tables
-- ============================================================
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('draws', 'device_usage', 'lucky7_log')
ORDER BY tablename;
