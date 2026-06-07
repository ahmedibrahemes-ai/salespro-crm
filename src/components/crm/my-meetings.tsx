'use client'

import { useMemo, useState, useCallback } from 'react'
import { useCrmStore, ATTENDANCE_STATUSES, formatDate } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiUpdateLead } from '@/lib/supabase'
import {
  Calendar, Clock, Video, MapPin, Phone, ExternalLink,
  Check, X, CalendarDays, CalendarRange,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/* ═══════════════════════════════════════════════════════
   Date helpers
   ═══════════════════════════════════════════════════════ */
function isToday(dateStr: string): boolean {
  if (!dateStr) return false
  const today = new Date().toISOString().split('T')[0]
  return dateStr === today
}

function isThisWeek(dateStr: string): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const startOfWeek = new Date(now)
  const dayOfWeek = now.getDay()
  const daysSinceSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1
  startOfWeek.setDate(now.getDate() - daysSinceSaturday)
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)
  return d >= startOfWeek && d < endOfWeek
}

function isUpcoming(dateStr: string): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d >= today
}

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
}: {
  lead: Lead
  onMarkAttendance: (id: string, value: string) => void
  currentUser: string | null
}) {
  const isOnline = lead.meetingType === 'online'
  const todayStr = new Date().toISOString().split('T')[0]
  const isMeetingToday = lead.meetingDate === todayStr
  const isPastMeeting = lead.meetingDate ? new Date(lead.meetingDate) < new Date(todayStr) : false

  const attendanceColor = lead.attended === 'attended'
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    : lead.attended === 'no-show'
    ? 'bg-red-500/15 text-red-400 border-red-500/20'
    : 'bg-amber-500/15 text-amber-400 border-amber-500/20'

  return (
    <Card className="bg-[#111520] border border-white/[0.06] hover:border-[#6c63ff]/20 transition-all group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left section */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Type icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isOnline ? 'bg-[#6c63ff]/15 text-[#6c63ff]' : 'bg-[#00d4aa]/15 text-[#00d4aa]'
            }`}>
              {isOnline ? <Video size={18} /> : <MapPin size={18} />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#f0f2ff] truncate">
                {lead.customerName || 'عميل'}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-[11px] text-[#8892b0]">
                  <Calendar size={10} />
                  {formatMeetingDate(lead.meetingDate)}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-[#8892b0]">
                  <Clock size={10} />
                  {formatMeetingTime(lead.meetingTime)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge className={`text-[9px] border ${
                  isOnline ? 'bg-[#6c63ff]/10 text-[#a8a3ff] border-[#6c63ff]/20' : 'bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20'
                }`}>
                  {isOnline ? 'أونلاين' : 'حضوري'}
                </Badge>
                {isMeetingToday && (
                  <Badge className="bg-[#ffd166]/10 text-[#ffd166] border border-[#ffd166]/20 text-[9px]">
                    اليوم
                  </Badge>
                )}
              </div>

              {/* Meeting link */}
              {isOnline && lead.meetingLink && (
                <a
                  href={lead.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-[11px] text-[#6c63ff] hover:text-[#a8a3ff] transition-colors"
                >
                  <ExternalLink size={10} />
                  رابط الاجتماع
                </a>
              )}

              {/* Brief */}
              {lead.brief && (
                <div className="text-[11px] text-[#4a5280] mt-1.5 truncate max-w-[250px]">
                  {lead.brief}
                </div>
              )}
            </div>
          </div>

          {/* Right section - Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Attendance badge */}
            <Badge className={`${attendanceColor} text-[9px] border`}>
              {ATTENDANCE_STATUSES.find((a) => a.key === lead.attended)?.label || '⏳ انتظار'}
            </Badge>

            {/* Phone */}
            <a
              href={`tel:${lead.phone}`}
              className="w-7 h-7 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors"
            >
              <Phone size={12} />
            </a>

            {/* Attendance buttons */}
            {(isMeetingToday || isPastMeeting) && lead.attended !== 'attended' && lead.attended !== 'no-show' && (
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

  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'all'>('today')

  /* ─── Filtered meetings ─── */
  const meetingLeads = useMemo(() => {
    let result = leads.filter((l) => !l.isArchived && l.meetingDate && l.meetingDate !== '')

    // Filter by current user role
    if (currentRole === 'tele' && currentUser) {
      result = result.filter((l) => l.tele === currentUser)
    } else if (currentRole === 'sales' && currentUser) {
      result = result.filter((l) => l.sales === currentUser)
    }

    // Time filter
    if (timeFilter === 'today') {
      result = result.filter((l) => isToday(l.meetingDate))
    } else if (timeFilter === 'week') {
      result = result.filter((l) => isThisWeek(l.meetingDate))
    }
    // 'all' shows upcoming meetings
    if (timeFilter === 'all') {
      result = result.filter((l) => isUpcoming(l.meetingDate))
    }

    // Sort by date then time
    result.sort((a, b) => {
      const dateComp = a.meetingDate.localeCompare(b.meetingDate)
      if (dateComp !== 0) return dateComp
      return (a.meetingTime || '').localeCompare(b.meetingTime || '')
    })

    return result
  }, [leads, currentUser, currentRole, timeFilter])

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const allMyMeetings = leads.filter((l) => {
      if (l.isArchived || !l.meetingDate) return false
      if (currentRole === 'tele' && currentUser) return l.tele === currentUser
      if (currentRole === 'sales' && currentUser) return l.sales === currentUser
      return true
    })

    const today = allMyMeetings.filter((l) => isToday(l.meetingDate))
    const attended = allMyMeetings.filter((l) => l.attended === 'attended')
    const noShow = allMyMeetings.filter((l) => l.attended === 'no-show')
    const pending = allMyMeetings.filter((l) => !l.attended || l.attended === 'pending')

    return {
      todayCount: today.length,
      attendedCount: attended.length,
      noShowCount: noShow.length,
      pendingCount: pending.length,
    }
  }, [leads, currentUser, currentRole])

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
          <h2 className="text-[18px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            اجتماعاتي
          </h2>
          <p className="text-[12px] text-[#8892b0] mt-0.5">متابعة الاجتماعات والحضور</p>
        </div>

        {/* Time filter */}
        <div className="flex items-center gap-1 bg-[#111520] border border-white/[0.06] rounded-lg p-1">
          {[
            { key: 'today' as const, label: 'اليوم', icon: CalendarDays },
            { key: 'week' as const, label: 'هذا الأسبوع', icon: CalendarRange },
            { key: 'all' as const, label: 'القادمة', icon: Calendar },
          ].map((f) => {
            const Icon = f.icon
            return (
              <button
                key={f.key}
                onClick={() => setTimeFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  timeFilter === f.key
                    ? 'bg-[#6c63ff]/15 text-[#a8a3ff]'
                    : 'text-[#8892b0] hover:bg-[#1c2234] hover:text-[#f0f2ff]'
                }`}
              >
                <Icon size={12} />
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'اجتماعات اليوم', value: stats.todayCount, color: '#ffd166' },
          { label: 'حضر', value: stats.attendedCount, color: '#00d4aa' },
          { label: 'لم يحضر', value: stats.noShowCount, color: '#ff6b6b' },
          { label: 'في الانتظار', value: stats.pendingCount, color: '#6c63ff' },
        ].map((s, i) => (
          <div key={i} className="bg-[#111520] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] text-[#8892b0]">{s.label}</div>
            <div className="text-[20px] font-bold mt-0.5" style={{ color: s.color, fontFamily: 'Cairo, sans-serif' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Meeting Cards */}
      {meetingLeads.length === 0 ? (
        <Card className="bg-[#111520] border-white/[0.06]">
          <CardContent className="py-16 text-center">
            <div className="text-[40px] mb-3">📅</div>
            <div className="text-[14px] text-[#8892b0] mb-1">لا يوجد اجتماعات</div>
            <div className="text-[12px] text-[#4a5280]">
              {timeFilter === 'today' ? 'لا يوجد اجتماعات اليوم' : timeFilter === 'week' ? 'لا يوجد اجتماعات هذا الأسبوع' : 'لا يوجد اجتماعات قادمة'}
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
