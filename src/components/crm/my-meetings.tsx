'use client'

import { useMemo, useState, useCallback } from 'react'
import { useCrmStore, ATTENDANCE_STATUSES, SALES_STATUSES, formatDate, formatRelativeTime, formatTime, getDateRange } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiUpdateLead } from '@/lib/supabase'
import { isTodayDateString, isThisWeek } from '@/lib/crm-utils'
import {
  Calendar, Clock, Phone, ExternalLink,
  Check, X, CalendarDays,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

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
   Meeting Card — OPTIMIZED: removed Framer Motion
   Uses CSS transitions instead for better performance
   ═══════════════════════════════════════════════════════ */
function MeetingCard({
  lead,
  onMarkAttendance,
  currentUser,
  currentRole,
}: {
  lead: Lead
  onMarkAttendance: (id: string, value: string) => void
  currentUser: string | null
  currentRole: string | null
}) {
  const isTele = currentRole === 'tele'
  const todayStr = new Date().toISOString().split('T')[0]
  const isMeetingToday = lead.meetingDate === todayStr
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
        {/* Relative time for tele users */}
        {isTele && lead.assignedAt && (
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
                    اليوم
                  </Badge>
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

              {/* Brief */}
              {lead.brief && (
                <div className="text-[12px] font-medium text-[#4a5280] mt-1.5 truncate max-w-[250px]">
                  {lead.brief}
                </div>
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

            {/* Attendance badge (read-only for tele, interactive for sales) */}
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

            {/* Attendance buttons — only for sales users */}
            {!isTele && (isMeetingToday || isPastMeeting) && lead.attended !== 'attended' && lead.attended !== 'no-show' && (
              <div className="flex gap-1">
                <button
                  onClick={() => onMarkAttendance(lead.id, 'attended')}
                  className="w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/25 transition-colors cursor-pointer"
                  title="حضر"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => onMarkAttendance(lead.id, 'no-show')}
                  className="w-7 h-7 rounded-md bg-red-500/15 text-red-400 flex items-center justify-center hover:bg-red-500/25 transition-colors cursor-pointer"
                  title="لم يحضر"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════
   My Meetings Component — PERFORMANCE OPTIMIZED
   - Removed Framer Motion (was creating stagger timers)
   - Using CSS transitions instead
   - Targeted Zustand selectors to prevent unnecessary re-renders
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
  }, [customFrom, customTo, setDateRangeFilter])

  /* ─── Filtered meetings ─── */
  const meetingLeads = useMemo(() => {
    let result = leads.filter((l) => !l.isArchived && l.meetingDate && l.meetingDate !== '')

    // Filter by current user role
    // For tele: show only transferred leads (has sales assigned)
    if (currentRole === 'tele' && currentUser) {
      result = result.filter((l) => l.tele === currentUser && l.sales)
    } else if (currentRole === 'sales' && currentUser) {
      result = result.filter((l) => l.sales === currentUser)
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
        // Sales: filter by meetingDate string
        if (dateFilter.preset === 'today') {
          result = result.filter((l) => isTodayDateString(l.meetingDate))
        } else if (dateFilter.preset === 'yesterday') {
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const yStr = yesterday.toISOString().split('T')[0]
          result = result.filter((l) => l.meetingDate === yStr)
        } else if (dateFilter.preset === 'week') {
          result = result.filter((l) => isThisWeek(l.meetingDate))
        } else if (dateFilter.preset === 'month') {
          const now = new Date()
          const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          result = result.filter((l) => l.meetingDate.startsWith(monthStr))
        } else if (dateFilter.preset === 'custom' && dateFilter.customFrom && dateFilter.customTo) {
          result = result.filter((l) => l.meetingDate >= dateFilter.customFrom! && l.meetingDate <= dateFilter.customTo!)
        }
      }
    }

    // Sort: tele users by assignedAt descending, sales users by meetingDate then time
    if (isTele) {
      result.sort((a, b) => {
        const aTime = a.assignedAt || a.createdAt || 0
        const bTime = b.assignedAt || b.createdAt || 0
        return bTime - aTime
      })
    } else {
      result.sort((a, b) => {
        const dateComp = a.meetingDate.localeCompare(b.meetingDate)
        if (dateComp !== 0) return dateComp
        return (a.meetingTime || '').localeCompare(b.meetingTime || '')
      })
    }

    return result
  }, [leads, currentUser, currentRole, dateFilter, isTele])

  /* ─── Stats (respect date range filter) ─── */
  const stats = useMemo(() => {
    const allMyMeetings = meetingLeads

    const today = allMyMeetings.filter((l) => isTodayDateString(l.meetingDate))
    const attended = allMyMeetings.filter((l) => l.attended === 'attended')
    const noShow = allMyMeetings.filter((l) => l.attended === 'no-show')
    const pending = allMyMeetings.filter((l) => !l.attended || l.attended === 'pending')
    const closedWon = allMyMeetings.filter((l) => l.salesStatus === 'closed-won')

    return {
      todayCount: today.length,
      attendedCount: attended.length,
      noShowCount: noShow.length,
      pendingCount: pending.length,
      closedWonCount: closedWon.length,
      totalCount: allMyMeetings.length,
    }
  }, [meetingLeads])

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

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            اجتماعاتي
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

      {/* Stats Row */}
      <div className={`grid gap-3 ${isTele ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {[
          ...(isTele ? [{ label: 'إجمالي التحويلات', value: stats.totalCount, color: '#a8a3ff' }] : []),
          { label: 'اجتماعات اليوم', value: stats.todayCount, color: '#ffd166' },
          { label: 'حضر', value: stats.attendedCount, color: '#00d4aa' },
          { label: 'لم يحضر', value: stats.noShowCount, color: '#ff6b6b' },
          ...(isTele ? [{ label: 'تم التقفيل', value: stats.closedWonCount, color: '#10b981' }] : [{ label: 'في الانتظار', value: stats.pendingCount, color: '#6c63ff' }]),
        ].map((s, i) => (
          <div key={i} className="bg-[#111520] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[13px] font-semibold text-[#8892b0]">{s.label}</div>
            <div className="text-[19px] font-bold mt-0.5" style={{ color: s.color, fontFamily: 'Cairo, sans-serif' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Meeting Cards */}
      {meetingLeads.length === 0 ? (
        <Card className="bg-[#111520] border-white/[0.06]">
          <CardContent className="py-16 text-center">
            <div className="text-[36px] mb-3">📅</div>
            <div className="text-[15px] font-bold text-[#8892b0] mb-1">لا يوجد اجتماعات</div>
            <div className="text-[13px] font-medium text-[#4a5280]">
              {isTele
                ? 'لا يوجد تحويلات للفترة المحددة'
                : 'لا يوجد اجتماعات للفترة المحددة'
              }
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {meetingLeads.map((lead) => (
            <MeetingCard
              key={lead.id}
              lead={lead}
              onMarkAttendance={handleMarkAttendance}
              currentUser={currentUser}
              currentRole={currentRole}
            />
          ))}
        </div>
      )}
    </div>
  )
}
