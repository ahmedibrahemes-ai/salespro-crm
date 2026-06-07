-- ╔══════════════════════════════════════════════════════════════╗
-- ║      SalesPro CRM - Supabase Database Schema Setup          ║
-- ║      IDEMPOTENT — Safe for NEW or EXISTING projects          ║
-- ║      Run this SQL in Supabase SQL Editor (Dashboard)        ║
-- ╚══════════════════════════════════════════════════════════════╝
--
-- HOW TO USE:
-- 1. Go to https://app.supabase.com
-- 2. Select your project (new OR existing with data)
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Paste this entire SQL and click "Run"
--
-- This script is IDEMPOTENT:
-- - Tables: created only if they don't exist
-- - Columns: added only if they don't exist
-- - Indexes: created only if they don't exist
-- - Realtime: tables added only if not already in the publication
-- - RLS policies: dropped and recreated (safe)
-- - Seed data: inserted only if table is empty
-- - Your EXISTING DATA will NOT be touched

-- ════════════════════════════════════════════════════════════════
-- 1. LEADS TABLE (create if not exists, add missing columns)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  store_url TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  customer_type TEXT DEFAULT '',
  brief TEXT DEFAULT '',
  contact_result TEXT DEFAULT '',
  contact_result_at TIMESTAMPTZ,
  tele_name TEXT DEFAULT '',
  sales_name TEXT,
  meeting_date TEXT DEFAULT '',
  meeting_time TEXT DEFAULT '',
  meeting_type TEXT DEFAULT '',
  meeting_link TEXT DEFAULT '',
  status TEXT DEFAULT 'new',
  sales_status TEXT,
  attended TEXT,
  attendance_marked_at TIMESTAMPTZ,
  attendance_marked_by TEXT,
  cancelled_from TEXT,
  cancelled_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  archived_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing leads table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'contact_result_at') THEN
    ALTER TABLE leads ADD COLUMN contact_result_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'cancelled_from') THEN
    ALTER TABLE leads ADD COLUMN cancelled_from TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'cancelled_at') THEN
    ALTER TABLE leads ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_at') THEN
    ALTER TABLE leads ADD COLUMN assigned_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'attendance_marked_at') THEN
    ALTER TABLE leads ADD COLUMN attendance_marked_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'attendance_marked_by') THEN
    ALTER TABLE leads ADD COLUMN attendance_marked_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'sales_status') THEN
    ALTER TABLE leads ADD COLUMN sales_status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'meeting_link') THEN
    ALTER TABLE leads ADD COLUMN meeting_link TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'meeting_type') THEN
    ALTER TABLE leads ADD COLUMN meeting_type TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'customer_type') THEN
    ALTER TABLE leads ADD COLUMN customer_type TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'brief') THEN
    ALTER TABLE leads ADD COLUMN brief TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'store_url') THEN
    ALTER TABLE leads ADD COLUMN store_url TEXT DEFAULT '';
  END IF;
END $$;

-- Indexes for common queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_leads_archived ON leads (is_archived);
CREATE INDEX IF NOT EXISTS idx_leads_tele_name ON leads (tele_name) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_leads_sales_name ON leads (sales_name) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_leads_meeting_date ON leads (meeting_date) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone);

-- ════════════════════════════════════════════════════════════════
-- 2. LEAD NOTES TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lead_notes (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  by_name TEXT DEFAULT '',
  category TEXT DEFAULT '',
  text TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes (lead_id);

-- ════════════════════════════════════════════════════════════════
-- 3. TEAM MEMBERS TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS team_members (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tele', 'sales', 'admin')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_name ON team_members (name);

-- ════════════════════════════════════════════════════════════════
-- 4. SETTINGS TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
-- 5. ENABLE REALTIME (idempotent — checks before adding)
-- ════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Add leads to realtime publication only if not already a member
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  END IF;

  -- Add lead_notes to realtime publication only if not already a member
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'lead_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lead_notes;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ════════════════════════════════════════════════════════════════
-- Enable RLS (safe to re-run)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies (idempotent)
DROP POLICY IF EXISTS "Allow public read access on leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated insert on leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated update on leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated delete on leads" ON leads;

CREATE POLICY "Allow public read access on leads"
  ON leads FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated insert on leads"
  ON leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on leads"
  ON leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete on leads"
  ON leads FOR DELETE TO authenticated USING (true);

-- lead_notes policies
DROP POLICY IF EXISTS "Allow public read access on lead_notes" ON lead_notes;
DROP POLICY IF EXISTS "Allow authenticated insert on lead_notes" ON lead_notes;
DROP POLICY IF EXISTS "Allow authenticated update on lead_notes" ON lead_notes;
DROP POLICY IF EXISTS "Allow authenticated delete on lead_notes" ON lead_notes;

CREATE POLICY "Allow public read access on lead_notes"
  ON lead_notes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated insert on lead_notes"
  ON lead_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on lead_notes"
  ON lead_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete on lead_notes"
  ON lead_notes FOR DELETE TO authenticated USING (true);

-- team_members policies
DROP POLICY IF EXISTS "Allow public read access on team_members" ON team_members;
DROP POLICY IF EXISTS "Allow authenticated insert on team_members" ON team_members;
DROP POLICY IF EXISTS "Allow authenticated update on team_members" ON team_members;

CREATE POLICY "Allow public read access on team_members"
  ON team_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated insert on team_members"
  ON team_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on team_members"
  ON team_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- settings policies
DROP POLICY IF EXISTS "Allow public read access on settings" ON settings;
DROP POLICY IF EXISTS "Allow authenticated upsert on settings" ON settings;

CREATE POLICY "Allow public read access on settings"
  ON settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated upsert on settings"
  ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- 7. SEED TEAM MEMBERS (only if table is empty)
-- ════════════════════════════════════════════════════════════════
INSERT INTO team_members (name, role, is_active)
SELECT name, role, is_active FROM (VALUES
  ('Amira', 'tele', true),
  ('Neveen', 'tele', true),
  ('Sara', 'tele', true),
  ('Esraa', 'tele', true),
  ('Rahma', 'tele', true),
  ('Rania', 'sales', true),
  ('Alaa', 'sales', true),
  ('Samar', 'sales', true),
  ('Admin', 'admin', true)
) AS v(name, role, is_active)
WHERE NOT EXISTS (SELECT 1 FROM team_members LIMIT 1);

-- ════════════════════════════════════════════════════════════════
-- ✅ DONE! Your database is ready.
-- ════════════════════════════════════════════════════════════════
-- If this is an EXISTING project, all your customer data is preserved.
-- If this is a NEW project, everything is created from scratch.
--
-- Now go to Settings → API and copy:
--   1. Project URL → NEXT_PUBLIC_SUPABASE_URL
--   2. anon/public key → NEXT_PUBLIC_SUPABASE_ANON_KEY
--   3. service_role key → SUPABASE_SERVICE_ROLE_KEY
--
-- Add these to your .env.local file or Vercel Environment Variables.
