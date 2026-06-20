-- ═══════════════════════════════════════════════════════════════
-- EGRESS OPTIMIZATION: RPC Functions for Dashboard Stats
-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in Supabase SQL Editor to create RPC functions.
-- These functions compute stats server-side in PostgreSQL,
-- eliminating the need to download full tables to the API layer.
--
-- BEFORE: 3 full-table scans (~17GB egress/month)
-- AFTER: 3 lightweight RPC calls returning aggregated rows (~1MB egress/month)
-- ═══════════════════════════════════════════════════════════════

-- 1. Per-Tele Stats — aggregated by tele_name
CREATE OR REPLACE FUNCTION get_per_tele_stats()
RETURNS TABLE (
  tele_name TEXT,
  total BIGINT,
  attended BIGINT,
  no_show BIGINT,
  meetings BIGINT,
  closed_won BIGINT
) AS $$
  SELECT
    tele_name,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE attended = 'attended') AS attended,
    COUNT(*) FILTER (WHERE attended = 'no-show') AS no_show,
    COUNT(*) FILTER (WHERE meeting_date IS NOT NULL AND meeting_date <> '') AS meetings,
    COUNT(*) FILTER (WHERE sales_status = 'closed-won' OR status = 'closed-won') AS closed_won
  FROM leads
  WHERE is_archived = false AND tele_name IS NOT NULL AND tele_name <> ''
  GROUP BY tele_name
$$ LANGUAGE sql STABLE;

-- 2. Per-Sales Stats — aggregated by sales_name
CREATE OR REPLACE FUNCTION get_per_sales_stats()
RETURNS TABLE (
  sales_name TEXT,
  total BIGINT,
  attended BIGINT,
  no_show BIGINT,
  meetings BIGINT,
  closed_won BIGINT
) AS $$
  SELECT
    sales_name,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE attended = 'attended') AS attended,
    COUNT(*) FILTER (WHERE attended = 'no-show') AS no_show,
    COUNT(*) FILTER (WHERE meeting_date IS NOT NULL AND meeting_date <> '') AS meetings,
    COUNT(*) FILTER (WHERE sales_status = 'closed-won' OR status = 'closed-won') AS closed_won
  FROM leads
  WHERE is_archived = false AND sales_name IS NOT NULL AND sales_name <> ''
  GROUP BY sales_name
$$ LANGUAGE sql STABLE;

-- 3. Call Analytics — overall call/attendance counts
CREATE OR REPLACE FUNCTION get_call_analytics()
RETURNS TABLE (
  total_calls BIGINT,
  success_count BIGINT,
  fail_count BIGINT
) AS $$
  SELECT
    COUNT(*) FILTER (WHERE contact_result IS NOT NULL AND contact_result <> '' AND contact_result <> 'none') AS total_calls,
    COUNT(*) FILTER (WHERE attended = 'attended') AS success_count,
    COUNT(*) FILTER (WHERE attended = 'no-show') AS fail_count
  FROM leads
  WHERE is_archived = false
$$ LANGUAGE sql STABLE;

-- 4. Weekly Calls — count leads by day of week for last 7 days
-- Uses EXTRACT(DOW) which returns 0=Sunday, 1=Monday, ..., 6=Saturday
CREATE OR REPLACE FUNCTION get_weekly_calls(days_ago TIMESTAMPTZ)
RETURNS TABLE (
  day_of_week INTEGER,
  count BIGINT
) AS $$
  SELECT
    EXTRACT(DOW FROM created_at AT TIME ZONE 'Africa/Cairo')::INTEGER AS day_of_week,
    COUNT(*) AS count
  FROM leads
  WHERE created_at >= days_ago
  GROUP BY day_of_week
  ORDER BY day_of_week
$$ LANGUAGE sql STABLE;

-- ═══════════════════════════════════════════════════════════════
-- GRANT EXECUTE to anon and authenticated roles
-- ═══════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION get_per_tele_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_per_sales_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_call_analytics() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_weekly_calls(TIMESTAMPTZ) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- Optional: Create indexes to speed up the RPC functions
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_leads_archived_tele ON leads (is_archived, tele_name) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_leads_archived_sales ON leads (is_archived, sales_name) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at);
CREATE INDEX IF NOT EXISTS idx_leads_contact_result ON leads (contact_result) WHERE contact_result IS NOT NULL AND contact_result <> '' AND contact_result <> 'none';
