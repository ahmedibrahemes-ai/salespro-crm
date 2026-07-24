import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'
import { requireAuth, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'
import { sanitizeForFilter } from '@/lib/crm-utils'

/**
 * /api/notifications
 *
 * GET  — list notifications for the current user (target_user matches session.uname
 *        OR target_role matches session.role OR target_user IS NULL for broadcasts).
 *        Query params: ?unread_only=true&limit=20
 *
 * POST — create a notification (server-to-server, e.g. from realtime events).
 *        Body: { target_user?, target_role?, type, message, lead_id? }
 *
 * PATCH — mark a notification as read. Body: { id } or { all: true } to mark all as read.
 */

interface NotificationRow {
  id: number
  target_user: string | null
  target_role: string | null
  type: string
  message: string
  lead_id: number | null
  read_at: string | null
  created_at: string
}

function notificationFromDb(row: NotificationRow) {
  return {
    id: String(row.id),
    targetUser: row.target_user,
    targetRole: row.target_role,
    type: row.type,
    message: row.message,
    leadId: row.lead_id ? String(row.lead_id) : null,
    read: !!row.read_at,
    readAt: row.read_at ? new Date(row.read_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  }
}

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
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    // Sanitize for safe use in .or() filters (audit issue #5)
    const safeUname = sanitizeForFilter(session.uname)
    const safeRole = sanitizeForFilter(session.role)

    // Build query: notifications targeted to this user OR their role OR broadcasts (NULL user)
    let query = client
      .from('notifications')
      .select('*')
      .or(`target_user.eq.${safeUname},target_user.is.null,target_role.eq.${safeRole}`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.is('read_at', null)
    }

    const { data, error } = await query
    if (error) {
      console.error('[api/notifications] GET error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also get unread count
    const { count: unreadCount, error: countErr } = await client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .or(`target_user.eq.${safeUname},target_user.is.null,target_role.eq.${safeRole}`)
      .is('read_at', null)

    return NextResponse.json({
      data: (data || []).map(notificationFromDb),
      unreadCount: countErr ? 0 : (unreadCount ?? 0),
    })
  } catch (err) {
    console.error('[api/notifications] GET unexpected error:', err)
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
    let { target_user, target_role, type, message, lead_id } = body as {
      target_user?: string
      target_role?: string
      type: string
      message: string
      lead_id?: string | number
    }

    // Validate
    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'type is required' }, { status: 400 })
    }
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }
    const allowedTypes = ['attendance', 'transfer', 'new-lead', 'note', 'system']
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: 'invalid type' }, { status: 400 })
    }

    // Security: non-admin users can only send notifications to THEMSELVES.
    // Prevents spam/impersonation — only admin can broadcast (target_user=null)
    // or send to other users.
    if (session.role !== 'admin') {
      target_user = session.uname
      target_role = undefined // don't allow role-based broadcasts
    }

    const { data, error } = await client
      .from('notifications')
      .insert({
        target_user: target_user || null,
        target_role: target_role || null,
        type,
        message: message.slice(0, 500), // cap length
        lead_id: lead_id ? Number(lead_id) : null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[api/notifications] POST error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: notificationFromDb(data as NotificationRow) }, { status: 201 })
  } catch (err) {
    console.error('[api/notifications] POST unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== PATCH (mark as read) =====
export async function PATCH(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  try {
    const client = getSupabaseAdmin()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { id, all } = body as { id?: string; all?: boolean }
    const now = new Date().toISOString()

    // Sanitize for safe use in .or() filters (audit issue #5)
    const safeUname = sanitizeForFilter(session.uname)
    const safeRole = sanitizeForFilter(session.role)

    if (all) {
      // Mark all unread notifications for this user as read
      const { error } = await client
        .from('notifications')
        .update({ read_at: now })
        .or(`target_user.eq.${safeUname},target_user.is.null,target_role.eq.${safeRole}`)
        .is('read_at', null)

      if (error) {
        console.error('[api/notifications] PATCH all error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, markedAll: true })
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required (or set all: true)' }, { status: 400 })
    }

    // Ownership check — verify the notification belongs to this user before
    // marking it as read. Prevents IDOR (marking other users' notifications).
    if (session.role !== 'admin') {
      const { data: notif } = await client
        .from('notifications')
        .select('target_user, target_role')
        .eq('id', id)
        .maybeSingle()
      if (!notif) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }
      const targetUser = notif.target_user as string | null
      const targetRole = notif.target_role as string | null
      // User can only mark notifications targeted to them (or broadcasts to their role)
      const isTargetedToUser = targetUser === session.uname
      const isBroadcastToRole = !targetUser && targetRole === session.role
      const isGlobalBroadcast = !targetUser && !targetRole
      if (!isTargetedToUser && !isBroadcastToRole && !isGlobalBroadcast) {
        return forbiddenResponse('لا تملك صلاحية تعديل هذا الإشعار')
      }
    }

    const { error } = await client
      .from('notifications')
      .update({ read_at: now })
      .eq('id', id)

    if (error) {
      console.error('[api/notifications] PATCH error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/notifications] PATCH unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
