-- ╔══════════════════════════════════════════════════════════════╗
-- ║      SalesPro CRM - Supabase Database Schema Setup          ║
-- ║      Run this SQL in Supabase SQL Editor (Dashboard)        ║
-- ╚══════════════════════════════════════════════════════════════╝
--
-- HOW TO USE:
-- 1. Go to https://app.supabase.com
-- 2. Select your project
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Paste this entire SQL and click "Run"
--

-- ════════════════════════════════════════════════════════════════
-- 1. LEADS TABLE
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

-- Indexes for common queries
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
-- 5. ENABLE REALTIME (for live updates)
-- ════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE lead_notes;

-- ════════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ════════════════════════════════════════════════════════════════
-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ── Leads: Allow public reads (for the CRM dashboard) ──
CREATE POLICY "Allow public read access on leads"
  ON leads FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── Leads: Allow authenticated inserts ──
CREATE POLICY "Allow authenticated insert on leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── Leads: Allow authenticated updates ──
CREATE POLICY "Allow authenticated update on leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Leads: Allow authenticated deletes ──
CREATE POLICY "Allow authenticated delete on leads"
  ON leads FOR DELETE
  TO authenticated
  USING (true);

-- ── Lead Notes: Allow public reads ──
CREATE POLICY "Allow public read access on lead_notes"
  ON lead_notes FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── Lead Notes: Allow authenticated inserts ──
CREATE POLICY "Allow authenticated insert on lead_notes"
  ON lead_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── Lead Notes: Allow authenticated updates ──
CREATE POLICY "Allow authenticated update on lead_notes"
  ON lead_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Lead Notes: Allow authenticated deletes ──
CREATE POLICY "Allow authenticated delete on lead_notes"
  ON lead_notes FOR DELETE
  TO authenticated
  USING (true);

-- ── Team Members: Allow public reads ──
CREATE POLICY "Allow public read access on team_members"
  ON team_members FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── Team Members: Allow authenticated inserts ──
CREATE POLICY "Allow authenticated insert on team_members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── Team Members: Allow authenticated updates ──
CREATE POLICY "Allow authenticated update on team_members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Settings: Allow public reads ──
CREATE POLICY "Allow public read access on settings"
  ON settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── Settings: Allow authenticated upserts ──
CREATE POLICY "Allow authenticated upsert on settings"
  ON settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- 7. SEED DEFAULT TEAM MEMBERS (Optional)
-- ════════════════════════════════════════════════════════════════
INSERT INTO team_members (name, role, is_active) VALUES
  ('Amira', 'tele', true),
  ('Neveen', 'tele', true),
  ('Sara', 'tele', true),
  ('Esraa', 'tele', true),
  ('Rahma', 'tele', true),
  ('Rania', 'sales', true),
  ('Alaa', 'sales', true),
  ('Samar', 'sales', true),
  ('Admin', 'admin', true)
ON CONFLICT (name) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- ✅ DONE! Your database is ready.
-- ════════════════════════════════════════════════════════════════
-- Now go to Settings → API and copy:
--   1. Project URL → NEXT_PUBLIC_SUPABASE_URL
--   2. anon/public key → NEXT_PUBLIC_SUPABASE_ANON_KEY
--   3. service_role key → SUPABASE_SERVICE_ROLE_KEY
--
-- Add these to your .env.local file or Vercel Environment Variables.
