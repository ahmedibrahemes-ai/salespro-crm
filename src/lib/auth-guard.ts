/**
 * Auth Guard for API Routes
 *
 * Verifies the session token from the Authorization header and enforces
 * role-based access control.
 *
 * Usage:
 *   import { requireAuth, requireAdmin } from '@/lib/auth-guard'
 *
 *   export async function POST(request: NextRequest) {
 *     const session = await requireAuth(request)
 *     if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *     // ... handler logic
 *   }
 *
 * IMPORTANT: Server-side only.
 */

import type { NextRequest } from 'next/server'
import { extractTokenFromRequest, verifySessionToken, type SessionPayload } from '@/lib/session'

/**
 * Extract and verify the session from a request.
 * Returns null if the request is unauthenticated or the token is invalid/expired.
 */
export async function requireAuth(request: NextRequest): Promise<SessionPayload | null> {
  const token = extractTokenFromRequest(request)
  return verifySessionToken(token)
}

/**
 * Require an authenticated admin session.
 * Returns null if not authenticated OR not an admin.
 */
export async function requireAdmin(request: NextRequest): Promise<SessionPayload | null> {
  const session = await requireAuth(request)
  if (!session) return null
  if (session.role !== 'admin') return null
  return session
}

/**
 * Require an authenticated session with one of the specified roles.
 * Returns null if not authenticated or the role doesn't match.
 */
export async function requireRole(
  request: NextRequest,
  roles: Array<'tele' | 'sales' | 'admin'>
): Promise<SessionPayload | null> {
  const session = await requireAuth(request)
  if (!session) return null
  if (!roles.includes(session.role)) return null
  return session
}

/**
 * Build a 401 Unauthorized JSON response.
 */
export function unauthorizedResponse(message = 'غير مصرح — يرجى تسجيل الدخول') {
  return Response.json({ error: message }, { status: 401 })
}

/**
 * Build a 403 Forbidden JSON response.
 */
export function forbiddenResponse(message = 'ليس لديك صلاحية للوصول إلى هذا المورد') {
  return Response.json({ error: message }, { status: 403 })
}
