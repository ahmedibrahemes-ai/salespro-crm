import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isAdminAvailable, createAuthenticatedClient, createAnonClient } from '@/lib/supabase-admin'
import { requireAuth, requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'
import { invalidateAllCaches } from '@/lib/api-cache'

/**
 * GET /api/team
 *
 * Fetch team members from Supabase `team_members` table where `is_active = true`,
 * grouped by role (tele/sales/admin).
 *
 * POST /api/team
 *
 * Write operations: add, remove, rename team members.
 * Uses service role key (bypasses RLS) or authenticated client fallback.
 *
 * NO Prisma/SQLite — Supabase ONLY.
 * NO hardcoded credentials — environment variables only.
 */

/**
 * Get the Supabase client for write operations.
 * Priority: service role key (bypasses RLS) > authenticated user token > error
 */
function getWriteClient(authToken?: string) {
  const admin = getSupabaseAdmin()
  if (admin) return { client: admin, mode: 'admin' as const }

  if (authToken) {
    return { client: createAuthenticatedClient(authToken), mode: 'authenticated' as const }
  }

  return null
}

// ===== GET handler =====
export async function GET(request: NextRequest) {
  // Require auth to read team data
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  try {
    const client = isAdminAvailable() ? getSupabaseAdmin()! : createAnonClient()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { data, error } = await client
      .from('team_members')
      .select('name, role')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('[api/team] GET error:', error.message)
      // Return empty team on error — UI shows a loading/empty state.
      // Do NOT return hardcoded production names (audit §2 row 9).
      return NextResponse.json({ tele: [], sales: [], admin: [] })
    }

    const team: { tele: string[]; sales: string[]; admin: string[] } = { tele: [], sales: [], admin: [] }

    if (data && data.length > 0) {
      for (const m of data as Array<{ name: string; role: string; is_active: boolean }>) {
        const role = m.role as 'tele' | 'sales' | 'admin'
        if (role in team) {
          team[role].push(m.name)
        }
      }
    }

    // If no active members found, return empty (not hardcoded names).
    // This typically means the DB was just initialized and needs seeding
    // via /api/seed (admin-only). UI handles empty team gracefully.
    if (team.tele.length === 0 && team.sales.length === 0 && team.admin.length === 0) {
      return NextResponse.json({ tele: [], sales: [], admin: [] })
    }

    return NextResponse.json(team)
  } catch (error) {
    console.error('[api/team] GET unexpected error:', error)
    // Return empty team on error — UI handles it (audit §2 row 9).
    return NextResponse.json({ tele: [], sales: [], admin: [] })
  }
}

// ===== POST handler - Write operations =====
export async function POST(request: NextRequest) {
  // Require admin for team write operations
  const session = await requireAdmin(request)
  if (!session) {
    return session === null ? forbiddenResponse('هذه العملية تتطلب صلاحيات مدير') : unauthorizedResponse()
  }

  const writeClient = getWriteClient(undefined)
  if (!writeClient) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
      { status: 500 }
    )
  }

  const { client, mode } = writeClient

  try {
    const body = await request.json()
    const { operation, data } = body

    switch (operation) {
      case 'add': {
        const { name, role } = data as { name: string; role: string }
        if (!name || !role) {
          return NextResponse.json({ error: 'Name and role are required' }, { status: 400 })
        }

        // Check if inactive member exists — reactivate instead of creating duplicate
        const { data: existing } = await client
          .from('team_members')
          .select('id')
          .eq('name', name)
          .eq('is_active', false)
          .maybeSingle()

        if (existing) {
          // Reactivation: clear sales_name AND tele_name on old leads so the new
          // user (same displayName) starts FRESH. Without this, the reactivated
          // user inherits the previous holder's leads.
          await client.from('leads').update({ tele_name: null }).eq('tele_name', name)
          await client.from('leads').update({ sales_name: null }).eq('sales_name', name)
          const { data: member, error } = await client
            .from('team_members')
            .update({ is_active: true, role })
            .eq('id', existing.id)
            .select()
            .single()
          if (error) {
            console.error('[api/team] Add (reactivate) error:', error, '(mode:', mode, ')')
            return NextResponse.json({ error: error.message }, { status: 400 })
          }
          invalidateAllCaches()
          return NextResponse.json({ data: member })
        }

        const { data: member, error } = await client
          .from('team_members')
          .insert({ name, role, is_active: true })
          .select()
          .single()
        if (error) {
          console.error('[api/team] Add error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        invalidateAllCaches()
        return NextResponse.json({ data: member })
      }

      case 'remove': {
        const name = data as string
        if (!name) {
          return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        }
        // Bug fix: this used to NULL tele_name/sales_name on every matching
        // lead (including already-archived ones), permanently destroying
        // ownership — the exact data-loss bug that /api/leads's
        // removeTeamMember case (the one actually used by the UI) was
        // rewritten to avoid. This route was never updated to match, even
        // though it implements the same "remove a team member" operation.
        // Now: archive the leads instead (is_archived=true), preserving
        // ownership for historical reference in the admin archive panel,
        // scoped to non-archived rows only — identical behavior to
        // /api/leads's removeTeamMember (route.ts case 'removeTeamMember').
        const archivedAt = new Date().toISOString()
        const archivedBy = `removed:${name}`
        const { error: archiveTeleErr } = await client
          .from('leads')
          .update({ is_archived: true, archived_at: archivedAt, archived_by: archivedBy })
          .eq('tele_name', name)
          .eq('is_archived', false)
        if (archiveTeleErr) {
          console.error('[api/team] Remove — archive tele leads error:', archiveTeleErr, '(mode:', mode, ')')
        }
        const { error: archiveSalesErr } = await client
          .from('leads')
          .update({ is_archived: true, archived_at: archivedAt, archived_by: archivedBy })
          .eq('sales_name', name)
          .eq('is_archived', false)
        if (archiveSalesErr) {
          console.error('[api/team] Remove — archive sales leads error:', archiveSalesErr, '(mode:', mode, ')')
        }
        const { error } = await client
          .from('team_members')
          .update({ is_active: false })
          .eq('name', name)
        if (error) {
          console.error('[api/team] Remove error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        invalidateAllCaches()
        return NextResponse.json({ success: true })
      }

      case 'rename': {
        const { oldName, newName } = data as { oldName: string; newName: string }
        if (!oldName || !newName) {
          return NextResponse.json({ error: 'oldName and newName are required' }, { status: 400 })
        }

        // Count affected leads before renaming
        const { count: teleCount } = await client
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('tele_name', oldName)
        const { count: salesCount } = await client
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('sales_name', oldName)
        console.log(`[api/team] Renaming: "${oldName}" -> "${newName}" (affects ${teleCount || 0} tele leads, ${salesCount || 0} sales leads)`)

        // Update team_members table
        const { error: e1 } = await client
          .from('team_members')
          .update({ name: newName })
          .eq('name', oldName)
        if (e1) {
          console.error('[api/team] Rename error:', e1, '(mode:', mode, ')')
          return NextResponse.json({ error: e1.message }, { status: 400 })
        }

        // Also update associated leads
        await client.from('leads').update({ tele_name: newName }).eq('tele_name', oldName)
        await client.from('leads').update({ sales_name: newName }).eq('sales_name', oldName)

        invalidateAllCaches()
        return NextResponse.json({ success: true, teleCount: teleCount || 0, salesCount: salesCount || 0 })
      }

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 })
    }
  } catch (err) {
    console.error('[api/team] Unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
