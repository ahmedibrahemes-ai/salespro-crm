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

// ===== Metrics tracking =====

interface CacheMetrics {
  statsHits: number
  statsMisses: number
  leadsHits: number
  leadsMisses: number
  supabaseQueries: number  // total Supabase API calls made
  cacheInvalidations: number
  startTime: number  // when the server started
}

const metrics: CacheMetrics = {
  statsHits: 0,
  statsMisses: 0,
  leadsHits: 0,
  leadsMisses: 0,
  supabaseQueries: 0,
  cacheInvalidations: 0,
  startTime: Date.now(),
}

export function recordStatsHit() { metrics.statsHits++ }
export function recordStatsMiss() { metrics.statsMisses++ }
export function recordLeadsHit() { metrics.leadsHits++ }
export function recordLeadsMiss() { metrics.leadsMisses++ }
export function recordSupabaseQuery(count = 1) { metrics.supabaseQueries += count }
export function recordCacheInvalidation() { metrics.cacheInvalidations++ }

export function getCacheMetrics(): CacheMetrics & { uptimeSeconds: number; hitRate: string; estimatedEgressSavedMB: string } {
  const totalHits = metrics.statsHits + metrics.leadsHits
  const totalMisses = metrics.statsMisses + metrics.leadsMisses
  const total = totalHits + totalMisses
  const hitRate = total > 0 ? Math.round((totalHits / total) * 100) : 0

  // Estimate egress saved:
  // - Each stats cache hit saves ~500KB (full stats query payload)
  // - Each leads cache hit saves ~2MB (full leads download)
  // These are rough estimates; actual depends on data size
  const estimatedSavedBytes = (metrics.statsHits * 500 * 1024) + (metrics.leadsHits * 2 * 1024 * 1024)
  const estimatedSavedMB = (estimatedSavedBytes / (1024 * 1024)).toFixed(1)

  return {
    ...metrics,
    uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
    hitRate: `${hitRate}%`,
    estimatedEgressSavedMB: estimatedSavedMB,
  }
}

// ===== Stats cache =====

let statsCache: { data: Record<string, unknown>; timestamp: number } | null = null
const STATS_CACHE_TTL = 10_000 // 10 seconds (was 60s — Vercel multi-instance causes stale data)

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
const LEADS_CACHE_TTL = 2_000 // 2 seconds (was 30s — Vercel multi-instance causes stale data)

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
  recordCacheInvalidation()
}
