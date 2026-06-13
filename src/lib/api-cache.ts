/**
 * Simple in-memory cache for API responses.
 * Reduces Supabase egress by avoiding redundant queries.
 *
 * - Stats cache: 60s TTL (dashboard data doesn't need real-time accuracy)
 * - Leads cache: 30s TTL (leads change more frequently)
 *
 * Both caches are invalidated on any write operation (POST/PATCH/DELETE to leads).
 * In a multi-instance deployment, each instance has its own cache — stale data
 * is acceptable for the short TTL windows.
 */

// ===== Stats cache =====

let statsCache: { data: Record<string, unknown>; timestamp: number } | null = null
const STATS_CACHE_TTL = 60_000 // 60 seconds

export function isStatsCacheValid(): boolean {
  return statsCache !== null && Date.now() - statsCache.timestamp < STATS_CACHE_TTL
}

export function getStatsCache(): Record<string, unknown> | null {
  if (!statsCache) return null
  return statsCache.data
}

export function setStatsCache(data: Record<string, unknown>): void {
  statsCache = { data, timestamp: Date.now() }
}

// ===== Leads cache =====

let leadsCache: { data: unknown; timestamp: number; key: string } | null = null
const LEADS_CACHE_TTL = 30_000 // 30 seconds

export function isLeadsCacheValid(key: string): boolean {
  return leadsCache !== null && leadsCache.key === key && Date.now() - leadsCache.timestamp < LEADS_CACHE_TTL
}

export function getLeadsCache(key: string): unknown | null {
  if (!leadsCache || leadsCache.key !== key) return null
  return leadsCache.data
}

export function setLeadsCache(key: string, data: unknown): void {
  leadsCache = { data, timestamp: Date.now(), key }
}

// ===== Cache invalidation =====

/**
 * Invalidate ALL caches. Call this after any write operation
 * that modifies leads data (create, update, delete, archive, etc.).
 */
export function invalidateAllCaches(): void {
  statsCache = null
  leadsCache = null
}
