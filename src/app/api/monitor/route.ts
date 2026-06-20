import { NextRequest, NextResponse } from 'next/server'
import { getCacheMetrics } from '@/lib/api-cache'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'

/**
 * GET /api/monitor
 *
 * Returns cache performance metrics for monitoring egress optimization.
 * Only available to authenticated admin users.
 */
export async function GET(request: NextRequest) {
  const session = await requireAdmin(request)
  if (!session) {
    return session === null ? forbiddenResponse('هذه العملية تتطلب صلاحيات مدير') : unauthorizedResponse()
  }

  const metrics = getCacheMetrics()

  const totalHits = metrics.statsHits + metrics.leadsHits
  const totalMisses = metrics.statsMisses + metrics.leadsMisses
  const totalRequests = totalHits + totalMisses

  // Format uptime
  const hours = Math.floor(metrics.uptimeSeconds / 3600)
  const minutes = Math.floor((metrics.uptimeSeconds % 3600) / 60)
  const uptimeStr = `${hours}h ${minutes}m`

  return NextResponse.json({
    status: 'ok',
    uptime: uptimeStr,
    cache: {
      hitRate: metrics.hitRate,
      statsHits: metrics.statsHits,
      statsMisses: metrics.statsMisses,
      leadsHits: metrics.leadsHits,
      leadsMisses: metrics.leadsMisses,
      totalHits,
      totalMisses,
      totalRequests,
      cacheInvalidations: metrics.cacheInvalidations,
    },
    supabase: {
      totalQueries: metrics.supabaseQueries,
      queriesSavedByCache: totalHits, // each cache hit = 1+ Supabase queries saved
    },
    egress: {
      estimatedSavedMB: metrics.estimatedEgressSavedMB,
      note: 'Estimated savings based on avg response sizes. Actual Supabase egress can be verified in the Supabase Dashboard → Settings → Usage.',
    },
    realtime: {
      optimization: 'lead_notes subscription removed — saves ~50% realtime messages. DELETE kept for sync.',
      note: 'Realtime messages count is visible in Supabase Dashboard → Settings → Usage. Before: 221K+ messages/billing cycle. Expected after: <50K.',
    },
    recommendations: getRecommendations(metrics),
  })
}

function getRecommendations(metrics: ReturnType<typeof getCacheMetrics>): string[] {
  const recs: string[] = []
  const totalHits = metrics.statsHits + metrics.leadsHits
  const totalMisses = metrics.statsMisses + metrics.leadsMisses
  const total = totalHits + totalMisses
  const hitRate = total > 0 ? (totalHits / total) * 100 : 0

  if (hitRate >= 80) {
    recs.push('✅ Cache hit rate is excellent (>80%). Egress optimization is working well.')
  } else if (hitRate >= 50) {
    recs.push('⚠️ Cache hit rate is moderate (50-80%). Consider increasing TTL if data freshness allows.')
  } else if (total > 5) {
    recs.push('🔴 Cache hit rate is low (<50%). Check if cache invalidation is too frequent.')
  }

  if (metrics.cacheInvalidations > totalHits) {
    recs.push('💡 Cache invalidations exceed hits — write operations are frequent. Consider longer TTL.')
  }

  if (metrics.uptimeSeconds < 300) {
    recs.push('ℹ️ Server recently restarted. Metrics will be more meaningful after 5+ minutes of traffic.')
  }

  if (metrics.supabaseQueries === 0 && total > 0) {
    recs.push('✅ All requests served from cache — zero Supabase queries in this period!')
  }

  return recs
}
