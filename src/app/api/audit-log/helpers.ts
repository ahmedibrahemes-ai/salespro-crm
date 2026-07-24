/**
 * Audit Log Helper
 *
 * Server-side helper to log sensitive actions to the audit_log table.
 * Safe to call — never throws (errors are logged only).
 *
 * Usage:
 *   import { logAuditEvent } from '@/app/api/audit-log/helpers'
 *   await logAuditEvent(session, 'delete-user', 'app_user', userId, { username }, request)
 */

import type { SessionPayload } from '@/lib/session'
import type { NextRequest } from 'next/server'

/**
 * Extract client IP from a request for audit logging (audit L4).
 */
function extractIp(request?: NextRequest | Request): string | null {
  if (!request) return null
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return null
}

export async function logAuditEvent(
  session: SessionPayload | null,
  action: string,
  targetType?: string,
  targetId?: string | number,
  metadata?: Record<string, unknown>,
  request?: NextRequest | Request
): Promise<void> {
  if (!session) return

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
    const client = getSupabaseAdmin()
    if (!client) return

    // Extract IP from request if provided (audit L4 — IP logging on sensitive ops)
    const ipAddress = extractIp(request)

    const { error } = await client.from('audit_log').insert({
      actor_id: session.uid,
      actor_username: session.uname,
      actor_role: session.role,
      action,
      target_type: targetType || null,
      target_id: targetId ? String(targetId) : null,
      metadata: metadata || null,
      ip_address: ipAddress,
    })

    if (error) {
      console.error('[audit-log] Failed to log event:', error.message)
    }
  } catch (err) {
    // Never throw — audit logging is best-effort
    console.error('[audit-log] Unexpected error:', err)
  }
}
