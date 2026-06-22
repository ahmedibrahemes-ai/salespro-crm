import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isAdminAvailable, createAuthenticatedClient, createAnonClient } from '@/lib/supabase-admin'
import { requireAuth, requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'

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
        return NextResponse.json({ data: member })
      }

      case 'remove': {
        const name = data as string
        if (!name) {
          return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        }
        // Solution A: clear sales_name AND tele_name on orphaned leads so a
        // future reactivated user (same name) does NOT inherit them. removeTeamMember
        // is a soft-delete (is_active=false), so without this, leads keep their
        // sales_name/tele_name = <removed user> and reappear when an admin re-adds
        // a user with the same displayName. We null BOTH fields since the removed
        // member could be in either role.
        const { error: clearTeleErr } = await client
          .from('leads')
          .update({ tele_name: null })
          .eq('tele_name', name)
        if (clearTeleErr) {
          console.error('[api/team] Remove — clear tele_name error:', clearTeleErr, '(mode:', mode, ')')
        }
        const { error: clearSalesErr } = await client
          .from('leads')
          .update({ sales_name: null })
          .eq('sales_name', name)
        if (clearSalesErr) {
          console.error('[api/team] Remove — clear sales_name error:', clearSalesErr, '(mode:', mode, ')')
        }
        const { error } = await client
          .from('team_members')
          .update({ is_active: false })
          .eq('name', name)
        if (error) {
          console.error('[api/team] Remove error:', error, '(mode:', mode, ')')
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
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
