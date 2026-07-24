import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'

/**
 * One-time cleanup endpoint: archive leads whose assigned member (tele_name
 * or sales_name) no longer exists OR is inactive in team_members.
 *
 * Bug fix: previously this endpoint NULLIFIED tele_name/sales_name on orphaned
 * leads, causing them to disappear from all sheets and become "unassigned".
 * Now: it ARCHIVES them (is_archived=true) so they're preserved in the admin
 * archive panel with ownership intact for reassignment.
 *
 * Admin-only. Idempotent. Safe to re-run.
 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin(request)
  if (!session) {
    return session === null ? forbiddenResponse('هذه العملية تتطلب صلاحيات مدير') : unauthorizedResponse()
  }

  try {
    // Require the service-role client — anon client cannot write (RLS blocks it).
    // Previously fell back to anon and silently did nothing (audit §3 row 6).
    const client = getSupabaseAdmin()
    if (!client) {
      return NextResponse.json(
        { error: 'Service role key not configured — this operation requires admin privileges (server-side).' },
        { status: 503 }
      )
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
    let archivedSales = 0
    let archivedTele = 0
    const archivedAt = new Date().toISOString()
    const archivedBy = 'cleanup:orphaned'

    if (activeNames.length > 0) {
      // sales_name is set but NOT in the active members list → archive
      const { count: orphanedSalesCount } = await client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .not('sales_name', 'is', null)
        .not('sales_name', 'in', `(${activeNames.map((n: string) => `'${n.replace(/'/g, "''")}'`).join(',')})`)
        .eq('is_archived', false)
      if (orphanedSalesCount && orphanedSalesCount > 0) {
        const { error: salesErr } = await client
          .from('leads')
          .update({ is_archived: true, archived_at: archivedAt, archived_by: archivedBy })
          .not('sales_name', 'is', null)
          .not('sales_name', 'in', `(${activeNames.map((n: string) => `'${n.replace(/'/g, "''")}'`).join(',')})`)
          .eq('is_archived', false)
        if (salesErr) {
          return NextResponse.json({ error: `Failed to archive sales_name leads: ${salesErr.message}` }, { status: 500 })
        }
        archivedSales = orphanedSalesCount
      }

      // tele_name is set but NOT in the active members list → archive
      const { count: orphanedTeleCount } = await client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .not('tele_name', 'is', null)
        .not('tele_name', 'in', `(${activeNames.map((n: string) => `'${n.replace(/'/g, "''")}'`).join(',')})`)
        .eq('is_archived', false)
      if (orphanedTeleCount && orphanedTeleCount > 0) {
        const { error: teleErr } = await client
          .from('leads')
          .update({ is_archived: true, archived_at: archivedAt, archived_by: archivedBy })
          .not('tele_name', 'is', null)
          .not('tele_name', 'in', `(${activeNames.map((n: string) => `'${n.replace(/'/g, "''")}'`).join(',')})`)
          .eq('is_archived', false)
        if (teleErr) {
          return NextResponse.json({ error: `Failed to archive tele_name leads: ${teleErr.message}` }, { status: 500 })
        }
        archivedTele = orphanedTeleCount
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup complete. Archived ${archivedSales} orphaned sales_name leads and ${archivedTele} orphaned tele_name leads.`,
      archivedSales,
      archivedTele,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
