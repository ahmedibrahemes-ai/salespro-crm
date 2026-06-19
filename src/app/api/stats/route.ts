import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin, isAdminAvailable, createAnonClient } from '@/lib/supabase-admin'
import { isStatsCacheValid, getStatsCache, setStatsCache, recordStatsHit, recordStatsMiss, recordSupabaseQuery } from '@/lib/api-cache'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-guard'

/**
 * GET /api/stats
 *
 * Computes CRM statistics from Supabase.
 * Uses RPC (server-side aggregation) instead of downloading full tables.
 * This drastically reduces egress compared to the old full-table-scan approach.
 * Uses Egypt timezone (Africa/Cairo, UTC+2) for "today" calculations.
 */

function getCurrentMonthAr(): string {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ]
  const nowEgypt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  return months[nowEgypt.getMonth()]
}

/** Helper: get exact count from Supabase using head: true (zero egress) */
async function getCount(
  client: ReturnType<typeof createAnonClient>,
  table: string,
  filters?: Record<string, unknown>
): Promise<number> {
  let query = client.from(table).select('*', { count: 'exact', head: true })
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value === null) {
        query = query.is(key, null)
      } else if (Array.isArray(value)) {
        query = query.in(key, value)
      } else {
        query = query.eq(key, value)
      }
    }
  }
  const { count, error } = await query
  if (error) {
    console.error(`[api/stats] getCount error for ${table}:`, error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Fallback: compute per-person stats client-side (for when RPC is not available).
 * This is the OLD approach — kept as fallback only.
 * It uses a single combined query instead of 3 separate full-table scans.
 */
async function computePerPersonStatsFallback(client: ReturnType<typeof createAnonClient>) {
  // Single query with all needed fields — eliminates 2 of 3 full-table scans
  const allLeads: Array<{
    tele_name: string | null; sales_name: string | null;
    attended: string | null; meeting_date: string | null;
    sales_status: string | null; status: string | null; contact_result: string | null
  }> = []
  {
    const PAGE_SIZE = 5000
    let from = 0
    let hasMore = true
    while (hasMore) {
      const { data, error } = await client
        .from('leads')
        .select('tele_name, sales_name, attended, meeting_date, sales_status, status, contact_result')
        .eq('is_archived', false)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) {
        console.error('[api/stats] fallback per-person query error:', error.message)
        break
      }
      if (data && data.length > 0) {
        allLeads.push(...(data as typeof allLeads))
        from += PAGE_SIZE
        hasMore = data.length === PAGE_SIZE
      } else {
        hasMore = false
      }
    }
  }

  const perTele: Record<string, { total: number; attended: number; noShow: number; meetings: number; closedWon: number }> = {}
  const perSales: Record<string, { total: number; attended: number; noShow: number; meetings: number; closedWon: number }> = {}
  let callsWithResult = 0
  let successCount = 0
  let failCount = 0

  for (const lead of allLeads) {
    // Per-tele aggregation
    const tele = (lead.tele_name || '').trim()
    if (tele) {
      if (!perTele[tele]) perTele[tele] = { total: 0, attended: 0, noShow: 0, meetings: 0, closedWon: 0 }
      perTele[tele].total++
      if (lead.attended === 'attended') perTele[tele].attended++
      if (lead.attended === 'no-show') perTele[tele].noShow++
      if (lead.meeting_date) perTele[tele].meetings++
      if (lead.sales_status === 'closed-won' || lead.status === 'closed-won') perTele[tele].closedWon++
    }

    // Per-sales aggregation
    const sales = (lead.sales_name || '').trim()
    if (sales) {
      if (!perSales[sales]) perSales[sales] = { total: 0, attended: 0, noShow: 0, meetings: 0, closedWon: 0 }
      perSales[sales].total++
      if (lead.attended === 'attended') perSales[sales].attended++
      if (lead.attended === 'no-show') perSales[sales].noShow++
      if (lead.meeting_date) perSales[sales].meetings++
      if (lead.sales_status === 'closed-won' || lead.status === 'closed-won') perSales[sales].closedWon++
    }

    // Call analytics
    if (lead.contact_result && lead.contact_result !== 'none' && lead.contact_result !== '') callsWithResult++
    if (lead.attended !== null) {
      if (lead.attended === 'attended') successCount++
      if (lead.attended === 'no-show') failCount++
    }
  }

  return { perTele, perSales, callsWithResult, successCount, failCount }
}

/**
 * Try to use Supabase RPC for server-side aggregation (near-zero egress).
 * Falls back to client-side if RPC functions don't exist yet.
 */
async function computePerPersonStatsRPC(client: ReturnType<typeof createAnonClient>) {
  try {
    // Call the RPC function — it returns pre-aggregated rows (tiny egress)
    const [teleResult, salesResult, callResult] = await Promise.all([
      client.rpc('get_per_tele_stats'),
      client.rpc('get_per_sales_stats'),
      client.rpc('get_call_analytics'),
    ])

    if (teleResult.error) {
      // RPC function doesn't exist yet — fall back
      console.warn('[api/stats] RPC not available, falling back to client-side aggregation. Error:', teleResult.error.message)
      return null
    }

    console.log('[api/stats] ✅ RPC functions working! Egress optimized.')

    const perTele: Record<string, { total: number; attended: number; noShow: number; meetings: number; closedWon: number }> = {}
    for (const row of teleResult.data || []) {
      perTele[row.tele_name] = {
        total: Number(row.total),
        attended: Number(row.attended),
        noShow: Number(row.no_show),
        meetings: Number(row.meetings),
        closedWon: Number(row.closed_won),
      }
    }

    const perSales: Record<string, { total: number; attended: number; noShow: number; meetings: number; closedWon: number }> = {}
    for (const row of salesResult.data || []) {
      perSales[row.sales_name] = {
        total: Number(row.total),
        attended: Number(row.attended),
        noShow: Number(row.no_show),
        meetings: Number(row.meetings),
        closedWon: Number(row.closed_won),
      }
    }

    const callData = callResult.data?.[0] || {}
    return {
      perTele,
      perSales,
      callsWithResult: Number(callData.total_calls || 0),
      successCount: Number(callData.success_count || 0),
      failCount: Number(callData.fail_count || 0),
    }
  } catch {
    // RPC not available — fall back
    console.warn('[api/stats] RPC call failed, falling back to client-side aggregation.')
    return null
  }
}

/**
 * Weekly calls via RPC (server-side) — near-zero egress.
 * Falls back to client-side if RPC doesn't exist.
 */
async function computeWeeklyCallsRPC(client: ReturnType<typeof createAnonClient>, sevenDaysAgoISO: string) {
  try {
    const { data, error } = await client.rpc('get_weekly_calls', { days_ago: sevenDaysAgoISO })
    if (error) return null

    // Map JS getDay() (0=Sun,...,6=Sat) to Arabic week index (0=Sat,...,6=Fri)
    const jsDayToArabicWeek: Record<number, number> = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }
    const dayNames = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
    const weeklyCalls = dayNames.map((day) => ({ day, count: 0 }))

    for (const row of data || []) {
      const idx = jsDayToArabicWeek[row.day_of_week]
      if (idx !== undefined && weeklyCalls[idx]) weeklyCalls[idx].count = Number(row.count)
    }
    return weeklyCalls
  } catch {
    return null
  }
}

/** Fallback: compute weekly calls client-side (downloads created_at for recent leads) */
async function computeWeeklyCallsFallback(client: ReturnType<typeof createAnonClient>, sevenDaysAgoISO: string) {
  const dayNames = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
  const weeklyCalls = dayNames.map((day) => ({ day, count: 0 }))
  const jsDayToArabicWeek: Record<number, number> = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }

  const recentLeads: Array<{ created_at: string | null }> = []
  {
    const PAGE_SIZE = 5000
    let from = 0
    let hasMore = true
    while (hasMore) {
      const { data, error } = await client
        .from('leads')
        .select('created_at')
        .gte('created_at', sevenDaysAgoISO)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) break
      if (data && data.length > 0) {
        recentLeads.push(...(data as typeof recentLeads))
        from += PAGE_SIZE
        hasMore = data.length === PAGE_SIZE
      } else {
        hasMore = false
      }
    }
  }

  for (const lead of recentLeads) {
    if (!lead.created_at) continue
    const d = new Date(new Date(lead.created_at).toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
    const jsDay = d.getDay()
    const arabicIdx = jsDayToArabicWeek[jsDay]
    if (arabicIdx !== undefined && weeklyCalls[arabicIdx]) weeklyCalls[arabicIdx].count++
  }

  return weeklyCalls
}

export async function GET(request: NextRequest) {
  // Require auth — stats are sensitive business data
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  try {
    // Check in-memory cache first — avoids hitting Supabase entirely
    if (isStatsCacheValid()) {
      recordStatsHit()
      const cached = getStatsCache()!
      const response = NextResponse.json(cached)
      response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
      response.headers.set('X-Cache', 'HIT')
      return response
    }
    recordStatsMiss()
    recordSupabaseQuery(15) // 9 core counts + 5 today counts + 1 overdue count

    const client = isAdminAvailable() ? getSupabaseAdmin()! : createAnonClient()
    if (!client) {
      return NextResponse.json({
        totalLeads: 0, totalActive: 0, totalArchived: 0, totalAttended: 0,
        totalNoShow: 0, totalPending: 0, totalMeetings: 0, totalClosedWon: 0,
        totalClosedLost: 0, todayStats: { leadsCreated: 0, meetingsToday: 0, attendedToday: 0 },
        perTele: {}, perSales: {}, totalCalls: 0, closedDeals: 0, conversionRate: 0,
        leadsToday: 0, callsToday: 0, dealsToday: 0, currentMonth: getCurrentMonthAr(),
        weeklyCalls: ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'].map(day => ({ day, count: 0 })),
        callAnalytics: { totalMinutes: 0, successCount: 0, failCount: 0, avgDuration: '0:00' },
        aiScore: 0, overdueCount: 0,
      })
    }

    // ===== Core counts using count: 'exact' (zero egress) =====
    const [
      totalLeads,
      totalActive,
      totalArchived,
      totalAttended,
      totalNoShow,
      totalPending,
      totalMeetings,
      totalClosedWon,
      totalClosedLost,
    ] = await Promise.all([
      getCount(client, 'leads'),
      getCount(client, 'leads', { is_archived: false }),
      getCount(client, 'leads', { is_archived: true }),
      getCount(client, 'leads', { attended: 'attended', is_archived: false }),
      getCount(client, 'leads', { attended: 'no-show', is_archived: false }),
      getCount(client, 'leads', { attended: null, is_archived: false }),
      client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .not('meeting_date', 'is', null)  // meeting_date is a DATE column — use IS NOT NULL instead of <> ''
        .then(({ count, error }: { count: number | null; error: { message: string } | null }) => {
          if (error) console.error('[api/stats] totalMeetings error:', error.message)
          return count ?? 0
        }),
      getCount(client, 'leads', { status: 'closed-won', is_archived: false }),
      getCount(client, 'leads', { status: 'closed-lost', is_archived: false }),
    ])

    // ===== Today's stats (Egypt timezone UTC+2) =====
    const nowEgypt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
    const EGYPT_OFFSET_MS = 2 * 60 * 60 * 1000
    const todayStartUTC = new Date(Date.UTC(nowEgypt.getFullYear(), nowEgypt.getMonth(), nowEgypt.getDate()) - EGYPT_OFFSET_MS)
    const todayISO = todayStartUTC.toISOString()
    const todayDateStr = `${nowEgypt.getFullYear()}-${String(nowEgypt.getMonth() + 1).padStart(2, '0')}-${String(nowEgypt.getDate()).padStart(2, '0')}`

    const [leadsToday, meetingsToday, attendedToday, dealsToday, callsToday] = await Promise.all([
      client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .gte('created_at', todayISO)
        .then(({ count, error }: { count: number | null; error: { message: string } | null }) => {
          if (error) console.error('[api/stats] leadsToday error:', error.message)
          return count ?? 0
        }),
      client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .eq('meeting_date', todayDateStr)
        .then(({ count, error }: { count: number | null; error: { message: string } | null }) => {
          if (error) console.error('[api/stats] meetingsToday error:', error.message)
          return count ?? 0
        }),
      client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('attended', 'attended')
        .eq('is_archived', false)
        .gte('attendance_marked_at', todayISO)
        .then(({ count, error }: { count: number | null; error: { message: string } | null }) => {
          if (error) console.error('[api/stats] attendedToday error:', error.message)
          return count ?? 0
        }),
      client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .eq('status', 'closed-won')
        .gte('contact_result_at', todayISO)
        .then(({ count, error }: { count: number | null; error: { message: string } | null }) => {
          if (error) console.error('[api/stats] dealsToday error:', error.message)
          return count ?? 0
        }),
      client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .not('contact_result', '')
        .neq('contact_result', 'none')
        .gte('contact_result_at', todayISO)
        .then(({ count }: { count: number | null }) => count ?? 0),
    ])

    // ===== Per-person stats — try RPC first, fallback to client-side =====
    const rpcResult = await computePerPersonStatsRPC(client)
    let perTele: Record<string, { total: number; attended: number; noShow: number; meetings: number; closedWon: number }>
    let perSales: Record<string, { total: number; attended: number; noShow: number; meetings: number; closedWon: number }>
    let callsWithResult: number
    let successCount: number
    let failCount: number

    if (rpcResult) {
      perTele = rpcResult.perTele
      perSales = rpcResult.perSales
      callsWithResult = rpcResult.callsWithResult
      successCount = rpcResult.successCount
      failCount = rpcResult.failCount
    } else {
      const fallback = await computePerPersonStatsFallback(client)
      perTele = fallback.perTele
      perSales = fallback.perSales
      callsWithResult = fallback.callsWithResult
      successCount = fallback.successCount
      failCount = fallback.failCount
    }

    // ===== Conversion rate =====
    const conversionRate = totalActive > 0 ? Math.round((totalClosedWon / totalActive) * 1000) / 10 : 0

    // ===== Overdue count (zero egress — head: true) =====
    const overdueCount = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false)
      .not('meeting_date', 'is', null)  // meeting_date is a DATE column — use IS NOT NULL instead of <> ''
      .lt('meeting_date', todayDateStr)
      .is('attended', null)
      .then(({ count }: { count: number | null }) => count ?? 0)

    // ===== Weekly calls — try RPC first, fallback to client-side =====
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoISO = sevenDaysAgo.toISOString()

    const weeklyCalls = (await computeWeeklyCallsRPC(client, sevenDaysAgoISO))
      || (await computeWeeklyCallsFallback(client, sevenDaysAgoISO))

    // ===== AI Score =====
    const totalOutcomes = totalAttended + totalNoShow
    const aiScore = totalOutcomes > 0 ? Math.round((totalAttended / totalOutcomes) * 100) / 10 : 0

    const stats = {
      totalLeads,
      totalActive,
      totalArchived,
      totalAttended,
      totalNoShow,
      totalPending,
      totalMeetings,
      totalClosedWon,
      totalClosedLost,
      todayStats: {
        leadsCreated: leadsToday,
        meetingsToday,
        attendedToday,
      },
      perTele,
      perSales,
      totalCalls: callsWithResult,
      closedDeals: totalClosedWon,
      conversionRate,
      leadsToday,
      callsToday,
      dealsToday,
      currentMonth: getCurrentMonthAr(),
      weeklyCalls,
      callAnalytics: {
        totalMinutes: 0,
        successCount,
        failCount,
        avgDuration: '0:00',
      },
      aiScore,
      overdueCount,
    }

    // Store in server-side cache for 60 seconds
    setStatsCache(stats)
    const response = NextResponse.json(stats)
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
    response.headers.set('X-Cache', 'MISS')
    return response
  } catch (error) {
    console.error('Error fetching stats:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
