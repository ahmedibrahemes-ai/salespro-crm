/**
 * Shared CRM Utility Functions
 *
 * Single source of truth for common helpers used across the app.
 * This module eliminates code duplication between:
 *   - src/lib/supabase.ts
 *   - src/app/api/leads/route.ts
 *   - src/app/api/duplicates/route.ts
 *   - src/components/crm/dashboard.tsx
 *   - src/components/crm/meetings-page.tsx
 *   - src/components/crm/my-meetings.tsx
 *   - src/lib/store.ts
 */

// ===== Phone Normalization =====

/** Normalize a phone number to a standard format (+966...) */
export function normalizePhone(input: string): string {
  if (!input) return ''
  let p = String(input).replace(/[\s\-()]/g, '')
  if (p.startsWith('+966')) return p
  if (p.startsWith('00966')) return '+' + p.substring(2)
  if (p.startsWith('966')) return '+' + p
  if (p.startsWith('05') && p.length >= 10) return '+966' + p.substring(1)
  if (p.startsWith('5') && p.length >= 9) return '+966' + p
  return p
}

// ===== Date/Time Helpers =====

/** Check if a timestamp (ms) falls on today's date (Egypt timezone UTC+2) */
export function isTodayTimestamp(timestamp: number): boolean {
  if (!timestamp) return false
  const d = new Date(timestamp)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

/** Check if a date string (YYYY-MM-DD) is today (Egypt timezone UTC+2) */
export function isTodayDateString(dateStr: string): boolean {
  if (!dateStr) return false
  // Use Egypt timezone instead of UTC to match local business hours
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })).toISOString().split('T')[0]
  return dateStr === today
}

/** Check if a date string (YYYY-MM-DD) falls within the current week (Sat-Fri, Arabic week) */
export function isThisWeek(dateStr: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return false

  // Use Egypt timezone (UTC+2) to match business hours
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  // Arabic week starts on Saturday (day 6 in JS, where 0=Sunday)
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysSinceSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - daysSinceSaturday)
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)

  return date >= startOfWeek && date < endOfWeek
}

/** Safely parse a timestamp from various formats */
export function safeTimestamp(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed) return null
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10)
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d.getTime()
  }
  return null
}

/** Safely parse a date string, returning YYYY-MM-DD or null */
export function safeDate(val: string | null | undefined): string | null {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const d = new Date(trimmed)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

/** Safely parse a time string, returning HH:MM or null */
export function safeTime(val: string | null | undefined): string | null {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) return trimmed
  return null
}

// ===== Data Normalization =====

/** Normalize attendance values to standard strings */
export function normalizeAttended(val: string | boolean | null | undefined): string | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'boolean') return val ? 'attended' : 'no-show'
  const str = String(val).trim().toLowerCase()
  if (str === 'true' || str === 'attended') return 'attended'
  if (str === 'false' || str === 'no-show') return 'no-show'
  if (str === 'pending') return null
  return str || null
}

// ===== DB Row Types =====

/** Database row type for a lead (snake_case columns from Supabase) */
export interface DbLead {
  id: string
  store_url: string | null
  phone: string | null
  customer_name: string | null
  customer_type: string | null
  brief: string | null
  contact_result: string | null
  contact_result_at: string | null
  tele_name: string | null
  sales_name: string | null
  meeting_date: string | null
  meeting_time: string | null
  meeting_type: string | null
  meeting_link: string | null
  status: string | null
  sales_status: string | null
  attended: string | null
  attendance_marked_at: string | null
  attendance_marked_by: string | null
  cancelled_from: string | null
  cancelled_at: string | null
  created_at: string | null
  assigned_at: string | null
  is_archived: boolean | null
  archived_at: string | null
  archived_by: string | null
}
