import { createClient } from '@supabase/supabase-js'

// ===== Client-side Supabase client =====
// NO hardcoded credentials — environment variables only
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isConfigured = SUPABASE_URL && SUPABASE_ANON_KEY

if (!isConfigured) {
  console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. App will run in demo mode without database.')
}

// Create client with a dummy URL if not configured, so the app still renders
// The actual API calls will gracefully fail/return empty data
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzYzNjM2MDAsImV4cCI6MTk5MjAyMDAwMH0.placeholder',
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
async function serverOp<T = unknown>(operation: string, data: unknown): Promise<T> {
  let authToken: string | undefined
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    authToken = sessionData.session?.access_token || undefined
  } catch {
    // Session might not be available yet
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) {
    headers['X-Supabase-Auth'] = authToken
  }

  const res = await fetch('/api/leads', {
    method: 'POST',
    headers,
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
  status: string
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
interface DbLead {
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

interface DbNote {
  id: string
  by_name: string | null
  category: string | null
  text: string | null
  created_at: string | null
}

// ===== Helpers =====
function safeTimestamp(val: string | number | null | undefined): number | null {
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

function safeDate(val: string | null | undefined): string | null {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const d = new Date(trimmed)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

function safeTime(val: string | null | undefined): string | null {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) return trimmed
  return null
}

export function normalizeAttended(val: string | boolean | null | undefined): string | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'boolean') return val ? 'attended' : 'no-show'
  const str = String(val).trim().toLowerCase()
  if (str === 'true' || str === 'attended') return 'attended'
  if (str === 'false' || str === 'no-show') return 'no-show'
  if (str === 'pending') return null
  return str || null
}

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
    status: row.status || 'new',
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
    status: lead.status || 'new',
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
  if ('status' in updates) dbData.status = updates.status || 'new'
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
    .select('*')
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
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const authToken = sessionData.session?.access_token
      if (authToken) headers['X-Supabase-Auth'] = authToken
    } catch { /* ignore */ }

    const params = new URLSearchParams()
    if (includeArchived) params.set('archived', 'true')

    const res = await fetch(`/api/leads?${params.toString()}`, { headers })
    if (res.ok) {
      const json = await res.json()
      if (json.data && Array.isArray(json.data)) {
        return json.data as Lead[]
      }
    }
  } catch (err) {
    console.warn('[apiGetLeads] Server API error:', err)
  }

  // Client-side fallback
  const PAGE_SIZE = 1000
  let allData: DbLead[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('leads')
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (!includeArchived) {
      query = query.eq('is_archived', false)
    }

    const { data, error } = await query
    if (error) throw error

    if (data && data.length > 0) {
      allData = allData.concat(data as DbLead[])
      from += PAGE_SIZE
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
  }

  return allData.map((row) => leadFromDb(row))
}

export async function apiGetArchivedLeads(): Promise<Lead[]> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const authToken = sessionData.session?.access_token
      if (authToken) headers['X-Supabase-Auth'] = authToken
    } catch { /* ignore */ }

    const res = await fetch('/api/leads?archived_only=true', { headers })
    if (res.ok) {
      const json = await res.json()
      if (json.data && Array.isArray(json.data)) {
        return json.data as Lead[]
      }
    }
  } catch (err) {
    console.warn('[apiGetArchivedLeads] Server API error:', err)
  }

  // Client-side fallback
  const PAGE_SIZE = 1000
  let allData: DbLead[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('is_archived', true)
      .order('archived_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (data && data.length > 0) {
      allData = allData.concat(data as DbLead[])
      from += PAGE_SIZE
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
  }

  return allData.map((row) => leadFromDb(row))
}

export async function apiCreateLead(lead: Partial<Lead>): Promise<Lead> {
  try {
    const data = await serverOp<Lead>('create', lead)
    return data
  } catch (serverErr) {
    console.warn('[apiCreateLead] Server API failed:', serverErr)
    const dbData = leadToDb(lead)
    let { data, error } = await supabase.from('leads').insert(dbData).select().single()
    if (error && /contact_result_at/i.test(error.message || '')) {
      delete (dbData as Record<string, unknown>).contact_result_at
      const retry = await supabase.from('leads').insert(dbData).select().single()
      data = retry.data
      error = retry.error
    }
    if (error) throw new Error(`فشل في إضافة الصف: ${error.message}`)
    return leadFromDb(data as DbLead)
  }
}

export async function apiBulkCreateLeads(leadsArr: Partial<Lead>[]): Promise<Lead[]> {
  if (!Array.isArray(leadsArr) || leadsArr.length === 0) return []
  try {
    const data = await serverOp<Lead[]>('bulkCreate', leadsArr)
    return Array.isArray(data) ? data : []
  } catch (serverErr) {
    console.warn('[apiBulkCreateLeads] Server API failed:', serverErr)
    const BATCH_SIZE = 500
    let allCreated: Lead[] = []
    for (let i = 0; i < leadsArr.length; i += BATCH_SIZE) {
      const batch = leadsArr.slice(i, i + BATCH_SIZE)
      const dbData = batch.map(leadToDb)
      const { data, error } = await supabase.from('leads').insert(dbData).select()
      if (error) throw new Error(`فشل في رفع البيانات: ${error.message}`)
      if (data) allCreated = allCreated.concat((data as DbLead[]).map(leadFromDb))
    }
    return allCreated
  }
}

export async function apiUpdateLead(id: string, updates: Partial<Lead>): Promise<Lead | null> {
  try {
    const data = await serverOp<Lead | null>('update', { id, updates })
    return data
  } catch (serverErr) {
    console.warn('[apiUpdateLead] Server API failed:', serverErr)
    const dbData = partialLeadToDb(updates)
    const { data, error } = await supabase.from('leads').update(dbData).eq('id', id).select().single()
    if (error) {
      const { error: updateError } = await supabase.from('leads').update(dbData).eq('id', id)
      if (updateError) throw new Error(`فشل التحديث: ${updateError.message}`)
      return null
    }
    return leadFromDb(data as DbLead)
  }
}

export async function apiDeleteLead(id: string) {
  try {
    await serverOp('delete', id)
  } catch (serverErr) {
    console.warn('[apiDeleteLead] Server API failed:', serverErr)
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) throw new Error(`فشل الحذف: ${error.message}`)
  }
}

export async function apiDeleteLeadsBulk(ids: string[]) {
  try {
    await serverOp('bulkDelete', ids)
  } catch (serverErr) {
    console.warn('[apiDeleteLeadsBulk] Server API failed:', serverErr)
    const BATCH_SIZE = 100
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('leads').delete().in('id', batch)
      if (error) throw new Error(`فشل الحذف: ${error.message}`)
    }
  }
}

export async function apiArchiveLeads(ids: string[], byName: string) {
  if (!Array.isArray(ids) || ids.length === 0) return
  try {
    await serverOp('archive', { ids, archivedBy: byName })
  } catch (serverErr) {
    console.warn('[apiArchiveLeads] Server API failed:', serverErr)
    const BATCH_SIZE = 100
    const archivedAt = new Date().toISOString()
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('leads')
        .update({ is_archived: true, archived_at: archivedAt, archived_by: byName })
        .in('id', batch)
      if (error) throw new Error(`فشل الأرشفة: ${error.message}`)
    }
  }
}

export async function apiUnarchiveLeads(ids: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) return
  try {
    await serverOp('unarchive', ids)
  } catch (serverErr) {
    console.warn('[apiUnarchiveLeads] Server API failed:', serverErr)
    const BATCH_SIZE = 100
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('leads')
        .update({ is_archived: false, archived_at: null, archived_by: null })
        .in('id', batch)
      if (error) throw new Error(`فشل إلغاء الأرشفة: ${error.message}`)
    }
  }
}

export async function apiGetLeadNotes(leadId: string): Promise<LeadNote[]> {
  const { data, error } = await supabase
    .from('lead_notes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return notesFromDb(data as DbNote[])
}

export async function apiAddNote(leadId: string, by: string, cat: string, text: string) {
  try {
    const data = await serverOp('addNote', { leadId, by, cat, text })
    return data
  } catch (serverErr) {
    console.warn('[apiAddNote] Server API failed:', serverErr)
    const { data, error } = await supabase
      .from('lead_notes')
      .insert({ lead_id: leadId, by_name: by, category: cat, text })
      .select()
      .single()
    if (error) throw new Error(`فشل إضافة الملاحظة: ${error.message}`)
    return data
  }
}

export async function apiDeleteNote(noteId: string | number) {
  try {
    await serverOp('deleteNote', noteId)
  } catch (serverErr) {
    console.warn('[apiDeleteNote] Server API failed:', serverErr)
    const { error } = await supabase.from('lead_notes').delete().eq('id', noteId)
    if (error) throw new Error(`فشل حذف الملاحظة: ${error.message}`)
  }
}

export async function apiAddTeamMember(name: string, role: string) {
  try {
    const data = await serverOp('addTeamMember', { name, role })
    return data
  } catch (serverErr) {
    console.warn('[apiAddTeamMember] Server API failed:', serverErr)
    const { data: existing } = await supabase
      .from('team_members')
      .select('*')
      .eq('name', name)
      .eq('is_active', false)
      .maybeSingle()

    if (existing) {
      const { data, error } = await supabase
        .from('team_members')
        .update({ is_active: true, role })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw new Error(`فشل إضافة عضو: ${error.message}`)
      return data
    }

    const { data, error } = await supabase.from('team_members').insert({ name, role }).select().single()
    if (error) throw new Error(`فشل إضافة عضو: ${error.message}`)
    return data
  }
}

export async function apiRemoveTeamMember(name: string) {
  try {
    await serverOp('removeTeamMember', name)
  } catch (serverErr) {
    console.warn('[apiRemoveTeamMember] Server API failed:', serverErr)
    const { error } = await supabase.from('team_members').update({ is_active: false }).eq('name', name)
    if (error) throw new Error(`فشل إزالة عضو: ${error.message}`)
  }
}

export async function apiRenameTeamMember(oldName: string, newName: string) {
  try {
    await serverOp('renameTeamMember', { oldName, newName })
  } catch (serverErr) {
    console.warn('[apiRenameTeamMember] Server API failed:', serverErr)
    const { error: e1 } = await supabase.from('team_members').update({ name: newName }).eq('name', oldName)
    if (e1) throw new Error(`فشل إعادة تسمية: ${e1.message}`)
    await supabase.from('leads').update({ tele_name: newName }).eq('tele_name', oldName)
    await supabase.from('leads').update({ sales_name: newName }).eq('sales_name', oldName)
  }
}

// ===== Broadcast Channel for Cross-User Real-Time =====
export interface BroadcastMessage {
  type: 'attendance' | 'assignment' | 'status' | 'archive' | 'note' | 'delete' | 'reset-attendance'
  leadId: string
  data: Partial<Lead>
  by: string
  byRole: string
  at: number
}

let broadcastChannelRef: ReturnType<typeof supabase.channel> | null = null

export function apiBroadcastChange(message: BroadcastMessage): void {
  if (!broadcastChannelRef) {
    broadcastChannelRef = supabase.channel('leads_changes', {
      config: { broadcast: { self: false } },
    })
  }
  broadcastChannelRef.send({
    type: 'broadcast',
    event: 'lead_change',
    payload: message,
  })
}

// ===== Toast Deduplication =====
const recentToastMap = new Map<string, number>()
const TOAST_DEDUP_MS = 3000

export function isDuplicateToast(leadId: string | number): boolean {
  const key = String(leadId)
  const lastTime = recentToastMap.get(key) || 0
  const now = Date.now()
  if (now - lastTime < TOAST_DEDUP_MS) return true
  recentToastMap.set(key, now)
  for (const [id, ts] of recentToastMap) {
    if (now - ts > 10000) recentToastMap.delete(id)
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

const realtimeDebounceTimers: Record<string, ReturnType<typeof setTimeout>> = {}
const DEBOUNCE_MS = 50

export function apiSubscribeToLeads(
  callback: (payload: Record<string, unknown>) => void,
  onStatusChange?: (status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT') => void
) {
  const channel = supabase
    .channel('leads_changes', {
      config: { broadcast: { self: false } },
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (rawPayload) => {
      const payload = rawPayload as Record<string, unknown>
      const eventType = payload.eventType as string

      if (eventType === 'UPDATE') {
        const newRow = payload.new as Record<string, unknown> | undefined
        const oldRow = payload.old as Record<string, unknown> | undefined
        const id = newRow?.id
        if (id) {
          if (hasPriorityChange(oldRow, newRow)) {
            const key = `leads:${id}`
            if (realtimeDebounceTimers[key]) {
              clearTimeout(realtimeDebounceTimers[key])
              delete realtimeDebounceTimers[key]
            }
            callback(payload)
            return
          }
          const key = `leads:${id}`
          if (realtimeDebounceTimers[key]) clearTimeout(realtimeDebounceTimers[key])
          realtimeDebounceTimers[key] = setTimeout(() => {
            delete realtimeDebounceTimers[key]
            callback(payload)
          }, DEBOUNCE_MS)
          return
        }
      }
      callback(payload)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_notes' }, (payload) =>
      callback({ ...payload, table: 'lead_notes' })
    )
    .on('broadcast', { event: 'lead_change' }, (rawPayload) => {
      const payload = rawPayload as Record<string, unknown>
      const broadcastMsg = payload.payload as BroadcastMessage | undefined
      if (broadcastMsg) {
        callback({
          eventType: 'BROADCAST',
          source: 'broadcast',
          table: 'leads',
          broadcastMessage: broadcastMsg,
        })
      }
    })
    .subscribe((status, err) => {
      console.log(`[realtime] Status: ${status}`, err || '')
      if (onStatusChange) {
        onStatusChange(status as 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT')
      }
    })

  broadcastChannelRef = channel
  return channel
}

export function apiUnsubscribe(channel: ReturnType<typeof supabase.channel>) {
  if (channel) supabase.removeChannel(channel)
}
