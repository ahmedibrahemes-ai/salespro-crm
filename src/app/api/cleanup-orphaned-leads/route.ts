import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'

/**
 * One-time cleanup endpoint: null out sales_name/tele_name on leads whose
 * assigned member no longer exists OR is inactive in team_members.
 *
 * This fixes the "Mahitab problem": a new sales user reactivated an old
 * (inactive) team_member row with the same displayName, and inherited
 * orphaned leads from the previous holder of that name.
 *
 * After running this once, the new Solution A (in removeTeamMember) will
 * keep things clean going forward — every removal clears sales_name/tele_name.
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

    // Get all ACTIVE team member names
    const { data: activeMembers, error: teamErr } = await client
      .from('team_members')
      .select('name')
      .eq('is_active', true)
    if (teamErr) {
      return NextResponse.json({ error: teamErr.message }, { status: 500 })
    }
    const activeNames = (activeMembers || []).map((m: { name: string }) => m.name.trim())

    // Find leads with sales_name pointing to a non-active (or non-existent) member
    let clearedSales = 0
    let clearedTele = 0

    if (activeNames.length > 0) {
      // sales_name is set but NOT in the active members list
      const { count: orphanedSalesCount } = await client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .not('sales_name', 'is', null)
        .not('sales_name', 'in', `(${activeNames.map((n: string) => `'${n.replace(/'/g, "''")}'`).join(',')})`)
      if (orphanedSalesCount && orphanedSalesCount > 0) {
        const { error: salesErr } = await client
          .from('leads')
          .update({ sales_name: null })
          .not('sales_name', 'is', null)
          .not('sales_name', 'in', `(${activeNames.map((n: string) => `'${n.replace(/'/g, "''")}'`).join(',')})`)
        if (salesErr) {
          return NextResponse.json({ error: `Failed to clear sales_name: ${salesErr.message}` }, { status: 500 })
        }
        clearedSales = orphanedSalesCount
      }

      // tele_name is set but NOT in the active members list
      const { count: orphanedTeleCount } = await client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .not('tele_name', 'is', null)
        .not('tele_name', 'in', `(${activeNames.map((n: string) => `'${n.replace(/'/g, "''")}'`).join(',')})`)
      if (orphanedTeleCount && orphanedTeleCount > 0) {
        const { error: teleErr } = await client
          .from('leads')
          .update({ tele_name: null })
          .not('tele_name', 'is', null)
          .not('tele_name', 'in', `(${activeNames.map((n: string) => `'${n.replace(/'/g, "''")}'`).join(',')})`)
        if (teleErr) {
          return NextResponse.json({ error: `Failed to clear tele_name: ${teleErr.message}` }, { status: 500 })
        }
        clearedTele = orphanedTeleCount
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup complete. Cleared ${clearedSales} orphaned sales_name assignments and ${clearedTele} orphaned tele_name assignments.`,
      clearedSales,
      clearedTele,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
