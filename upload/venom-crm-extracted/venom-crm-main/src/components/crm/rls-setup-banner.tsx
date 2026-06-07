'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Copy, CheckCircle2, X, ExternalLink, Database, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

const RLS_SQL = `-- ===== Venom CRM - RLS Policies + Realtime Setup =====
-- Run this SQL in the Supabase SQL Editor (Dashboard > SQL Editor)
-- This allows all users (authenticated + anon) to read and write data,
-- AND enables real-time updates for the leads and lead_notes tables.

-- 1. leads table policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access on leads" ON leads
  FOR SELECT USING (true);
CREATE POLICY "Allow insert on leads" ON leads
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on leads" ON leads
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on leads" ON leads
  FOR DELETE USING (true);

-- 2. lead_notes table policies
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access on lead_notes" ON lead_notes
  FOR SELECT USING (true);
CREATE POLICY "Allow insert on lead_notes" ON lead_notes
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on lead_notes" ON lead_notes
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on lead_notes" ON lead_notes
  FOR DELETE USING (true);

-- 3. team_members table policies
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access on team_members" ON team_members
  FOR SELECT USING (true);
CREATE POLICY "Allow insert on team_members" ON team_members
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on team_members" ON team_members
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on team_members" ON team_members
  FOR DELETE USING (true);

-- 4. settings table policies
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access on settings" ON settings
  FOR SELECT USING (true);
CREATE POLICY "Allow insert on settings" ON settings
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on settings" ON settings
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on settings" ON settings
  FOR DELETE USING (true);

-- 5. Enable Realtime for instant updates across users
-- This allows tele users to see attendance changes by sales in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE lead_notes;`

/**
 * Banner that shows when RLS policies are blocking write operations.
 * Provides the SQL the user needs to run in the Supabase SQL editor,
 * or instructions to add the service role key.
 */
export function RlsSetupBanner() {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [mode, setMode] = useState<string>('none')
  const [details, setDetails] = useState<string>('')

  // Check if write operations work on mount
  useEffect(() => {
    checkRls()
  }, [])

  async function checkRls() {
    setChecking(true)
    try {
      // Get auth token for the check
      let authToken: string | undefined
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        authToken = sessionData.session?.access_token || undefined
      } catch {
        // ignore
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authToken) headers['X-Supabase-Auth'] = authToken

      const res = await fetch('/api/setup', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'check-rls' }),
      })
      const data = await res.json()
      setMode(data.mode || 'none')
      setDetails(data.details || '')
      setShow(!data.working)
    } catch (err) {
      // If the API fails, show the banner
      setMode('error')
      setDetails(err instanceof Error ? err.message : String(err))
      setShow(true)
    } finally {
      setChecking(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(RLS_SQL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textarea = document.createElement('textarea')
      textarea.value = RLS_SQL
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (checking || !show) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[2000] bg-red-500/10 border-b border-red-500/30 backdrop-blur-sm" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-red-400">
              ⚠️ عمليات الكتابة معطّلة - Row Level Security
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              قاعدة البيانات بتمنع إضافة أو تعديل أو حذف البيانات بسبب إعدادات الأمان.
              نفس الكود ده هيفعّل التحديثات الفورية (Realtime) كمان.
              لإصلاح المشكلة، اختر أحد الحلول التالية:
            </p>

            <div className="mt-3 space-y-2">
              {/* Solution 1: Run SQL */}
              <div className="bg-background/50 rounded-md p-2.5 border border-border/50">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-venom" />
                  الحل الأول: تشغيل كود SQL في Supabase
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  انسخ الكود التالي وشغّله في Supabase SQL Editor
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="h-7 text-xs border-venom/30 text-venom hover:bg-venom/10"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
                        تم النسخ!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 ml-1" />
                        نسخ كود SQL
                      </>
                    )}
                  </Button>

                  <a
                    href="https://supabase.com/dashboard/project/gopgmisvyvqdbgkfekuf/sql/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-7 px-3 text-xs border border-venom/30 text-venom hover:bg-venom/10 rounded-md transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    فتح SQL Editor
                  </a>
                </div>
              </div>

              {/* Solution 2: Add service role key */}
              <div className="bg-background/50 rounded-md p-2.5 border border-border/50">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  الحل الثاني: إضافة Service Role Key
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  أضف مفتاح Service Role في ملف .env.local
                </p>
                <code className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded mt-1 inline-block font-mono">
                  SUPABASE_SERVICE_ROLE_KEY=your_key_here
                </code>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={checkRls}
                className="h-7 text-xs text-muted-foreground"
              >
                <Database className="w-3.5 h-3.5 ml-1" />
                إعادة الفحص
              </Button>
              {details && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                  ({details})
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShow(false)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
