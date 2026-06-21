import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'

/**
 * One-time cleanup endpoint: fix leads where tele_name was wrongly set to a
 * sales user's name (the bulk-add.tsx bug from Task 21-research).
 *
 * The bug: bulk-add.tsx initialized `tele: currentUser || team.tele[0] || ''`
 * for every new row. For a sales user (e.g. Mahitab), this meant
 * `tele_name = 'Mahitab'` AND `sales_name = 'Mahitab'` on every bulk-created
 * lead. Those leads then:
 *   - vanished from the sales sheet (Task 16 filter excludes leads with tele set)
 *   - appeared in 'اجتماعات التلي' (my-meetings filter: sales===me && tele set)
 *
 * This endpoint finds leads where tele_name === sales_name AND sales_name is
 * NOT a tele team member (i.e. sales_name belongs to a sales user), and nulls
 * out tele_name. This restores the leads to the sales sheet where they belong.
 *
 * Admin-only. Idempotent. Safe to re-run.
 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin(request)
  if (!session) {
    return session === null ? forbiddenResponse('هذه العملية تتطلب صلاحيات مدير') : unauthorizedResponse()
  }

  try {
    const client = getSupabaseAdmin() || createAnonClient()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    // Get all ACTIVE tele member names (to identify which tele_name values are legit)
    const { data: activeTele, error: teleErr } = await client
      .from('team_members')
      .select('name')
      .eq('is_active', true)
      .eq('role', 'tele')
    if (teleErr) {
      return NextResponse.json({ error: teleErr.message }, { status: 500 })
    }
    const teleNames = (activeTele || []).map((m: { name: string }) => m.name.trim())

    // Get all ACTIVE sales member names
    const { data: activeSales, error: salesErr } = await client
      .from('team_members')
      .select('name')
      .eq('is_active', true)
      .eq('role', 'sales')
    if (salesErr) {
      return NextResponse.json({ error: salesErr.message }, { status: 500 })
    }
    const salesNames = (activeSales || []).map((m: { name: string }) => m.name.trim())

    if (salesNames.length === 0) {
      return NextResponse.json({ success: true, message: 'No active sales members — nothing to fix.', fixedCount: 0 })
    }

    // Find leads where:
    //   - tele_name === sales_name (the bug signature)
    //   - sales_name is an active sales member (NOT a tele member)
    //   - tele_name is set (not null)
    // These are the bulk-created leads that got tele_name = sales user's name wrongly.
    let fixedCount = 0
    const fixedPerUser: Record<string, number> = {}

    for (const salesName of salesNames) {
      // If this salesName is ALSO a tele member (unusual but possible), skip —
      // we can't tell if tele_name is legit or buggy in that case.
      if (teleNames.includes(salesName)) continue

      // Count leads with tele_name = sales_name = this sales user
      const { count } = await client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('tele_name', salesName)
        .eq('sales_name', salesName)

      if (count && count > 0) {
        // Null out tele_name — restores the lead to the sales sheet
        const { error: updateErr } = await client
          .from('leads')
          .update({ tele_name: null })
          .eq('tele_name', salesName)
          .eq('sales_name', salesName)
        if (updateErr) {
          console.error(`[fix-sales-leads-tele] Failed for ${salesName}:`, updateErr.message)
          continue
        }
        fixedCount += count
        fixedPerUser[salesName] = count
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup complete. Fixed ${fixedCount} leads (tele_name wrongly set to a sales user's name).`,
      fixedCount,
      fixedPerUser,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
