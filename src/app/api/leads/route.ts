import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isAdminAvailable, createAuthenticatedClient, createAnonClient } from '@/lib/supabase-admin'

// ===== Types =====
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

function normalizeAttended(val: string | boolean | null | undefined): string | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'boolean') return val ? 'attended' : 'no-show'
  const str = String(val).trim().toLowerCase()
  if (str === 'true' || str === 'attended') return 'attended'
  if (str === 'false' || str === 'no-show') return 'no-show'
  if (str === 'pending') return null
  return str || null
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

function leadFromDb(row: DbLead) {
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

function leadToDb(lead: Record<string, unknown>): Record<string, unknown> {
  const contactAt =
    lead.contactResultAt || (lead.contactResult ? Date.now() : null)
  return {
    store_url: lead.storeUrl || null,
    phone: lead.phone || null,
    customer_name: lead.customerName || null,
    customer_type: lead.customerType || null,
    brief: lead.brief || null,
    contact_result: lead.contactResult || null,
    contact_result_at: contactAt ? new Date(contactAt as number).toISOString() : null,
    tele_name: lead.tele || null,
    sales_name: lead.sales || null,
    meeting_date: safeDate(lead.meetingDate as string || null),
    meeting_time: safeTime(lead.meetingTime as string || null),
    meeting_type: lead.meetingType || null,
    meeting_link: lead.meetingLink || null,
    status: lead.status || 'new',
    sales_status: lead.salesStatus || null,
    attended: lead.attended === undefined ? null : lead.attended,
    attendance_marked_at: lead.attendanceMarkedAt ? new Date(lead.attendanceMarkedAt as number).toISOString() : null,
    attendance_marked_by: lead.attendanceMarkedBy || null,
    cancelled_from: lead.cancelledFrom || null,
    cancelled_at: lead.cancelledAt ? new Date(lead.cancelledAt as number).toISOString() : null,
    assigned_at: lead.assignedAt ? new Date(lead.assignedAt as number).toISOString() : null,
    is_archived: lead.isArchived || false,
    archived_at: lead.archivedAt ? new Date(lead.archivedAt as number).toISOString() : null,
    archived_by: lead.archivedBy || null,
  }
}

function partialLeadToDb(updates: Record<string, unknown>): Record<string, unknown> {
  const dbData: Record<string, unknown> = {}

  if ('storeUrl' in updates) dbData.store_url = updates.storeUrl || null
  if ('phone' in updates) dbData.phone = updates.phone || null
  if ('customerName' in updates) dbData.customer_name = updates.customerName || null
  if ('customerType' in updates) dbData.customer_type = updates.customerType || null
  if ('brief' in updates) dbData.brief = updates.brief || null
  if ('contactResult' in updates) dbData.contact_result = updates.contactResult || null
  if ('contactResultAt' in updates) dbData.contact_result_at = updates.contactResultAt ? new Date(updates.contactResultAt as number).toISOString() : null
  if ('tele' in updates) dbData.tele_name = updates.tele || null
  if ('sales' in updates) dbData.sales_name = updates.sales || null
  if ('meetingDate' in updates) dbData.meeting_date = safeDate(updates.meetingDate as string || null)
  if ('meetingTime' in updates) dbData.meeting_time = safeTime(updates.meetingTime as string || null)
  if ('meetingType' in updates) dbData.meeting_type = updates.meetingType || null
  if ('meetingLink' in updates) dbData.meeting_link = updates.meetingLink || null
  if ('status' in updates) dbData.status = updates.status || 'new'
  if ('salesStatus' in updates) dbData.sales_status = updates.salesStatus || null
  if ('attended' in updates) dbData.attended = updates.attended === undefined ? null : updates.attended
  if ('attendanceMarkedAt' in updates) dbData.attendance_marked_at = updates.attendanceMarkedAt ? new Date(updates.attendanceMarkedAt as number).toISOString() : null
  if ('attendanceMarkedBy' in updates) dbData.attendance_marked_by = updates.attendanceMarkedBy || null
  if ('cancelledFrom' in updates) dbData.cancelled_from = updates.cancelledFrom || null
  if ('cancelledAt' in updates) dbData.cancelled_at = updates.cancelledAt ? new Date(updates.cancelledAt as number).toISOString() : null
  if ('assignedAt' in updates) dbData.assigned_at = updates.assignedAt ? new Date(updates.assignedAt as number).toISOString() : null
  if ('isArchived' in updates) dbData.is_archived = updates.isArchived || false
  if ('archivedAt' in updates) dbData.archived_at = updates.archivedAt ? new Date(updates.archivedAt as number).toISOString() : null
  if ('archivedBy' in updates) dbData.archived_by = updates.archivedBy || null

  return dbData
}

/** Normalize phone number (same logic as client-side and duplicates route) */
function normalizePhone(input: string): string {
  if (!input) return ''
  let p = String(input).replace(/[\s\-()]/g, '')
  if (p.startsWith('+966')) return p
  if (p.startsWith('00966')) return '+' + p.substring(2)
  if (p.startsWith('966')) return '+' + p
  if (p.startsWith('05') && p.length >= 10) return '+966' + p.substring(1)
  if (p.startsWith('5') && p.length >= 9) return '+966' + p
  return p
}

/** Generate all possible phone format variants for a given phone number. */
function generatePhoneVariants(phone: string): string[] {
  const variants = new Set<string>()
  if (!phone || !phone.trim()) return []
  const raw = phone.trim()
  variants.add(raw)

  const norm = normalizePhone(raw)
  if (norm) {
    variants.add(norm)
    if (norm.startsWith('+966')) {
      const digits = norm.substring(4)
      variants.add(digits)
      variants.add('0' + digits)
      variants.add('966' + digits)
      variants.add('00966' + digits)
    }
    if (norm.startsWith('00966')) {
      variants.add('+' + norm.substring(2))
    }
  }

  variants.delete('')
  return Array.from(variants)
}

/**
 * Get the Supabase client for write operations.
 * Priority: service role key (bypasses RLS) > authenticated user token > error
 */
function getWriteClient(authToken?: string) {
  const admin = getSupabaseAdmin()
  if (admin) return { client: admin, mode: 'admin' as const }

  if (authToken) {
    return { client: createAuthenticatedClient(authToken), mode: 'authenticated' as const }
  }

  return null
}

// ===== GET handler - Read leads (uses anon/public client for reliable pagination) =====
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('archived') === 'true'
    const archivedOnly = searchParams.get('archived_only') === 'true'

    // For READ operations, use the anon/public client for reliable pagination.
    // The admin (service role) client can have inconsistent pagination behavior.
    // Since RLS SELECT policies allow public reads, anon client works fine.
    const client = createAnonClient()
    if (!client) {
      return NextResponse.json({ leads: [], hasMore: false }, { status: 200 })
    }
    const source = 'supabase'

    const PAGE_SIZE = 1000 // Supabase REST API default max rows per request
    let allData: DbLead[] = []
    let from = 0
    let hasMore = true
    let page = 0

    while (hasMore) {
      page++
      let query = client
        .from('leads')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (archivedOnly) {
        query = query.eq('is_archived', true)
      } else if (!includeArchived) {
        query = query.eq('is_archived', false)
      }

      const { data, error } = await query
      if (error) {
        console.error(`[api/leads] GET page ${page} error:`, error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (data && data.length > 0) {
        allData = allData.concat(data as DbLead[])
        from += PAGE_SIZE
        hasMore = data.length === PAGE_SIZE
        console.log(`[api/leads] GET page ${page}: got ${data.length} rows (total so far: ${allData.length})`)
      } else {
        hasMore = false
      }
    }

    const result = allData.map(leadFromDb)
    console.log(`[api/leads] GET final: ${result.length} leads loaded in ${page} pages`)
    return NextResponse.json({ data: result, source, total: result.length })
  } catch (err) {
    console.error('[api/leads] GET unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== POST handler - Write operations using service role key (bypasses RLS) =====
export async function POST(request: NextRequest) {
  // Extract auth token from header if present
  const authToken = request.headers.get('X-Supabase-Auth') || undefined

  const writeClient = getWriteClient(authToken)
  if (!writeClient) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured and no auth token provided. Please add the service role key to .env.local or ensure RLS policies allow authenticated writes.' },
      { status: 500 }
    )
  }

  const { client, mode } = writeClient

  try {
    const body = await request.json()
    const { operation, data } = body

    switch (operation) {
      case 'create': {
        const dbData = leadToDb(data)

        // Server-side duplicate phone check (WARNING only — don't block creation)
        const phone = data?.phone as string | undefined
        let duplicateWarning: { existingId: number; existingOwner: string; normalizedPhone: string } | null = null
        if (phone && phone.trim()) {
          const norm = normalizePhone(phone)
          if (norm) {
            const variants = generatePhoneVariants(phone)
            const { data: existing } = await client
              .from('leads')
              .select('id, phone, tele_name, sales_name')
              .eq('is_archived', false)
              .in('phone', variants)
              .limit(1)

            if (existing && existing.length > 0) {
              const existingLead = existing[0]
              duplicateWarning = {
                existingId: existingLead.id,
                existingOwner: (existingLead.tele_name || '').trim() || (existingLead.sales_name || '').trim() || '—',
                normalizedPhone: norm,
              }
              console.log(`[api/leads] Create: duplicate phone warning for ${norm} (exists as ID ${existingLead.id})`)
            }
          }
        }

        // Proceed with creation (allow duplicates — the client warns the user)
        const { data: lead, error } = await client
          .from('leads')
          .insert(dbData)
          .select()
          .single()

        if (error) {
          // Retry without contact_result_at if that column causes issues
          if (/contact_result_at/i.test(error.message || '')) {
            delete (dbData as Record<string, unknown>).contact_result_at
            const retry = await client.from('leads').insert(dbData).select().single()
            if (retry.error) {
              console.error('[api/leads] Create error (retry):', retry.error, '(mode:', mode, ')')
              return NextResponse.json({ error: retry.error.message }, { status: 400 })
            }
            return NextResponse.json({ data: leadFromDb(retry.data as DbLead) })
          }
          console.error('[api/leads] Create error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ data: leadFromDb(lead as DbLead), duplicateWarning })
      }

      case 'bulkCreate': {
        const leads = data as Record<string, unknown>[]
        if (!Array.isArray(leads) || leads.length === 0) {
          return NextResponse.json({ data: [] })
        }

        // Check for intra-batch duplicates (INFO only — don't filter/remove any leads)
        const duplicateWarnings: Array<{ index: number; phone: string; reason: string }> = []
        const seenPhones = new Map<string, number>()

        leads.forEach((lead, idx) => {
          const phone = lead.phone as string | undefined
          if (!phone || !phone.trim()) return
          const norm = normalizePhone(phone)
          if (!norm) return

          if (seenPhones.has(norm)) {
            duplicateWarnings.push({
              index: idx,
              phone: norm,
              reason: `Duplicate within batch (row ${seenPhones.get(norm)! + 1})`,
            })
            return
          }
          seenPhones.set(norm, idx)
        })

        if (duplicateWarnings.length > 0) {
          console.log(`[api/leads] Bulk create: ${duplicateWarnings.length} intra-batch duplicate phones detected (not filtered)`)
        }

        // Proceed with ALL leads (don't filter any out)
        const BATCH_SIZE = 500
        let allCreated: DbLead[] = []
        for (let i = 0; i < leads.length; i += BATCH_SIZE) {
          const batch = leads.slice(i, i + BATCH_SIZE)
          const dbData = batch.map(leadToDb)
          const { data: created, error } = await client.from('leads').insert(dbData).select()
          if (error) {
            console.error('[api/leads] Bulk create error:', error, '(mode:', mode, ')')
            return NextResponse.json({ error: error.message }, { status: 400 })
          }
          if (created) {
            allCreated = allCreated.concat(created as DbLead[])
          } else {
            console.warn(`[api/leads] Bulk create: insert().select() returned null data for batch starting at index ${i}`)
          }
        }
        // Sort by auto-increment ID to preserve insertion order
        allCreated.sort((a, b) => Number(a.id) - Number(b.id))
        if (allCreated.length !== leads.length) {
          console.warn(`[api/leads] Bulk create MISMATCH: ${leads.length} requested, ${allCreated.length} created`)
        } else {
          console.log(`[api/leads] Bulk create: ${leads.length} requested, ${allCreated.length} created`)
        }
        return NextResponse.json({ data: allCreated.map(leadFromDb) })
      }

      case 'update': {
        const { id, updates } = data as { id: string; updates: Record<string, unknown> }
        if (!id) {
          return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
        }
        const dbData = partialLeadToDb(updates)
        const { data: lead, error } = await client
          .from('leads')
          .update(dbData)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          // Try without select (in case RLS blocks the read-back)
          const { error: updateError } = await client
            .from('leads')
            .update(dbData)
            .eq('id', id)
          if (updateError) {
            console.error('[api/leads] Update error:', updateError, '(mode:', mode, ')')
            return NextResponse.json({ error: updateError.message }, { status: 400 })
          }
          return NextResponse.json({ data: null })
        }

        return NextResponse.json({ data: leadFromDb(lead as DbLead) })
      }

      case 'delete': {
        const id = data as string
        if (!id) {
          return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
        }
        const { error } = await client.from('leads').delete().eq('id', id)
        if (error) {
          console.error('[api/leads] Delete error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ success: true })
      }

      case 'bulkDelete': {
        const ids = data as string[]
        if (!Array.isArray(ids) || ids.length === 0) {
          return NextResponse.json({ success: true })
        }
        const BATCH_SIZE = 100
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const batch = ids.slice(i, i + BATCH_SIZE)
          const { error } = await client.from('leads').delete().in('id', batch)
          if (error) {
            console.error('[api/leads] Bulk delete error:', error, '(mode:', mode, ')')
            return NextResponse.json({ error: error.message }, { status: 400 })
          }
        }
        return NextResponse.json({ success: true })
      }

      case 'bulkUpdate': {
        const { ids, updates } = data as { ids: number[]; updates: Record<string, unknown> }
        if (!Array.isArray(ids) || ids.length === 0) {
          return NextResponse.json({ success: true })
        }
        const BATCH_SIZE = 500
        const dbData = partialLeadToDb(updates)
        let totalUpdated = 0
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const batch = ids.slice(i, i + BATCH_SIZE)
          const { error } = await client
            .from('leads')
            .update(dbData)
            .in('id', batch)
          if (error) {
            console.error('[api/leads] Bulk update error:', error, '(mode:', mode, ')')
            return NextResponse.json({ error: error.message }, { status: 400 })
          }
          totalUpdated += batch.length
        }
        return NextResponse.json({ success: true, updated: totalUpdated })
      }

      case 'archive': {
        const { ids, archivedBy } = data as { ids: string[]; archivedBy: string }
        if (!Array.isArray(ids) || ids.length === 0) {
          return NextResponse.json({ success: true })
        }
        const BATCH_SIZE = 100
        const archivedAt = new Date().toISOString()
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const batch = ids.slice(i, i + BATCH_SIZE)
          const { error } = await client
            .from('leads')
            .update({ is_archived: true, archived_at: archivedAt, archived_by: archivedBy })
            .in('id', batch)
          if (error) {
            console.error('[api/leads] Archive error:', error, '(mode:', mode, ')')
            return NextResponse.json({ error: error.message }, { status: 400 })
          }
        }
        return NextResponse.json({ success: true })
      }

      case 'unarchive': {
        const ids = data as string[]
        if (!Array.isArray(ids) || ids.length === 0) {
          return NextResponse.json({ success: true })
        }
        const BATCH_SIZE = 100
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const batch = ids.slice(i, i + BATCH_SIZE)
          const { error } = await client
            .from('leads')
            .update({ is_archived: false, archived_at: null, archived_by: null })
            .in('id', batch)
          if (error) {
            console.error('[api/leads] Unarchive error:', error, '(mode:', mode, ')')
            return NextResponse.json({ error: error.message }, { status: 400 })
          }
        }
        return NextResponse.json({ success: true })
      }

      case 'addNote': {
        const { leadId, by, cat, text } = data as { leadId: string; by: string; cat: string; text: string }
        const { data: note, error } = await client
          .from('lead_notes')
          .insert({ lead_id: leadId, by_name: by, category: cat, text })
          .select()
          .single()
        if (error) {
          console.error('[api/leads] Add note error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ data: note })
      }

      case 'deleteNote': {
        const noteId = data as string
        const { error } = await client.from('lead_notes').delete().eq('id', noteId)
        if (error) {
          console.error('[api/leads] Delete note error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ success: true })
      }

      case 'updateNote': {
        const { noteId, updates: noteUpdates } = data as { noteId: string; updates: { text?: string; category?: string } }
        const dbNoteData: Record<string, unknown> = {}
        if ('text' in noteUpdates) dbNoteData.text = noteUpdates.text
        if ('category' in noteUpdates) dbNoteData.category = noteUpdates.category
        const { data: note, error } = await client
          .from('lead_notes')
          .update(dbNoteData)
          .eq('id', noteId)
          .select()
          .single()
        if (error) {
          console.error('[api/leads] Update note error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ data: note })
      }

      case 'saveSetting': {
        const { key, value } = data as { key: string; value: unknown }
        const { error } = await client
          .from('settings')
          .upsert({ key, value }, { onConflict: 'key' })
        if (error) {
          console.error('[api/leads] Save setting error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ success: true })
      }

      case 'addTeamMember': {
        const { name, role } = data as { name: string; role: string }
        // Check if inactive member exists
        const { data: existing } = await client
          .from('team_members')
          .select('*')
          .eq('name', name)
          .eq('is_active', false)
          .maybeSingle()

        if (existing) {
          const { data: member, error } = await client
            .from('team_members')
            .update({ is_active: true, role })
            .eq('id', existing.id)
            .select()
            .single()
          if (error) {
            console.error('[api/leads] Add team member (reactivate) error:', error, '(mode:', mode, ')')
            return NextResponse.json({ error: error.message }, { status: 400 })
          }
          return NextResponse.json({ data: member })
        }

        const { data: member, error } = await client
          .from('team_members')
          .insert({ name, role })
          .select()
          .single()
        if (error) {
          console.error('[api/leads] Add team member error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ data: member })
      }

      case 'removeTeamMember': {
        const name = data as string
        const { error } = await client
          .from('team_members')
          .update({ is_active: false })
          .eq('name', name)
        if (error) {
          console.error('[api/leads] Remove team member error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ success: true })
      }

      case 'renameTeamMember': {
        const { oldName, newName } = data as { oldName: string; newName: string }
        // Count affected leads before renaming
        const { count: teleCount } = await client.from('leads').select('*', { count: 'exact', head: true }).eq('tele_name', oldName)
        const { count: salesCount } = await client.from('leads').select('*', { count: 'exact', head: true }).eq('sales_name', oldName)
        console.log(`[api/leads] Renaming team member: "${oldName}" -> "${newName}" (affects ${teleCount || 0} tele leads, ${salesCount || 0} sales leads)`)
        const { error: e1 } = await client
          .from('team_members')
          .update({ name: newName })
          .eq('name', oldName)
        if (e1) {
          console.error('[api/leads] Rename team member error:', e1, '(mode:', mode, ')')
          return NextResponse.json({ error: e1.message }, { status: 400 })
        }
        await client.from('leads').update({ tele_name: newName }).eq('tele_name', oldName)
        await client.from('leads').update({ sales_name: newName }).eq('sales_name', oldName)
        return NextResponse.json({ success: true, teleCount: teleCount || 0, salesCount: salesCount || 0 })
      }

      case 'checkDuplicatePhones': {
        // Takes an array of phone numbers and returns which ones already exist
        // in the database (non-archived leads). Uses normalized phone matching.
        const phones = data as string[]
        if (!Array.isArray(phones) || phones.length === 0) {
          return NextResponse.json({ duplicates: {} })
        }

        // Normalize the input phones
        const normalizedToOriginal: Record<string, string> = {}
        const normalizedPhones: string[] = []
        for (const p of phones) {
          const norm = normalizePhone(p)
          if (norm && !normalizedToOriginal[norm]) {
            normalizedToOriginal[norm] = p
            normalizedPhones.push(norm)
          }
        }

        if (normalizedPhones.length === 0) {
          return NextResponse.json({ duplicates: {} })
        }

        // Generate ALL format variants for each input phone to find matches
        const allSearchPhones = new Set<string>()
        for (const p of phones) {
          if (!p || !p.trim()) continue
          for (const variant of generatePhoneVariants(p)) {
            allSearchPhones.add(variant)
          }
        }
        const searchPhonesArray = Array.from(allSearchPhones)

        const BATCH_SIZE = 500
        let existingLeads: Array<{ id: number; phone: string | null; tele_name: string | null; sales_name: string | null }> = []

        for (let i = 0; i < searchPhonesArray.length; i += BATCH_SIZE) {
          const batch = searchPhonesArray.slice(i, i + BATCH_SIZE)
          const { data: found, error: findErr } = await client
            .from('leads')
            .select('id, phone, tele_name, sales_name')
            .eq('is_archived', false)
            .in('phone', batch)

          if (findErr) {
            console.error('[api/leads] checkDuplicatePhones error:', findErr.message)
            continue
          }
          if (found) existingLeads = existingLeads.concat(found as typeof existingLeads)
        }

        // Build the duplicates response with normalized matching
        const duplicates: Record<string, {
          existingId: number
          existingOwner: string
          normalizedPhone: string
        }> = {}

        for (const lead of existingLeads) {
          if (!lead.phone) continue
          const norm = normalizePhone(lead.phone)
          if (!norm) continue
          if (!normalizedToOriginal[norm]) continue
          if (duplicates[norm]) {
            if (lead.id < duplicates[norm].existingId) {
              duplicates[norm] = {
                existingId: lead.id,
                existingOwner: (lead.tele_name || '').trim() || (lead.sales_name || '').trim() || '—',
                normalizedPhone: norm,
              }
            }
          } else {
            duplicates[norm] = {
              existingId: lead.id,
              existingOwner: (lead.tele_name || '').trim() || (lead.sales_name || '').trim() || '—',
              normalizedPhone: norm,
            }
          }
        }

        return NextResponse.json({ duplicates })
      }

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 })
    }
  } catch (err) {
    console.error('[api/leads] Unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== PATCH handler - Update a single lead =====
export async function PATCH(request: NextRequest) {
  const authToken = request.headers.get('X-Supabase-Auth') || undefined
  const writeClient = getWriteClient(authToken)

  if (!writeClient) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured and no auth token provided' },
      { status: 500 }
    )
  }

  const { client, mode } = writeClient

  try {
    const body = await request.json()
    const { id, updates } = body as { id: string; updates: Record<string, unknown> }

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    const dbData = partialLeadToDb(updates)
    const { data, error } = await client
      .from('leads')
      .update(dbData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[api/leads] Update error:', error, '(mode:', mode, ')')
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data: leadFromDb(data as DbLead) })
  } catch (err) {
    console.error('[api/leads] Update unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== DELETE handler - Delete a single lead =====
export async function DELETE(request: NextRequest) {
  const authToken = request.headers.get('X-Supabase-Auth') || undefined
  const writeClient = getWriteClient(authToken)

  if (!writeClient) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured and no auth token provided' },
      { status: 500 }
    )
  }

  const { client, mode } = writeClient

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    const { error } = await client.from('leads').delete().eq('id', id)
    if (error) {
      console.error('[api/leads] Delete error:', error, '(mode:', mode, ')')
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/leads] Delete unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
