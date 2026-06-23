-- ╔════════════════════════════════════════════════════════════════╗
-- ║ Migration: audit fixes — lead_notes RLS + typo status fix         ║
-- ║ Date: 2026-06-22                                                  ║
-- ║ Source: External code audit (§1 row 4, §4 row 11)                 ║
-- ║                                                                  ║
-- ║ Two fixes:                                                       ║
-- ║ 1. Remove anon SELECT on lead_notes (data leak — audit §1 row 4) ║
-- ║ 2. Fix typo status 'follow up-2' → 'followup-2' (audit §4 row 11)║
-- ║                                                                  ║
-- ║ Idempotent. Safe to re-run.                                      ║
-- ╚════════════════════════════════════════════════════════════════╝

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- 1. lead_notes RLS: remove anon SELECT (data leak fix)
-- ────────────────────────────────────────────────────────────────────
-- The client-side realtime subscription ONLY subscribes to the 'leads'
-- table (NOT lead_notes — see supabase.ts:apiSubscribeToLeads).
-- Therefore anon SELECT on lead_notes is NOT needed for realtime.
-- Keeping it allows any visitor to read all internal notes (by_name,
-- category, text) via Supabase REST.
--
-- We DROP the anon SELECT policy. authenticated SELECT stays (for any
-- future authenticated realtime use). Writes remain authenticated-only.

DROP POLICY IF EXISTS "lead_notes_select_anon" ON lead_notes;
-- Note: lead_notes_select_authenticated, lead_notes_insert/update/delete
-- remain unchanged (authenticated-only writes).

-- ────────────────────────────────────────────────────────────────────
-- 2. Typo status fix: 'follow up-2' (space) → 'followup-2' (hyphen)
-- ────────────────────────────────────────────────────────────────────
-- 1 lead in production has status='follow up-2' (space instead of hyphen).
-- The follow-up filter checks for 'followup-2' so this lead is invisible.
-- Fix the data:

UPDATE leads SET status = 'followup-2' WHERE status = 'follow up-2';

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Verification queries (run manually to confirm)
-- ────────────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM leads WHERE status = 'follow up-2';  -- should be 0
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'lead_notes';
--   -- should show NO policy with 'anon' in roles
