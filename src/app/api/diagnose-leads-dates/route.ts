import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'

/**
 * Diagnostic endpoint: checks the created_at values on leads for a specific
 * sales user. The user reported that the date filter in the sales sheet shows
 * nothing for any preset (today/yesterday/this month) but "all" works — which
 * suggests leads have broken/missing created_at values (createdAt = 0 on the
 * client, meaning created_at was null in the DB).
 *
 * GET /api/diagnose-leads-dates?user=Mahitab
 *   → returns: total, nullCount, minCreatedAt, maxCreatedAt, sample leads
 *
 * POST /api/diagnose-leads-dates?user=Mahitab
 *   → fixes: sets created_at = now() for leads where created_at IS NULL
 *
 * Admin-only.
 */
export async function GET(request: NextRequest) {
  const session = await requireAdmin(request)
  if (!session) {
    return session === null ? forbiddenResponse('هذه العملية تتطلب صلاحيات مدير') : unauthorizedResponse()
  }

  const { searchParams } = new URL(request.url)
  const user = searchParams.get('user')

  try {
    // Require service-role client — anon client would give misleading results
    // (RLS may block rows). Previously fell back to anon silently (audit §3 row 6).
    const client = getSupabaseAdmin()
    if (!client) {
      return NextResponse.json(
        { error: 'Service role key not configured — this operation requires admin privileges (server-side).' },
        { status: 503 }
      )
    }

    // Build query — filter by sales_name if user param is provided
    let query = client.from('leads').select('id, customer_name, sales_name, tele_name, created_at, assigned_at')
    if (user) {
      query = query.eq('sales_name', user)
    }
    const { data: leads, error } = await query.limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const allLeads = leads || []
    const nullCount = allLeads.filter((l: { created_at: string | null }) => !l.created_at).length
    const validLeads = allLeads.filter((l: { created_at: string | null }) => l.created_at)
    const timestamps = validLeads.map((l: { created_at: string }) => new Date(l.created_at).getTime())

    return NextResponse.json({
      success: true,
      user: user || '(all)',
      total: allLeads.length,
      nullCreatedCount: nullCount,
      validCreatedCount: validLeads.length,
      minCreatedAt: timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null,
      maxCreatedAt: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null,
      sample: allLeads.slice(0, 5).map((l: { id: number; customer_name: string | null; sales_name: string | null; tele_name: string | null; created_at: string | null; assigned_at: string | null }) => ({
        id: l.id,
        customer: l.customer_name,
        sales: l.sales_name,
        tele: l.tele_name,
        created_at: l.created_at,
        assigned_at: l.assigned_at,
      })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * Fix: set created_at = now() for leads where created_at IS NULL.
 * This restores the date filter functionality.
 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin(request)
  if (!session) {
    return session === null ? forbiddenResponse('هذه العملية تتطلب صلاحيات مدير') : unauthorizedResponse()
  }

  const { searchParams } = new URL(request.url)
  const user = searchParams.get('user')

  try {
    // Require service-role client — anon client would give misleading results
    // (RLS may block rows). Previously fell back to anon silently (audit §3 row 6).
    const client = getSupabaseAdmin()
    if (!client) {
      return NextResponse.json(
        { error: 'Service role key not configured — this operation requires admin privileges (server-side).' },
        { status: 503 }
      )
    }

    // Find leads with null created_at
    let query = client
      .from('leads')
      .select('id, sales_name')
      .is('created_at', null)
    if (user) {
      query = query.eq('sales_name', user)
    }
    const { data: nullLeads, error: findErr } = await query

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 })
    }

    const count = (nullLeads || []).length
    if (count === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads with null created_at found. The date filter should work — the issue is elsewhere.',
        fixedCount: 0,
      })
    }

    // Fix: set created_at = now() for these leads
    let updateQuery = client
      .from('leads')
      .update({ created_at: new Date().toISOString() })
      .is('created_at', null)
    if (user) {
      updateQuery = updateQuery.eq('sales_name', user)
    }
    const { error: updateErr } = await updateQuery

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${count} leads with null created_at — set to now(). The date filter should now work.`,
      fixedCount: count,
      user: user || '(all)',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
