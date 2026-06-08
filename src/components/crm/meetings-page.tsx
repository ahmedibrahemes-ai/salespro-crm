'use client'

import { useMemo, useState, useCallback } from 'react'
import { useCrmStore, ATTENDANCE_STATUSES, formatDate } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiUpdateLead } from '@/lib/supabase'
import {
  Calendar, Clock, Video, MapPin, Phone, Check, X, Filter, Search,
  CalendarDays, CalendarRange, Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

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
   Time filter type
   ═══════════════════════════════════════════════════════ */
type TimeFilter = 'today' | 'week' | 'upcoming' | 'all'

/* ═══════════════════════════════════════════════════════
   Meeting Card — OPTIMIZED: no Framer Motion
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
          {/* Right section (RTL - main info) */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Type icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isOnline ? 'bg-[#6c63ff]/15 text-[#6c63ff]' : 'bg-[#00d4aa]/15 text-[#00d4aa]'
            }`}>
              {isOnline ? <Video size={18} /> : <MapPin size={18} />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold text-[#f0f2ff] truncate">
                {lead.customerName || 'عميل'}
              </div>

              {lead.phone && (
                <div className="text-[14px] font-medium text-[#8892b0] mt-0.5 font-mono" dir="ltr">
                  {lead.phone}
                </div>
              )}

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-[15px] font-medium text-[#8892b0]">
                  <Calendar size={10} />
                  {formatMeetingDate(lead.meetingDate)}
                </span>
                <span className="flex items-center gap-1 text-[15px] font-medium text-[#8892b0]">
                  <Clock size={10} />
                  {formatMeetingTime(lead.meetingTime)}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge className={`text-[13px] font-bold border ${
                  isOnline ? 'bg-[#6c63ff]/10 text-[#a8a3ff] border-[#6c63ff]/20' : 'bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20'
                }`}>
                  {isOnline ? 'أونلاين' : 'حضوري'}
                </Badge>
                {isMeetingToday && (
                  <Badge className="bg-[#ffd166]/10 text-[#ffd166] border border-[#ffd166]/20 text-[13px] font-bold">
                    اليوم
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 mt-2">
                {lead.tele && (
                  <span className="flex items-center gap-1 text-[14px] font-medium text-[#6c63ff]">
                    <Users size={9} />
                    تيلي: {lead.tele}
                  </span>
                )}
                {lead.sales && (
                  <span className="flex items-center gap-1 text-[14px] font-medium text-[#00d4aa]">
                    <Users size={9} />
                    مبيعات: {lead.sales}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Left section (RTL - actions) */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge className={`${attendanceColor} text-[13px] font-bold border`}>
              {ATTENDANCE_STATUSES.find((a) => a.key === lead.attended)?.label || '⏳ انتظار'}
            </Badge>

            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="w-7 h-7 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors"
              >
                <Phone size={12} />
              </a>
            )}

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
   Meetings Page Component — OPTIMIZED
   - Replaced Framer Motion with CSS transitions
   - Targeted Zustand selectors
   ═══════════════════════════════════════════════════════ */
export function MeetingsPage() {
  const leads = useCrmStore((s) => s.leads)
  const team = useCrmStore((s) => s.team)
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)
  const addToast = useCrmStore((s) => s.addToast)
  const updateLeadInCache = useCrmStore((s) => s.updateLeadInCache)

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today')
  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  /* ─── All team members for filter ─── */
  const allMembers = useMemo(() => {
    const members: { name: string; role: string }[] = []
    team.tele.forEach((name) => members.push({ name, role: 'تيلي' }))
    team.sales.forEach((name) => members.push({ name, role: 'مبيعات' }))
    return members
  }, [team])

  /* ─── Filtered meetings ─── */
  const meetingLeads = useMemo(() => {
    let result = leads.filter((l) => !l.isArchived && l.meetingDate && l.meetingDate !== '')

    // Role-based filtering: tele/sales only see their own meetings
    if (currentRole === 'tele' && currentUser) {
      result = result.filter((l) => l.tele === currentUser)
    } else if (currentRole === 'sales' && currentUser) {
      result = result.filter((l) => l.sales === currentUser)
    }

    if (timeFilter === 'today') {
      result = result.filter((l) => isToday(l.meetingDate))
    } else if (timeFilter === 'week') {
      result = result.filter((l) => isThisWeek(l.meetingDate))
    } else if (timeFilter === 'upcoming') {
      result = result.filter((l) => isUpcoming(l.meetingDate))
    }

    if (memberFilter !== 'all') {
      result = result.filter((l) => l.tele === memberFilter || l.sales === memberFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((l) =>
        (l.customerName && l.customerName.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q))
      )
    }

    result.sort((a, b) => {
      const dateComp = a.meetingDate.localeCompare(b.meetingDate)
      if (dateComp !== 0) return dateComp
      return (a.meetingTime || '').localeCompare(b.meetingTime || '')
    })

    return result
  }, [leads, timeFilter, memberFilter, searchQuery, currentUser, currentRole])

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const allMeetings = leads.filter((l) => !l.isArchived && l.meetingDate && l.meetingDate !== '')

    const today = allMeetings.filter((l) => isToday(l.meetingDate))
    const attended = today.filter((l) => l.attended === 'attended')
    const noShow = today.filter((l) => l.attended === 'no-show')
    const pending = today.filter((l) => !l.attended || l.attended === 'pending')

    return {
      todayCount: today.length,
      attendedCount: attended.length,
      noShowCount: noShow.length,
      pendingCount: pending.length,
    }
  }, [leads])

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

  /* ─── Empty state message based on filter ─── */
  const emptyMessage = useMemo(() => {
    if (searchQuery.trim()) return 'لا توجد نتائج مطابقة للبحث'
    switch (timeFilter) {
      case 'today': return 'لا يوجد اجتماعات اليوم'
      case 'week': return 'لا يوجد اجتماعات هذا الأسبوع'
      case 'upcoming': return 'لا يوجد اجتماعات قادمة'
      default: return 'لا يوجد اجتماعات'
    }
  }, [timeFilter, searchQuery])

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div
      className="space-y-4 animate-in fade-in duration-300"
      dir="rtl"
      style={{ fontFamily: 'Cairo, sans-serif' }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            الاجتماعات
          </h2>
          <p className="text-[15px] font-semibold text-[#8892b0] mt-0.5">متابعة جميع اجتماعات الفريق</p>
        </div>

        {/* Time filter tabs */}
        <div className="flex items-center gap-1 bg-[#111520] border border-white/[0.06] rounded-lg p-1 flex-wrap">
          {[
            { key: 'today' as const, label: 'اليوم', icon: CalendarDays },
            { key: 'week' as const, label: 'هذا الأسبوع', icon: CalendarRange },
            { key: 'upcoming' as const, label: 'القادمة', icon: Calendar },
            { key: 'all' as const, label: 'الكل', icon: Calendar },
          ].map((f) => {
            const Icon = f.icon
            return (
              <button
                key={f.key}
                onClick={() => setTimeFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[15px] font-bold transition-colors cursor-pointer ${
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
            <div className="text-[15px] font-semibold text-[#8892b0]">{s.label}</div>
            <div className="text-[22px] font-bold mt-0.5" style={{ color: s.color, fontFamily: 'Cairo, sans-serif' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters Row: Member filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Filter size={14} className="text-[#4a5280]" />
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger className="w-[180px] h-8 bg-[#111520] border-white/[0.06] text-[15px] text-[#f0f2ff]">
              <SelectValue placeholder="كل الفريق" />
            </SelectTrigger>
            <SelectContent className="bg-[#111520] border-white/[0.06] max-h-64 overflow-y-auto">
              <SelectItem value="all" className="text-[15px] text-[#8892b0] focus:text-[#f0f2ff] focus:bg-[#1c2234]">
                كل الفريق
              </SelectItem>
              {allMembers.map((m) => (
                <SelectItem
                  key={m.name}
                  value={m.name}
                  className="text-[15px] text-[#8892b0] focus:text-[#f0f2ff] focus:bg-[#1c2234]"
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${m.role === 'تيلي' ? 'bg-[#6c63ff]' : 'bg-[#00d4aa]'}`} />
                    {m.name}
                    <span className="text-[14px] font-medium text-[#4a5280]">({m.role})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5280] pointer-events-none" />
          <Input
            placeholder="بحث بالاسم أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 bg-[#111520] border-white/[0.06] text-[15px] text-[#f0f2ff] placeholder:text-[#4a5280] pr-9"
          />
        </div>
      </div>

      {/* Meeting Cards */}
      {meetingLeads.length === 0 ? (
        <Card className="bg-[#111520] border-white/[0.06]">
          <CardContent className="py-16 text-center">
            <div className="text-[42px] mb-3">📅</div>
            <div className="text-[18px] font-bold text-[#8892b0] mb-1">لا يوجد اجتماعات</div>
            <div className="text-[15px] font-medium text-[#4a5280]">{emptyMessage}</div>
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
