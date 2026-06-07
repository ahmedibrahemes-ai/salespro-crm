'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  CalendarOff,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  ExternalLink,
  Search,
  FolderOpen,
  Info,
  Eye,
} from 'lucide-react'
import {
  useCrmStore,
  STATUSES,
  ATTENDANCE_STATUSES,
  formatDate,
  formatRelativeTime,
  getDateRange,
  getAllLeadsForAnalytics,
  normalizePhone,
} from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ===== Date filter presets =====
const DATE_PRESETS = [
  { key: 'today', label: '📅 اليوم' },
  { key: 'yesterday', label: '🕐 أمس' },
  { key: 'week', label: '📆 آخر أسبوع' },
  { key: 'month', label: '🗓️ الشهر الحالي' },
  { key: 'all', label: '🌐 الكل' },
  { key: 'custom', label: '🎯 تاريخ محدد' },
]

// ===== Attendance helpers =====
function getAttendanceBadge(attended: string | null) {
  if (attended === 'attended') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500 text-white">
        <CheckCircle2 className="w-3 h-3" /> حضر - كوميشن
      </span>
    )
  }
  if (attended === 'no-show') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-500 text-white">
        <XCircle className="w-3 h-3" /> لم يحضر
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
      <Clock className="w-3 h-3" /> في انتظار تأكيد السيلز
    </span>
  )
}

function getStatusBadge(lead: Lead) {
  const statusKey = lead.status || 'new'
  const status = STATUSES.find((s) => s.key === statusKey)
  if (!status) return null
  if (statusKey === 'new') return null
  const clsMap: Record<string, string> = {
    'status-new': 'bg-venom/20 text-venom',
    'status-noreply': 'bg-muted text-muted-foreground',
    'status-followup': 'bg-amber-500/20 text-amber-400',
    'status-done': 'bg-emerald-500/20 text-emerald-400',
    'status-objection': 'bg-red-500/20 text-red-400',
    'status-closed-win': 'bg-emerald-500/20 text-emerald-400',
    'status-closed-lost': 'bg-red-500/20 text-red-400',
  }
  const cls = clsMap[status.cls] || 'bg-muted text-muted-foreground'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status.label}
    </span>
  )
}

function getTimeLabel(ts: number | null): string {
  if (!ts) return ''
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'دلوقتي'
  if (mins < 60) return `من ${mins} د`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `من ${hours} س`
  const days = Math.floor(hours / 24)
  return `من ${days} يوم`
}

// ===== Main Component =====
const VIEW_KEY = 'my-meetings'

export function MyMeetings() {
  const {
    currentUser,
    currentRole,
    leads,
    archivedLeads,
    team,
    addToast,
    getAccessibleTeleSheets,
    activeFilter,
    setActiveFilter,
    searchQueries,
    setSearchQuery,
    dateRangeFilters,
    setDateRangeFilter,
  } = useCrmStore()

  // Date filter state synced with store
  const dateFilter = dateRangeFilters[VIEW_KEY] || { preset: 'all', customFrom: '', customTo: '' }
  const setDateFilter = useCallback(
    (f: { preset: string; customFrom?: string; customTo?: string }) => setDateRangeFilter(VIEW_KEY, f),
    [setDateRangeFilter]
  )

  // Search query synced with store
  const searchQuery = searchQueries[VIEW_KEY] || ''

  // Active attendance filter
  const attendFilter = activeFilter[VIEW_KEY] || 'all'

  // Sheet selector state
  const [viewingSheet, setViewingSheet] = useState<string | null>(null)

  // Get accessible tele sheets
  const accessibleSheets = useMemo(() => {
    if (!currentUser) return []
    return getAccessibleTeleSheets(currentUser)
  }, [currentUser, getAccessibleTeleSheets])

  // Resolve which sheet we're viewing
  const resolvedSheet = useMemo(() => {
    if (viewingSheet && accessibleSheets.map((s) => s.toLowerCase()).includes(viewingSheet.toLowerCase())) {
      return viewingSheet
    }
    return currentUser || ''
  }, [viewingSheet, accessibleSheets, currentUser])

  const isViewingOwn = resolvedSheet.toLowerCase() === (currentUser || '').toLowerCase()

  // All leads (active + archived) for meetings
  const allLeads = useMemo(() => getAllLeadsForAnalytics(leads, archivedLeads), [leads, archivedLeads])

  // Filter: tele's leads that have been assigned to sales (have meeting)
  const myBookedMeetings = useMemo(() => {
    if (!currentUser) return []
    const sheetLower = resolvedSheet.toLowerCase()
    let filtered = allLeads
      .filter(
        (l) => String(l.tele || '').toLowerCase() === sheetLower && l.sales
      )
      .sort((a, b) => (b.assignedAt || 0) - (a.assignedAt || 0))

    // Apply date range filter on assignedAt
    const { from, to } = getDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo)
    if (dateFilter.preset !== 'all') {
      filtered = filtered.filter((l) => {
        const ts = l.assignedAt || 0
        return ts >= from && ts < to
      })
    }

    return filtered
  }, [allLeads, resolvedSheet, currentUser, dateFilter])

  // Stats
  const stats = useMemo(() => {
    const attended = myBookedMeetings.filter((l) => l.attended === 'attended').length
    const noShow = myBookedMeetings.filter((l) => l.attended === 'no-show').length
    const pending = myBookedMeetings.filter((l) => l.attended !== 'attended' && l.attended !== 'no-show').length
    return { total: myBookedMeetings.length, attended, noShow, pending }
  }, [myBookedMeetings])

  // Apply attendance filter
  const filteredMeetings = useMemo(() => {
    if (attendFilter === 'attended') return myBookedMeetings.filter((l) => l.attended === 'attended')
    if (attendFilter === 'pending')
      return myBookedMeetings.filter((l) => l.attended !== 'attended' && l.attended !== 'no-show')
    if (attendFilter === 'no-show') return myBookedMeetings.filter((l) => l.attended === 'no-show')
    return myBookedMeetings
  }, [myBookedMeetings, attendFilter])

  // Apply search
  const displayedMeetings = useMemo(() => {
    if (!searchQuery.trim()) return filteredMeetings
    const q = searchQuery.toLowerCase()
    return filteredMeetings.filter(
      (l) =>
        (l.customerName || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.sales || '').toLowerCase().includes(q) ||
        (l.brief || '').toLowerCase().includes(q)
    )
  }, [filteredMeetings, searchQuery])

  // Date range label
  const dateRangeLabel = useMemo(() => {
    const p = dateFilter.preset
    if (p === 'all') return 'كل الأوقات'
    if (p === 'today') return 'اليوم'
    if (p === 'yesterday') return 'أمس'
    if (p === 'week') return 'آخر أسبوع'
    if (p === 'month') return 'الشهر الحالي'
    if (p === 'custom') {
      const from = dateFilter.customFrom || '—'
      const to = dateFilter.customTo || '—'
      return `${from} → ${to}`
    }
    return 'كل الأوقات'
  }, [dateFilter])

  if (!currentUser || currentRole !== 'tele') return null

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-venom venom-text-glow">اجتماعاتي</h1>
        <p className="text-muted-foreground text-sm mt-1">متابعة جميع اجتماعاتك مع العملاء</p>
      </motion.div>

      {/* Sheet Selector */}
      {accessibleSheets.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl flex-wrap"
        >
          <FolderOpen className="w-4 h-4 text-venom shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">اختار الشيت:</span>
          <Select value={resolvedSheet} onValueChange={(v) => setViewingSheet(v)}>
            <SelectTrigger className="flex-1 min-w-[200px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accessibleSheets.map((name) => {
                const isOwn = name.toLowerCase() === currentUser.toLowerCase()
                const cnt = allLeads.filter(
                  (l) => String(l.tele || '').toLowerCase() === name.toLowerCase() && l.sales
                ).length
                return (
                  <SelectItem key={name} value={name}>
                    {isOwn ? '👤 شيتي - ' : '👁️ شيت '}
                    {name} ({cnt} اجتماع)
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {!isViewingOwn && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
              <Eye className="w-3 h-3 ml-1" /> بتشوف اجتماعات {resolvedSheet}
            </Badge>
          )}
        </motion.div>
      )}

      {/* Date Range Filter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="p-3 bg-card border border-border rounded-xl"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-venom shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">فلتر حسب التاريخ:</span>
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={dateFilter.preset === p.key ? 'default' : 'outline'}
              className={
                dateFilter.preset === p.key
                  ? 'h-7 text-xs px-3 rounded-full bg-venom text-venom-foreground hover:bg-venom/90'
                  : 'h-7 text-xs px-3 rounded-full border-border hover:border-venom/30 hover:text-venom'
              }
              onClick={() => setDateFilter({ preset: p.key, customFrom: '', customTo: '' })}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {dateFilter.preset === 'custom' && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-muted-foreground">من:</span>
            <Input
              type="date"
              value={dateFilter.customFrom || ''}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, customFrom: e.target.value })
              }
              className="w-36 h-8 text-xs bg-background border-border"
            />
            <span className="text-xs text-muted-foreground">إلى:</span>
            <Input
              type="date"
              value={dateFilter.customTo || ''}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, customTo: e.target.value })
              }
              className="w-36 h-8 text-xs bg-background border-border"
            />
            <Button
              size="sm"
              className="h-8 text-xs bg-venom text-venom-foreground hover:bg-venom/90"
              onClick={() => {
                if (!dateFilter.customFrom) {
                  addToast('error', 'اختاري تاريخ "من" على الأقل')
                  return
                }
                setDateFilter({
                  ...dateFilter,
                  preset: 'custom',
                  customTo: dateFilter.customTo || dateFilter.customFrom,
                })
              }}
            >
              تطبيق
            </Button>
          </div>
        )}
      </motion.div>

      {/* Info Banner */}
      <div className="flex items-center gap-2 bg-venom/5 border border-venom/30 rounded-lg px-3 py-2 text-xs text-venom flex-wrap">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          <strong>فلتر التاريخ بيشتغل على:</strong> تاريخ تحويل العميل للسيلز
        </span>
        <span className="mr-auto bg-card px-2.5 py-0.5 rounded-lg font-semibold text-xs">
          {dateRangeLabel}
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="بحث في اجتماعاتي..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(VIEW_KEY, e.target.value)}
          className="pr-10 h-9 text-sm bg-card border-border"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="bg-card border border-border">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">إجمالي الاجتماعات</div>
            <div className="text-xl font-bold text-venom">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-emerald-500/30">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">حضر ✅ (كوميشن)</div>
            <div className="text-xl font-bold text-emerald-400">{stats.attended}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">في الانتظار ⏳</div>
            <div className="text-xl font-bold text-amber-400">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">لم يحضر ❌</div>
            <div className="text-xl font-bold text-red-400">{stats.noShow}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all', label: 'الكل', count: stats.total },
          { key: 'attended', label: 'حضر', count: stats.attended },
          { key: 'pending', label: 'في الانتظار', count: stats.pending },
          { key: 'no-show', label: 'لم يحضر', count: stats.noShow },
        ].map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={attendFilter === f.key ? 'default' : 'outline'}
            className={
              attendFilter === f.key
                ? 'h-8 text-[12px] rounded-full bg-venom text-venom-foreground hover:bg-venom/90'
                : 'h-8 text-[12px] rounded-full border-border hover:border-venom/30 hover:text-venom'
            }
            onClick={() => setActiveFilter(VIEW_KEY, f.key)}
          >
            {f.label} ({f.count})
          </Button>
        ))}
      </div>

      {/* Meeting Cards List */}
      <div className="max-h-[calc(100vh-420px)] overflow-y-auto custom-scrollbar space-y-3 pr-1">
        <AnimatePresence mode="popLayout">
          {displayedMeetings.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <CalendarOff className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground text-base font-medium">
                {dateFilter.preset === 'all'
                  ? 'مفيش اجتماعات حجزتيها لحد دلوقتي'
                  : 'مفيش اجتماعات في الفترة المختارة'}
              </p>
              <p className="text-muted-foreground/50 text-sm mt-1">
                {dateFilter.preset === 'all'
                  ? 'أول ما تحوّلي عميل لسيلز هيظهر هنا'
                  : 'جربي تغيير الفلتر للتاريخ'}
              </p>
            </motion.div>
          ) : (
            displayedMeetings.map((lead, i) => (
              <TeleMeetingCard key={lead.id} lead={lead} index={i} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ===== Tele Meeting Card (matches old HTML renderMyMeetingCard) =====
function TeleMeetingCard({ lead, index }: { lead: Lead; index: number }) {
  const timeLabel = getTimeLabel(lead.assignedAt || lead.createdAt)
  const notes = lead.notes || []
  const hasName = lead.customerName && lead.customerName.trim()

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card className="bg-card border border-border hover:border-venom/20 transition-all duration-200 overflow-hidden">
        <CardContent className="p-0">
          {/* Header row: attendance badge + status badge + time label + sales name */}
          <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 border-b border-border/50 bg-muted/20">
            {getAttendanceBadge(lead.attended)}
            {getStatusBadge(lead)}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" /> {timeLabel}
            </span>
            <span className="mr-auto text-[12px] text-emerald-400 font-medium flex items-center gap-1">
              مع {lead.sales}
            </span>
          </div>

          {/* Body: customer info + meeting date */}
          <div className="flex gap-3 px-4 py-3">
            {/* Customer Info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground truncate">
                  {hasName ? lead.customerName : <span className="text-muted-foreground font-normal">بدون اسم</span>}
                </span>
                {lead.customerType && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-venom/10 text-venom border border-venom/20">
                    {lead.customerType}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {lead.phone && (
                  <span className="inline-flex items-center gap-1" dir="ltr">
                    <Phone className="w-3 h-3" /> {normalizePhone(lead.phone)}
                  </span>
                )}
                {lead.storeUrl && (
                  <span className="inline-flex items-center gap-1 truncate max-w-[200px]" dir="ltr">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <a
                      href={lead.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-venom hover:underline truncate"
                    >
                      {lead.storeUrl.replace(/^https?:\/\//, '').substring(0, 40)}
                    </a>
                  </span>
                )}
              </div>
              {lead.brief && (
                <div className="text-xs text-muted-foreground border-r-2 border-venom/40 pr-2 mt-1">
                  <strong className="text-[9px] text-venom">البريف:</strong>{' '}
                  {lead.brief.length > 120 ? lead.brief.substring(0, 120) + '...' : lead.brief}
                </div>
              )}
            </div>

            {/* Meeting Date/Time */}
            {lead.meetingDate && (
              <div className="shrink-0 text-center px-3 py-1.5 bg-muted/30 rounded-lg">
                <div className="text-[9px] text-muted-foreground">
                  {formatDate(new Date(lead.meetingDate).getTime())}
                </div>
                <div className="text-sm font-bold text-foreground">{lead.meetingTime || '—'}</div>
              </div>
            )}
          </div>

          {/* Notes section (last 2) */}
          {notes.length > 0 && (
            <div className="px-4 py-2 border-t border-border/30 bg-muted/10">
              {notes.slice(-2).map((n, ni) => (
                <div key={ni} className="py-1">
                  <div className="text-[9px] text-muted-foreground">
                    {n.by} · {formatRelativeTime(n.at)}
                  </div>
                  <div className="text-xs text-muted-foreground">{n.text}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
