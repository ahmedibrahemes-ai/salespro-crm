/**
 * Auth Guard for API Routes
 *
 * Verifies the session token from the Authorization header and enforces
 * role-based access control. Also checks that the user is still active
 * in the database (with a 30-second cache) to prevent revoked users
 * from using valid tokens.
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
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// ===== Active-user cache (audit issue #3 — session revocation gap) =====
// Without this, a disabled/deleted user's HMAC token remains valid for up to
// 7 days (the token TTL). This cache checks is_active in the DB, with a
// 30-second TTL so most requests don't incur a DB round-trip. When an admin
// disables a user via toggle-user, clearActiveUserCache() is called to
// invalidate immediately.

interface ActiveCacheEntry {
  isActive: boolean
  checkedAt: number
}

const activeCache = new Map<string, ActiveCacheEntry>()
const ACTIVE_CACHE_TTL = 30_000 // 30 seconds
const ACTIVE_CACHE_MAX = 100   // Max entries — prevents unbounded growth

/**
 * Check whether a user is still active in the database.
 * Uses an in-memory cache (30s TTL) to avoid a DB query on every request.
 * Fails open (returns true) if the DB is unavailable or errors — this
 * prevents a DB outage from locking all users out.
 */
async function isUserActive(uid: string | number): Promise<boolean> {
  const key = String(uid)
  const cached = activeCache.get(key)
  if (cached && Date.now() - cached.checkedAt < ACTIVE_CACHE_TTL) {
    return cached.isActive
  }

  const client = getSupabaseAdmin()
  if (!client) return true // Demo mode — no DB, fail open

  try {
    const { data, error } = await client
      .from('app_users')
      .select('is_active')
      .eq('id', uid)
      .maybeSingle()

    if (error) {
      console.warn('[auth-guard] is_active check failed, failing open:', error.message)
      return true
    }

    const isActive = !!data?.is_active
    // Evict oldest entry if at capacity (Map preserves insertion order)
    if (activeCache.size >= ACTIVE_CACHE_MAX) {
      const oldestKey = activeCache.keys().next().value
      if (oldestKey !== undefined) activeCache.delete(oldestKey)
    }
    activeCache.set(key, { isActive, checkedAt: Date.now() })
    return isActive
  } catch (err) {
    console.warn('[auth-guard] is_active check threw, failing open:', err)
    return true
  }
}

/**
 * Clear the active-user cache for a specific user (or all users if no uid).
 * Call this when an admin disables/deletes a user to invalidate their
 * session immediately (instead of waiting up to 30s for the cache to expire).
 */
export function clearActiveUserCache(uid?: string | number): void {
  if (uid !== undefined) {
    activeCache.delete(String(uid))
  } else {
    activeCache.clear()
  }
}

/**
 * Extract and verify the session from a request.
 * Returns null if the request is unauthenticated, the token is invalid/expired,
 * or the user has been disabled/deleted since the token was issued.
 */
export async function requireAuth(request: NextRequest): Promise<SessionPayload | null> {
  const token = extractTokenFromRequest(request)
  const session = await verifySessionToken(token)
  if (!session) return null

  // Check that the user is still active in the DB (audit issue #3)
  if (!(await isUserActive(session.uid))) return null

  return session
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
