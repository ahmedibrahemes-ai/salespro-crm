import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isAdminAvailable, createAuthenticatedClient, createAnonClient } from '@/lib/supabase-admin'
import { DbLead, normalizePhone, generatePhoneVariants, safeTimestamp, safeDate, safeTime, normalizeAttended } from '@/lib/crm-utils'
import { isLeadsCacheValid, getLeadsCache, setLeadsCache, invalidateAllCaches, recordLeadsHit, recordLeadsMiss, recordSupabaseQuery } from '@/lib/api-cache'
import { requireAuth, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'

// Operations that mutate data (must invalidate cache AFTER successful write)
const WRITE_OPERATIONS = new Set([
  'create', 'bulkCreate', 'update', 'delete', 'bulkDelete',
  'archive', 'unarchive', 'addNote', 'deleteNote',
  'addTeamMember', 'removeTeamMember', 'renameTeamMember',
  'saveAccessPermissions', 'setSetting',
])

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
    status: lead.status || null,
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
  if ('status' in updates) dbData.status = updates.status || null
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

// generatePhoneVariants is now imported from @/lib/crm-utils (audit issue #12 — dedup)

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

/**
 * Check if the current session user owns a lead (as tele or sales) or is admin.
 * Prevents IDOR — users can only modify leads they own.
 */
async function checkLeadOwnership(
  client: ReturnType<typeof getSupabaseAdmin>,
  leadId: string,
  session: { uid: string | number; uname: string; role: string }
): Promise<boolean> {
  if (session.role === 'admin') return true
  if (!client) return false
  const { data } = await client
    .from('leads')
    .select('tele_name, sales_name')
    .eq('id', leadId)
    .maybeSingle()
  if (!data) return false
  const ownerTele = (data.tele_name || '').trim()
  const ownerSales = (data.sales_name || '').trim()
  return session.uname === ownerTele || session.uname === ownerSales
}

/**
 * Check ownership for a batch of leads. All must be owned by the user (or admin).
 */
async function checkBulkOwnership(
  client: ReturnType<typeof getSupabaseAdmin>,
  ids: string[],
  session: { uid: string | number; uname: string; role: string }
): Promise<boolean> {
  if (session.role === 'admin') return true
  if (ids.length === 0) return true
  if (!client) return false
  const { data } = await client
    .from('leads')
    .select('id, tele_name, sales_name')
    .in('id', ids)
  if (!data || data.length !== ids.length) return false
  for (const lead of data) {
    const ownerTele = (lead.tele_name || '').trim()
    const ownerSales = (lead.sales_name || '').trim()
    if (session.uname !== ownerTele && session.uname !== ownerSales) return false
  }
  return true
}

/**
 * Sanitize search input to prevent PostgREST filter injection.
 * Removes characters that could break or manipulate .or() filter strings.
 */
function sanitizeSearch(search: string): string {
  return search.replace(/[,()\\]/g, '').trim()
}

// ===== GET handler - Read leads (uses anon/public client for reliable pagination) =====
export async function GET(request: NextRequest) {
  // Security fix (audit issue #2): require auth for ALL GET requests.
  // Previously, paginated GET allowed anon access for edge caching — but
  // this leaked all leads data (10,736+ records) to anyone without auth.
  // The in-memory leads cache (Map-based, issue #9) still provides fast
  // responses without exposing data publicly.
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const pageParam = searchParams.get('page')
  const limitParam = searchParams.get('limit')
  const isPaginated = pageParam !== null && limitParam !== null

  try {
    const includeArchived = searchParams.get('archived') === 'true'
    const archivedOnly = searchParams.get('archived_only') === 'true'

    // ===== Server-side pagination =====
    // pageParam + limitParam already parsed above (before the auth check).
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : null
    const limit = limitParam ? Math.min(500, Math.max(10, parseInt(limitParam, 10))) : null
    const search = sanitizeSearch(searchParams.get('search') || '')
    // isPaginated already set above.

    // Cache key includes pagination params so each page has its own cache slot
    const cacheKey = `${includeArchived}|${archivedOnly}|${page ?? 'all'}|${limit ?? 'all'}|${search}`

    // Check in-memory cache first — avoids hitting Supabase entirely
    if (isLeadsCacheValid(cacheKey)) {
      recordLeadsHit()
      const cached = getLeadsCache(cacheKey)!
      const response = NextResponse.json(cached)
      // Same edge caching as the MISS path — in-memory cache hit still benefits
      // from edge caching across instances.
      response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
      response.headers.set('X-Cache', 'HIT')
      return response
    }
    recordLeadsMiss()

    // For READ operations, use the anon/public client for reliable pagination.
    const client = createAnonClient()
    if (!client) {
      return NextResponse.json({ data: [], hasMore: false, total: 0 }, { status: 200 })
    }
    const source = 'supabase'

    // Build the SELECT query — only fetch columns that are actually used by
    // the client. Removed: customer_type (always empty), cancelled_from,
    // cancelled_at (dead fields — no code sets them). This cuts ~15% per row.
    // archived_at + archived_by are kept (admin-panel displays archivedBy).
    const selectColumns = 'id,store_url,phone,customer_name,brief,contact_result,contact_result_at,tele_name,sales_name,meeting_date,meeting_time,meeting_type,meeting_link,status,sales_status,attended,attendance_marked_at,attendance_marked_by,created_at,assigned_at,is_archived,archived_at,archived_by'

    // Get total count — SKIP for paginated requests to save 200-400ms.
    // The countQuery (HEAD request) adds latency. For paginated requests,
    // we infer hasMore from the result size (if we got 'limit' rows, there
    // are probably more). The exact total is not needed for Phase 1 rendering.
    let total: number | undefined
    if (isPaginated) {
      // Skip count query — infer hasMore from result size below.
      total = undefined
    }

    // Fetch data (single page if paginated, else all pages)
    let allData: DbLead[] = []
    let hasMore = false

    if (isPaginated) {
      const from = (page! - 1) * limit!
      const to = from + limit! - 1

      let dataQuery = client
        .from('leads')
        .select(selectColumns)
        .order('created_at', { ascending: false }) // primary: newest first
        .order('id', { ascending: false }) // secondary: stable sort for same-timestamp leads
        .range(from, to)

      if (archivedOnly) {
        dataQuery = dataQuery.eq('is_archived', true)
      } else if (!includeArchived) {
        dataQuery = dataQuery.eq('is_archived', false)
      }

      if (search) {
        dataQuery = dataQuery.or(`phone.ilike.%${search}%,customer_name.ilike.%${search}%,store_url.ilike.%${search}%`)
      }

      const { data, error } = await dataQuery
      if (error) {
        console.error(`[api/leads] GET page ${page} error:`, error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      allData = (data as DbLead[]) || []
      // Infer hasMore from result size (no count query needed).
      // If we got exactly 'limit' rows, there are probably more.
      hasMore = allData.length === limit
      console.log(`[api/leads] GET page ${page}: got ${allData.length} rows (hasMore: ${hasMore})`)
      recordSupabaseQuery(1)
    } else {
      // Backward-compatible: load ALL leads (for dashboard stats, etc.)
      const PAGE_SIZE = 1000
      let from = 0
      let hasMorePages = true
      let pageNum = 0

      while (hasMorePages) {
        pageNum++
        let query = client
          .from('leads')
          .select(selectColumns)
          .order('created_at', { ascending: false }) // primary: newest first
          .order('id', { ascending: false }) // secondary: stable sort for same-timestamp leads
          .range(from, from + PAGE_SIZE - 1)

        if (archivedOnly) {
          query = query.eq('is_archived', true)
        } else if (!includeArchived) {
          query = query.eq('is_archived', false)
        }

        const { data, error } = await query
        if (error) {
          console.error(`[api/leads] GET page ${pageNum} error:`, error.message)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (data && data.length > 0) {
          allData = allData.concat(data as DbLead[])
          from += PAGE_SIZE
          hasMorePages = data.length === PAGE_SIZE
          console.log(`[api/leads] GET page ${pageNum}: got ${data.length} rows (total so far: ${allData.length})`)
        } else {
          hasMorePages = false
        }
      }
      recordSupabaseQuery(pageNum)
    }

    const result = allData.map(leadFromDb)

    // Build response body
    const responseBody: Record<string, unknown> = {
      data: result,
      source,
    }
    if (isPaginated) {
      responseBody.total = total ?? 0
      responseBody.page = page
      responseBody.limit = limit
      responseBody.hasMore = hasMore
    } else {
      responseBody.total = result.length
    }

    // Store in server-side cache
    setLeadsCache(cacheKey, responseBody)

    const response = NextResponse.json(responseBody)
    // Edge caching: the GET response is the same for all authenticated users
    // (no server-side role filtering — filtering happens client-side). So it's
    // safe to cache at the Vercel edge with s-maxage.
    // s-maxage=30: edge caches for 30s (cuts origin traffic ~90% for active users)
    // stale-while-revalidate=120: serve stale up to 120s while fetching fresh
    // This is the #1 egress reduction fix (was 'no-store' → every request hit origin).
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
    response.headers.set('X-Cache', 'MISS')
    return response
  } catch (err) {
    console.error('[api/leads] GET unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== POST handler - Write operations using service role key (bypasses RLS) =====
export async function POST(request: NextRequest) {
  // ===== Authentication: every write must be from a signed-in user =====
  const session = await requireAuth(request)
  if (!session) {
    return unauthorizedResponse()
  }

  const writeClient = getWriteClient(undefined)
  if (!writeClient) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured. Please add the service role key to .env.local.' },
      { status: 500 }
    )
  }

  const { client, mode } = writeClient

  try {
    const body = await request.json()
    const { operation, data } = body

    // NOTE: Cache invalidation happens AFTER the write succeeds.
    // We use a wrapper that invalidates before returning a success response.
    const isWriteOp = WRITE_OPERATIONS.has(operation)
    const success = <T>(payload: T): NextResponse => {
      if (isWriteOp) invalidateAllCaches()
      return NextResponse.json(payload)
    }

    switch (operation) {
      case 'create': {
        // Force tele_name/sales_name to match session user (prevents impersonation)
        if (session.role !== 'admin') {
          if (session.role === 'tele') data.tele = session.uname
          if (session.role === 'sales') data.sales = session.uname
        }
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
            return success({ data: leadFromDb(retry.data as DbLead) })
          }
          console.error('[api/leads] Create error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return success({ data: leadFromDb(lead as DbLead), duplicateWarning })
      }

      case 'bulkCreate': {
        const leads = data as Record<string, unknown>[]
        if (!Array.isArray(leads) || leads.length === 0) {
          return success({ data: [] })
        }
        // Limit batch size to prevent DoS
        if (leads.length > 500) {
          return NextResponse.json({ error: 'الحد الأقصى 500 عميل في المرة الواحدة' }, { status: 400 })
        }
        // Force tele_name/sales_name to match session user (prevents impersonation)
        if (session.role !== 'admin') {
          for (const lead of leads) {
            if (session.role === 'tele') lead.tele = session.uname
            if (session.role === 'sales') lead.sales = session.uname
          }
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
        // FIX: Assign incremental created_at so sort order is STABLE on refresh.
        // Without this, Postgres NOW() evaluates ONCE per INSERT statement,
        // so all rows get the SAME timestamp → secondary sort by id (random
        // for UUID) scrambles order on every query.
        //
        // Direction: First pasted row (idx=0) gets the NEWEST timestamp
        // so it appears at the TOP when sorted DESC (matching Quick Paste order).
        const BATCH_SIZE = 500
        const baseTime = Date.now()
        let allCreated: DbLead[] = []
        for (let i = 0; i < leads.length; i += BATCH_SIZE) {
          const batch = leads.slice(i, i + BATCH_SIZE)
          const dbData = batch.map((lead, idxInBatch) => {
            const globalIdx = i + idxInBatch
            // First pasted (idx=0) → baseTime (newest)
            // Second pasted (idx=1) → baseTime - 1ms
            // ... Last pasted → baseTime - (N-1)ms (oldest in batch)
            const rowTime = baseTime - globalIdx
            return {
              ...leadToDb(lead),
              created_at: new Date(rowTime).toISOString(),
            }
          })
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
        // Supabase returns rows in insertion order (first inserted = first in array).
        // We keep this order — the client prepends them to the leads array,
        // so the first-pasted row appears at the top of the sheet.
        if (allCreated.length !== leads.length) {
          console.warn(`[api/leads] Bulk create MISMATCH: ${leads.length} requested, ${allCreated.length} created`)
        } else {
          console.log(`[api/leads] Bulk create: ${leads.length} requested, ${allCreated.length} created`)
        }
        return success({ data: allCreated.map(leadFromDb) })
      }

      case 'update': {
        const { id, updates } = data as { id: string; updates: Record<string, unknown> }
        if (!id) {
          return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
        }
        // Ownership check — prevent IDOR
        if (!await checkLeadOwnership(client, id, session)) {
          return forbiddenResponse('لا تملك صلاحية تعديل هذا العميل')
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
          return success({ data: null })
        }

        return success({ data: leadFromDb(lead as DbLead) })
      }

      case 'delete': {
        const id = data as string
        if (!id) {
          return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
        }
        // Ownership check — prevent IDOR
        if (!await checkLeadOwnership(client, id, session)) {
          return forbiddenResponse('لا تملك صلاحية حذف هذا العميل')
        }
        const { error } = await client.from('leads').delete().eq('id', id)
        if (error) {
          console.error('[api/leads] Delete error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return success({ success: true })
      }

      case 'bulkDelete': {
        const ids = data as string[]
        if (!Array.isArray(ids) || ids.length === 0) {
          return success({ success: true })
        }
        // Ownership check — prevent IDOR on bulk operations
        if (!await checkBulkOwnership(client, ids, session)) {
          return forbiddenResponse('لا تملك صلاحية حذف بعض العملاء المحددين')
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
        return success({ success: true })
      }

      case 'bulkUpdate': {
        const { ids, updates } = data as { ids: number[]; updates: Record<string, unknown> }
        if (!Array.isArray(ids) || ids.length === 0) {
          return success({ success: true })
        }
        // Ownership check — prevent IDOR on bulk operations
        if (!await checkBulkOwnership(client, ids.map(String), session)) {
          return forbiddenResponse('لا تملك صلاحية تعديل بعض العملاء المحددين')
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
        return success({ success: true, updated: totalUpdated })
      }

      case 'archive': {
        const { ids, archivedBy } = data as { ids: string[]; archivedBy: string }
        if (!Array.isArray(ids) || ids.length === 0) {
          return success({ success: true })
        }
        // Ownership check — prevent IDOR
        if (!await checkBulkOwnership(client, ids, session)) {
          return forbiddenResponse('لا تملك صلاحية أرشفة بعض العملاء المحددين')
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
        return success({ success: true })
      }

      case 'unarchive': {
        const ids = data as string[]
        if (!Array.isArray(ids) || ids.length === 0) {
          return success({ success: true })
        }
        // Ownership check — prevent IDOR
        if (!await checkBulkOwnership(client, ids, session)) {
          return forbiddenResponse('لا تملك صلاحية استرجاع بعض العملاء المحددين')
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
        return success({ success: true })
      }

      case 'addNote': {
        const { leadId, by, cat, text } = data as { leadId: string; by: string; cat: string; text: string }
        // Ownership check — prevent IDOR (audit issue #1)
        if (!await checkLeadOwnership(client, leadId, session)) {
          return forbiddenResponse('لا تملك صلاحية إضافة ملاحظة لهذا العميل')
        }
        const { data: note, error } = await client
          .from('lead_notes')
          .insert({ lead_id: leadId, by_name: by, category: cat, text })
          .select()
          .single()
        if (error) {
          console.error('[api/leads] Add note error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return success({ data: note })
      }

      case 'deleteNote': {
        const noteId = data as string
        // Ownership check — fetch note's lead_id, then verify ownership (audit issue #1)
        const { data: delNoteRow } = await client
          .from('lead_notes')
          .select('lead_id')
          .eq('id', noteId)
          .maybeSingle()
        if (!delNoteRow) {
          return NextResponse.json({ error: 'الملاحظة غير موجودة' }, { status: 404 })
        }
        if (!await checkLeadOwnership(client, String(delNoteRow.lead_id), session)) {
          return forbiddenResponse('لا تملك صلاحية حذف هذه الملاحظة')
        }
        const { error } = await client.from('lead_notes').delete().eq('id', noteId)
        if (error) {
          console.error('[api/leads] Delete note error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return success({ success: true })
      }

      case 'updateNote': {
        const { noteId, updates: noteUpdates } = data as { noteId: string; updates: { text?: string; category?: string } }
        // Ownership check — fetch note's lead_id, then verify ownership (audit issue #1)
        const { data: updNoteRow } = await client
          .from('lead_notes')
          .select('lead_id')
          .eq('id', noteId)
          .maybeSingle()
        if (!updNoteRow) {
          return NextResponse.json({ error: 'الملاحظة غير موجودة' }, { status: 404 })
        }
        if (!await checkLeadOwnership(client, String(updNoteRow.lead_id), session)) {
          return forbiddenResponse('لا تملك صلاحية تعديل هذه الملاحظة')
        }
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
        return success({ data: note })
      }

      case 'saveSetting': {
        // Admin-only — settings are global (e.g. team targets), not per-user (audit issue #1)
        if (session.role !== 'admin') return forbiddenResponse('هذه العملية تتطلب صلاحيات مدير')
        const { key, value } = data as { key: string; value: unknown }
        const { error } = await client
          .from('settings')
          .upsert({ key, value }, { onConflict: 'key' })
        if (error) {
          console.error('[api/leads] Save setting error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return success({ success: true })
      }

      case 'getSetting': {
        const key = data as string
        if (!key) {
          return NextResponse.json({ error: 'Setting key is required' }, { status: 400 })
        }
        const { data: row, error } = await client
          .from('settings')
          .select('value')
          .eq('key', key)
          .single()
        if (error) {
          // Not found is not an error — return null
          if (error.code === 'PGRST116') {
            return NextResponse.json({ data: null })
          }
          console.error('[api/leads] Get setting error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ data: row?.value ?? null })
      }

      case 'addTeamMember': {
        // Admin-only: adding/reactivating team members is an admin operation.
        // /api/team/route.ts already enforces requireAdmin for the same op —
        // this brings /api/leads in line (security fix, audit §1 row 1).
        if (session.role !== 'admin') return forbiddenResponse('هذه العملية تتطلب صلاحيات مدير')
        const { name, role } = data as { name: string; role: string }
        // Check if inactive member exists
        const { data: existing } = await client
          .from('team_members')
          .select('id')
          .eq('name', name)
          .eq('is_active', false)
          .maybeSingle()

        if (existing) {
          // Reactivation: clear sales_name AND tele_name on the old leads so the
          // new user (same displayName) starts FRESH. Without this, the reactivated
          // user inherits the previous holder's leads — they'd appear as fake/default
          // customers in the sales sheet and اجتماعات التلي. (Attendance/meeting
          // fields are preserved on the leads for historical reports.)
          await client.from('leads').update({ tele_name: null }).eq('tele_name', name)
          await client.from('leads').update({ sales_name: null }).eq('sales_name', name)
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
          return success({ data: member })
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
        return success({ data: member })
      }

      case 'removeTeamMember': {
        // Admin-only: removing team members + clearing their leads is admin-only.
        if (session.role !== 'admin') return forbiddenResponse('هذه العملية تتطلب صلاحيات مدير')
        const name = data as string
        // Solution A: clear sales_name AND tele_name on the orphaned leads so a
        // future reactivated user (same name) does NOT inherit them. Without this,
        // removeTeamMember only soft-deletes the team_member (is_active=false),
        // leaving leads with sales_name/tele_name = <removed user> — when an admin
        // re-adds a user with the same displayName, those orphaned leads reappear.
        // We null out BOTH tele_name and sales_name since the removed member could
        // be in either role. (Attendance/meeting fields are preserved for reports.)
        const { error: clearTeleErr } = await client
          .from('leads')
          .update({ tele_name: null })
          .eq('tele_name', name)
        if (clearTeleErr) {
          console.error('[api/leads] Remove team member — clear tele_name error:', clearTeleErr, '(mode:', mode, ')')
        }
        const { error: clearSalesErr } = await client
          .from('leads')
          .update({ sales_name: null })
          .eq('sales_name', name)
        if (clearSalesErr) {
          console.error('[api/leads] Remove team member — clear sales_name error:', clearSalesErr, '(mode:', mode, ')')
        }
        const { error } = await client
          .from('team_members')
          .update({ is_active: false })
          .eq('name', name)
        if (error) {
          console.error('[api/leads] Remove team member error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return success({ success: true })
      }

      case 'renameTeamMember': {
        // Admin-only: renaming a team member rewrites leads.tele_name/sales_name
        // across the whole table — admin operation.
        if (session.role !== 'admin') return forbiddenResponse('هذه العملية تتطلب صلاحيات مدير')
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
        return success({ success: true, teleCount: teleCount || 0, salesCount: salesCount || 0 })
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

      case 'saveAccessPermissions': {
        // Admin-only: rewriting the access_permissions table is admin-only.
        if (session.role !== 'admin') return forbiddenResponse('هذه العملية تتطلب صلاحيات مدير')
        const { teleAccess, salesAccess } = data as { teleAccess: Record<string, string[]>; salesAccess: Record<string, string[]> }

        // Delete all existing permissions
        await client.from('access_permissions').delete().neq('id', 0)

        // Build new rows
        const rows: Array<{ viewer_name: string; target_name: string; role: string; is_active: boolean }> = []
        for (const [viewer, targets] of Object.entries(teleAccess)) {
          for (const target of targets) {
            rows.push({ viewer_name: viewer, target_name: target, role: 'tele', is_active: true })
          }
        }
        for (const [viewer, targets] of Object.entries(salesAccess)) {
          for (const target of targets) {
            rows.push({ viewer_name: viewer, target_name: target, role: 'sales', is_active: true })
          }
        }

        if (rows.length > 0) {
          const { error: insertError } = await client.from('access_permissions').insert(rows)
          if (insertError) {
            console.error('[api/leads] Save access permissions error:', insertError, '(mode:', mode, ')')
            return NextResponse.json({ error: insertError.message }, { status: 400 })
          }
        }

        return success({ success: true, count: rows.length })
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
  // Require auth
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  const writeClient = getWriteClient(undefined)
  if (!writeClient) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
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

    // Ownership check — prevent IDOR (audit issue #1)
    if (!await checkLeadOwnership(client, id, session)) {
      return forbiddenResponse('لا تملك صلاحية تعديل هذا العميل')
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

    // Invalidate caches after successful update
    invalidateAllCaches()
    return NextResponse.json({ data: leadFromDb(data as DbLead) })
  } catch (err) {
    console.error('[api/leads] Update unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== DELETE handler - Delete a single lead =====
export async function DELETE(request: NextRequest) {
  // Require auth
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  const writeClient = getWriteClient(undefined)
  if (!writeClient) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
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

    // Ownership check — prevent IDOR (audit issue #1)
    if (!await checkLeadOwnership(client, id, session)) {
      return forbiddenResponse('لا تملك صلاحية حذف هذا العميل')
    }

    const { error } = await client.from('leads').delete().eq('id', id)
    if (error) {
      console.error('[api/leads] Delete error:', error, '(mode:', mode, ')')
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Invalidate caches after successful delete
    invalidateAllCaches()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/leads] Delete unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
