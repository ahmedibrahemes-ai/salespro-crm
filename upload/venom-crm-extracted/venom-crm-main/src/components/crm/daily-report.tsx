'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Calendar,
  Phone,
  ArrowRightLeft,
  Download,
  Search,
  FolderOpen,
  Eye,
  Info,
  PhoneCall,
} from 'lucide-react'
import {
  useCrmStore,
  CONTACT_RESULTS,
  formatDate,
  getDateRange,
  getAllLeadsForAnalytics,
} from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

// ===== Date presets =====
const DATE_PRESETS = [
  { key: 'today', label: '📅 اليوم' },
  { key: 'yesterday', label: '🕐 أمس' },
  { key: 'week', label: '📆 الأسبوع الحالي' },
  { key: 'month', label: '🗓️ الشهر الحالي' },
  { key: 'all', label: '🌐 الكل' },
  { key: 'custom', label: '🎯 تاريخ محدد' },
]

// ===== Activity types =====
interface Activity {
  kind: 'added' | 'call' | 'transfer' | 'meeting' | 'attendance'
  leadId: string
  lead: Lead
  ts: number
  label: string
  icon: string
  color: string
  callResult?: string
  attended?: boolean | null
}

// ===== Main Component =====
export function DailyReport() {
  const {
    currentUser,
    currentRole,
    leads,
    archivedLeads,
    getAccessibleTeleSheets,
    getAccessibleSalesSheets,
    addToast,
    searchQueries,
    setSearchQuery,
    dateRangeFilters,
    setDateRangeFilter,
    activeFilter,
    setActiveFilter,
  } = useCrmStore()

  const VIEW_KEY = 'daily-report'

  // Sheet selector state
  const [viewingSheet, setViewingSheet] = useState<string>(currentUser || '')

  // Get date range from store
  const dateFilter = dateRangeFilters[VIEW_KEY] || { preset: 'today' }
  const activityFilter = activeFilter[VIEW_KEY] || 'all'

  const isTele = currentRole === 'tele'

  // Accessible sheets
  const accessibleSheets = currentUser
    ? isTele
      ? getAccessibleTeleSheets(currentUser)
      : getAccessibleSalesSheets(currentUser)
    : []

  // Ensure viewingSheet is valid
  const validViewingSheet =
    accessibleSheets.map((s) => s.toLowerCase()).includes(viewingSheet.toLowerCase())
      ? viewingSheet
      : currentUser || ''

  const isViewingOwn = validViewingSheet.toLowerCase() === (currentUser || '').toLowerCase()

  // Get all leads (active + archived)
  const allLeads = useMemo(
    () => getAllLeadsForAnalytics(leads, archivedLeads),
    [leads, archivedLeads]
  )

  // Filter leads by selected sheet
  const myLeads = useMemo(() => {
    const sheetLower = validViewingSheet.toLowerCase()
    return allLeads.filter((l) => {
      if (isTele) return l.tele && l.tele.toLowerCase() === sheetLower
      return l.sales && l.sales.toLowerCase() === sheetLower
    })
  }, [allLeads, validViewingSheet, isTele])

  // Build activities from leads
  const activities = useMemo(() => {
    const result: Activity[] = []

    myLeads.forEach((l) => {
      // 1. Added
      if (l.createdAt) {
        result.push({
          kind: 'added',
          leadId: l.id,
          lead: l,
          ts: l.createdAt,
          label: isTele
            ? '📝 ضافيتي العميل في الشيت'
            : l.tele
              ? `📥 جاي من ${l.tele}`
              : '📝 ضفت العميل في الشيت',
          icon: '📝',
          color: '#5eb8a6',
        })
      }

      // 2. Call (contact result)
      if (l.contactResult && l.contactResult !== '') {
        const cr = CONTACT_RESULTS.find((c) => c.key === l.contactResult)
        let callTs = l.contactResultAt || null
        if (!callTs && l.notes && l.notes.length) {
          const callNotes = l.notes.filter(
            (n) =>
              n.cat === 'meeting' ||
              n.cat === 'customer' ||
              (n.text && /اتصل|كلم|رد|مردش|تواصل/.test(n.text))
          )
          if (callNotes.length) {
            callTs = Math.max(...callNotes.map((n) => n.at || 0))
          }
        }
        if (!callTs) callTs = l.createdAt || Date.now()

        result.push({
          kind: 'call',
          callResult: l.contactResult,
          leadId: l.id,
          lead: l,
          ts: callTs,
          label: cr ? cr.label : l.contactResult,
          icon: '📞',
          color: cr?.color === 'text-emerald-400' ? '#10B981'
            : cr?.color === 'text-amber-400' ? '#F59E0B'
            : cr?.color === 'text-venom' ? '#5eb8a6'
            : cr?.color === 'text-red-400' ? '#EF4444'
            : '#9CA3AF',
        })
      }

      // 3. Transfer
      if (l.assignedAt && l.sales) {
        result.push({
          kind: 'transfer',
          leadId: l.id,
          lead: l,
          ts: l.assignedAt,
          label: isTele ? `حولتيه لـ ${l.sales}` : `اتحول لك من ${l.tele || '—'}`,
          icon: '🔄',
          color: '#5eb8a6',
        })
      }

      // 4. Meeting
      if (l.meetingDate && l.sales) {
        const meetTs = new Date(
          l.meetingDate + 'T' + (l.meetingTime || '12:00') + ':00'
        ).getTime()
        result.push({
          kind: 'meeting',
          leadId: l.id,
          lead: l,
          ts: meetTs,
          label:
            l.attended === 'attended'
              ? '✅ حضر الاجتماع'
              : l.attended === 'no-show'
                ? '❌ لم يحضر'
                : '⏳ موعد اجتماع',
          icon: '📅',
          color:
            l.attended === 'attended' ? '#10B981'
              : l.attended === 'no-show' ? '#EF4444'
              : '#F59E0B',
        })
      }

      // 5. Attendance confirmation
      if (l.attendanceMarkedAt && l.attended) {
        result.push({
          kind: 'attendance',
          attended: l.attended === 'attended',
          leadId: l.id,
          lead: l,
          ts: l.attendanceMarkedAt,
          label: l.attended === 'attended' ? '✅ تأكيد حضور' : '❌ تأكيد عدم حضور',
          icon: l.attended === 'attended' ? '✅' : '❌',
          color: l.attended === 'attended' ? '#10B981' : '#EF4444',
        })
      }
    })

    return result
  }, [myLeads, isTele])

  // Date range
  const { from, to } = useMemo(
    () => getDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo),
    [dateFilter]
  )

  // Activities in date range
  const allInRange = useMemo(() => {
    if (dateFilter.preset === 'all') return activities
    return activities.filter((a) => a.ts >= from && a.ts < to)
  }, [activities, dateFilter.preset, from, to])

  // Stats from allInRange
  const callActivities = allInRange.filter((a) => a.kind === 'call')
  const callsByResult: Record<string, number> = {}
  CONTACT_RESULTS.forEach((cr) => {
    if (cr.key) {
      callsByResult[cr.key] = callActivities.filter((a) => a.callResult === cr.key).length
    }
  })

  const callsAnswered = (callsByResult['replied'] || 0) + (callsByResult['whatsapp'] || 0)
  const callsNoReply = (callsByResult['no-reply'] || 0) + (callsByResult['busy'] || 0)
  const callsRejected =
    (callsByResult['not-interested'] || 0) + (callsByResult['wrong-number'] || 0)

  const stats = useMemo(() => {
    return {
      leads: allInRange.filter((a) => a.kind === 'added').length,
      transfers: allInRange.filter((a) => a.kind === 'transfer').length,
      meetings: allInRange.filter((a) => a.kind === 'meeting').length,
      attendance: allInRange.filter((a) => a.kind === 'attendance').length,
      calls: callActivities.length,
      callsAnswered,
      callsNoReply,
      callsRejected,
      callsByResult,
      responseRate: callActivities.length
        ? Math.round((callsAnswered / callActivities.length) * 100)
        : 0,
      attendedCount: allInRange.filter(
        (a) => a.kind === 'meeting' && a.lead.attended === 'attended'
      ).length,
      noShowCount: allInRange.filter(
        (a) => a.kind === 'meeting' && a.lead.attended === 'no-show'
      ).length,
    }
  }, [allInRange, callActivities, callsAnswered, callsNoReply, callsRejected, callsByResult])

  // Filtered activities by activityFilter
  const filtered = useMemo(() => {
    let result = dateFilter.preset === 'all'
      ? activities
      : activities.filter((a) => a.ts >= from && a.ts < to)

    if (activityFilter !== 'all') {
      if (activityFilter === 'added') result = result.filter((a) => a.kind === 'added')
      else if (activityFilter === 'transfers') result = result.filter((a) => a.kind === 'transfer')
      else if (activityFilter === 'meetings') result = result.filter((a) => a.kind === 'meeting')
      else if (activityFilter === 'attendance') result = result.filter((a) => a.kind === 'attendance')
      else if (activityFilter === 'calls') result = result.filter((a) => a.kind === 'call')
      else if (activityFilter.startsWith('call-')) {
        const crKey = activityFilter.substring(5)
        result = result.filter((a) => a.kind === 'call' && a.callResult === crKey)
      }
    }

    return result.sort((a, b) => b.ts - a.ts)
  }, [activities, dateFilter.preset, from, to, activityFilter])

  // Search filter
  const searchQuery = searchQueries[VIEW_KEY] || ''
  const displayed = useMemo(() => {
    if (!searchQuery) return filtered
    const q = searchQuery.toLowerCase()
    return filtered.filter(
      (a) =>
        (a.lead.customerName || '').toLowerCase().includes(q) ||
        (a.lead.phone || '').toLowerCase().includes(q) ||
        a.label.toLowerCase().includes(q)
    )
  }, [filtered, searchQuery])

  // Activity pills
  const activityPills = [
    {
      key: 'all',
      label: `📋 الكل (${stats.leads + stats.transfers + stats.meetings + stats.attendance + stats.calls})`,
    },
    {
      key: 'added',
      label: `📝 ${isTele ? 'leads ضافيتيها' : 'عملاء جدد'} (${stats.leads})`,
    },
    { key: 'calls', label: `📞 المكالمات (${stats.calls})` },
    { key: 'transfers', label: `🔄 التحويلات (${stats.transfers})` },
    { key: 'meetings', label: `📅 الاجتماعات (${stats.meetings})` },
    { key: 'attendance', label: `✅ تأكيدات الحضور (${stats.attendance})` },
  ]

  // Call result sub-pills
  const callResultPills =
    stats.calls > 0
      ? CONTACT_RESULTS.filter((cr) => cr.key && cr.key !== 'none' && (callsByResult[cr.key] || 0) > 0).map(
          (cr) => ({
            key: 'call-' + cr.key,
            label: `${cr.label} (${callsByResult[cr.key] || 0})`,
            color:
              cr.color === 'text-emerald-400' ? '#10B981'
                : cr.color === 'text-amber-400' ? '#F59E0B'
                : cr.color === 'text-venom' ? '#5eb8a6'
                : cr.color === 'text-red-400' ? '#EF4444'
                : '#9CA3AF',
          })
        )
      : []

  // Kind labels
  const kindLabels: Record<string, string> = {
    added: 'إضافة',
    call: 'مكالمة',
    transfer: 'تحويل',
    meeting: 'اجتماع',
    attendance: 'تأكيد حضور',
  }

  // Export CSV
  const exportCSV = useCallback(() => {
    const headers = [
      '#',
      'النشاط',
      'اسم العميل',
      'الجوال',
      'التفاصيل',
      isTele ? 'السيلز' : 'التيلي',
      'التاريخ والوقت',
    ]
    const rows = displayed.map((a, idx) => {
      const l = a.lead
      const dt = new Date(a.ts)
      return [
        idx + 1,
        kindLabels[a.kind] || a.kind,
        l.customerName || '',
        l.phone || '',
        a.label,
        isTele ? (l.sales || '') : (l.tele || ''),
        dt.toLocaleString('ar-EG'),
      ]
    })
    const BOM = '\uFEFF'
    const csv = BOM + [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `daily-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    addToast('success', '✅ تم التصدير')
  }, [displayed, isTele, addToast])

  // Date range label
  const getDateRangeLabel = () => {
    const preset = dateFilter.preset
    if (preset === 'today') return 'اليوم'
    if (preset === 'yesterday') return 'أمس'
    if (preset === 'week') return 'الأسبوع الحالي'
    if (preset === 'month') return 'الشهر الحالي'
    if (preset === 'custom') return `${dateFilter.customFrom || '...'} → ${dateFilter.customTo || '...'}`
    return 'الكل'
  }

  // Role guard: only tele and sales (AFTER all hooks)
  if (!currentUser || !currentRole || currentRole === 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Info className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <h3 className="text-lg font-semibold text-muted-foreground">غير متاح</h3>
          <p className="text-sm text-muted-foreground">التقارير متاحة للتيلي والسيلز فقط</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Sheet Selector */}
      {accessibleSheets.length > 1 && (
        <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl flex-wrap">
          <FolderOpen className="w-5 h-5 text-venom shrink-0" />
          <span className="text-xs text-muted-foreground font-medium">اختار الشيت:</span>
          <select
            value={validViewingSheet}
            onChange={(e) => setViewingSheet(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 border border-border rounded-lg bg-background text-sm cursor-pointer"
          >
            {accessibleSheets.map((name) => {
              const isOwn = name.toLowerCase() === currentUser.toLowerCase()
              return (
                <option key={name} value={name}>
                  {isOwn ? '👤 شيتي - ' : '👁️ شيت '}{name}
                </option>
              )
            })}
          </select>
          {!isViewingOwn && (
            <Badge className="bg-amber-500/15 text-amber-400 text-xs">
              <Eye className="w-3 h-3 ml-1" />
              بتشوف تقرير {validViewingSheet}
            </Badge>
          )}
        </div>
      )}

      {/* Date Range Filter */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-5 h-5 text-venom shrink-0" />
          <span className="text-xs text-muted-foreground font-medium">فلتر حسب التاريخ:</span>
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={dateFilter.preset === p.key ? 'default' : 'outline'}
              size="sm"
              className={
                dateFilter.preset === p.key
                  ? 'bg-venom text-venom-foreground border-venom/40 hover:bg-venom/90 h-7 text-xs shadow-sm'
                  : 'border-border h-7 text-xs hover:border-venom/30 hover:text-venom'
              }
              onClick={() => setDateRangeFilter(VIEW_KEY, { ...dateFilter, preset: p.key })}
            >
              {p.label}
            </Button>
          ))}
          {dateFilter.preset === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFilter.customFrom || ''}
                onChange={(e) =>
                  setDateRangeFilter(VIEW_KEY, { ...dateFilter, customFrom: e.target.value })
                }
                className="w-36 h-7 text-xs bg-background border-border"
              />
              <span className="text-muted-foreground text-xs">إلى</span>
              <Input
                type="date"
                value={dateFilter.customTo || ''}
                onChange={(e) =>
                  setDateRangeFilter(VIEW_KEY, { ...dateFilter, customTo: e.target.value })
                }
                className="w-36 h-7 text-xs bg-background border-border"
              />
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-venom/10 border border-venom/30 rounded-lg px-4 py-3 text-xs text-venom flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1">
          <strong>اللي ظاهر:</strong>{' '}
          كل {isTele ? 'الـ leads اللي ضفتيها' : 'العملاء'} + المكالمات (بكل حالاتها) + التحويلات + الاجتماعات + تأكيدات الحضور
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">
          {getDateRangeLabel()}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border border-venom/20 hover:border-venom/40 transition-colors">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">
              {isTele ? '📝 Leads ضافيتيها' : '📝 عملاء جدد'}
            </div>
            <div className="text-2xl font-bold text-venom mt-1">{stats.leads}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">📞 مكالمات</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.calls}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.responseRate}% نسبة استجابة
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-venom/20 hover:border-venom/40 transition-colors">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">🔄 تحويلات</div>
            <div className="text-2xl font-bold text-venom mt-1">{stats.transfers}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-amber-500/20 hover:border-amber-500/40 transition-colors">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">📅 اجتماعات</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats.meetings}</div>
            <div className="text-xs text-muted-foreground mt-1">
              ✅ {stats.attendedCount} · ❌ {stats.noShowCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Breakdown */}
      {stats.calls > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <PhoneCall className="w-4 h-4 text-emerald-400" />
            تفصيل المكالمات حسب الحالة
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {CONTACT_RESULTS.filter((cr) => cr.key && cr.key !== 'none' && (callsByResult[cr.key] || 0) > 0).map(
              (cr) => {
                const count = callsByResult[cr.key] || 0
                const crColor =
                  cr.color === 'text-emerald-400' ? '#10B981'
                    : cr.color === 'text-amber-400' ? '#F59E0B'
                    : cr.color === 'text-venom' ? '#5eb8a6'
                    : cr.color === 'text-red-400' ? '#EF4444'
                    : '#9CA3AF'
                return (
                  <div
                    key={cr.key}
                    className="bg-background border-2 rounded-lg p-3 cursor-pointer hover:scale-[1.03] transition-all"
                    style={{ borderColor: crColor }}
                    onClick={() => setActiveFilter(VIEW_KEY, 'call-' + cr.key)}
                  >
                    <div className="text-xs text-muted-foreground">{cr.label}</div>
                    <div className="text-xl font-bold" style={{ color: crColor }}>
                      {count}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {stats.calls ? Math.round((count / stats.calls) * 100) : 0}% من المكالمات
                    </div>
                  </div>
                )
              }
            )}
            <div className="bg-venom/10 border-2 border-venom rounded-lg p-3">
              <div className="text-xs text-venom">📊 نسبة الاستجابة</div>
              <div className="text-xl font-bold text-venom">{stats.responseRate}%</div>
              <div className="text-[9px] text-muted-foreground">
                {stats.callsAnswered} رد من {stats.calls}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {activityPills.map((p) => (
          <Button
            key={p.key}
            variant={activityFilter === p.key ? 'default' : 'outline'}
            size="sm"
            className={
              activityFilter === p.key
                ? 'bg-venom text-venom-foreground border-venom/40 hover:bg-venom/90 h-7 text-xs shadow-sm'
                : 'border-border h-7 text-xs hover:border-venom/30 hover:text-venom'
            }
            onClick={() => setActiveFilter(VIEW_KEY, p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Call Result Sub-Pills */}
      {(activityFilter === 'calls' || activityFilter.startsWith('call-')) &&
        callResultPills.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-card border border-border rounded-lg">
            <span className="text-xs text-muted-foreground ml-2">حالات المكالمات:</span>
            <Button
              variant={activityFilter === 'calls' ? 'default' : 'outline'}
              size="sm"
              className={
                activityFilter === 'calls'
                  ? 'bg-venom text-venom-foreground border-venom/40 h-7 text-xs shadow-sm'
                  : 'border-border h-7 text-xs'
              }
              onClick={() => setActiveFilter(VIEW_KEY, 'calls')}
            >
              الكل ({stats.calls})
            </Button>
            {callResultPills.map((p) => (
              <Button
                key={p.key}
                variant={activityFilter === p.key ? 'default' : 'outline'}
                size="sm"
                className={
                  activityFilter === p.key
                    ? 'bg-venom text-venom-foreground border-venom/40 h-7 text-xs shadow-sm'
                    : 'border-border h-7 text-xs'
                }
                style={
                  activityFilter !== p.key
                    ? { borderColor: p.color, color: p.color }
                    : undefined
                }
                onClick={() => setActiveFilter(VIEW_KEY, p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        )}

      {/* Search & Export */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث في الأنشطة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(VIEW_KEY, e.target.value)}
            className="pr-10 bg-background border-border focus:border-venom/50"
          />
        </div>
        <Button
          onClick={exportCSV}
          variant="outline"
          className="border-venom/30 text-venom hover:bg-venom/10"
        >
          <Download className="w-4 h-4 ml-2" />
          تصدير CSV
        </Button>
      </div>

      {/* Activities Table */}
      <div className="bg-card border border-border rounded-xl overflow-auto">
        <ScrollArea className="max-h-[calc(100vh-400px)]">
          <div className="min-w-[900px]">
            <table className="w-full text-sm" dir="rtl">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">#</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">النشاط</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">العميل</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">الجوال</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">التفاصيل</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">
                    {isTele ? 'السيلز' : 'التيلي'}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <Calendar className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p>مفيش أنشطة في الفترة المختارة</p>
                    </td>
                  </tr>
                ) : (
                  displayed.slice(0, 200).map((a, idx) => {
                    const l = a.lead
                    const dt = new Date(a.ts)
                    const dateStr = dt.toLocaleDateString('ar-EG', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })
                    const timeStr = dt.toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    return (
                      <tr
                        key={`${a.kind}-${a.leadId}-${idx}`}
                        className="border-b border-border/50 hover:bg-venom/5 transition-colors"
                      >
                        <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-xs font-medium border"
                            style={{ color: a.color, borderColor: a.color }}
                          >
                            {a.icon} {kindLabels[a.kind] || a.kind}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-sm">
                            {l.customerName || <span className="text-muted-foreground">بدون اسم</span>}
                          </div>
                          {l.customerType && (
                            <div className="text-xs text-muted-foreground">{l.customerType}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground" dir="ltr">
                          {l.phone || '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{a.label}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {isTele ? (l.sales || '—') : (l.tele || '—')}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          <div>{dateStr}</div>
                          <div className="text-xs">{timeStr}</div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
