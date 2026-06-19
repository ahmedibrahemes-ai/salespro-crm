import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-guard'

/**
 * /api/daily-reports
 *
 * GET  — list daily reports. Query: ?date={YYYY-MM-DD}&employee={name}&role={tele|sales|admin}
 *
 * POST — upsert a daily report (uses UNIQUE(employee_name, report_date) constraint).
 *        Body: { employee_name, employee_role, report_date, calls_made, meetings_done,
 *                deals_closed, revenue, notes }
 */

interface DailyReportRow {
  id: number
  employee_name: string
  employee_role: string
  report_date: string
  calls_made: number
  meetings_done: number
  deals_closed: number
  revenue: number
  notes: string | null
  submitted_at: string
}

function reportFromDb(row: DailyReportRow) {
  return {
    id: String(row.id),
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    reportDate: row.report_date,
    callsMade: row.calls_made,
    meetingsDone: row.meetings_done,
    dealsClosed: row.deals_closed,
    revenue: Number(row.revenue),
    notes: row.notes || '',
    submittedAt: new Date(row.submitted_at).getTime(),
  }
}

// ===== GET =====
export async function GET(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  try {
    const client = getSupabaseAdmin()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const employee = searchParams.get('employee')
    const role = searchParams.get('role')

    let query = client
      .from('daily_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .order('employee_name', { ascending: true })

    if (date) query = query.eq('report_date', date)
    if (employee) query = query.eq('employee_name', employee)
    if (role) query = query.eq('employee_role', role)

    // Non-admins can only see their own reports
    if (session.role !== 'admin') {
      query = query.eq('employee_name', session.uname)
    }

    const { data, error } = await query
    if (error) {
      console.error('[api/daily-reports] GET error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: (data || []).map(reportFromDb) })
  } catch (err) {
    console.error('[api/daily-reports] GET unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== POST (upsert) =====
export async function POST(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  try {
    const client = getSupabaseAdmin()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const body = await request.json()
    const {
      employee_name,
      employee_role,
      report_date,
      calls_made,
      meetings_done,
      deals_closed,
      revenue,
      notes,
    } = body as {
      employee_name: string
      employee_role: string
      report_date: string
      calls_made?: number
      meetings_done?: number
      deals_closed?: number
      revenue?: number
      notes?: string
    }

    // Validate
    if (!employee_name || !employee_role || !report_date) {
      return NextResponse.json(
        { error: 'employee_name, employee_role, and report_date are required' },
        { status: 400 }
      )
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(report_date)) {
      return NextResponse.json({ error: 'report_date must be YYYY-MM-DD' }, { status: 400 })
    }

    // Only the user themselves or an admin can submit their report
    if (session.role !== 'admin' && employee_name !== session.uname) {
      return NextResponse.json(
        { error: 'You can only submit reports for yourself' },
        { status: 403 }
      )
    }

    // Upsert (uses UNIQUE(employee_name, report_date) constraint)
    const { data, error } = await client
      .from('daily_reports')
      .upsert(
        {
          employee_name,
          employee_role,
          report_date,
          calls_made: Math.max(0, Number(calls_made) || 0),
          meetings_done: Math.max(0, Number(meetings_done) || 0),
          deals_closed: Math.max(0, Number(deals_closed) || 0),
          revenue: Math.max(0, Number(revenue) || 0),
          notes: notes ? String(notes).slice(0, 2000) : null,
        },
        { onConflict: 'employee_name,report_date' }
      )
      .select('*')
      .single()

    if (error) {
      console.error('[api/daily-reports] POST error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: reportFromDb(data as DailyReportRow) }, { status: 201 })
  } catch (err) {
    console.error('[api/daily-reports] POST unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
