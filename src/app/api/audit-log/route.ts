import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'

/**
 * /api/audit-log
 *
 * GET  — list audit log entries (admin only).
 *        Query: ?action={name}&actor={username}&limit=50&page=1
 *
 * POST — create an audit log entry (admin only via HTTP).
 *        Other server routes should use the logAuditEvent helper instead:
 *        import { logAuditEvent } from '@/app/api/audit-log/helpers'
 */

interface AuditLogRow {
  id: number
  actor_id: number | null
  actor_username: string | null
  actor_role: string | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

function logFromDb(row: AuditLogRow) {
  return {
    id: String(row.id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorUsername: row.actor_username || '',
    actorRole: row.actor_role || '',
    action: row.action,
    targetType: row.target_type || '',
    targetId: row.target_id || '',
    metadata: row.metadata || {},
    ipAddress: row.ip_address || '',
    createdAt: new Date(row.created_at).getTime(),
  }
}

// ===== GET (admin only) =====
export async function GET(request: NextRequest) {
  const session = await requireAdmin(request)
  if (!session) {
    return session === null ? forbiddenResponse() : unauthorizedResponse()
  }

  try {
    const client = getSupabaseAdmin()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const actor = searchParams.get('actor')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)))

    let query = client
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (action) query = query.eq('action', action)
    if (actor) query = query.eq('actor_username', actor)

    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, count, error } = await query
    if (error) {
      console.error('[api/audit-log] GET error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: (data || []).map(logFromDb),
      total: count ?? 0,
      page,
      limit,
      hasMore: from + (data?.length || 0) < (count ?? 0),
    })
  } catch (err) {
    console.error('[api/audit-log] GET unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== POST (server-side only — not exposed to clients) =====
export async function POST(request: NextRequest) {
  // This endpoint is intended to be called server-to-server. We still require
  // an admin session to prevent abuse, but typically other routes will use
  // the logAuditEvent helper directly (no HTTP roundtrip).
  const session = await requireAdmin(request)
  if (!session) {
    return session === null ? forbiddenResponse() : unauthorizedResponse()
  }

  try {
    const client = getSupabaseAdmin()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { action, target_type, target_id, metadata } = body as {
      action: string
      target_type?: string
      target_id?: string
      metadata?: Record<string, unknown>
    }

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    // Extract IP from request headers
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : null

    const { data, error } = await client
      .from('audit_log')
      .insert({
        actor_id: session.uid,
        actor_username: session.uname,
        actor_role: session.role,
        action,
        target_type: target_type || null,
        target_id: target_id ? String(target_id) : null,
        metadata: metadata || null,
        ip_address: ip,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[api/audit-log] POST error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: logFromDb(data as AuditLogRow) }, { status: 201 })
  } catch (err) {
    console.error('[api/audit-log] POST unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
