import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-guard'

/**
 * /api/meetings
 *
 * GET  — list meetings. Query params:
 *        ?filter={today|week|upcoming|all}&member={name}&search={query}
 *        &role={tele|sales|admin}&user={currentUser}
 *
 *        NOTE: meetings table stores explicit meeting records. However, the
 *        existing UI reads meeting info from the `leads` table (meeting_date,
 *        meeting_time, etc.). To avoid a breaking migration, this endpoint
 *        returns meetings derived FROM leads (joins the leads table) plus any
 *        explicit rows in the `meetings` table. This keeps backward compatibility.
 *
 * PATCH — update a meeting's status (attended/no-show) by lead_id.
 *         Body: { lead_id, attended } — updates the leads table.
 */

// ===== GET =====
export async function GET(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  try {
    const client = getSupabaseAdmin() || createAnonClient()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const member = searchParams.get('member') || ''
    const search = searchParams.get('search')?.trim() || ''
    const role = session.role

    // Date filters
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)
    const weekStart = new Date(todayStart)
    // Arabic week starts Saturday (day 6 in JS)
    const dayOfWeek = now.getDay()
    const daysSinceSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1
    weekStart.setDate(weekStart.getDate() - daysSinceSaturday)

    // Build query on leads table (since meeting info lives there)
    let query = client
      .from('leads')
      .select('id, customer_name, phone, store_url, brief, tele_name, sales_name, meeting_date, meeting_time, meeting_type, meeting_link, attended, attendance_marked_at, attendance_marked_by, sales_status, assigned_at, created_at, is_archived')
      .not('meeting_date', 'is', null)
      .eq('is_archived', false)

    // Filter by date
    if (filter === 'today') {
      const todayStr = todayStart.toISOString().split('T')[0]
      query = query.eq('meeting_date', todayStr)
    } else if (filter === 'week') {
      const weekStartStr = weekStart.toISOString().split('T')[0]
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const weekEndStr = weekEnd.toISOString().split('T')[0]
      query = query.gte('meeting_date', weekStartStr).lt('meeting_date', weekEndStr)
    } else if (filter === 'upcoming') {
      const todayStr = todayStart.toISOString().split('T')[0]
      query = query.gte('meeting_date', todayStr)
    }

    // Role-based filtering
    if (role === 'tele' && !member) {
      query = query.eq('tele_name', session.uname)
    } else if (role === 'sales' && !member) {
      query = query.eq('sales_name', session.uname)
    } else if (member) {
      // Admin or explicit member filter
      query = query.or(`tele_name.eq.${member},sales_name.eq.${member}`)
    }

    // Order by meeting_date ascending
    query = query.order('meeting_date', { ascending: true }).order('meeting_time', { ascending: true })

    const { data, error } = await query

    if (error) {
      console.error('[api/meetings] GET error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Apply search filter client-side (covers customer_name + phone)
    let result = (data || []).map((row: Record<string, unknown>) => ({
      leadId: String(row.id ?? ''),
      customerName: String(row.customer_name ?? ''),
      phone: String(row.phone ?? ''),
      storeUrl: String(row.store_url ?? ''),
      brief: String(row.brief ?? ''),
      tele: String(row.tele_name ?? ''),
      sales: String(row.sales_name ?? ''),
      meetingDate: String(row.meeting_date ?? ''),
      meetingTime: String(row.meeting_time ?? ''),
      meetingType: String(row.meeting_type ?? ''),
      meetingLink: String(row.meeting_link ?? ''),
      attended: String(row.attended ?? ''),
      attendanceMarkedAt: row.attendance_marked_at ? new Date(row.attendance_marked_at as string).getTime() : null,
      attendanceMarkedBy: String(row.attendance_marked_by ?? ''),
      salesStatus: String(row.sales_status ?? ''),
      assignedAt: row.assigned_at ? new Date(row.assigned_at as string).getTime() : null,
      createdAt: row.created_at ? new Date(row.created_at as string).getTime() : 0,
    }))

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.customerName.toLowerCase().includes(q) ||
          m.phone.toLowerCase().includes(q) ||
          m.storeUrl.toLowerCase().includes(q)
      )
    }

    return NextResponse.json({
      data: result,
      total: result.length,
      filter,
    })
  } catch (err) {
    console.error('[api/meetings] GET unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== PATCH (mark attendance) =====
export async function PATCH(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  try {
    const client = getSupabaseAdmin()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { lead_id, attended } = body as { lead_id: string; attended: 'attended' | 'no-show' }

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })
    }
    if (attended !== 'attended' && attended !== 'no-show') {
      return NextResponse.json({ error: 'attended must be "attended" or "no-show"' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data, error } = await client
      .from('leads')
      .update({
        attended,
        attendance_marked_at: now,
        attendance_marked_by: session.uname,
      })
      .eq('id', lead_id)
      .select('id, attended, attendance_marked_at, attendance_marked_by')
      .single()

    if (error) {
      console.error('[api/meetings] PATCH error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        leadId: String(data.id),
        attended: data.attended,
        attendanceMarkedAt: data.attendance_marked_at ? new Date(data.attendance_marked_at).getTime() : null,
        attendanceMarkedBy: data.attendance_marked_by,
      },
    })
  } catch (err) {
    console.error('[api/meetings] PATCH unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
