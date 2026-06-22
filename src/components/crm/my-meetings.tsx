'use client'

import { useMemo, useState, useCallback } from 'react'
import { useCrmStore, ATTENDANCE_STATUSES, SALES_STATUSES, formatDate, formatRelativeTime, formatTime, getDateRange } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiUpdateLead } from '@/lib/supabase'
import { isTodayDateString, isTodayTimestamp, isThisWeek, isClosedWon } from '@/lib/crm-utils'
import {
  Calendar, Clock, Phone, ExternalLink,
  Check, X, CalendarDays, XCircle, StickyNote, Store, ArrowRightLeft,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

/* ═══════════════════════════════════════════════════════
   Inline Notes Cell — editable text for Follow-Up notes
   (same as sales-sheet NotesCell, stored in salesStatus field)
   ═══════════════════════════════════════════════════════ */
function MeetingNotesCell({
  value,
  onSave,
}: {
  value: string
  onSave: (val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)

  const commit = useCallback(() => {
    if (draft !== value) onSave(draft)
    setEditing(false)
    setOpen(false)
  }, [draft, value, onSave])

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[12px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]"
        placeholder="اكتب ملاحظة..."
        autoFocus
      />
    )
  }

  const isEmpty = !value || value.trim() === ''

  if (isEmpty) {
    return (
      <div
        onClick={() => { setDraft(value); setEditing(true) }}
        className="cursor-pointer hover:bg-[#1c2234] rounded px-2 py-1 transition-colors flex items-center gap-1.5 min-h-[28px]"
      >
        <StickyNote size={12} className="text-[#4a5280] shrink-0" />
        <span className="text-[12px] text-[#4a5280]">ملاحظات Follow-Up</span>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          onClick={() => { setDraft(value); setEditing(true) }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="cursor-pointer hover:bg-[#1c2234] rounded px-2 py-1 transition-colors flex items-center gap-1.5 min-h-[28px]"
        >
          <StickyNote size={12} className="text-[#6c63ff] shrink-0" />
          <span className="text-[12px] truncate text-[#8892b0]">{value}</span>
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="bg-[#1a1f2e] border-white/[0.08] text-[#f0f2ff] max-w-[400px] w-[400px] p-3 z-50"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ fontFamily: 'Cairo, sans-serif' }} dir="rtl">
          {value}
        </div>
        <div className="mt-2 pt-2 border-t border-white/[0.06] text-[10px] text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
          اضغط للتعديل
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ═══════════════════════════════════════════════════════
   Date helpers
   ═══════════════════════════════════════════════════════ */

function formatMeetingDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (d.toDateString() === today.toDateString()) return 'اليوم'
  if (d.toDateString() === tomorrow.toDateString()) return 'غداً'

  return d.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatMeetingTime(timeStr: string): string {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h, 10)
  const period = hour >= 12 ? 'م' : 'ص'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m} ${period}`
}

/* ═══════════════════════════════════════════════════════
   Stat filter type — which stat card is active
   ═══════════════════════════════════════════════════════ */
type StatFilter = 'all' | 'today' | 'attended' | 'no-show' | 'pending' | 'closed-won' | 'total'

/* ═══════════════════════════════════════════════════════
   Meeting Card — OPTIMIZED: removed Framer Motion
   Uses CSS transitions instead for better performance
   ═══════════════════════════════════════════════════════ */
function MeetingCard({
  lead,
  onMarkAttendance,
  onUpdateField,
  currentUser,
  currentRole,
}: {
  lead: Lead
  onMarkAttendance: (id: string, value: string) => void
  onUpdateField: (id: string, field: string, value: string) => void
  currentUser: string | null
  currentRole: string | null
}) {
  const isTele = currentRole === 'tele'
  const todayStr = new Date().toISOString().split('T')[0]
  const isMeetingToday = lead.meetingDate === todayStr
  const isTransferToday = isTele && lead.assignedAt ? isTodayTimestamp(lead.assignedAt) : false
  const isPastMeeting = lead.meetingDate ? new Date(lead.meetingDate) < new Date(todayStr) : false

  const attendanceColor = lead.attended === 'attended'
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    : lead.attended === 'no-show'
    ? 'bg-red-500/15 text-red-400 border-red-500/20'
    : 'bg-amber-500/15 text-amber-400 border-amber-500/20'

  // Sales status badge for tele users
  const salesStatusObj = SALES_STATUSES.find((s) => s.key === lead.salesStatus)

  return (
    <Card className="bg-[#111520] border border-white/[0.06] hover:border-[#6c63ff]/20 transition-all group">
      <CardContent className="p-4">
        {/* Transfer date & time — shown to BOTH tele and sales (the transfer
            timestamp is meaningful for both: tele sees when they transferred,
            sales sees when the meeting was transferred to them). */}
        {lead.assignedAt && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#a8a3ff]">
              {formatRelativeTime(lead.assignedAt)}
            </span>
            <span className="text-[10px] font-medium text-[#4a5280]">
              {formatDate(lead.assignedAt)} - {formatTime(lead.assignedAt)}
            </span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          {/* Left section */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Calendar icon */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#6c63ff]/15 text-[#6c63ff]">
              <Calendar size={18} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-[#f0f2ff] truncate">
                {lead.customerName || 'عميل'}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-[13px] font-medium text-[#8892b0]">
                  <CalendarDays size={10} />
                  {formatMeetingDate(lead.meetingDate)}
                </span>
                <span className="flex items-center gap-1 text-[13px] font-medium text-[#8892b0]">
                  <Clock size={10} />
                  {formatMeetingTime(lead.meetingTime)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {isMeetingToday && (
                  <Badge className="bg-[#ffd166]/10 text-[#ffd166] border border-[#ffd166]/20 text-[11px] font-bold">
                    الاجتماع اليوم
                  </Badge>
                )}
                {isTele && isTransferToday && !isMeetingToday && (
                  <Badge className="bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20 text-[11px] font-bold">
                    تم التحويل اليوم
                  </Badge>
                )}
              </div>

              {/* Tele name (who transferred the meeting) — shown to sales users */}
              {!isTele && lead.tele && lead.tele.trim() !== '' && (
                <div className="text-[11px] font-bold text-[#6c63ff] flex items-center gap-1 mt-1.5">
                  <ArrowRightLeft size={10} />
                  <span className="text-[#8892b0]">حول من التلي:</span>
                  <span>{lead.tele}</span>
                </div>
              )}

              {/* Store link + Phone number — quick actions */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {lead.storeUrl && (
                  <a
                    href={lead.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#6c63ff]/10 text-[#6c63ff] hover:bg-[#6c63ff]/20 transition-colors text-[11px] font-bold"
                    title={lead.storeUrl}
                  >
                    <Store size={10} />
                    المتجر
                  </a>
                )}
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#00d4aa]/10 text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors text-[11px] font-bold"
                    title={lead.phone}
                    dir="ltr"
                  >
                    <Phone size={10} />
                    {lead.phone}
                  </a>
                )}
              </div>

              {/* Meeting link */}
              {lead.meetingType === 'online' && lead.meetingLink && (
                <a
                  href={lead.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-[12px] font-medium text-[#6c63ff] hover:text-[#a8a3ff] transition-colors"
                >
                  <ExternalLink size={10} />
                  رابط الاجتماع
                </a>
              )}

              {/* Brief — click or hover to show full text in a popover popup */}
              {lead.brief && (
                <Popover>
                  <PopoverTrigger asChild>
                    <div
                      className="text-[12px] font-medium text-[#4a5280] mt-1.5 truncate max-w-[250px] cursor-pointer hover:text-[#6c63ff] hover:bg-[#1c2234] rounded px-1 py-0.5 transition-colors"
                      title="اضغط أو اشاور لرؤية البريف كامل"
                    >
                      {lead.brief}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    className="bg-[#1a1f2e] border-white/[0.08] text-[#f0f2ff] max-w-[400px] w-[400px] p-3 z-50"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div
                      className="text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                      dir="rtl"
                    >
                      {lead.brief}
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/[0.06] text-[10px] text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      البريف كامل
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {/* Right section - Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Tele user: show sales status + sales person */}
            {isTele && (
              <>
                {/* Sales status badge */}
                {salesStatusObj ? (
                  <Badge className={`${salesStatusObj.cls} text-[11px] font-bold border-0`}>
                    {salesStatusObj.label}
                  </Badge>
                ) : (
                  <Badge className="bg-[#1c2234] text-[#4a5280] text-[11px] font-bold border-0">
                    —
                  </Badge>
                )}
                {/* Sales person */}
                {lead.sales && (
                  <div className="text-[11px] font-bold text-[#6c63ff] flex items-center gap-1">
                    <span className="text-[#8892b0]">السيلز:</span> {lead.sales}
                  </div>
                )}
              </>
            )}

            {/* Attendance badge */}
            <Badge className={`${attendanceColor} text-[11px] font-bold border`}>
              {ATTENDANCE_STATUSES.find((a) => a.key === lead.attended)?.label || '⏳ انتظار'}
            </Badge>

            {/* Phone */}
            <a
              href={`tel:${lead.phone}`}
              className="w-7 h-7 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors"
            >
              <Phone size={12} />
            </a>

            {/* Attendance buttons — sales can ALWAYS change (even if already set) */}
            {!isTele && (
              <div className="flex gap-1">
                <button
                  onClick={() => onMarkAttendance(lead.id, 'attended')}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${lead.attended === 'attended' ? 'bg-emerald-500/30 text-emerald-400 ring-1 ring-emerald-500/50' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'}`}
                  title="حضر"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => onMarkAttendance(lead.id, 'pending')}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${lead.attended === 'pending' || !lead.attended ? 'bg-amber-500/30 text-amber-400 ring-1 ring-amber-500/50' : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'}`}
                  title="انتظار"
                >
                  <Clock size={12} />
                </button>
                <button
                  onClick={() => onMarkAttendance(lead.id, 'no-show')}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${lead.attended === 'no-show' ? 'bg-red-500/30 text-red-400 ring-1 ring-red-500/50' : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'}`}
                  title="لم يحضر"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ملاحظات Follow-Up — editable for sales, read-only for tele */}
        {!isTele && (
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5 mb-1">
              <StickyNote size={12} className="text-[#6c63ff]" />
              <span className="text-[11px] font-bold text-[#4a5280]">ملاحظات Follow-Up</span>
            </div>
            <MeetingNotesCell
              value={lead.salesStatus || ''}
              onSave={(v) => onUpdateField(lead.id, 'salesStatus', v)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════
   My Meetings Component — PERFORMANCE OPTIMIZED
   - Removed Framer Motion (was creating stagger timers)
   - Using CSS transitions instead
   - Targeted Zustand selectors to prevent unnecessary re-renders
   - Interactive stat cards: click to filter, click again to unfilter
   ═══════════════════════════════════════════════════════ */
export function MyMeetings() {
  const leads = useCrmStore((s) => s.leads)
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)
  const addToast = useCrmStore((s) => s.addToast)
  const updateLeadInCache = useCrmStore((s) => s.updateLeadInCache)
  const dateRangeFilters = useCrmStore((s) => s.dateRangeFilters)
  const setDateRangeFilter = useCrmStore((s) => s.setDateRangeFilter)

  const viewKey = 'my-meetings'
  const dateFilter = dateRangeFilters[viewKey] || { preset: 'all' }

  const isTele = currentRole === 'tele'

  /* ─── Stat filter state ─── */
  const [activeStat, setActiveStat] = useState<StatFilter>('all')

  const handleStatClick = useCallback((stat: StatFilter) => {
    setActiveStat((prev) => prev === stat ? 'all' : stat)
  }, [])

  /* ─── Custom date state ─── */
  const [customFrom, setCustomFrom] = useState(dateFilter.customFrom || '')
  const [customTo, setCustomTo] = useState(dateFilter.customTo || '')

  const handleDatePresetChange = useCallback((preset: string) => {
    if (preset === 'custom') {
      setDateRangeFilter(viewKey, { preset, customFrom, customTo })
    } else {
      setDateRangeFilter(viewKey, { preset })
      setCustomFrom('')
      setCustomTo('')
    }
    // Reset stat filter when date filter changes
    setActiveStat('all')
  }, [customFrom, customTo, setDateRangeFilter])

  /* ─── Filtered meetings (by date) ─── */
  const dateFilteredLeads = useMemo(() => {
    // Meetings page: ONLY shows leads transferred FROM tele TO sales
    // (leads where tele is set AND sales is set)
    // Leads where sales set up their own meetings are in the 'follow-up' page
    let result = leads.filter((l) => !l.isArchived)

    if (currentRole === 'tele' && currentUser) {
      // Tele users: show leads they transferred to sales
      result = result.filter((l) => l.tele === currentUser && l.sales)
    } else if (currentRole === 'sales' && currentUser) {
      // Sales users: show ONLY tele-transferred leads assigned to them
      result = result.filter((l) => l.sales === currentUser && l.tele && l.tele.trim() !== '')
    } else {
      // Admin: show ALL tele→sales transfers
      result = result.filter((l) => l.tele && l.tele.trim() !== '' && l.sales && l.sales.trim() !== '')
    }

    // Date range filter
    // For tele users: filter by assignedAt timestamp
    // For sales users: filter by meetingDate string
    if (dateFilter.preset !== 'all') {
      if (isTele) {
        // Tele: filter by assignedAt timestamp
        const { from, to } = getDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo)
        result = result.filter((l) => {
          const ts = l.assignedAt || l.createdAt || 0
          return ts >= from && ts < to
        })
      } else {
        // Sales: filter by meetingDate string.
        // Use Africa/Cairo timezone consistently (matches getDateRange in store.ts)
        // to avoid off-by-one-day errors around midnight/month boundaries.
        const nowEgypt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
        const toEgyptDateStr = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

        if (dateFilter.preset === 'today') {
          result = result.filter((l) => isTodayDateString(l.meetingDate))
        } else if (dateFilter.preset === 'yesterday') {
          const yesterday = new Date(nowEgypt)
          yesterday.setDate(yesterday.getDate() - 1)
          const yStr = toEgyptDateStr(yesterday)
          result = result.filter((l) => l.meetingDate === yStr)
        } else if (dateFilter.preset === 'week') {
          result = result.filter((l) => isThisWeek(l.meetingDate))
        } else if (dateFilter.preset === 'month') {
          const monthStr = `${nowEgypt.getFullYear()}-${String(nowEgypt.getMonth() + 1).padStart(2, '0')}`
          result = result.filter((l) => l.meetingDate.startsWith(monthStr))
        } else if (dateFilter.preset === 'custom' && dateFilter.customFrom && dateFilter.customTo) {
          result = result.filter((l) => l.meetingDate >= dateFilter.customFrom! && l.meetingDate <= dateFilter.customTo!)
        }
      }
    }

    // Sort: NEWEST first (descending) for both tele and sales.
    // Tele: by transfer timestamp (assignedAt) — newest transfer on top.
    // Sales: by meeting date+time descending (newest meeting on top), with a
    // fallback to assignedAt (transfer time) when meetingDate is missing.
    if (isTele) {
      result.sort((a, b) => {
        const aTime = a.assignedAt || a.createdAt || 0
        const bTime = b.assignedAt || b.createdAt || 0
        return bTime - aTime
      })
    } else {
      result.sort((a, b) => {
        // Newest meeting first: compare meetingDate descending
        const aDate = a.meetingDate || ''
        const bDate = b.meetingDate || ''
        const dateComp = bDate.localeCompare(aDate)
        if (dateComp !== 0) return dateComp
        // Same date → newer meeting time first
        const timeComp = (b.meetingTime || '').localeCompare(a.meetingTime || '')
        if (timeComp !== 0) return timeComp
        // Same date+time → fall back to transfer time (newest transfer first)
        const aTransfer = a.assignedAt || a.createdAt || 0
        const bTransfer = b.assignedAt || b.createdAt || 0
        return bTransfer - aTransfer
      })
    }

    return result
  }, [leads, currentUser, currentRole, dateFilter, isTele])

  /* ─── Stats (respect date range filter) ─── */
  const stats = useMemo(() => {
    const allMyMeetings = dateFilteredLeads

    // For tele users: "today" means transferred today (by assignedAt)
    // For sales users: "today" means meeting today (by meetingDate)
    const today = isTele
      ? allMyMeetings.filter((l) => {
          const ts = l.assignedAt || l.createdAt || 0
          return isTodayTimestamp(ts)
        })
      : allMyMeetings.filter((l) => isTodayDateString(l.meetingDate))
    const attended = allMyMeetings.filter((l) => l.attended === 'attended')
    const noShow = allMyMeetings.filter((l) => l.attended === 'no-show')
    const pending = allMyMeetings.filter((l) => !l.attended || l.attended === 'pending')
    const closedWon = allMyMeetings.filter((l) => isClosedWon(l))

    return {
      today: today,
      attended: attended,
      noShow: noShow,
      pending: pending,
      closedWon: closedWon,
      all: allMyMeetings,
      todayCount: today.length,
      attendedCount: attended.length,
      noShowCount: noShow.length,
      pendingCount: pending.length,
      closedWonCount: closedWon.length,
      totalCount: allMyMeetings.length,
    }
  }, [dateFilteredLeads, isTele])

  /* ─── Final displayed meetings (date + stat filter) ─── */
  const displayedLeads = useMemo(() => {
    if (activeStat === 'all') return dateFilteredLeads
    return stats[activeStat] || dateFilteredLeads
  }, [activeStat, dateFilteredLeads, stats])

  /* ─── Mark attendance ─── */
  const handleMarkAttendance = useCallback(async (id: string, value: string) => {
    const updates: Partial<Lead> = {
      attended: value,
      attendanceMarkedAt: Date.now(),
      attendanceMarkedBy: currentUser || '',
    }
    updateLeadInCache(id, updates)
    try {
      await apiUpdateLead(id, updates)
      addToast('success', value === 'attended' ? 'تم تأكيد الحضور ✅' : 'تم تسجيل عدم الحضور ❌')
    } catch {
      addToast('error', 'فشل تسجيل الحضور')
    }
  }, [updateLeadInCache, currentUser, addToast])

  /* ─── Update field (for notes) ─── */
  const handleUpdateField = useCallback(async (id: string, field: string, value: string) => {
    const updates: Partial<Lead> = { [field]: value || null }
    updateLeadInCache(id, updates)
    try { await apiUpdateLead(id, updates) } catch { addToast('error', 'فشل التحديث') }
  }, [updateLeadInCache, addToast])

  /* ─── Stat card config ─── */
  const statCards = useMemo(() => {
    const cards: Array<{ key: StatFilter; label: string; value: number; color: string; activeBg: string }> = []

    if (isTele) {
      cards.push({ key: 'total', label: 'إجمالي التحويلات', value: stats.totalCount, color: '#a8a3ff', activeBg: 'bg-[#a8a3ff]/10 border-[#a8a3ff]/30' })
    }
    cards.push({ key: 'today', label: isTele ? 'تحويلات اليوم' : 'اجتماعات اليوم', value: stats.todayCount, color: '#ffd166', activeBg: 'bg-[#ffd166]/10 border-[#ffd166]/30' })
    cards.push({ key: 'attended', label: 'حضر', value: stats.attendedCount, color: '#00d4aa', activeBg: 'bg-emerald-500/10 border-emerald-500/30' })
    cards.push({ key: 'no-show', label: 'لم يحضر', value: stats.noShowCount, color: '#ff6b6b', activeBg: 'bg-red-500/10 border-red-500/30' })
    if (isTele) {
      cards.push({ key: 'closed-won', label: 'تم التقفيل', value: stats.closedWonCount, color: '#10b981', activeBg: 'bg-emerald-500/10 border-emerald-500/30' })
    } else {
      cards.push({ key: 'pending', label: 'في الانتظار', value: stats.pendingCount, color: '#6c63ff', activeBg: 'bg-[#6c63ff]/10 border-[#6c63ff]/30' })
    }

    return cards
  }, [isTele, stats])

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            اجتماعات التلي
          </h2>
          <p className="text-[13px] font-semibold text-[#8892b0] mt-0.5">{isTele ? 'العملاء المحولين للسيلز وحالتهم' : 'متابعة الاجتماعات والحضور'}</p>
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateFilter.preset} onValueChange={handleDatePresetChange}>
            <SelectTrigger className="w-[130px] h-8 text-[15px] bg-[#111520] border-white/[0.06] text-[#8892b0]">
              <CalendarDays size={12} className="text-[#6c63ff]" />
              <SelectValue placeholder="التاريخ" />
            </SelectTrigger>
            <SelectContent className="bg-[#111520] border-white/[0.08]">
              <SelectItem value="all" className="text-[15px] text-[#f0f2ff]">الكل</SelectItem>
              <SelectItem value="today" className="text-[15px] text-[#f0f2ff]">اليوم</SelectItem>
              <SelectItem value="yesterday" className="text-[15px] text-[#f0f2ff]">أمس</SelectItem>
              <SelectItem value="week" className="text-[15px] text-[#f0f2ff]">هذا الأسبوع</SelectItem>
              <SelectItem value="month" className="text-[15px] text-[#f0f2ff]">هذا الشهر</SelectItem>
              <SelectItem value="custom" className="text-[15px] text-[#f0f2ff]">مخصص</SelectItem>
            </SelectContent>
          </Select>

          {/* Custom date range inputs */}
          {dateFilter.preset === 'custom' && (
            <>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value)
                  setDateRangeFilter(viewKey, { preset: 'custom', customFrom: e.target.value, customTo })
                }}
                className="h-8 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[140px]"
              />
              <Input
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value)
                  setDateRangeFilter(viewKey, { preset: 'custom', customFrom, customTo: e.target.value })
                }}
                className="h-8 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[140px]"
              />
            </>
          )}
        </div>
      </div>

      {/* Stats Row — Interactive Cards */}
      <div className={`grid gap-3 ${isTele ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {statCards.map((s) => {
          const isActive = activeStat === s.key
          return (
            <button
              key={s.key}
              onClick={() => handleStatClick(s.key)}
              className={`relative bg-[#111520] border rounded-xl p-3 text-right transition-all duration-200 cursor-pointer group ${
                isActive
                  ? `${s.activeBg} shadow-lg`
                  : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-[#151b2e]'
              }`}
            >
              {/* Active indicator dot */}
              {isActive && (
                <div
                  className="absolute top-2 left-2 w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: s.color }}
                />
              )}
              <div className={`text-[13px] font-semibold transition-colors ${isActive ? 'text-[#f0f2ff]' : 'text-[#8892b0]'}`}>
                {s.label}
              </div>
              <div className="text-[19px] font-bold mt-0.5 flex items-center gap-2" style={{ color: s.color, fontFamily: 'Cairo, sans-serif' }}>
                {s.value}
                {isActive && (
                  <XCircle size={14} className="opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: s.color }} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Active filter indicator */}
      {activeStat !== 'all' && (
        <div className="flex items-center gap-2 text-[12px] font-semibold text-[#8892b0]">
          <span>عرض:</span>
          <Badge
            className="text-[11px] font-bold cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: `${statCards.find(s => s.key === activeStat)?.color}15`,
              color: statCards.find(s => s.key === activeStat)?.color,
              borderColor: `${statCards.find(s => s.key === activeStat)?.color}30`,
            }}
          >
            {statCards.find(s => s.key === activeStat)?.label} ({displayedLeads.length})
          </Badge>
          <button
            onClick={() => setActiveStat('all')}
            className="text-[#4a5280] hover:text-[#f0f2ff] transition-colors cursor-pointer"
          >
            إلغاء الفلتر
          </button>
        </div>
      )}

      {/* Meeting Cards */}
      {displayedLeads.length === 0 ? (
        <Card className="bg-[#111520] border-white/[0.06]">
          <CardContent className="py-16 text-center">
            <div className="text-[36px] mb-3">📅</div>
            <div className="text-[15px] font-bold text-[#8892b0] mb-1">
              {activeStat !== 'all' ? 'لا يوجد نتائج للفلتر المحدد' : 'لا يوجد اجتماعات'}
            </div>
            <div className="text-[13px] font-medium text-[#4a5280]">
              {activeStat !== 'all'
                ? 'جرب فلتر مختلف أو إلغاء الفلتر'
                : isTele
                  ? 'لا يوجد تحويلات للفترة المحددة'
                  : 'لا يوجد اجتماعات للفترة المحددة'
              }
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayedLeads.map((lead) => (
            <MeetingCard
              key={lead.id}
              lead={lead}
              onMarkAttendance={handleMarkAttendance}
              onUpdateField={handleUpdateField}
              currentUser={currentUser}
              currentRole={currentRole}
            />
          ))}
        </div>
      )}
    </div>
  )
}
