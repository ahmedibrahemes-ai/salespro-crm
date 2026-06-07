import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isAdminAvailable, createAuthenticatedClient, createAnonClient } from '@/lib/supabase-admin'

/**
 * GET /api/duplicates
 *
 * Server-side duplicate detection that works across ALL sheets.
 * Uses Supabase ONLY — no Prisma/SQLite.
 *
 * Optimization strategy:
 * 1. Try supabase.rpc('get_duplicate_phones') first (server-side SQL, fastest)
 * 2. Fall back to optimized two-pass approach:
 *    - Pass 1: Load only phone strings from all non-archived leads (lightweight)
 *    - Find duplicate phones in JS
 *    - Pass 2: Load full lead data only for the duplicate phones using .in()
 *
 * Returns a map of normalized phone → { originalId, originalTele, originalSales, duplicateIds }
 * Only includes phones that appear 2+ times across non-archived leads.
 */

/** Normalize phone number (same logic as leads route) */
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

/** Build the duplicates response from a flat list of leads */
function buildDuplicatesResponse(
  leads: Array<{ id: number; phone: string | null; tele_name: string | null; sales_name: string | null }>,
  totalLeads: number
) {
  // Group by normalized phone
  const phoneMap: Record<string, Array<{ id: number; tele: string; sales: string | null }>> = {}
  for (const lead of leads) {
    if (!lead.phone) continue
    const norm = normalizePhone(lead.phone)
    if (!norm) continue
    if (!phoneMap[norm]) phoneMap[norm] = []
    phoneMap[norm].push({
      id: lead.id,
      tele: (lead.tele_name || '').trim(),
      sales: lead.sales_name ? lead.sales_name.trim() : null,
    })
  }

  // Build duplicates response - only phones with 2+ leads
  const duplicates: Record<string, {
    originalId: number
    originalTele: string
    originalSales: string | null
    duplicateIds: number[]
  }> = {}

  for (const [norm, leadList] of Object.entries(phoneMap)) {
    if (leadList.length < 2) continue
    // BUG FIX: Use Number(a.id) - Number(b.id) for auto-increment integer IDs from Supabase
    leadList.sort((a, b) => Number(a.id) - Number(b.id))
    duplicates[norm] = {
      originalId: leadList[0].id,
      originalTele: leadList[0].tele,
      originalSales: leadList[0].sales,
      duplicateIds: leadList.slice(1).map((l) => l.id),
    }
  }

  return {
    duplicates,
    totalLeads,
    totalDuplicatePhones: Object.keys(duplicates).length,
  }
}

/** Get a Supabase client that can read ALL leads (bypass RLS) */
function getReadClient(request: NextRequest) {
  const admin = getSupabaseAdmin()
  if (admin) return admin

  const authToken = request.headers.get('X-Supabase-Auth') || undefined
  if (authToken) {
    return createAuthenticatedClient(authToken)
  }

  // Last resort: use the anon client
  return createAnonClient()
}

// ============================================================
// Strategy 1: RPC function (fastest — all work done in PostgreSQL)
// ============================================================
async function fetchDuplicatesViaRPC(client: NonNullable<ReturnType<typeof getReadClient>>) {
  const startTime = Date.now()
  console.log('[api/duplicates] Trying RPC strategy (get_duplicate_phones)...')

  const { data, error } = await client.rpc('get_duplicate_phones')

  if (error) {
    console.log('[api/duplicates] RPC not available:', error.message)
    return null
  }

  if (!data || !Array.isArray(data)) {
    console.log('[api/duplicates] RPC returned unexpected data format')
    return null
  }

  console.log(`[api/duplicates] RPC succeeded in ${Date.now() - startTime}ms, got ${data.length} duplicate phones`)

  const duplicates: Record<string, {
    originalId: number
    originalTele: string
    originalSales: string | null
    duplicateIds: number[]
  }> = {}

  let totalLeadsInDuplicates = 0

  for (const row of data) {
    const phone = row.phone as string
    const rawLeadIds = row.lead_ids as Array<string | number>
    const teleNames = row.tele_names as string[]
    const salesNames = row.sales_names as string[]

    if (!phone || !rawLeadIds || rawLeadIds.length < 2) continue

    totalLeadsInDuplicates += rawLeadIds.length

    const norm = normalizePhone(phone)
    if (!norm) continue

    // BUG FIX: Use Number() for ID comparison with auto-increment int8 IDs
    const leadIds = rawLeadIds.map((id) => Number(id))

    duplicates[norm] = {
      originalId: leadIds[0],
      originalTele: teleNames[0] || '',
      originalSales: salesNames[0] || null,
      duplicateIds: leadIds.slice(1),
    }
  }

  // Get total count from DB
  const { count, error: countError } = await client
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', false)

  return {
    duplicates,
    totalLeads: countError ? totalLeadsInDuplicates : (count ?? totalLeadsInDuplicates),
    totalDuplicatePhones: Object.keys(duplicates).length,
  }
}

// ============================================================
// Strategy 2: Optimized two-pass approach (no RPC needed)
// ============================================================
async function fetchDuplicatesViaTwoPass(client: NonNullable<ReturnType<typeof getReadClient>>) {
  const startTime = Date.now()
  console.log('[api/duplicates] Using optimized two-pass strategy...')

  // Pass 1: Load only phone strings from all non-archived leads
  const PAGE_SIZE = 5000
  let allPhones: Array<{ id: number; phone: string | null }> = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await client
      .from('leads')
      .select('id, phone')
      .eq('is_archived', false)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[api/duplicates] Pass 1 query error:', error.message)
      throw error
    }

    if (data && data.length > 0) {
      allPhones = allPhones.concat(data)
      from += PAGE_SIZE
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
  }

  const totalLeads = allPhones.length
  console.log(`[api/duplicates] Pass 1 complete: ${totalLeads} leads loaded (phone only) in ${Date.now() - startTime}ms`)

  // Find duplicate phones in JS
  const phoneCount: Record<string, number> = {}
  const phoneToRawPhones: Record<string, string[]> = {}

  for (const lead of allPhones) {
    if (!lead.phone) continue
    const norm = normalizePhone(lead.phone)
    if (!norm) continue
    phoneCount[norm] = (phoneCount[norm] || 0) + 1
    if (!phoneToRawPhones[norm]) phoneToRawPhones[norm] = []
    if (!phoneToRawPhones[norm].includes(lead.phone)) {
      phoneToRawPhones[norm].push(lead.phone)
    }
  }

  const duplicateNormPhones = Object.keys(phoneCount).filter((p) => phoneCount[p] >= 2)
  console.log(`[api/duplicates] Found ${duplicateNormPhones.length} duplicate phones`)

  if (duplicateNormPhones.length === 0) {
    return {
      duplicates: {},
      totalLeads,
      totalDuplicatePhones: 0,
    }
  }

  // Pass 2: Load full lead data only for duplicate phones
  const rawPhonesToQuery: string[] = []
  for (const norm of duplicateNormPhones) {
    rawPhonesToQuery.push(...phoneToRawPhones[norm])
  }

  const IN_BATCH_SIZE = 500
  let duplicateLeads: Array<{ id: number; phone: string | null; tele_name: string | null; sales_name: string | null }> = []

  for (let i = 0; i < rawPhonesToQuery.length; i += IN_BATCH_SIZE) {
    const batch = rawPhonesToQuery.slice(i, i + IN_BATCH_SIZE)
    const { data, error } = await client
      .from('leads')
      .select('id, phone, tele_name, sales_name')
      .eq('is_archived', false)
      .in('phone', batch)
      .order('id', { ascending: true })

    if (error) {
      console.error('[api/duplicates] Pass 2 query error:', error.message)
      throw error
    }

    if (data) {
      duplicateLeads = duplicateLeads.concat(data)
    }
  }

  console.log(`[api/duplicates] Pass 2 complete: ${duplicateLeads.length} duplicate lead records loaded in ${Date.now() - startTime}ms total`)

  return buildDuplicatesResponse(duplicateLeads, totalLeads)
}

// ============================================================
// Strategy 3: Legacy fallback — load all leads
// ============================================================
async function fetchDuplicatesViaLegacy(client: NonNullable<ReturnType<typeof getReadClient>>) {
  const startTime = Date.now()
  console.log('[api/duplicates] Using legacy full-load strategy...')

  const PAGE_SIZE = 5000
  let allLeads: Array<{ id: number; phone: string | null; tele_name: string | null; sales_name: string | null }> = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await client
      .from('leads')
      .select('id, phone, tele_name, sales_name')
      .eq('is_archived', false)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[api/duplicates] Legacy query error:', error.message)
      throw error
    }

    if (data && data.length > 0) {
      allLeads = allLeads.concat(data)
      from += PAGE_SIZE
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
  }

  console.log(`[api/duplicates] Legacy complete: ${allLeads.length} leads loaded in ${Date.now() - startTime}ms`)

  return buildDuplicatesResponse(allLeads, allLeads.length)
}

// ============================================================
// Main handler
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const client = getReadClient(request)

    let result

    // Strategy 1: Try RPC (fastest)
    if (isAdminAvailable()) {
      try {
        result = await fetchDuplicatesViaRPC(client)
      } catch (err) {
        console.log('[api/duplicates] RPC failed, falling back:', err instanceof Error ? err.message : String(err))
        result = null
      }
    }

    // Strategy 2: Optimized two-pass
    if (!result) {
      try {
        result = await fetchDuplicatesViaTwoPass(client)
      } catch (err) {
        console.error('[api/duplicates] Two-pass failed, falling back to legacy:', err instanceof Error ? err.message : String(err))
        result = null
      }
    }

    // Strategy 3: Legacy full-load fallback
    if (!result) {
      result = await fetchDuplicatesViaLegacy(client)
    }

    // Add caching headers — duplicate data is valid for 30 seconds
    const response = NextResponse.json(result)
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    return response
  } catch (err) {
    console.error('[api/duplicates] Unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
