'use client'

import { useMemo, useState } from 'react'
import { useCrmStore, STATUSES, SALES_STATUSES, CONTACT_RESULTS, formatDate, formatRelativeTime } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { isCallContactResult } from '@/lib/crm-utils'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Phone,
  Users,
  Trophy,
  BarChart3,
  TrendingUp,
  UserPlus,
  Check,
  X,
  Clock,
  Zap,
  Moon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function isSameDay(timestamp: number, date: Date): boolean {
  if (!timestamp) return false
  const d = new Date(timestamp)
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  )
}

function formatDayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return 'اليوم'
  }
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'أمس'
  }
  return date.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function isMeetingToday(lead: Lead, date: Date): boolean {
  if (!lead.meetingDate) return false
  const selectedStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return lead.meetingDate === selectedStr
}

function getContactResultLabel(key: string): string {
  const cr = CONTACT_RESULTS.find((c) => c.key === key)
  return cr ? cr.label : key
}

/** Format hour (0-23) to Arabic AM/PM label */
function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 ص'
  if (hour < 12) return `${hour} ص`
  if (hour === 12) return '12 م'
  return `${hour - 12} م`
}

/* ═══════════════════════════════════════════════════════
   Activity Item Component
   ═══════════════════════════════════════════════════════ */

interface ActivityItemProps {
  icon: React.ReactNode
  iconColor: string
  title: string
  subtitle: string
  time: string
}

function ActivityItem({ icon, iconColor, title, subtitle, time }: ActivityItemProps) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 border border-white/[0.04] rounded-xl hover:bg-white/[0.02] transition-colors">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${iconColor}20`, color: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] font-bold text-[#f0f2ff] truncate"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {title}
        </div>
        <div
          className="text-[12px] font-medium text-[#8892b0] truncate"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {subtitle}
        </div>
      </div>
      <div
        className="text-[11px] font-medium text-[#4a5280] shrink-0"
        style={{ fontFamily: 'Cairo, sans-serif' }}
      >
        {time}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   DailyReport Component — OPTIMIZED
   - Replaced Framer Motion with CSS transitions
   - Single-pass computation for all KPIs + activities + hourly data
   - Targeted Zustand selectors
   ═══════════════════════════════════════════════════════ */

export function DailyReport() {
  const leads = useCrmStore((s) => s.leads)
  const archivedLeads = useCrmStore((s) => s.archivedLeads)
  const team = useCrmStore((s) => s.team)
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)
  const teleAccess = useCrmStore((s) => s.teleAccess)
  const salesAccess = useCrmStore((s) => s.salesAccess)
  const accessibleTeleSheets = useCrmStore((s) => s.getAccessibleTeleSheets)
  const accessibleSalesSheets = useCrmStore((s) => s.getAccessibleSalesSheets)

  /* ─── Date Navigation ─── */
  const [selectedDate, setSelectedDate] = useState(new Date())

  const goToPrevDay = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 1)
      return d
    })
  }

  const goToNextDay = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 1)
      const today = new Date()
      if (d > today) return prev
      return d
    })
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const isSelectedToday = useMemo(() => {
    const now = new Date()
    return (
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate()
    )
  }, [selectedDate])

  /* ─── SINGLE PASS: All computations in one useMemo ─── */
  const computed = useMemo(() => {
    let allLeads = [...leads, ...archivedLeads]

    // Role-based filtering: tele/sales only see their own data
    if (currentRole === 'tele' && currentUser) {
      allLeads = allLeads.filter((l) => l.tele === currentUser)
    } else if (currentRole === 'sales' && currentUser) {
      allLeads = allLeads.filter((l) => l.sales === currentUser)
    }

    // KPI values - single pass
    let newLeadsCount = 0
    let callsMadeCount = 0
    let meetingsCount = 0
    let attendedCount = 0
    let noShowCount = 0
    let closedWonCount = 0
    let transferredCount = 0
    let contactRepliedCount = 0
    let contactNoReplyCount = 0
    let contactBusyCount = 0
    let contactWrongNumberCount = 0
    let contactCustomerServiceCount = 0

    // Activity lists - single pass
    const newLeadActivities: Array<{
      id: string; icon: React.ReactNode; iconColor: string;
      title: string; subtitle: string; time: string; timestamp: number;
    }> = []
    const statusChangeActivities: Array<{
      id: string; icon: React.ReactNode; iconColor: string;
      title: string; subtitle: string; time: string; timestamp: number;
    }> = []
    const meetingActivities: Array<{
      id: string; icon: React.ReactNode; iconColor: string;
      title: string; subtitle: string; time: string; timestamp: number;
    }> = []

    // Team activity - accumulate per member
    const memberStats: Record<string, {
      role: 'tele' | 'sales'; newLeads: number; calls: number;
      meetings: number; attended: number; closed: number;
    }> = {}
    for (const name of team.tele) {
      memberStats[name] = { role: 'tele', newLeads: 0, calls: 0, meetings: 0, attended: 0, closed: 0 }
    }
    for (const name of team.sales) {
      memberStats[name] = { role: 'sales', newLeads: 0, calls: 0, meetings: 0, attended: 0, closed: 0 }
    }

    // Hourly call distribution (0-23)
    const hourlyCalls: number[] = new Array(24).fill(0)

    // Single pass over all leads
    for (const lead of allLeads) {
      const isNewToday = isSameDay(lead.createdAt, selectedDate)
      const isCallToday = lead.contactResultAt && isSameDay(lead.contactResultAt, selectedDate) && isCallContactResult(lead.contactResult)
      const hasMeetingToday = isMeetingToday(lead, selectedDate)
      const isAttendedToday = hasMeetingToday && lead.attended === 'attended'
      const isNoShowToday = hasMeetingToday && lead.attended === 'no-show'
      const isClosedWonToday = lead.attendanceMarkedAt && isSameDay(lead.attendanceMarkedAt, selectedDate) && lead.status === 'closed-won'
      const isTransferredToday = lead.assignedAt && isSameDay(lead.assignedAt, selectedDate) && lead.sales

      if (isNewToday) newLeadsCount++
      if (isCallToday) {
        callsMadeCount++
        // Count by contact result type
        if (lead.contactResult === 'replied') contactRepliedCount++
        else if (lead.contactResult === 'no-reply') contactNoReplyCount++
        else if (lead.contactResult === 'busy') contactBusyCount++
        else if (lead.contactResult === 'wrong-number') contactWrongNumberCount++
        else if (lead.contactResult === 'customer-service') contactCustomerServiceCount++

        // Accumulate hourly distribution
        if (lead.contactResultAt) {
          const hour = new Date(lead.contactResultAt).getHours()
          hourlyCalls[hour]++
        }
      }
      if (hasMeetingToday) meetingsCount++
      if (isAttendedToday) attendedCount++
      if (isNoShowToday) noShowCount++
      if (isClosedWonToday) closedWonCount++
      if (isTransferredToday) transferredCount++

      // Per-member stats
      const teleMember = memberStats[lead.tele]
      if (teleMember) {
        if (isNewToday) teleMember.newLeads++
        if (isCallToday) teleMember.calls++
        if (hasMeetingToday) teleMember.meetings++
        if (isAttendedToday) teleMember.attended++
        if (isClosedWonToday) teleMember.closed++
      }
      if (lead.sales) {
        const salesMember = memberStats[lead.sales]
        if (salesMember) {
          if (isNewToday) salesMember.newLeads++
          if (isCallToday) salesMember.calls++
          if (hasMeetingToday) salesMember.meetings++
          if (isAttendedToday) salesMember.attended++
          if (isClosedWonToday) salesMember.closed++
        }
      }

      // Activities - only compute for relevant leads (limit to 50 total)
      if (newLeadActivities.length + statusChangeActivities.length + meetingActivities.length < 50) {
        if (isNewToday) {
          newLeadActivities.push({
            id: `new-${lead.id}`,
            icon: <UserPlus size={14} />,
            iconColor: '#6c63ff',
            title: `ليد جديد: ${lead.customerName || lead.phone || 'عميل'}`,
            subtitle: `بواسطة ${lead.tele || '—'}${lead.storeUrl ? ` • ${lead.storeUrl}` : ''}`,
            time: formatRelativeTime(lead.createdAt),
            timestamp: lead.createdAt,
          })
        }

        if (isCallToday) {
          statusChangeActivities.push({
            id: `call-${lead.id}`,
            icon: <Phone size={14} />,
            iconColor: '#00d4aa',
            title: `مكالمة: ${lead.customerName || lead.phone || 'عميل'}`,
            subtitle: `${getContactResultLabel(lead.contactResult)} • ${lead.tele || '—'}`,
            time: formatRelativeTime(lead.contactResultAt),
            timestamp: lead.contactResultAt || 0,
          })
        }

        if (hasMeetingToday) {
          meetingActivities.push({
            id: `meeting-${lead.id}`,
            icon: <Calendar size={14} />,
            iconColor: '#ffd166',
            title: `اجتماع: ${lead.customerName || lead.phone || 'عميل'}`,
            subtitle: `${lead.meetingTime || '—'} • حضور: ${lead.attended === 'attended' ? '✅ حضر' : lead.attended === 'no-show' ? '❌ لم يحضر' : '⏳ انتظار'}`,
            time: lead.meetingTime || formatDate(lead.createdAt),
            timestamp: lead.createdAt,
          })
        }

        if (isClosedWonToday) {
          statusChangeActivities.push({
            id: `won-${lead.id}`,
            icon: <Trophy size={14} />,
            iconColor: '#00d4aa',
            title: `🏆 تقفيل: ${lead.customerName || lead.phone || 'عميل'}`,
            subtitle: `بواسطة ${lead.sales || lead.tele || '—'}`,
            time: formatRelativeTime(lead.attendanceMarkedAt),
            timestamp: lead.attendanceMarkedAt || 0,
          })
        }

        if (lead.attendanceMarkedAt && isSameDay(lead.attendanceMarkedAt, selectedDate) && lead.attended) {
          const isAttended = lead.attended === 'attended'
          statusChangeActivities.push({
            id: `attend-${lead.id}`,
            icon: isAttended ? <Check size={14} /> : <X size={14} />,
            iconColor: isAttended ? '#00d4aa' : '#ff6b6b',
            title: `${isAttended ? '✅ حضر' : '❌ لم يحضر'}: ${lead.customerName || lead.phone || 'عميل'}`,
            subtitle: `تم التسجيل بواسطة ${lead.attendanceMarkedBy || '—'}`,
            time: formatRelativeTime(lead.attendanceMarkedAt),
            timestamp: lead.attendanceMarkedAt || 0,
          })
        }
      }
    }

    // Sort activities by timestamp descending
    newLeadActivities.sort((a, b) => b.timestamp - a.timestamp)
    statusChangeActivities.sort((a, b) => b.timestamp - a.timestamp)
    meetingActivities.sort((a, b) => b.timestamp - a.timestamp)

    // Team activity sorted by calls (most active first)
    const teamActivity = Object.entries(memberStats).map(([name, stats]) => ({
      name,
      ...stats,
      total: stats.newLeads + stats.calls + stats.meetings + stats.attended + stats.closed,
    })).sort((a, b) => b.calls - a.calls || b.total - a.total)

    // Filter team activity based on permissions
    let filteredTeamActivity = teamActivity
    if (currentRole === 'tele' && currentUser) {
      const accessible = new Set(accessibleTeleSheets(currentUser))
      filteredTeamActivity = teamActivity.filter((m) => accessible.has(m.name))
    } else if (currentRole === 'sales' && currentUser) {
      const accessible = new Set(accessibleSalesSheets(currentUser))
      filteredTeamActivity = teamActivity.filter((m) => accessible.has(m.name))
    }
    // Admin sees all (no filter)

    // Hide team section if 0 or 1 members (just themselves — redundant)
    const showTeamSection = filteredTeamActivity.length > 1

    const topPerformer = filteredTeamActivity.length > 0 && filteredTeamActivity[0].total > 0 ? filteredTeamActivity[0] : null
    const topCaller = filteredTeamActivity.find((m) => m.calls > 0) || null

    // Peak hours: sort hours by call count descending
    const peakHours = hourlyCalls
      .map((count, hour) => ({ hour, count }))
      .filter((h) => h.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Low activity hours: hours with 0 calls (within working hours 8-22)
    const lowActivityHours = hourlyCalls
      .map((count, hour) => ({ hour, count }))
      .filter((h) => h.hour >= 8 && h.hour <= 22 && h.count === 0)
      .sort((a, b) => a.hour - b.hour)

    const maxHourlyCalls = Math.max(...hourlyCalls, 1)

    return {
      kpiData: {
        newLeadsCount, callsMadeCount, meetingsCount, attendedCount,
        noShowCount, closedWonCount, transferredCount,
        contactRepliedCount, contactNoReplyCount, contactBusyCount,
        contactWrongNumberCount, contactCustomerServiceCount,
      },
      newLeadActivities: newLeadActivities.slice(0, 20),
      statusChangeActivities: statusChangeActivities.slice(0, 20),
      meetingActivities: meetingActivities.slice(0, 20),
      teamActivity: filteredTeamActivity,
      showTeamSection,
      topPerformer,
      topCaller,
      hourlyCalls,
      peakHours,
      lowActivityHours,
      maxHourlyCalls,
    }
  }, [leads, archivedLeads, team, selectedDate, currentUser, currentRole, teleAccess, salesAccess, accessibleTeleSheets, accessibleSalesSheets])

  /* ─── Performance Rating ─── */
  const performanceRating = useMemo(() => {
    const { newLeadsCount, callsMadeCount, meetingsCount, attendedCount, closedWonCount } = computed.kpiData
    const score = newLeadsCount * 2 + callsMadeCount * 1.5 + meetingsCount * 2 + attendedCount * 3 + closedWonCount * 5

    if (score >= 50) return { label: 'ممتاز 🌟', color: '#00d4aa', description: 'أداء متميز! استمروا على هذا المستوى.' }
    if (score >= 30) return { label: 'جيد جداً 💪', color: '#6c63ff', description: 'أداء قوي مع إمكانية التحسن أكثر.' }
    if (score >= 15) return { label: 'جيد 📈', color: '#ffd166', description: 'أداء مقبول يحتاج مزيد من الجهد.' }
    if (score >= 5) return { label: 'يحتاج تحسين ⚠️', color: '#ff6b6b', description: 'الأرقام أقل من المتوقع. حاولوا زيادة النشاط.' }
    return { label: 'لا نشاط اليوم 😴', color: '#4a5280', description: 'لم يتم تسجيل أي نشاط لهذا اليوم.' }
  }, [computed.kpiData])

  /* ─── KPI Cards Config ─── */
  const kpis = [
    { icon: <UserPlus size={16} />, color: '#6c63ff', value: computed.kpiData.newLeadsCount, label: 'ليدز جديدة' },
    { icon: <Phone size={16} />, color: '#00d4aa', value: computed.kpiData.callsMadeCount, label: 'مكالمات منفذة' },
    { icon: <Calendar size={16} />, color: '#ffd166', value: computed.kpiData.meetingsCount, label: 'اجتماعات اليوم' },
    { icon: <Check size={16} />, color: '#00d4aa', value: computed.kpiData.attendedCount, label: 'حضور مؤكد' },
    { icon: <X size={16} />, color: '#ff6b6b', value: computed.kpiData.noShowCount, label: 'لم يحضر' },
    { icon: <Trophy size={16} />, color: '#00d4aa', value: computed.kpiData.closedWonCount, label: 'تقفيلات' },
    { icon: <Users size={16} />, color: '#6c63ff', value: computed.kpiData.transferredCount, label: 'تحويلات' },
  ]

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div
      className="space-y-5 animate-in fade-in duration-300"
      style={{ fontFamily: 'Cairo, sans-serif' }}
    >
      {/* ══════════════════════════════════════════════════
          1. HEADER
          ══════════════════════════════════════════════════ */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[20px] md:text-[24px] font-extrabold text-[#f0f2ff]">
              📊 تقرير يومي
            </h1>
            <p className="text-[14px] font-semibold text-[#8892b0] mt-1">ملخص أنشطة اليوم</p>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-[#111520] border border-white/[0.06] rounded-xl px-3 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevDay}
              className="h-8 w-8 text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.05]"
            >
              <ChevronRight size={16} />
            </Button>

            <button
              onClick={goToToday}
              className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <Calendar size={14} className="text-[#6c63ff]" />
              <span className="text-[14px] font-bold text-[#f0f2ff] min-w-[120px] text-center">
                {formatDayLabel(selectedDate)}
              </span>
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextDay}
              disabled={isSelectedToday}
              className="h-8 w-8 text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.05] disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          2. KPI CARDS ROW
          ══════════════════════════════════════════════════ */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}
      >
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className="bg-[#111520] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden hover:-translate-y-0.5 hover:border-white/[0.12] transition-all group"
          >
            {/* Decorative corner */}
            <div
              className="absolute top-0 right-0 w-[56px] h-[56px] rounded-t-2xl rounded-bl-[56px] opacity-[0.07]"
              style={{ background: kpi.color }}
            />
            {/* Icon */}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: `${kpi.color}20`, color: kpi.color }}
            >
              {kpi.icon}
            </div>
            {/* Value */}
            <div
              className="text-[22px] md:text-[24px] font-extrabold leading-tight"
              style={{ color: kpi.color, fontFamily: 'Cairo, sans-serif' }}
            >
              {kpi.value}
            </div>
            {/* Label */}
            <div
              className="text-[14px] font-bold text-[#8892b0] mt-0.5"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          3. MOST ACTIVE EMPLOYEES (Prominent Section)
          ══════════════════════════════════════════════════ */}
      {computed.showTeamSection && computed.topCaller && (
        <div
          className="relative flex items-center gap-4 border rounded-2xl px-5 py-4 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #6c63ff08, #6c63ff03)',
            borderColor: '#6c63ff25',
          }}
        >
          <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full blur-[60px] opacity-20 bg-[#6c63ff]" />
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#6c63ff]/15 text-[#6c63ff]">
            <Zap size={22} />
          </div>
          <div className="flex-1 min-w-0 relative z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[17px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                أكثر الأعضاء نشاطاً
              </span>
            </div>
            <div className="text-[14px] font-bold text-[#6c63ff] mt-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
              👑 {computed.topCaller.name} — {computed.topCaller.calls} مكالمة • {computed.topCaller.newLeads} ليد جديد • {computed.topCaller.meetings} اجتماع
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          4. PEAK & LOW CALL TIMES
          ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Peak Call Times */}
        <Card className="bg-[#111520] border-white/[0.06] rounded-2xl shadow-none">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-[16px] font-extrabold text-[#f0f2ff] flex items-center gap-2"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <Zap size={16} className="text-[#ffd166]" />
              أوقات الذروة
              <span className="text-[12px] font-bold text-[#8892b0] mr-1">الأكثر مكالمات</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {computed.peakHours.length > 0 ? (
              <div className="space-y-2.5">
                {computed.peakHours.map(({ hour, count }) => (
                  <div key={hour} className="flex items-center gap-3">
                    <span
                      className="text-[13px] font-bold text-[#f0f2ff] w-[50px] text-center shrink-0"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {formatHourLabel(hour)}
                    </span>
                    <div className="flex-1 h-7 bg-white/[0.03] rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-500"
                        style={{
                          width: `${Math.max((count / computed.maxHourlyCalls) * 100, 8)}%`,
                          background: 'linear-gradient(90deg, #ffd16640, #ffd166)',
                        }}
                      />
                    </div>
                    <span
                      className="text-[14px] font-extrabold text-[#ffd166] w-[40px] text-center shrink-0"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13px] font-semibold text-[#4a5280] py-6 text-center">
                لا توجد مكالمات مسجلة لهذا اليوم
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Activity Times */}
        <Card className="bg-[#111520] border-white/[0.06] rounded-2xl shadow-none">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-[16px] font-extrabold text-[#f0f2ff] flex items-center gap-2"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <Moon size={16} className="text-[#4a5280]" />
              أوقات الهدوء
              <span className="text-[12px] font-bold text-[#8892b0] mr-1">بدون مكالمات</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {computed.lowActivityHours.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {computed.lowActivityHours.map(({ hour }) => (
                  <div
                    key={hour}
                    className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[13px] font-bold text-[#4a5280]"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    {formatHourLabel(hour)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13px] font-semibold text-[#4a5280] py-6 text-center">
                {computed.kpiData.callsMadeCount > 0
                  ? 'كل ساعات العمل بها نشاط! 🎉'
                  : 'لا توجد مكالمات مسجلة لهذا اليوم'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════
          5. CONTACT RESULT BREAKDOWN
          ══════════════════════════════════════════════════ */}
      {computed.kpiData.callsMadeCount > 0 && (
        <Card className="bg-[#111520] border-white/[0.06] rounded-2xl shadow-none">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-[16px] font-extrabold text-[#f0f2ff] flex items-center gap-2"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <Phone size={16} className="text-[#00d4aa]" />
              تفصيل نتائج التواصل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { label: 'رد', count: computed.kpiData.contactRepliedCount, color: '#00d4aa', emoji: '✅' },
                { label: 'لم يرد', count: computed.kpiData.contactNoReplyCount, color: '#ffd166', emoji: '📵' },
                { label: 'مشغول', count: computed.kpiData.contactBusyCount, color: '#ff6b6b', emoji: '🔴' },
                { label: 'رقم غلط', count: computed.kpiData.contactWrongNumberCount, color: '#ff6b6b', emoji: '❌' },
                { label: 'خدمة عملاء', count: computed.kpiData.contactCustomerServiceCount, color: '#6c63ff', emoji: '🎧' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3 text-center"
                >
                  <div className="text-[18px] mb-1">{item.emoji}</div>
                  <div
                    className="text-[20px] font-extrabold"
                    style={{ color: item.color, fontFamily: 'Cairo, sans-serif' }}
                  >
                    {item.count}
                  </div>
                  <div
                    className="text-[12px] font-bold text-[#8892b0]"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════
          6. TEAM ACTIVITY BREAKDOWN TABLE
          ══════════════════════════════════════════════════ */}
      {computed.showTeamSection && <Card className="bg-[#111520] border-white/[0.06] rounded-2xl shadow-none">
        <CardHeader className="pb-2">
          <CardTitle
            className="text-[16px] font-extrabold text-[#f0f2ff] flex items-center gap-2"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <Users size={16} className="text-[#6c63ff]" />
            تفصيل أداء الفريق
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-[#8892b0] text-[13px] font-bold text-right">العضو</TableHead>
                  <TableHead className="text-[#8892b0] text-[13px] font-bold text-center">الدور</TableHead>
                  <TableHead className="text-[#6c63ff] text-[13px] font-bold text-center">ليدز</TableHead>
                  <TableHead className="text-[#00d4aa] text-[13px] font-bold text-center">مكالمات</TableHead>
                  <TableHead className="text-[#ffd166] text-[13px] font-bold text-center">اجتماعات</TableHead>
                  <TableHead className="text-[#00d4aa] text-[13px] font-bold text-center">حضور</TableHead>
                  <TableHead className="text-[#ffd166] text-[13px] font-bold text-center">تقفيلات</TableHead>
                  <TableHead className="text-[#8892b0] text-[13px] font-bold text-center">المجموع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {computed.teamActivity.length > 0 ? (
                  computed.teamActivity.map((member) => {
                    const isTop = computed.topPerformer && member.name === computed.topPerformer.name && member.total > 0
                    return (
                      <TableRow
                        key={member.name}
                        className={`border-white/[0.04] ${isTop ? 'bg-[#6c63ff]/[0.07]' : 'hover:bg-white/[0.02]'}`}
                      >
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <span
                              className={`text-[14px] font-bold ${isTop ? 'text-[#6c63ff]' : 'text-[#f0f2ff]'}`}
                              style={{ fontFamily: 'Cairo, sans-serif' }}
                            >
                              {member.name}
                            </span>
                            {isTop && <span className="text-[14px]" title="أفضل أداء">👑</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-bold ${
                              member.role === 'tele'
                                ? 'border-[#6c63ff]/30 text-[#6c63ff] bg-[#6c63ff]/10'
                                : 'border-[#ffd166]/30 text-[#ffd166] bg-[#ffd166]/10'
                            }`}
                            style={{ fontFamily: 'Cairo, sans-serif' }}
                          >
                            {member.role === 'tele' ? 'تيلي' : 'مبيعات'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[14px] font-bold text-[#6c63ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>{member.newLeads}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[14px] font-bold text-[#00d4aa]" style={{ fontFamily: 'Cairo, sans-serif' }}>{member.calls}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[14px] font-bold text-[#ffd166]" style={{ fontFamily: 'Cairo, sans-serif' }}>{member.meetings}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[14px] font-bold text-[#00d4aa]" style={{ fontFamily: 'Cairo, sans-serif' }}>{member.attended}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[14px] font-bold text-[#ffd166]" style={{ fontFamily: 'Cairo, sans-serif' }}>{member.closed}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`text-[13px] font-bold ${isTop ? 'text-[#6c63ff]' : 'text-[#f0f2ff]'}`}
                            style={{ fontFamily: 'Cairo, sans-serif' }}
                          >
                            {member.total}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-[#4a5280] text-[13px]">
                      لا يوجد أعضاء في الفريق
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>}

      {/* ══════════════════════════════════════════════════
          7. RECENT ACTIVITIES
          ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ─── New Leads ─── */}
        <div>
          <Card className="bg-[#111520] border-white/[0.06] rounded-2xl shadow-none h-full">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-[14px] font-bold text-[#f0f2ff] flex items-center gap-2"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <UserPlus size={14} className="text-[#6c63ff]" />
                ليدز جديدة
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold border-[#6c63ff]/30 text-[#6c63ff] bg-[#6c63ff]/10 mr-auto"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {computed.kpiData.newLeadsCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                {computed.newLeadActivities.length > 0 ? (
                  computed.newLeadActivities.map((activity) => (
                    <ActivityItem
                      key={activity.id}
                      icon={activity.icon}
                      iconColor={activity.iconColor}
                      title={activity.title}
                      subtitle={activity.subtitle}
                      time={activity.time}
                    />
                  ))
                ) : (
                  <div className="text-[13px] font-semibold text-[#4a5280] py-6 text-center">
                    لا توجد ليدز جديدة لهذا اليوم
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Status Changes / Calls ─── */}
        <div>
          <Card className="bg-[#111520] border-white/[0.06] rounded-2xl shadow-none h-full">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-[14px] font-bold text-[#f0f2ff] flex items-center gap-2"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <Phone size={14} className="text-[#00d4aa]" />
                تغييرات الحالة
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10 mr-auto"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {computed.statusChangeActivities.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                {computed.statusChangeActivities.length > 0 ? (
                  computed.statusChangeActivities.map((activity) => (
                    <ActivityItem
                      key={activity.id}
                      icon={activity.icon}
                      iconColor={activity.iconColor}
                      title={activity.title}
                      subtitle={activity.subtitle}
                      time={activity.time}
                    />
                  ))
                ) : (
                  <div className="text-[13px] font-semibold text-[#4a5280] py-6 text-center">
                    لا توجد تغييرات حالة لهذا اليوم
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Meetings ─── */}
        <div>
          <Card className="bg-[#111520] border-white/[0.06] rounded-2xl shadow-none h-full">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-[14px] font-bold text-[#f0f2ff] flex items-center gap-2"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <Calendar size={14} className="text-[#ffd166]" />
                اجتماعات اليوم
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold border-[#ffd166]/30 text-[#ffd166] bg-[#ffd166]/10 mr-auto"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {computed.kpiData.meetingsCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                {computed.meetingActivities.length > 0 ? (
                  computed.meetingActivities.map((activity) => (
                    <ActivityItem
                      key={activity.id}
                      icon={activity.icon}
                      iconColor={activity.iconColor}
                      title={activity.title}
                      subtitle={activity.subtitle}
                      time={activity.time}
                    />
                  ))
                ) : (
                  <div className="text-[13px] font-semibold text-[#4a5280] py-6 text-center">
                    لا توجد اجتماعات لهذا اليوم
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          8. SUMMARY / PERFORMANCE RATING
          ══════════════════════════════════════════════════ */}
      <div
        className="relative flex items-center gap-4 border rounded-2xl px-5 py-4 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${performanceRating.color}08, ${performanceRating.color}03)`,
          borderColor: `${performanceRating.color}25`,
        }}
      >
        {/* Decorative glow */}
        <div
          className="absolute -top-8 -left-8 w-32 h-32 rounded-full blur-[60px] opacity-20"
          style={{ background: performanceRating.color }}
        />

        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${performanceRating.color}15`, color: performanceRating.color }}
        >
          <BarChart3 size={22} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 relative z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[17px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
              تقييم الأداء:
            </span>
            <span
              className="text-[19px] font-extrabold"
              style={{ color: performanceRating.color, fontFamily: 'Cairo, sans-serif' }}
            >
              {performanceRating.label}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-[#8892b0] mt-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {performanceRating.description}
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-[12px] font-medium text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
              ليدز: {computed.kpiData.newLeadsCount} • مكالمات: {computed.kpiData.callsMadeCount} • اجتماعات: {computed.kpiData.meetingsCount} • تحويلات: {computed.kpiData.transferredCount} • تقفيلات: {computed.kpiData.closedWonCount}
            </span>
          </div>
        </div>

        {/* Trend indicator */}
        <div
          className="flex items-center gap-1.5 shrink-0 relative z-10"
          style={{ color: performanceRating.color }}
        >
          <TrendingUp size={18} />
          <span className="text-[14px] font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {computed.kpiData.newLeadsCount + computed.kpiData.callsMadeCount + computed.kpiData.meetingsCount + computed.kpiData.closedWonCount > 0 ? 'نشط' : 'هادئ'}
          </span>
        </div>
      </div>
    </div>
  )
}
