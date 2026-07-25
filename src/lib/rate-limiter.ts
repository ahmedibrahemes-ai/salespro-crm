/**
 * Simple in-memory rate limiter for login brute-force protection (audit C3).
 *
 * Tracks failed login attempts per username + IP. After MAX_FAILED_ATTEMPTS
 * consecutive failures, the account is locked for LOCKOUT_DURATION_MS.
 * Successful login clears the counter.
 *
 * In-memory only — each Vercel serverless instance has its own counter.
 * For a small team CRM this is sufficient. For larger scale, use Upstash
 * Redis or a database-backed limiter.
 *
 * IMPORTANT: Server-side only.
 */

interface RateLimitEntry {
  failedAttempts: number
  lockedUntil: number | null
  lastAttemptAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const ENTRY_TTL_MS = 30 * 60 * 1000 // Clean up entries older than 30 min
const MAX_ENTRIES = 1000 // Prevent unbounded memory growth

/**
 * Get a rate-limit key from username + IP.
 * Combines both so a lockout applies to the specific user from the specific IP.
 * This prevents locking out a legitimate user if an attacker tries from a
 * different IP, while still blocking the attacker's IP.
 */
export function getRateLimitKey(username: string, ip: string): string {
  return `${username.toLowerCase()}:${ip}`
}

/**
 * Extract client IP from a request.
 * Checks X-Forwarded-For (Vercel/proxy), X-Real-IP, then falls back to 'unknown'.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

/**
 * Check if a login attempt is allowed (not locked out).
 * Returns { allowed, retryAfterMs }.
 */
export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const entry = rateLimitMap.get(key)
  if (!entry || !entry.lockedUntil) {
    return { allowed: true, retryAfterMs: 0 }
  }

  const now = Date.now()
  if (now < entry.lockedUntil) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now }
  }

  // Lockout expired — reset
  entry.lockedUntil = null
  entry.failedAttempts = 0
  return { allowed: true, retryAfterMs: 0 }
}

/**
 * Record a failed login attempt. Locks out after MAX_FAILED_ATTEMPTS.
 */
export function recordFailedAttempt(key: string): void {
  // Evict oldest entry if at capacity (Map preserves insertion order)
  if (rateLimitMap.size >= MAX_ENTRIES) {
    const oldestKey = rateLimitMap.keys().next().value
    if (oldestKey !== undefined) rateLimitMap.delete(oldestKey)
  }

  const now = Date.now()
  const entry = rateLimitMap.get(key) || { failedAttempts: 0, lockedUntil: null, lastAttemptAt: now }

  // Clean up stale entries periodically
  if (now - entry.lastAttemptAt > ENTRY_TTL_MS) {
    entry.failedAttempts = 0
    entry.lockedUntil = null
  }

  entry.failedAttempts++
  entry.lastAttemptAt = now

  if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS
  }

  rateLimitMap.set(key, entry)
}

/**
 * Record a successful login. Clears the failed-attempt counter.
 */
export function recordSuccessfulLogin(key: string): void {
  rateLimitMap.delete(key)
}
