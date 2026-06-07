'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react'
import { useCrmStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

/**
 * A small floating badge that shows the real-time connection status.
 * - Connected (green): Real-time subscription is working
 * - Disconnected (amber): Falling back to polling (Realtime may not be enabled)
 * - Error (red): Connection error
 * - Connecting (blue): Initial connection in progress
 */
export function RealtimeStatusBadge() {
  const { realtimeStatus, lastSyncAt } = useCrmStore()
  const [expanded, setExpanded] = useState(false)
  const [justSynced, setJustSynced] = useState(false)
  const [checkingRealtime, setCheckingRealtime] = useState(false)
  const [realtimeCheckResult, setRealtimeCheckResult] = useState<{enabled: boolean; tables: string[]} | null>(null)

  // Flash effect when data syncs
  useEffect(() => {
    if (lastSyncAt) {
      setJustSynced(true)
      const timer = setTimeout(() => setJustSynced(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [lastSyncAt])

  // Check realtime publication status via API
  const checkRealtimeStatus = useCallback(async () => {
    setCheckingRealtime(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-realtime' }),
      })
      const data = await res.json()
      if (data.tables) {
        setRealtimeCheckResult({ enabled: true, tables: data.tables })
      } else {
        setRealtimeCheckResult({ enabled: false, tables: [] })
      }
    } catch {
      setRealtimeCheckResult({ enabled: false, tables: [] })
    } finally {
      setCheckingRealtime(false)
    }
  }, [])

  const statusConfig = {
    connected: {
      icon: <Wifi className="w-3.5 h-3.5" />,
      color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
      pulseColor: 'bg-emerald-500',
      label: 'متصل مباشر',
      description: 'التحديثات بتظهر فوراً',
    },
    disconnected: {
      icon: <RefreshCw className="w-3.5 h-3.5" />,
      color: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
      pulseColor: 'bg-amber-500',
      label: 'تحديث دوري',
      description: 'البيانات بتتحدث كل 15 ثانية',
    },
    error: {
      icon: <WifiOff className="w-3.5 h-3.5" />,
      color: 'bg-red-500/20 border-red-500/40 text-red-400',
      pulseColor: 'bg-red-500',
      label: 'خطأ في الاتصال',
      description: 'حاول تحديث الصفحة',
    },
    connecting: {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      color: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
      pulseColor: 'bg-blue-500',
      label: 'جاري الاتصال...',
      description: '',
    },
  }

  const config = statusConfig[realtimeStatus]

  const formatLastSync = (ts: number | null) => {
    if (!ts) return '—'
    const secs = Math.floor((Date.now() - ts) / 1000)
    if (secs < 5) return 'دلوقتي'
    if (secs < 60) return `من ${secs} ثانية`
    const mins = Math.floor(secs / 60)
    return `من ${mins} دقيقة`
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-[999]"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute bottom-full mb-2 left-0 min-w-[200px] p-3 rounded-lg border ${config.color} backdrop-blur-sm shadow-lg`}
            dir="rtl"
          >
            <div className="flex items-center gap-2 mb-1">
              {config.icon}
              <span className="text-xs font-semibold">{config.label}</span>
            </div>
            {config.description && (
              <p className="text-[10px] text-muted-foreground">{config.description}</p>
            )}
            <div className="text-[10px] text-muted-foreground mt-1">
              آخر تحديث: {formatLastSync(lastSyncAt)}
            </div>
            {realtimeStatus === 'disconnected' && (
              <div className="mt-2 border-t border-amber-500/20 pt-2 space-y-1">
                {realtimeCheckResult?.enabled ? (
                  <p className="text-[10px] text-emerald-400">
                    ✅ Realtime مفعّل على: {realtimeCheckResult.tables.join(', ')}
                    <br />التحديثات بتظهر كل 15 ثانية بشكل تلقائي
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] text-amber-400">
                      💡 لتفعيل التحديث الفوري:
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      1. افتح Supabase Dashboard → Database → Replication
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      2. فعّل Realtime لجداول leads و lead_notes
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-1">
                      أو شغّل الكود ده في SQL Editor:
                    </p>
                    <code className="text-[9px] bg-muted/30 px-1.5 py-0.5 rounded block font-mono text-amber-300" dir="ltr">
                      ALTER PUBLICATION supabase_realtime ADD TABLE leads;
                    </code>
                    <p className="text-[8px] text-muted-foreground mt-1">
                      ⚠️ لو ظهرلك خطأ "already member" يبقى Realtime مفعّل بالفعل ✅
                    </p>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] w-full mt-1 text-amber-400 hover:text-amber-300"
                  onClick={checkRealtimeStatus}
                  disabled={checkingRealtime}
                >
                  {checkingRealtime ? 'جاري الفحص...' : '🔍 فحص حالة Realtime'}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-medium transition-all duration-300 ${config.color} ${
          justSynced ? 'ring-2 ring-venom/30' : ''
        }`}
        whileTap={{ scale: 0.95 }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Pulse dot */}
        <span className="relative flex h-2 w-2">
          {realtimeStatus === 'connected' && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.pulseColor} opacity-40`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.pulseColor}`} />
        </span>
        {config.icon}
        <span className="hidden sm:inline">{config.label}</span>
      </motion.button>
    </div>
  )
}
