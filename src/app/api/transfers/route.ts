import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-guard'

/**
 * /api/transfers
 *
 * GET  — list lead transfers. Query params:
 *        ?tele={name}&sales={name}&search={query}&date_preset={today|week|month|all}
 *        &date_from={ISO}&date_to={ISO}&page={N}&limit={M}
 *
 * POST — create a transfer record (called after a lead is assigned to a sales rep).
 *        Body: { lead_id, from_name, to_name, from_role?, to_role?, reason?, transferred_by }
 */

interface TransferRow {
  id: number
  lead_id: number
  from_name: string | null
  to_name: string | null
  from_role: string | null
  to_role: string | null
  reason: string | null
  transferred_by: string | null
  transferred_at: string
}

function transferFromDb(row: TransferRow) {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    fromName: row.from_name || '',
    toName: row.to_name || '',
    fromRole: row.from_role || '',
    toRole: row.to_role || '',
    reason: row.reason || '',
    transferredBy: row.transferred_by || '',
    transferredAt: new Date(row.transferred_at).getTime(),
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
    const tele = searchParams.get('tele') || ''
    const sales = searchParams.get('sales') || ''
    const search = searchParams.get('search')?.trim() || ''
    const datePreset = searchParams.get('date_preset') || 'all'
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)))

    // Build base query (no JOIN — Supabase REST needs explicit FK for that)
    let query = client
      .from('transfers')
      .select('*', { count: 'exact' })
      .order('transferred_at', { ascending: false })

    // Role-based filtering
    if (session.role === 'tele') {
      // Tele users see transfers they made (from_name = their name)
      query = query.eq('from_name', session.uname)
    } else if (session.role === 'sales') {
      // Sales users see transfers assigned to them (to_name = their name)
      query = query.eq('to_name', session.uname)
    }
    // Admins see all transfers

    // Optional filters
    if (tele) query = query.eq('from_name', tele)
    if (sales) query = query.eq('to_name', sales)

    // Date filtering
    if (datePreset !== 'all') {
      const now = new Date()
      let startDate: Date | null = null
      if (datePreset === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (datePreset === 'week') {
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
      } else if (datePreset === 'month') {
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
      }
      if (startDate) {
        query = query.gte('transferred_at', startDate.toISOString())
      }
    } else if (dateFrom) {
      query = query.gte('transferred_at', dateFrom)
      if (dateTo) query = query.lte('transferred_at', dateTo)
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('[api/transfers] GET error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch related lead data in a separate query (avoids JOIN requirement)
    const transferRows = (data || []) as TransferRow[]
    const leadIds = transferRows.map((t) => t.lead_id).filter(Boolean)
    let leadsMap: Record<string, Record<string, unknown>> = {}

    if (leadIds.length > 0) {
      const { data: leadsData, error: leadsErr } = await client
        .from('leads')
        .select('id, customer_name, phone, store_url, brief, meeting_date, meeting_time, attended, sales_status, tele_name, sales_name')
        .in('id', leadIds)

      if (leadsErr) {
        console.error('[api/transfers] leads fetch error:', leadsErr.message)
        // non-fatal — return transfers without lead info
      } else if (leadsData) {
        for (const lead of leadsData as Array<Record<string, unknown>>) {
          leadsMap[String(lead.id)] = lead
        }
      }
    }

    // Map results
    let result = transferRows.map((transfer) => {
      const lead = leadsMap[String(transfer.lead_id)] || {}
      return {
        ...transferFromDb(transfer),
        lead: {
          id: String(lead.id ?? ''),
          customerName: String(lead.customer_name ?? ''),
          phone: String(lead.phone ?? ''),
          storeUrl: String(lead.store_url ?? ''),
          brief: String(lead.brief ?? ''),
          meetingDate: String(lead.meeting_date ?? ''),
          meetingTime: String(lead.meeting_time ?? ''),
          attended: String(lead.attended ?? ''),
          salesStatus: String(lead.sales_status ?? ''),
          tele: String(lead.tele_name ?? ''),
          sales: String(lead.sales_name ?? ''),
        },
      }
    })

    // Apply search filter client-side (on joined lead fields)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.lead.customerName.toLowerCase().includes(q) ||
          t.lead.phone.toLowerCase().includes(q) ||
          t.lead.storeUrl.toLowerCase().includes(q) ||
          t.fromName.toLowerCase().includes(q) ||
          t.toName.toLowerCase().includes(q)
      )
    }

    return NextResponse.json({
      data: result,
      total: count ?? 0,
      page,
      limit,
      hasMore: from + result.length < (count ?? 0),
    })
  } catch (err) {
    console.error('[api/transfers] GET unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== POST =====
export async function POST(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  try {
    const client = getSupabaseAdmin()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { lead_id, from_name, to_name, from_role, to_role, reason } = body as {
      lead_id: string | number
      from_name: string
      to_name: string
      from_role?: string
      to_role?: string
      reason?: string
    }

    // Validate
    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })
    }
    if (!from_name || !to_name) {
      return NextResponse.json({ error: 'from_name and to_name are required' }, { status: 400 })
    }

    const { data, error } = await client
      .from('transfers')
      .insert({
        lead_id: Number(lead_id),
        from_name,
        to_name,
        from_role: from_role || 'tele',
        to_role: to_role || 'sales',
        reason: reason || null,
        transferred_by: session.uname,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[api/transfers] POST error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also create a notification for the sales rep
    try {
      await client.from('notifications').insert({
        target_user: to_name,
        target_role: to_role || 'sales',
        type: 'transfer',
        message: `تحويل جديد من ${from_name}: عميل #${lead_id}`,
        lead_id: Number(lead_id),
      })
    } catch (notifErr) {
      console.error('[api/transfers] notification insert failed:', notifErr)
      // non-fatal
    }

    return NextResponse.json({ data: transferFromDb(data as TransferRow) }, { status: 201 })
  } catch (err) {
    console.error('[api/transfers] POST unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
