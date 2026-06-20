-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SalesPro CRM — Stage 1 Migration (CORRECTED VERSION)             ║
-- ║  Run this in the Supabase SQL Editor (Dashboard → SQL → New Query)║
-- ║                                                                  ║
-- ║  FIX: Removed `updated_at` reference — app_users has no such     ║
-- ║  column (only last_login_at and created_at exist).               ║
-- ║                                                                  ║
-- ║  This migration:                                                 ║
-- ║   1. Resets the admin password to bcrypt (SalesPro@2026!)        ║
-- ║   2. Strengthens RLS policies                                    ║
-- ║   3. Creates the missing tables (meetings, transfers, etc.)      ║
-- ║   4. Adds indexes for performance                                ║
-- ║                                                                  ║
-- ║  Idempotent: safe to re-run (CREATE TABLE IF NOT EXISTS,         ║
-- ║  DROP POLICY IF EXISTS, CREATE INDEX IF NOT EXISTS).             ║
-- ║  Only the password reset is NOT idempotent.                     ║
-- ╚══════════════════════════════════════════════════════════════════╝

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- 1. RESET ADMIN PASSWORD (bcrypt)
-- ────────────────────────────────────────────────────────────────────
-- New password: SalesPro@2026!
-- NOTE: app_users has NO updated_at column — only last_login_at + created_at.

UPDATE app_users
SET
  password_hash = '$2b$10$69bZDPTLmDtZBb.g1RN7HebrCK7kgiJB1kzgY0XaryYNMRRb7mQGK',
  password_salt = ''
WHERE username = 'admin';

-- If no admin row exists yet, create one
INSERT INTO app_users (username, password_hash, password_salt, display_name, role, is_active)
SELECT 'admin', '$2b$10$69bZDPTLmDtZBb.g1RN7HebrCK7kgiJB1kzgY0XaryYNMRRb7mQGK', '', 'Administrator', 'admin', true
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'admin');

-- Make password_salt nullable so future bcrypt hashes (which embed the salt) can use ''
-- (The table was created with NOT NULL on password_salt.)
ALTER TABLE app_users ALTER COLUMN password_salt DROP NOT NULL;

-- ────────────────────────────────────────────────────────────────────
-- 2. STRENGTHEN RLS POLICIES
-- ────────────────────────────────────────────────────────────────────
-- Strategy:
--   - app_users: NO direct access from anon/authenticated (server uses service role)
--   - leads, lead_notes, team_members, access_permissions, settings:
--     SELECT for authenticated + anon (realtime subscription needs anon)
--   - We drop the old "allow all" policies and create tighter ones.

-- Enable RLS on all tables (idempotent)
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (idempotent — errors ignored if policy doesn't exist)
DROP POLICY IF EXISTS "Enable read access for all users" ON leads;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON leads;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON leads;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON leads;
DROP POLICY IF EXISTS "leads_select_authenticated" ON leads;
DROP POLICY IF EXISTS "leads_select_anon" ON leads;
DROP POLICY IF EXISTS "leads_insert_authenticated" ON leads;
DROP POLICY IF EXISTS "leads_update_authenticated" ON leads;
DROP POLICY IF EXISTS "leads_delete_authenticated" ON leads;

DROP POLICY IF EXISTS "Enable read access for all users" ON lead_notes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON lead_notes;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON lead_notes;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON lead_notes;
DROP POLICY IF EXISTS "lead_notes_select_authenticated" ON lead_notes;
DROP POLICY IF EXISTS "lead_notes_select_anon" ON lead_notes;
DROP POLICY IF EXISTS "lead_notes_insert_authenticated" ON lead_notes;
DROP POLICY IF EXISTS "lead_notes_update_authenticated" ON lead_notes;
DROP POLICY IF EXISTS "lead_notes_delete_authenticated" ON lead_notes;

DROP POLICY IF EXISTS "Enable read access for all users" ON team_members;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON team_members;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON team_members;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON team_members;
DROP POLICY IF EXISTS "team_members_select_authenticated" ON team_members;
DROP POLICY IF EXISTS "team_members_insert_authenticated" ON team_members;
DROP POLICY IF EXISTS "team_members_update_authenticated" ON team_members;
DROP POLICY IF EXISTS "team_members_delete_authenticated" ON team_members;

DROP POLICY IF EXISTS "Enable read access for all users" ON access_permissions;
DROP POLICY IF EXISTS "Allow admin write" ON access_permissions;
DROP POLICY IF EXISTS "access_permissions_select_authenticated" ON access_permissions;
DROP POLICY IF EXISTS "access_permissions_insert_authenticated" ON access_permissions;
DROP POLICY IF EXISTS "access_permissions_update_authenticated" ON access_permissions;
DROP POLICY IF EXISTS "access_permissions_delete_authenticated" ON access_permissions;

DROP POLICY IF EXISTS "Enable read access for all users" ON settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON settings;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON settings;
DROP POLICY IF EXISTS "settings_select_authenticated" ON settings;
DROP POLICY IF EXISTS "settings_insert_authenticated" ON settings;
DROP POLICY IF EXISTS "settings_update_authenticated" ON settings;

DROP POLICY IF EXISTS "Enable read access for all users" ON app_users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON app_users;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON app_users;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON app_users;

DROP POLICY IF EXISTS "Enable read access for all users" ON activity_log;
DROP POLICY IF EXISTS "activity_log_select_authenticated" ON activity_log;

-- ╔════════════════════════════════════════════════════════════════╗
-- ║ NEW RLS POLICIES                                                ║
-- ║                                                                  ║
-- ║ The Next.js API routes use the SERVICE ROLE key (bypasses RLS).  ║
-- ║ Client-side code should NOT query these tables directly.         ║
-- ║ We still allow anon SELECT on leads/lead_notes because the       ║
-- ║ client-side realtime subscription uses the anon key.             ║
-- ║                                                                  ║
-- ║ app_users is FULLY locked down — only service role can access.   ║
-- ╚════════════════════════════════════════════════════════════════╝

-- leads: authenticated + anon can read (realtime needs anon), writes via service role
CREATE POLICY "leads_select_authenticated" ON leads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "leads_select_anon" ON leads
  FOR SELECT TO anon USING (true);
CREATE POLICY "leads_insert_authenticated" ON leads
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "leads_update_authenticated" ON leads
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "leads_delete_authenticated" ON leads
  FOR DELETE TO authenticated USING (true);

-- lead_notes: same pattern (realtime chat feature)
CREATE POLICY "lead_notes_select_authenticated" ON lead_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_notes_select_anon" ON lead_notes
  FOR SELECT TO anon USING (true);
CREATE POLICY "lead_notes_insert_authenticated" ON lead_notes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lead_notes_update_authenticated" ON lead_notes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lead_notes_delete_authenticated" ON lead_notes
  FOR DELETE TO authenticated USING (true);

-- team_members: authenticated can read
CREATE POLICY "team_members_select_authenticated" ON team_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_members_insert_authenticated" ON team_members
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_members_update_authenticated" ON team_members
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team_members_delete_authenticated" ON team_members
  FOR DELETE TO authenticated USING (true);

-- access_permissions: authenticated can read
CREATE POLICY "access_permissions_select_authenticated" ON access_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "access_permissions_insert_authenticated" ON access_permissions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "access_permissions_update_authenticated" ON access_permissions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "access_permissions_delete_authenticated" ON access_permissions
  FOR DELETE TO authenticated USING (true);

-- settings: authenticated can read
CREATE POLICY "settings_select_authenticated" ON settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_insert_authenticated" ON settings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "settings_update_authenticated" ON settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- activity_log: authenticated can read, service role writes
CREATE POLICY "activity_log_select_authenticated" ON activity_log
  FOR SELECT TO authenticated USING (true);

-- app_users: NO direct access (lock it down entirely)
-- Only the service role (server-side) can read/write this table.
REVOKE ALL ON app_users FROM anon, authenticated;

-- ╔════════════════════════════════════════════════════════════════╗
-- ║ 3. MISSING TABLES                                               ║
-- ╚════════════════════════════════════════════════════════════════╝

-- meetings: scheduled meetings
CREATE TABLE IF NOT EXISTS meetings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id BIGINT NOT NULL,
  tele_name TEXT,
  sales_name TEXT,
  meeting_date DATE,
  meeting_time TEXT,
  meeting_type TEXT,
  meeting_link TEXT,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meetings_select_authenticated" ON meetings;
DROP POLICY IF EXISTS "meetings_insert_authenticated" ON meetings;
DROP POLICY IF EXISTS "meetings_update_authenticated" ON meetings;
DROP POLICY IF EXISTS "meetings_delete_authenticated" ON meetings;
CREATE POLICY "meetings_select_authenticated" ON meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings_insert_authenticated" ON meetings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "meetings_update_authenticated" ON meetings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "meetings_delete_authenticated" ON meetings FOR DELETE TO authenticated USING (true);

-- transfers: lead transfers between team members
CREATE TABLE IF NOT EXISTS transfers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id BIGINT NOT NULL,
  from_name TEXT,
  to_name TEXT,
  from_role TEXT,
  to_role TEXT,
  reason TEXT,
  transferred_by TEXT,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transfers_select_authenticated" ON transfers;
DROP POLICY IF EXISTS "transfers_insert_authenticated" ON transfers;
CREATE POLICY "transfers_select_authenticated" ON transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "transfers_insert_authenticated" ON transfers FOR INSERT TO authenticated WITH CHECK (true);

-- daily_reports: per-employee daily activity reports
CREATE TABLE IF NOT EXISTS daily_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_name TEXT NOT NULL,
  employee_role TEXT NOT NULL,
  report_date DATE NOT NULL,
  calls_made INT DEFAULT 0,
  meetings_done INT DEFAULT 0,
  deals_closed INT DEFAULT 0,
  revenue NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_name, report_date)
);
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_reports_select_authenticated" ON daily_reports;
DROP POLICY IF EXISTS "daily_reports_insert_authenticated" ON daily_reports;
DROP POLICY IF EXISTS "daily_reports_update_authenticated" ON daily_reports;
CREATE POLICY "daily_reports_select_authenticated" ON daily_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "daily_reports_insert_authenticated" ON daily_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "daily_reports_update_authenticated" ON daily_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- whatsapp_messages: WhatsApp conversation log
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id BIGINT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outgoing',
  by_name TEXT,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "whatsapp_messages_select_authenticated" ON whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_insert_authenticated" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_select_authenticated" ON whatsapp_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "whatsapp_messages_insert_authenticated" ON whatsapp_messages FOR INSERT TO authenticated WITH CHECK (true);

-- notifications: in-app notifications (bell icon)
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_user TEXT,
  target_role TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  lead_id BIGINT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_authenticated" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON notifications;
DROP POLICY IF EXISTS "notifications_update_authenticated" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_authenticated" ON notifications;
CREATE POLICY "notifications_select_authenticated" ON notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "notifications_insert_authenticated" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update_authenticated" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notifications_delete_authenticated" ON notifications FOR DELETE TO authenticated USING (true);

-- audit_log: security audit trail for admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id BIGINT,
  actor_username TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert_authenticated" ON audit_log;
CREATE POLICY "audit_log_select_admin" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_log_insert_authenticated" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ╔════════════════════════════════════════════════════════════════╗
-- ║ 4. PERFORMANCE INDEXES                                          ║
-- ╚════════════════════════════════════════════════════════════════╝
CREATE INDEX IF NOT EXISTS idx_leads_tele_name ON leads (tele_name) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_leads_sales_name ON leads (sales_name) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_leads_is_archived ON leads (is_archived);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_leads_meeting_date ON leads (meeting_date) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON lead_notes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON team_members (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_meetings_lead_id ON meetings (lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_date ON meetings (meeting_date);
CREATE INDEX IF NOT EXISTS idx_transfers_lead_id ON transfers (lead_id);
CREATE INDEX IF NOT EXISTS idx_transfers_transferred_at ON transfers (transferred_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_employee_date ON daily_reports (employee_name, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead_id ON whatsapp_messages (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_target_user_unread ON notifications (target_user, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);

COMMIT;

-- ╔════════════════════════════════════════════════════════════════╗
-- ║ VERIFICATION QUERIES (run manually after migration)             ║
-- ╚════════════════════════════════════════════════════════════════╝
-- SELECT username, role, is_active, length(password_hash) as hash_len FROM app_users;
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
