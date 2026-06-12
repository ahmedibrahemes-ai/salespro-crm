import { NextResponse } from 'next/server'
import { getSupabaseAdmin, isAdminAvailable, createAnonClient } from '@/lib/supabase-admin'

/**
 * GET /api/stats
 *
 * Computes CRM statistics from Supabase using count: 'exact' for accurate counts.
 * NO Prisma/SQLite — Supabase ONLY.
 * NO hardcoded credentials — environment variables only.
 * Uses Egypt timezone (Africa/Cairo, UTC+2) for "today" calculations.
 */

function getCurrentMonthAr(): string {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ]
  // Use Egypt timezone for month name
  const nowEgypt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  return months[nowEgypt.getMonth()]
}

/** Helper: get exact count from Supabase using head: true + count: 'exact' */
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

export async function GET() {
  try {
    // Use admin client if available (bypasses RLS), otherwise anon client
    const client = isAdminAvailable() ? getSupabaseAdmin()! : createAnonClient()
    if (!client) {
      // Return empty stats when Supabase is not configured (demo mode)
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

    // ===== Core counts using count: 'exact' =====
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
      // Meetings: leads with a non-empty meeting_date
      client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .not('meeting_date', '')
        .then(({ count, error }: { count: number | null; error: { message: string } | null }) => {
          if (error) console.error('[api/stats] totalMeetings error:', error.message)
          return count ?? 0
        }),
      getCount(client, 'leads', { status: 'closed-won', is_archived: false }),
      getCount(client, 'leads', { status: 'closed-lost', is_archived: false }),
    ])

    // ===== Today's stats (Egypt timezone UTC+2) =====
    const nowEgypt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
    // Egypt is always UTC+2 (no daylight saving time)
    // midnight Cairo = 22:00 UTC of the previous day
    const EGYPT_OFFSET_MS = 2 * 60 * 60 * 1000
    const todayStartUTC = new Date(Date.UTC(nowEgypt.getFullYear(), nowEgypt.getMonth(), nowEgypt.getDate()) - EGYPT_OFFSET_MS)
    const todayISO = todayStartUTC.toISOString()
    // Date string in Egypt timezone (for meeting_date column which stores YYYY-MM-DD)
    const todayDateStr = `${nowEgypt.getFullYear()}-${String(nowEgypt.getMonth() + 1).padStart(2, '0')}-${String(nowEgypt.getDate()).padStart(2, '0')}`

    const [leadsToday, meetingsToday, attendedToday, dealsToday] = await Promise.all([
      // Leads created today
      client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .gte('created_at', todayISO)
        .then(({ count, error }: { count: number | null; error: { message: string } | null }) => {
          if (error) console.error('[api/stats] leadsToday error:', error.message)
          return count ?? 0
        }),
      // Meetings today (meeting_date = today's date string)
      client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .eq('meeting_date', todayDateStr)
        .then(({ count, error }: { count: number | null; error: { message: string } | null }) => {
          if (error) console.error('[api/stats] meetingsToday error:', error.message)
          return count ?? 0
        }),
      // Marked attended today
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
      // Deals closed today (use contact_result_at as proxy until closed_at column is added)
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
    ])

    // ===== Per-tele stats =====
    // Load only the fields needed for aggregation
    const teleLeads: Array<{ tele_name: string | null; attended: string | null; meeting_date: string | null; sales_status: string | null; status: string | null; contact_result: string | null }> = []
    {
      const PAGE_SIZE = 5000
      let from = 0
      let hasMore = true
      while (hasMore) {
        const { data, error } = await client
          .from('leads')
          .select('tele_name, attended, meeting_date, sales_status, status, contact_result')
          .eq('is_archived', false)
          .not('tele_name', '')
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
        if (error) {
          console.error('[api/stats] per-tele query error:', error.message)
          break
        }
        if (data && data.length > 0) {
          teleLeads.push(...(data as typeof teleLeads))
          from += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }
    }

    const perTele: Record<string, { total: number; attended: number; noShow: number; meetings: number; closedWon: number }> = {}
    for (const lead of teleLeads) {
      const tele = (lead.tele_name || '').trim()
      if (!tele) continue
      if (!perTele[tele]) perTele[tele] = { total: 0, attended: 0, noShow: 0, meetings: 0, closedWon: 0 }
      perTele[tele].total++
      if (lead.attended === 'attended') perTele[tele].attended++
      if (lead.attended === 'no-show') perTele[tele].noShow++
      if (lead.meeting_date) perTele[tele].meetings++
      if (lead.sales_status === 'closed-won' || lead.status === 'closed-won') perTele[tele].closedWon++
    }

    // ===== Per-sales stats =====
    const salesLeads: Array<{ sales_name: string | null; attended: string | null; meeting_date: string | null; sales_status: string | null; status: string | null }> = []
    {
      const PAGE_SIZE = 5000
      let from = 0
      let hasMore = true
      while (hasMore) {
        const { data, error } = await client
          .from('leads')
          .select('sales_name, attended, meeting_date, sales_status, status')
          .eq('is_archived', false)
          .not('sales_name', '')
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
        if (error) {
          console.error('[api/stats] per-sales query error:', error.message)
          break
        }
        if (data && data.length > 0) {
          salesLeads.push(...(data as typeof salesLeads))
          from += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }
    }

    const perSales: Record<string, { total: number; attended: number; noShow: number; meetings: number; closedWon: number }> = {}
    for (const lead of salesLeads) {
      const sales = (lead.sales_name || '').trim()
      if (!sales) continue
      if (!perSales[sales]) perSales[sales] = { total: 0, attended: 0, noShow: 0, meetings: 0, closedWon: 0 }
      perSales[sales].total++
      if (lead.attended === 'attended') perSales[sales].attended++
      if (lead.attended === 'no-show') perSales[sales].noShow++
      if (lead.meeting_date) perSales[sales].meetings++
      if (lead.sales_status === 'closed-won' || lead.status === 'closed-won') perSales[sales].closedWon++
    }

    // ===== Conversion rate =====
    const conversionRate = totalActive > 0 ? Math.round((totalClosedWon / totalActive) * 1000) / 10 : 0

    // ===== Overdue count =====
    // Overdue = leads with a meeting date in the past but no attendance marked yet
    const overdueCount = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false)
      .not('meeting_date', '')
      .lt('meeting_date', todayDateStr)
      .is('attended', null)
      .then(({ count }: { count: number | null }) => count ?? 0)

    // ===== Weekly calls analytics (computed from leads data) =====
    // Egypt work week: Saturday to Friday
    const dayNames = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
    const weeklyCalls = dayNames.map((day) => ({ day, count: 0 }))
    // Map JS getDay() (0=Sun,1=Mon,...,6=Sat) to our Arabic week index (0=Sat,1=Sun,...,6=Fri)
    const jsDayToArabicWeek: Record<number, number> = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }

    // Count leads per day of week from last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoISO = sevenDaysAgo.toISOString()

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
      // Use Egypt timezone for correct day-of-week calculation
      const d = new Date(new Date(lead.created_at).toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
      const jsDay = d.getDay()
      const arabicIdx = jsDayToArabicWeek[jsDay]
      if (arabicIdx !== undefined && weeklyCalls[arabicIdx]) weeklyCalls[arabicIdx].count++
    }

    // ===== Call analytics =====
    // Count actual calls = leads where a contact result was recorded (not just 'none' or empty)
    const callsWithResult = teleLeads.filter((l) => l.contact_result && l.contact_result !== 'none' && l.contact_result !== '').length
    const contactResults = teleLeads.filter((l) => l.attended !== null)
    const successCount = contactResults.filter((l) => l.attended === 'attended').length
    const failCount = contactResults.filter((l) => l.attended === 'no-show').length
    // We don't track actual call duration — don't show fake numbers
    const avgDurationMin = 0
    const avgDurationSecRem = 0

    // ===== AI Score (computed from lead outcomes) =====
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
      // Additional dashboard stats — using REAL data, no fake numbers
      totalCalls: callsWithResult,
      closedDeals: totalClosedWon,
      conversionRate,
      leadsToday,
      callsToday: await client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .not('contact_result', '')
        .neq('contact_result', 'none')
        .gte('contact_result_at', todayISO)
        .then(({ count }: { count: number | null }) => count ?? 0),
      dealsToday, // Real count from DB, not hardcoded 0
      currentMonth: getCurrentMonthAr(),
      weeklyCalls,
      callAnalytics: {
        totalMinutes: 0, // Set to 0 until actual call duration tracking is implemented
        successCount,
        failCount,
        avgDuration: `${avgDurationMin}:${avgDurationSecRem.toString().padStart(2, '0')}`,
      },
      aiScore,
      overdueCount,
    }

    // Cache for 5 minutes to avoid hammering the database on every dashboard load
    // Previously 30s which caused excessive egress with full-table scans
    const response = NextResponse.json(stats)
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
    return response
  } catch (error) {
    console.error('Error fetching stats:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
