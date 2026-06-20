import { createClient } from '@supabase/supabase-js'
import { DbLead, safeTimestamp, safeDate, safeTime, normalizeAttended } from '@/lib/crm-utils'

// ===== Client-side Supabase client =====
// NO hardcoded credentials — environment variables only
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isConfigured = SUPABASE_URL && SUPABASE_ANON_KEY

if (!isConfigured) {
  console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. App will run in demo mode without database.')
}

// Create client only if configured — otherwise use a null-like placeholder
// that won't expose any credentials in source code
const DUMMY_URL = 'https://placeholder.supabase.co'
const DUMMY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'

export const supabase = createClient(
  SUPABASE_URL || DUMMY_URL,
  SUPABASE_ANON_KEY || DUMMY_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

// ===== Server-side API helper =====
// Routes write operations through our Next.js API route which uses
// the Supabase service role key to bypass Row Level Security (RLS).
// Authentication is done via our signed session token (HMAC) — no more
// reliance on Supabase auth sessions for API authorization.

/** Get the signed session token.
 *  Tries localStorage first, then falls back to the Zustand store (persisted).
 *  This dual approach ensures the token is always available on page refresh. */
function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    // Try localStorage first (fastest)
    const token = localStorage.getItem('venom-session')
    if (token) return token

    // Fallback: check Zustand store (persisted via localStorage)
    // This handles edge cases where localStorage 'venom-session' was cleared
    // but the Zustand persist still has the token
    const storeData = localStorage.getItem('venom-crm-storage')
    if (storeData) {
      const parsed = JSON.parse(storeData)
      const storeToken = parsed?.state?.sessionToken
      if (storeToken) {
        // Restore to localStorage for future fast access
        try { localStorage.setItem('venom-session', storeToken) } catch { /* ignore */ }
        return storeToken
      }
    }

    console.warn('[auth] No session token found — API calls will fail with 401')
    return null
  } catch (e) {
    console.error('[auth] Failed to read session token:', e)
    return null
  }
}

/** Build headers with the session token for authenticated API calls. */
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getSessionToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (extra) Object.assign(headers, extra)
  return headers
}

async function serverOp<T = unknown>(operation: string, data: unknown): Promise<T> {
  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ operation, data }),
  })
  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(json.error || `Server operation "${operation}" failed (${res.status})`)
  }
  return json.data ?? json
}

// ===== Types =====
export interface TeamMember {
  id: string
  name: string
  role: 'tele' | 'sales' | 'admin'
  is_active: boolean
}

export interface LeadNote {
  id: string
  by: string
  cat: string
  text: string
  at: number
}

export interface Lead {
  id: string
  storeUrl: string
  phone: string
  customerName: string
  customerType: string
  brief: string
  contactResult: string
  contactResultAt: number | null
  tele: string
  sales: string | null
  meetingDate: string
  meetingTime: string
  meetingType: string
  meetingLink: string
  status: string | null
  salesStatus: string | null
  attended: string | null
  attendanceMarkedAt: number | null
  attendanceMarkedBy: string | null
  cancelledFrom: string | null
  cancelledAt: number | null
  createdAt: number
  assignedAt: number | null
  isArchived: boolean
  archivedAt: number | null
  archivedBy: string | null
  notes: LeadNote[]
}

// ===== DB Row Types =====
interface DbNote {
  id: string
  by_name: string | null
  category: string | null
  text: string | null
  created_at: string | null
}

// ===== Helpers =====

function leadFromDb(row: DbLead): Lead {
  return {
    id: String(row.id),
    storeUrl: row.store_url || '',
    phone: row.phone || '',
    customerName: row.customer_name || '',
    customerType: row.customer_type || '',
    brief: row.brief || '',
    contactResult: row.contact_result || '',
    contactResultAt: safeTimestamp(row.contact_result_at),
    tele: (row.tele_name || '').trim(),
    sales: row.sales_name ? row.sales_name.trim() : null,
    meetingDate: row.meeting_date || '',
    meetingTime: row.meeting_time ? row.meeting_time.substring(0, 5) : '',
    meetingType: row.meeting_type || '',
    meetingLink: row.meeting_link || '',
    status: row.status || null,
    salesStatus: row.sales_status || null,
    attended: normalizeAttended(row.attended),
    attendanceMarkedAt: safeTimestamp(row.attendance_marked_at),
    attendanceMarkedBy: row.attendance_marked_by || null,
    cancelledFrom: row.cancelled_from || null,
    cancelledAt: safeTimestamp(row.cancelled_at),
    createdAt: safeTimestamp(row.created_at) ?? 0,
    assignedAt: safeTimestamp(row.assigned_at),
    isArchived: row.is_archived || false,
    archivedAt: safeTimestamp(row.archived_at),
    archivedBy: row.archived_by || null,
    notes: [],
  }
}

function notesFromDb(notes: DbNote[] | undefined): LeadNote[] {
  if (!notes || !Array.isArray(notes)) return []
  return notes
    .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime())
    .map((n) => ({
      id: String(n.id),
      by: n.by_name || '',
      cat: n.category || '',
      text: n.text || '',
      at: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
    }))
}

function leadToDb(lead: Partial<Lead>) {
  const contactAt = lead.contactResultAt || (lead.contactResult ? Date.now() : null)
  return {
    store_url: lead.storeUrl || null,
    phone: lead.phone || null,
    customer_name: lead.customerName || null,
    customer_type: lead.customerType || null,
    brief: lead.brief || null,
    contact_result: lead.contactResult || null,
    contact_result_at: contactAt ? new Date(contactAt).toISOString() : null,
    tele_name: lead.tele || null,
    sales_name: lead.sales || null,
    meeting_date: safeDate(lead.meetingDate || null),
    meeting_time: safeTime(lead.meetingTime || null),
    meeting_type: lead.meetingType || null,
    meeting_link: lead.meetingLink || null,
    status: lead.status || null,
    sales_status: lead.salesStatus || null,
    attended: lead.attended === undefined ? null : lead.attended,
    attendance_marked_at: lead.attendanceMarkedAt ? new Date(lead.attendanceMarkedAt).toISOString() : null,
    attendance_marked_by: lead.attendanceMarkedBy || null,
    cancelled_from: lead.cancelledFrom || null,
    cancelled_at: lead.cancelledAt ? new Date(lead.cancelledAt).toISOString() : null,
    assigned_at: lead.assignedAt ? new Date(lead.assignedAt).toISOString() : null,
    is_archived: lead.isArchived || false,
    archived_at: lead.archivedAt ? new Date(lead.archivedAt).toISOString() : null,
    archived_by: lead.archivedBy || null,
  }
}

function partialLeadToDb(updates: Partial<Lead>): Record<string, unknown> {
  const dbData: Record<string, unknown> = {}
  if ('storeUrl' in updates) dbData.store_url = updates.storeUrl || null
  if ('phone' in updates) dbData.phone = updates.phone || null
  if ('customerName' in updates) dbData.customer_name = updates.customerName || null
  if ('customerType' in updates) dbData.customer_type = updates.customerType || null
  if ('brief' in updates) dbData.brief = updates.brief || null
  if ('contactResult' in updates) dbData.contact_result = updates.contactResult || null
  if ('contactResultAt' in updates) dbData.contact_result_at = updates.contactResultAt ? new Date(updates.contactResultAt).toISOString() : null
  if ('tele' in updates) dbData.tele_name = updates.tele || null
  if ('sales' in updates) dbData.sales_name = updates.sales || null
  if ('meetingDate' in updates) dbData.meeting_date = safeDate(updates.meetingDate || null)
  if ('meetingTime' in updates) dbData.meeting_time = safeTime(updates.meetingTime || null)
  if ('meetingType' in updates) dbData.meeting_type = updates.meetingType || null
  if ('meetingLink' in updates) dbData.meeting_link = updates.meetingLink || null
  if ('status' in updates) dbData.status = updates.status || null
  if ('salesStatus' in updates) dbData.sales_status = updates.salesStatus || null
  if ('attended' in updates) dbData.attended = updates.attended === undefined ? null : updates.attended
  if ('attendanceMarkedAt' in updates) dbData.attendance_marked_at = updates.attendanceMarkedAt ? new Date(updates.attendanceMarkedAt).toISOString() : null
  if ('attendanceMarkedBy' in updates) dbData.attendance_marked_by = updates.attendanceMarkedBy || null
  if ('cancelledFrom' in updates) dbData.cancelled_from = updates.cancelledFrom || null
  if ('cancelledAt' in updates) dbData.cancelled_at = updates.cancelledAt ? new Date(updates.cancelledAt).toISOString() : null
  if ('assignedAt' in updates) dbData.assigned_at = updates.assignedAt ? new Date(updates.assignedAt).toISOString() : null
  if ('isArchived' in updates) dbData.is_archived = updates.isArchived || false
  if ('archivedAt' in updates) dbData.archived_at = updates.archivedAt ? new Date(updates.archivedAt).toISOString() : null
  if ('archivedBy' in updates) dbData.archived_by = updates.archivedBy || null
  return dbData
}

// ===== API Functions =====

export async function apiLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function apiLogout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function apiGetSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function apiGetTeam() {
  const { data, error } = await supabase
    .from('team_members')
    .select('name, role')
    .eq('is_active', true)
    .order('name')
  if (error) throw error

  if (!data || data.length === 0) {
    const { DEFAULT_TEAM } = await import('@/lib/store')
    return DEFAULT_TEAM
  }

  const team: { tele: string[]; sales: string[]; admin: string[] } = { tele: [], sales: [], admin: [] }
  ;(data as TeamMember[]).forEach((m) => {
    if (team[m.role as keyof typeof team]) team[m.role as keyof typeof team].push(m.name)
  })
  return team
}

export async function apiGetLeads(includeArchived = false): Promise<Lead[]> {
  const params = new URLSearchParams()
  if (includeArchived) params.set('archived', 'true')

  const res = await fetch(`/api/leads?${params.toString()}`, { headers: authHeaders() })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const msg = errBody?.error || `فشل تحميل البيانات (HTTP ${res.status})`
    throw new Error(msg)
  }
  const json = await res.json()
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error('استجابة غير صالحة من الخادم')
  }
  return json.data as Lead[]
}

export async function apiGetArchivedLeads(): Promise<Lead[]> {
  const res = await fetch('/api/leads?archived_only=true', { headers: authHeaders() })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const msg = errBody?.error || `فشل تحميل الأرشيف (HTTP ${res.status})`
    throw new Error(msg)
  }
  const json = await res.json()
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error('استجابة غير صالحة من الخادم')
  }
  return json.data as Lead[]
}

export async function apiCreateLead(lead: Partial<Lead>): Promise<Lead> {
  // No direct-Supabase fallback — the server API uses the service role key
  // (bypasses RLS) and our in-memory cache. Falling back to the client-side
  // anon client would bypass the cache AND fail under RLS. Surface the error.
  return serverOp<Lead>('create', lead)
}

export async function apiBulkCreateLeads(leadsArr: Partial<Lead>[]): Promise<Lead[]> {
  if (!Array.isArray(leadsArr) || leadsArr.length === 0) return []
  const data = await serverOp<Lead[]>('bulkCreate', leadsArr)
  return Array.isArray(data) ? data : []
}

export async function apiUpdateLead(id: string, updates: Partial<Lead>): Promise<Lead | null> {
  return serverOp<Lead | null>('update', { id, updates })
}

export async function apiDeleteLead(id: string) {
  await serverOp('delete', id)
}

export async function apiDeleteLeadsBulk(ids: string[]) {
  await serverOp('bulkDelete', ids)
}

export async function apiArchiveLeads(ids: string[], byName: string) {
  if (!Array.isArray(ids) || ids.length === 0) return
  await serverOp('archive', { ids, archivedBy: byName })
}

export async function apiUnarchiveLeads(ids: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) return
  await serverOp('unarchive', ids)
}

export async function apiGetLeadNotes(leadId: string): Promise<LeadNote[]> {
  const { data, error } = await supabase
    .from('lead_notes')
    .select('id,by_name,category,text,created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return notesFromDb(data as DbNote[])
}

export async function apiAddNote(leadId: string, by: string, cat: string, text: string) {
  return serverOp('addNote', { leadId, by, cat, text })
}

export async function apiDeleteNote(noteId: string | number) {
  await serverOp('deleteNote', noteId)
}

export async function apiAddTeamMember(name: string, role: string) {
  return serverOp('addTeamMember', { name, role })
}

export async function apiRemoveTeamMember(name: string) {
  await serverOp('removeTeamMember', name)
}

export async function apiRenameTeamMember(oldName: string, newName: string) {
  await serverOp('renameTeamMember', { oldName, newName })
}

// ===== Access Permissions (who can view whose sheets) =====
export async function apiGetAccessPermissions(): Promise<{ teleAccess: Record<string, string[]>; salesAccess: Record<string, string[]> }> {
  try {
    const { data, error } = await supabase
      .from('access_permissions')
      .select('viewer_name, target_name, role')
      .eq('is_active', true)

    if (error) {
      console.warn('[apiGetAccessPermissions] Query error:', error.message)
      return { teleAccess: {}, salesAccess: {} }
    }

    const teleAccess: Record<string, string[]> = {}
    const salesAccess: Record<string, string[]> = {}

    for (const row of (data || []) as Array<{ viewer_name: string; target_name: string; role: string }>) {
      const access = row.role === 'sales' ? salesAccess : teleAccess
      if (!access[row.viewer_name]) access[row.viewer_name] = []
      access[row.viewer_name].push(row.target_name)
    }

    return { teleAccess, salesAccess }
  } catch {
    return { teleAccess: {}, salesAccess: {} }
  }
}

export async function apiSaveAccessPermissions(
  teleAccess: Record<string, string[]>,
  salesAccess: Record<string, string[]>
): Promise<void> {
  // No direct-Supabase fallback — server API uses service role key + cache invalidation.
  await serverOp('saveAccessPermissions', { teleAccess, salesAccess })
}

// ===== Broadcast removed — postgres_changes already sends updates to all clients =====
// Previously we had a separate broadcast channel that DOUBLED the realtime messages.
// Now we rely solely on postgres_changes which is sufficient for cross-user updates.
export interface BroadcastMessage {
  type: 'attendance' | 'assignment' | 'status' | 'archive' | 'note' | 'delete' | 'reset-attendance'
  leadId: string
  data: Partial<Lead>
  by: string
  byRole: string
  at: number
}

// No-op: broadcast is removed to halve realtime message count
export function apiBroadcastChange(_message: BroadcastMessage): void {
  // Intentionally empty — postgres_changes handles all real-time updates
}

// ===== Notifications API =====

export interface AppNotification {
  id: string
  targetUser: string | null
  targetRole: string | null
  type: 'attendance' | 'transfer' | 'new-lead' | 'note' | 'system'
  message: string
  leadId: string | null
  read: boolean
  readAt: number | null
  createdAt: number
}

export async function apiGetNotifications(unreadOnly = false): Promise<{ data: AppNotification[]; unreadCount: number }> {
  const params = new URLSearchParams()
  if (unreadOnly) params.set('unread_only', 'true')
  params.set('limit', '50')

  const res = await fetch(`/api/notifications?${params.toString()}`, { headers: authHeaders() })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error || `فشل تحميل الإشعارات (HTTP ${res.status})`)
  }
  const json = await res.json()
  return {
    data: (json.data || []) as AppNotification[],
    unreadCount: json.unreadCount || 0,
  }
}

export async function apiMarkNotificationRead(id: string): Promise<void> {
  const res = await fetch('/api/notifications', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error || 'فشل تحديث الإشعار')
  }
}

export async function apiMarkAllNotificationsRead(): Promise<void> {
  const res = await fetch('/api/notifications', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ all: true }),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error || 'فشل تحديث الإشعارات')
  }
}

// ===== Transfers API =====

export interface Transfer {
  id: string
  leadId: string
  fromName: string
  toName: string
  fromRole: string
  toRole: string
  reason: string
  transferredBy: string
  transferredAt: number
  lead?: {
    id: string
    customerName: string
    phone: string
    storeUrl: string
    brief: string
    meetingDate: string
    meetingTime: string
    attended: string
    salesStatus: string
    tele: string
    sales: string
  }
}

export async function apiGetTransfers(filters?: {
  tele?: string
  sales?: string
  search?: string
  datePreset?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}): Promise<{ data: Transfer[]; total: number; page: number; limit: number; hasMore: boolean }> {
  const params = new URLSearchParams()
  if (filters?.tele) params.set('tele', filters.tele)
  if (filters?.sales) params.set('sales', filters.sales)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.datePreset) params.set('date_preset', filters.datePreset)
  if (filters?.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters?.dateTo) params.set('date_to', filters.dateTo)
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.limit) params.set('limit', String(filters.limit))

  const res = await fetch(`/api/transfers?${params.toString()}`, { headers: authHeaders() })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error || `فشل تحميل التحويلات (HTTP ${res.status})`)
  }
  return await res.json()
}

export async function apiCreateTransfer(data: {
  lead_id: string | number
  from_name: string
  to_name: string
  from_role?: string
  to_role?: string
  reason?: string
}): Promise<Transfer> {
  const res = await fetch('/api/transfers', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error || 'فشل إنشاء التحويل')
  }
  const json = await res.json()
  return json.data as Transfer
}

// ===== Meetings API =====

export interface Meeting {
  leadId: string
  customerName: string
  phone: string
  storeUrl: string
  brief: string
  tele: string
  sales: string
  meetingDate: string
  meetingTime: string
  meetingType: string
  meetingLink: string
  attended: string
  attendanceMarkedAt: number | null
  attendanceMarkedBy: string
  salesStatus: string
  assignedAt: number | null
  createdAt: number
}

export async function apiGetMeetings(filters?: {
  filter?: 'today' | 'week' | 'upcoming' | 'all'
  member?: string
  search?: string
}): Promise<{ data: Meeting[]; total: number }> {
  const params = new URLSearchParams()
  if (filters?.filter) params.set('filter', filters.filter)
  if (filters?.member) params.set('member', filters.member)
  if (filters?.search) params.set('search', filters.search)

  const res = await fetch(`/api/meetings?${params.toString()}`, { headers: authHeaders() })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error || `فشل تحميل الاجتماعات (HTTP ${res.status})`)
  }
  return await res.json()
}

export async function apiMarkMeetingAttendance(leadId: string, attended: 'attended' | 'no-show'): Promise<void> {
  const res = await fetch('/api/meetings', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ lead_id: leadId, attended }),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error || 'فشل تحديث الحضور')
  }
}

// ===== Daily Reports API =====

export interface DailyReport {
  id: string
  employeeName: string
  employeeRole: string
  reportDate: string
  callsMade: number
  meetingsDone: number
  dealsClosed: number
  revenue: number
  notes: string
  submittedAt: number
}

export async function apiGetDailyReports(filters?: {
  date?: string
  employee?: string
  role?: string
}): Promise<DailyReport[]> {
  const params = new URLSearchParams()
  if (filters?.date) params.set('date', filters.date)
  if (filters?.employee) params.set('employee', filters.employee)
  if (filters?.role) params.set('role', filters.role)

  const res = await fetch(`/api/daily-reports?${params.toString()}`, { headers: authHeaders() })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error || `فشل تحميل التقارير (HTTP ${res.status})`)
  }
  const json = await res.json()
  return json.data as DailyReport[]
}

export async function apiSubmitDailyReport(data: {
  employee_name: string
  employee_role: string
  report_date: string
  calls_made?: number
  meetings_done?: number
  deals_closed?: number
  revenue?: number
  notes?: string
}): Promise<DailyReport> {
  const res = await fetch('/api/daily-reports', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error || 'فشل حفظ التقرير')
  }
  const json = await res.json()
  return json.data as DailyReport
}

// ===== Toast Deduplication =====
// FIX (memory leak): The old cleanup only ran when isDuplicateToast was called.
// If toasts stopped coming, the map would grow indefinitely. Now we cap the size
// and run periodic cleanup via setInterval (registered once, cleared on page unload).
const recentToastMap = new Map<string, number>()
const TOAST_DEDUP_MS = 3000
const TOAST_MAP_MAX_SIZE = 500

let toastCleanupInterval: ReturnType<typeof setInterval> | null = null

function ensureToastCleanupRunning() {
  if (toastCleanupInterval || typeof window === 'undefined') return
  toastCleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [id, ts] of recentToastMap) {
      if (now - ts > TOAST_DEDUP_MS * 2) {
        recentToastMap.delete(id)
      }
    }
    // Hard cap: if still over size, delete oldest entries
    if (recentToastMap.size > TOAST_MAP_MAX_SIZE) {
      const entries = [...recentToastMap.entries()].sort((a, b) => a[1] - b[1])
      const toRemove = entries.length - TOAST_MAP_MAX_SIZE
      for (let i = 0; i < toRemove; i++) {
        recentToastMap.delete(entries[i][0])
      }
    }
  }, 10000) // run every 10s
  // Don't keep the process alive just for this interval
  if (toastCleanupInterval && typeof toastCleanupInterval.unref === 'function') {
    toastCleanupInterval.unref()
  }
}

export function isDuplicateToast(leadId: string | number): boolean {
  ensureToastCleanupRunning()
  const key = String(leadId)
  const lastTime = recentToastMap.get(key) || 0
  const now = Date.now()
  if (now - lastTime < TOAST_DEDUP_MS) return true
  recentToastMap.set(key, now)
  // Inline cleanup (cheap, runs only when called)
  if (recentToastMap.size > TOAST_MAP_MAX_SIZE) {
    for (const [id, ts] of recentToastMap) {
      if (now - ts > TOAST_DEDUP_MS * 2) recentToastMap.delete(id)
    }
  }
  return false
}

// ===== Real-time Subscription =====
const PRIORITY_FIELDS = new Set([
  'attended', 'attendance_marked_at', 'attendance_marked_by',
  'sales_name', 'sales_status', 'assigned_at',
  'is_archived', 'archived_at',
])

function hasPriorityChange(
  oldRow: Record<string, unknown> | undefined,
  newRow: Record<string, unknown>
): boolean {
  if (!oldRow) return true
  for (const field of PRIORITY_FIELDS) {
    if (oldRow[field] !== newRow[field]) return true
  }
  return false
}

// FIX (memory leak): Use a Map with a hard size cap instead of an unbounded Record.
// Each lead ID added an entry that was only deleted after the timer fired.
// In long sessions with thousands of leads, this grew without bound.
const realtimeDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const DEBOUNCE_MS = 50
const DEBOUNCE_MAP_MAX_SIZE = 1000

function setDebounceTimer(key: string, fn: () => void, ms: number) {
  // Clear existing timer for this key
  const existing = realtimeDebounceTimers.get(key)
  if (existing) clearTimeout(existing)

  // If the map is too large, evict oldest entries (simple LRU-ish)
  if (realtimeDebounceTimers.size >= DEBOUNCE_MAP_MAX_SIZE) {
    const firstKey = realtimeDebounceTimers.keys().next().value
    if (firstKey) {
      const old = realtimeDebounceTimers.get(firstKey)
      if (old) clearTimeout(old)
      realtimeDebounceTimers.delete(firstKey)
    }
  }

  const timer = setTimeout(() => {
    realtimeDebounceTimers.delete(key)
    fn()
  }, ms)
  realtimeDebounceTimers.set(key, timer)
}

function clearDebounceTimer(key: string) {
  const timer = realtimeDebounceTimers.get(key)
  if (timer) {
    clearTimeout(timer)
    realtimeDebounceTimers.delete(key)
  }
}

function clearAllDebounceTimers() {
  for (const timer of realtimeDebounceTimers.values()) {
    clearTimeout(timer)
  }
  realtimeDebounceTimers.clear()
}

export function apiSubscribeToLeads(
  callback: (payload: Record<string, unknown>) => void,
  onStatusChange?: (status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT') => void
) {
  // IMPORTANT: We subscribe to only UPDATE and INSERT events on leads.
  // - Removed lead_notes subscription (not used in client, saves ~50% realtime messages)
  // - Removed DELETE event (handled by UPDATE with is_archived, or just refetch)
  // - This reduces realtime egress dramatically
  let channel: ReturnType<typeof supabase.channel> | null = null

  // Retry logic: if the channel closes unexpectedly, attempt to reconnect
  // with exponential backoff (1s, 2s, 4s, 8s, max 30s).
  let retryCount = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  const MAX_RETRY_DELAY_MS = 30000
  const BASE_RETRY_DELAY_MS = 1000

  function clearRetryTimer() {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  function scheduleReconnect() {
    clearRetryTimer()
    const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, retryCount), MAX_RETRY_DELAY_MS)
    retryCount++
    console.log(`[realtime] Reconnecting in ${delay}ms (attempt ${retryCount})...`)
    retryTimer = setTimeout(() => {
      if (!channel) return
      console.log('[realtime] Attempting reconnect...')
      try {
        channel.subscribe()
      } catch (err) {
        console.error('[realtime] Reconnect failed:', err)
        scheduleReconnect()
      }
    }, delay)
  }

  channel = supabase
    .channel('leads_changes', {
      config: { broadcast: { self: false } },
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (rawPayload) => {
      const payload = rawPayload as Record<string, unknown>
      callback(payload)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (rawPayload) => {
      const payload = rawPayload as Record<string, unknown>
      const newRow = payload.new as Record<string, unknown> | undefined
      const oldRow = payload.old as Record<string, unknown> | undefined
      const id = newRow?.id
      if (id) {
        const key = `leads:${id}`
        if (hasPriorityChange(oldRow, newRow)) {
          // Priority changes fire immediately (no debounce)
          clearDebounceTimer(key)
          callback(payload)
          return
        }
        // Non-priority changes are debounced to prevent UI flickering
        setDebounceTimer(key, () => callback(payload), DEBOUNCE_MS)
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (rawPayload) => {
      callback(rawPayload as Record<string, unknown>)
    })
    // NOTE: lead_notes subscription removed — client doesn't process note changes.
    // Notes are loaded on-demand when a lead detail is opened.
    // This saves ~50% of realtime messages/egress.
    .subscribe((status, err) => {
      console.log(`[realtime] Status: ${status}`, err || '')
      if (status === 'SUBSCRIBED') {
        // Reset retry counter on successful connection
        retryCount = 0
        clearRetryTimer()
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Auto-reconnect with exponential backoff
        scheduleReconnect()
      }
      if (onStatusChange) {
        onStatusChange(status as 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT')
      }
    })

  // Return a wrapper that cleans up timers AND the channel on unsubscribe
  const wrappedChannel = {
    channel,
    unsubscribe() {
      clearRetryTimer()
      clearAllDebounceTimers()
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch (err) {
          console.error('[realtime] Error removing channel:', err)
        }
      }
    },
  }

  return wrappedChannel as unknown as ReturnType<typeof supabase.channel>
}

export function apiUnsubscribe(channel: ReturnType<typeof supabase.channel> | null) {
  if (!channel) return
  // The channel passed in is our wrapped object with a custom unsubscribe
  const wrapped = channel as unknown as { unsubscribe?: () => void; channel?: unknown }
  if (wrapped && typeof wrapped.unsubscribe === 'function') {
    wrapped.unsubscribe()
    return
  }
  // Fallback: assume it's a raw Supabase channel
  try {
    supabase.removeChannel(channel as ReturnType<typeof supabase.channel>)
  } catch (err) {
    console.error('[realtime] Error in apiUnsubscribe fallback:', err)
  }
}
