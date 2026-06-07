'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Phone,
  Users,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Download,
  Filter,
  TrendingUp,
} from 'lucide-react'
import {
  useCrmStore,
  CONTACT_RESULTS,
  SALES_STATUSES,
  ATTENDANCE_STATUSES,
  formatDate,
  formatRelativeTime,
  getDateRange,
  getAllLeadsForAnalytics,
} from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

// ===== Date presets =====
const DATE_PRESETS = [
  { key: 'today', label: 'اليوم' },
  { key: 'yesterday', label: 'أمس' },
  { key: 'week', label: 'أسبوع' },
  { key: 'month', label: 'شهر' },
  { key: 'all', label: 'الكل' },
  { key: 'custom', label: 'تاريخ محدد' },
]

// ===== Main Component =====
export function DailyReport() {
  const { currentUser, currentRole, leads, archivedLeads } = useCrmStore()
  const [datePreset, setDatePreset] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [resultFilter, setResultFilter] = useState<string>('all')

  // Get all leads
  const allLeads = useMemo(() => getAllLeadsForAnalytics(leads, archivedLeads), [leads, archivedLeads])

  // Filter leads by role
  const myLeads = useMemo(() => {
    if (!currentUser || !currentRole) return []
    if (currentRole === 'admin') return allLeads
    if (currentRole === 'tele') return allLeads.filter((l) => l.tele === currentUser)
    if (currentRole === 'sales') return allLeads.filter((l) => l.sales === currentUser)
    return []
  }, [allLeads, currentUser, currentRole])

  // Apply date range
  const { from, to } = useMemo(
    () => getDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  )

  const leadsInRange = useMemo(() => {
    return myLeads.filter((l) => l.createdAt >= from && l.createdAt < to)
  }, [myLeads, from, to])

  // Stats
  const stats = useMemo(() => {
    const leadsAdded = leadsInRange.length
    const calls = leadsInRange.filter((l) => l.contactResult && l.contactResult.trim() !== '')
    const transfers = leadsInRange.filter((l) => l.sales && l.sales.trim() !== '')
    const meetings = leadsInRange.filter((l) => l.meetingDate && l.meetingDate.trim() !== '')
    const attended = leadsInRange.filter((l) => l.attended === 'attended')

    // Call breakdown
    const callBreakdown: Record<string, number> = {}
    calls.forEach((l) => {
      const key = l.contactResult || 'unknown'
      callBreakdown[key] = (callBreakdown[key] || 0) + 1
    })

    return { leadsAdded, callsCount: calls.length, transfersCount: transfers.length, meetingsCount: meetings.length, attendedCount: attended.length, callBreakdown }
  }, [leadsInRange])

  // Filtered by result
  const displayLeads = useMemo(() => {
    if (resultFilter === 'all') return leadsInRange
    return leadsInRange.filter((l) => l.contactResult === resultFilter)
  }, [leadsInRange, resultFilter])

  // Export CSV
  const exportCSV = useCallback(() => {
    const headers = ['الاسم', 'الموبايل', 'المتجر', 'نتيجة التواصل', 'الحالة', 'الحضور', 'تاريخ الاجتماع', 'التلي', 'السيلز']
    const rows = displayLeads.map((l) => [
      l.customerName || '',
      l.phone || '',
      l.storeUrl || '',
      CONTACT_RESULTS.find((c) => c.key === l.contactResult)?.label || l.contactResult || '',
      SALES_STATUSES.find((s) => s.key === (currentRole === 'sales' ? l.salesStatus : l.status))?.label || l.status || '',
      ATTENDANCE_STATUSES.find((a) => a.key === l.attended)?.label || l.attended || '',
      l.meetingDate || '',
      l.tele || '',
      l.sales || '',
    ])

    const BOM = '\uFEFF'
    const csv = BOM + [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `تقرير-${datePreset}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير التقرير بنجاح')
  }, [displayLeads, datePreset, currentRole])

  if (!currentUser) return null

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold venom-text-glow text-venom">التقرير اليومي</h1>
          <p className="text-muted-foreground mt-1">ملخص الأنشطة والتواصل</p>
        </div>
        <Button
          onClick={exportCSV}
          variant="outline"
          className="border-venom/30 text-venom hover:bg-venom/10"
        >
          <Download className="w-4 h-4 ml-2" />
          تصدير CSV
        </Button>
      </motion.div>

      {/* Date Filter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >
        <Calendar className="w-4 h-4 text-venom" />
        {DATE_PRESETS.map((p) => (
          <Button
            key={p.key}
            variant={datePreset === p.key ? 'default' : 'outline'}
            size="sm"
            className={
              datePreset === p.key
                ? 'bg-venom/20 text-venom border-venom/30 hover:bg-venom/30'
                : 'border-border hover:border-venom/30 hover:text-venom'
            }
            onClick={() => setDatePreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36 h-8 text-xs bg-background border-border" />
            <span className="text-muted-foreground text-xs">إلى</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36 h-8 text-xs bg-background border-border" />
          </div>
        )}
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'عملاء أضيفوا', value: stats.leadsAdded, icon: Users, color: '#00FF88' },
          { label: 'مكالمات تمت', value: stats.callsCount, icon: Phone, color: '#8B5CF6' },
          { label: 'تحويلات', value: stats.transfersCount, icon: ArrowRightLeft, color: '#F59E0B' },
          { label: 'اجتماعات', value: stats.meetingsCount, icon: Calendar, color: '#06B6D4' },
          { label: 'حضور', value: stats.attendedCount, icon: CheckCircle2, color: '#10B981' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            whileHover={{ scale: 1.03 }}
          >
            <Card className="bg-card border border-border hover:border-venom/30 transition-all duration-300 relative overflow-hidden group">
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at center, ${stat.color}10 0%, transparent 70%)` }}
              />
              <CardContent className="p-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: `${stat.color}15` }}
                  >
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-xl font-bold tabular-nums" style={{ color: stat.color }}>
                      {stat.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Call Result Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card className="bg-card border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-venom" />
              تفصيل المكالمات حسب النتيجة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Result filter pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant={resultFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className={resultFilter === 'all' ? 'bg-venom/20 text-venom border-venom/30 h-7 text-xs' : 'border-border h-7 text-xs hover:border-venom/30'}
                onClick={() => setResultFilter('all')}
              >
                الكل ({stats.callsCount})
              </Button>
              {CONTACT_RESULTS.filter((c) => c.key !== '').map((cr) => {
                const count = stats.callBreakdown[cr.key] || 0
                if (count === 0) return null
                return (
                  <Button
                    key={cr.key}
                    variant={resultFilter === cr.key ? 'default' : 'outline'}
                    size="sm"
                    className={resultFilter === cr.key ? 'bg-venom/20 text-venom border-venom/30 h-7 text-xs' : 'border-border h-7 text-xs hover:border-venom/30'}
                    onClick={() => setResultFilter(cr.key)}
                  >
                    {cr.label} ({count})
                  </Button>
                )
              })}
            </div>

            {/* Count boxes */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {CONTACT_RESULTS.filter((c) => c.key !== '').map((cr) => {
                const count = stats.callBreakdown[cr.key] || 0
                return (
                  <motion.div
                    key={cr.key}
                    whileHover={{ scale: 1.05 }}
                    className={`text-center p-3 rounded-lg border transition-all cursor-pointer ${
                      resultFilter === cr.key
                        ? 'border-venom/40 bg-venom/10'
                        : 'border-border hover:border-venom/20'
                    }`}
                    onClick={() => setResultFilter(resultFilter === cr.key ? 'all' : cr.key)}
                  >
                    <p className={`text-2xl font-bold ${count > 0 ? cr.color : 'text-muted-foreground/30'}`}>
                      {count}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">{cr.label}</p>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Activity Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="bg-card border border-border overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-venom-purple" />
              جدول الأنشطة
              <Badge variant="secondary" className="text-[10px] mr-2">{displayLeads.length} سجل</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[400px]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">#</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">العميل</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">الموبايل</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">نتيجة التواصل</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">الحالة</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          لا توجد أنشطة في هذه الفترة
                        </td>
                      </tr>
                    ) : (
                      displayLeads.slice(0, 100).map((lead, i) => (
                        <tr key={lead.id} className="border-b border-border/50 hover:bg-venom/5 transition-colors">
                          <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium truncate max-w-[120px]">{lead.customerName || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs" dir="ltr">{lead.phone || '—'}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {CONTACT_RESULTS.find((c) => c.key === lead.contactResult)?.label || '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {SALES_STATUSES.find((s) => s.key === lead.salesStatus)?.label || lead.status || '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">
                            {formatRelativeTime(lead.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
