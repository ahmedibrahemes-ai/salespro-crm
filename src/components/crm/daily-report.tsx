'use client'

import { useMemo, useState } from 'react'
import { useCrmStore, STATUSES, SALES_STATUSES, CONTACT_RESULTS, formatDate, formatRelativeTime } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { motion } from 'framer-motion'
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

function isToday(timestamp: number): boolean {
  if (!timestamp) return false
  const d = new Date(timestamp)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

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
  const meetingDateStr = lead.meetingDate // format: YYYY-MM-DD
  const selectedStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return meetingDateStr === selectedStr
}

function getStatusLabel(key: string): string {
  const teleStatus = STATUSES.find((s) => s.key === key)
  if (teleStatus) return teleStatus.label
  const salesStatus = SALES_STATUSES.find((s) => s.key === key)
  if (salesStatus) return salesStatus.label
  return key
}

function getContactResultLabel(key: string): string {
  const cr = CONTACT_RESULTS.find((c) => c.key === key)
  return cr ? cr.label : key
}

/* ═══════════════════════════════════════════════════════
   Animation variants
   ═══════════════════════════════════════════════════════ */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
} as const

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

/* ═══════════════════════════════════════════════════════
   KPI Card Component
   ═══════════════════════════════════════════════════════ */

interface KpiCardProps {
  icon: React.ReactNode
  color: string
  value: number | string
  label: string
}

function KpiCard({ icon, color, value, label }: KpiCardProps) {
  return (
    <div
      className="bg-[#111520] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden hover:-translate-y-0.5 hover:border-white/[0.12] transition-all group"
    >
      {/* Decorative corner */}
      <div
        className="absolute top-0 right-0 w-[56px] h-[56px] rounded-t-2xl rounded-bl-[56px] opacity-[0.07]"
        style={{ background: color }}
      />

      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
        style={{ background: `${color}20`, color }}
      >
        {icon}
      </div>

      {/* Value */}
      <div
        className="text-[24px] md:text-[26px] font-extrabold leading-tight"
        style={{ color, fontFamily: 'Cairo, sans-serif' }}
      >
        {value}
      </div>

      {/* Label */}
      <div
        className="text-[12px] text-[#8892b0] mt-0.5"
        style={{ fontFamily: 'Cairo, sans-serif' }}
      >
        {label}
      </div>
    </div>
  )
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
          className="text-[13px] font-semibold text-[#f0f2ff] truncate"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {title}
        </div>
        <div
          className="text-[11px] text-[#8892b0] truncate"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {subtitle}
        </div>
      </div>
      <div
        className="text-[10px] text-[#4a5280] shrink-0"
        style={{ fontFamily: 'Cairo, sans-serif' }}
      >
        {time}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   DailyReport Component
   ═══════════════════════════════════════════════════════ */

export function DailyReport() {
  const { leads, archivedLeads, team, currentUser, currentRole } = useCrmStore()

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

  /* ─── All leads (active + archived) ─── */
  const allLeads = useMemo(() => {
    return [...leads, ...archivedLeads]
  }, [leads, archivedLeads])

  /* ─── Leads for selected day ─── */
  const dayLeads = useMemo(() => {
    return allLeads.filter((l) => isSameDay(l.createdAt, selectedDate) || isMeetingToday(l, selectedDate))
  }, [allLeads, selectedDate])

  /* ─── KPI Calculations ─── */
  const kpiData = useMemo(() => {
    // New leads created on selected date
    const newLeadsCount = allLeads.filter((l) => isSameDay(l.createdAt, selectedDate)).length

    // Calls made on selected date (leads with contactResult set on that day)
    const callsMadeCount = allLeads.filter(
      (l) => l.contactResultAt && isSameDay(l.contactResultAt, selectedDate) && l.contactResult && l.contactResult !== 'none' && l.contactResult !== ''
    ).length

    // Today's meetings (meeting date matches selected date)
    const meetingsCount = allLeads.filter((l) => isMeetingToday(l, selectedDate)).length

    // Attended today
    const attendedCount = allLeads.filter(
      (l) => isMeetingToday(l, selectedDate) && l.attended === 'attended'
    ).length

    // No-show today
    const noShowCount = allLeads.filter(
      (l) => isMeetingToday(l, selectedDate) && l.attended === 'no-show'
    ).length

    // Closed won today (attendanceMarkedAt or status change on selected day)
    const closedWonCount = allLeads.filter(
      (l) => l.attendanceMarkedAt && isSameDay(l.attendanceMarkedAt, selectedDate) && l.status === 'closed-won'
    ).length

    return { newLeadsCount, callsMadeCount, meetingsCount, attendedCount, noShowCount, closedWonCount }
  }, [allLeads, selectedDate])

  /* ─── Team Activity Breakdown ─── */
  const teamActivity = useMemo(() => {
    const allMembers = [...team.tele.map((n) => ({ name: n, role: 'tele' })), ...team.sales.map((n) => ({ name: n, role: 'sales' }))]

    const activity = allMembers.map((member) => {
      const memberLeads = allLeads.filter((l) => {
        if (member.role === 'tele') return l.tele === member.name
        if (member.role === 'sales') return l.sales === member.name
        return false
      })

      const newLeads = memberLeads.filter((l) => isSameDay(l.createdAt, selectedDate)).length
      const calls = memberLeads.filter(
        (l) => l.contactResultAt && isSameDay(l.contactResultAt, selectedDate) && l.contactResult && l.contactResult !== 'none' && l.contactResult !== ''
      ).length
      const meetings = memberLeads.filter((l) => isMeetingToday(l, selectedDate)).length
      const attended = memberLeads.filter(
        (l) => isMeetingToday(l, selectedDate) && l.attended === 'attended'
      ).length
      const closed = memberLeads.filter(
        (l) => l.attendanceMarkedAt && isSameDay(l.attendanceMarkedAt, selectedDate) && l.status === 'closed-won'
      ).length

      const total = newLeads + calls + meetings + attended + closed

      return { ...member, newLeads, calls, meetings, attended, closed, total }
    })

    // Sort by total descending
    activity.sort((a, b) => b.total - a.total)

    return activity
  }, [allLeads, selectedDate, team])

  const topPerformer = useMemo(() => {
    if (teamActivity.length === 0) return null
    return teamActivity[0].total > 0 ? teamActivity[0] : null
  }, [teamActivity])

  /* ─── Recent Activities ─── */
  const recentActivities = useMemo(() => {
    const activities: Array<{
      id: string
      type: 'new-lead' | 'status-change' | 'meeting-booked' | 'closed-won' | 'attendance'
      icon: React.ReactNode
      iconColor: string
      title: string
      subtitle: string
      time: string
      timestamp: number
    }> = []

    for (const lead of allLeads) {
      // New leads added today
      if (isSameDay(lead.createdAt, selectedDate)) {
        activities.push({
          id: `new-${lead.id}`,
          type: 'new-lead',
          icon: <UserPlus size={14} />,
          iconColor: '#6c63ff',
          title: `ليد جديد: ${lead.customerName || lead.phone || 'عميل'}`,
          subtitle: `بواسطة ${lead.tele || '—'}${lead.storeUrl ? ` • ${lead.storeUrl}` : ''}`,
          time: formatRelativeTime(lead.createdAt),
          timestamp: lead.createdAt,
        })
      }

      // Status changes / contact result changes
      if (lead.contactResultAt && isSameDay(lead.contactResultAt, selectedDate)) {
        const isCall = lead.contactResult && lead.contactResult !== 'none' && lead.contactResult !== ''
        if (isCall) {
          activities.push({
            id: `call-${lead.id}`,
            type: 'status-change',
            icon: <Phone size={14} />,
            iconColor: '#00d4aa',
            title: `مكالمة: ${lead.customerName || lead.phone || 'عميل'}`,
            subtitle: `${getContactResultLabel(lead.contactResult)} • ${lead.tele || '—'}`,
            time: formatRelativeTime(lead.contactResultAt),
            timestamp: lead.contactResultAt,
          })
        }
      }

      // Meetings booked today
      if (isMeetingToday(lead, selectedDate)) {
        activities.push({
          id: `meeting-${lead.id}`,
          type: 'meeting-booked',
          icon: <Calendar size={14} />,
          iconColor: '#ffd166',
          title: `اجتماع: ${lead.customerName || lead.phone || 'عميل'}`,
          subtitle: `${lead.meetingTime || '—'} • حضور: ${lead.attended === 'attended' ? '✅ حضر' : lead.attended === 'no-show' ? '❌ لم يحضر' : '⏳ انتظار'}`,
          time: lead.meetingTime || formatDate(lead.createdAt),
          timestamp: lead.createdAt,
        })
      }

      // Closed won
      if (lead.attendanceMarkedAt && isSameDay(lead.attendanceMarkedAt, selectedDate) && lead.status === 'closed-won') {
        activities.push({
          id: `won-${lead.id}`,
          type: 'closed-won',
          icon: <Trophy size={14} />,
          iconColor: '#00d4aa',
          title: `🏆 تقفيل: ${lead.customerName || lead.phone || 'عميل'}`,
          subtitle: `بواسطة ${lead.sales || lead.tele || '—'}`,
          time: formatRelativeTime(lead.attendanceMarkedAt),
          timestamp: lead.attendanceMarkedAt,
        })
      }

      // Attendance marked
      if (lead.attendanceMarkedAt && isSameDay(lead.attendanceMarkedAt, selectedDate) && lead.attended) {
        const isAttended = lead.attended === 'attended'
        activities.push({
          id: `attend-${lead.id}`,
          type: 'attendance',
          icon: isAttended ? <Check size={14} /> : <X size={14} />,
          iconColor: isAttended ? '#00d4aa' : '#ff6b6b',
          title: `${isAttended ? '✅ حضر' : '❌ لم يحضر'}: ${lead.customerName || lead.phone || 'عميل'}`,
          subtitle: `تم التسجيل بواسطة ${lead.attendanceMarkedBy || '—'}`,
          time: formatRelativeTime(lead.attendanceMarkedAt),
          timestamp: lead.attendanceMarkedAt,
        })
      }
    }

    // Sort by timestamp descending (most recent first)
    activities.sort((a, b) => b.timestamp - a.timestamp)

    return activities.slice(0, 50)
  }, [allLeads, selectedDate])

  /* ─── Categorized Activities ─── */
  const categorizedActivities = useMemo(() => {
    const newLeads = recentActivities.filter((a) => a.type === 'new-lead')
    const statusChanges = recentActivities.filter((a) => a.type === 'status-change' || a.type === 'attendance' || a.type === 'closed-won')
    const meetings = recentActivities.filter((a) => a.type === 'meeting-booked')
    return { newLeads, statusChanges, meetings }
  }, [recentActivities])

  /* ─── Performance Rating ─── */
  const performanceRating = useMemo(() => {
    const { newLeadsCount, callsMadeCount, meetingsCount, attendedCount, closedWonCount } = kpiData
    const score = newLeadsCount * 2 + callsMadeCount * 1.5 + meetingsCount * 2 + attendedCount * 3 + closedWonCount * 5

    if (score >= 50) return { label: 'ممتاز 🌟', color: '#00d4aa', description: 'أداء متميز! استمروا على هذا المستوى.' }
    if (score >= 30) return { label: 'جيد جداً 💪', color: '#6c63ff', description: 'أداء قوي مع إمكانية التحسن أكثر.' }
    if (score >= 15) return { label: 'جيد 📈', color: '#ffd166', description: 'أداء مقبول يحتاج مزيد من الجهد.' }
    if (score >= 5) return { label: 'يحتاج تحسين ⚠️', color: '#ff6b6b', description: 'الأرقام أقل من المتوقع. حاولوا زيادة النشاط.' }
    return { label: 'لا نشاط اليوم 😴', color: '#4a5280', description: 'لم يتم تسجيل أي نشاط لهذا اليوم.' }
  }, [kpiData])

  /* ─── KPI Cards Config ─── */
  const kpis = [
    {
      icon: <UserPlus size={16} />,
      color: '#6c63ff',
      value: kpiData.newLeadsCount,
      label: 'ليدز جديدة',
    },
    {
      icon: <Phone size={16} />,
      color: '#00d4aa',
      value: kpiData.callsMadeCount,
      label: 'مكالمات منفذة',
    },
    {
      icon: <Calendar size={16} />,
      color: '#ffd166',
      value: kpiData.meetingsCount,
      label: 'اجتماعات اليوم',
    },
    {
      icon: <Check size={16} />,
      color: '#00d4aa',
      value: kpiData.attendedCount,
      label: 'حضور مؤكد',
    },
    {
      icon: <X size={16} />,
      color: '#ff6b6b',
      value: kpiData.noShowCount,
      label: 'لم يحضر',
    },
    {
      icon: <Trophy size={16} />,
      color: '#00d4aa',
      value: kpiData.closedWonCount,
      label: 'تقفيلات',
    },
  ]

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
      style={{ fontFamily: 'Cairo, sans-serif' }}
    >
      {/* ══════════════════════════════════════════════════
          1. HEADER
          ══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[22px] md:text-[26px] font-extrabold text-[#f0f2ff]">
              📊 تقرير يومي
            </h1>
            <p className="text-[13px] text-[#8892b0] mt-1">ملخص أنشطة اليوم</p>
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
              <span className="text-[13px] font-semibold text-[#f0f2ff] min-w-[120px] text-center">
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
      </motion.div>

      {/* ══════════════════════════════════════════════════
          2. KPI CARDS ROW
          ══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}
      >
        {kpis.map((kpi, i) => (
          <KpiCard
            key={i}
            icon={kpi.icon}
            color={kpi.color}
            value={kpi.value}
            label={kpi.label}
          />
        ))}
      </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════
          3. TEAM ACTIVITY BREAKDOWN TABLE
          ══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
        <Card className="bg-[#111520] border-white/[0.06] rounded-2xl shadow-none">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-[14px] font-semibold text-[#f0f2ff] flex items-center gap-2"
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
                    <TableHead className="text-[#8892b0] text-[12px] font-semibold text-right">
                      العضو
                    </TableHead>
                    <TableHead className="text-[#8892b0] text-[12px] font-semibold text-center">
                      الدور
                    </TableHead>
                    <TableHead className="text-[#6c63ff] text-[12px] font-semibold text-center">
                      ليدز
                    </TableHead>
                    <TableHead className="text-[#00d4aa] text-[12px] font-semibold text-center">
                      مكالمات
                    </TableHead>
                    <TableHead className="text-[#ffd166] text-[12px] font-semibold text-center">
                      اجتماعات
                    </TableHead>
                    <TableHead className="text-[#00d4aa] text-[12px] font-semibold text-center">
                      حضور
                    </TableHead>
                    <TableHead className="text-[#ffd166] text-[12px] font-semibold text-center">
                      تقفيلات
                    </TableHead>
                    <TableHead className="text-[#8892b0] text-[12px] font-semibold text-center">
                      المجموع
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamActivity.length > 0 ? (
                    teamActivity.map((member, idx) => {
                      const isTop = topPerformer && member.name === topPerformer.name && member.total > 0
                      return (
                        <TableRow
                          key={member.name}
                          className={`border-white/[0.04] ${isTop ? 'bg-[#6c63ff]/[0.07]' : 'hover:bg-white/[0.02]'}`}
                        >
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <span
                                className={`text-[13px] font-semibold ${isTop ? 'text-[#6c63ff]' : 'text-[#f0f2ff]'}`}
                                style={{ fontFamily: 'Cairo, sans-serif' }}
                              >
                                {member.name}
                              </span>
                              {isTop && (
                                <span className="text-[14px]" title="أفضل أداء">
                                  👑
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${
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
                            <span className="text-[13px] font-semibold text-[#6c63ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                              {member.newLeads}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-[13px] font-semibold text-[#00d4aa]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                              {member.calls}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-[13px] font-semibold text-[#ffd166]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                              {member.meetings}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-[13px] font-semibold text-[#00d4aa]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                              {member.attended}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-[13px] font-semibold text-[#ffd166]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                              {member.closed}
                            </span>
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
        </Card>
      </motion.div>

      {/* ══════════════════════════════════════════════════
          4. RECENT ACTIVITIES
          ══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ─── New Leads ─── */}
        <div>
          <Card className="bg-[#111520] border-white/[0.06] rounded-2xl shadow-none h-full">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-[13px] font-semibold text-[#f0f2ff] flex items-center gap-2"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <UserPlus size={14} className="text-[#6c63ff]" />
                ليدز جديدة
                <Badge
                  variant="outline"
                  className="text-[10px] border-[#6c63ff]/30 text-[#6c63ff] bg-[#6c63ff]/10 mr-auto"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {kpiData.newLeadsCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                {categorizedActivities.newLeads.length > 0 ? (
                  categorizedActivities.newLeads
                    .map((activity) => (
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
                  <div className="text-[12px] text-[#4a5280] py-6 text-center">
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
                className="text-[13px] font-semibold text-[#f0f2ff] flex items-center gap-2"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <Phone size={14} className="text-[#00d4aa]" />
                تغييرات الحالة
                <Badge
                  variant="outline"
                  className="text-[10px] border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10 mr-auto"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {categorizedActivities.statusChanges.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                {categorizedActivities.statusChanges.length > 0 ? (
                  categorizedActivities.statusChanges
                    .map((activity) => (
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
                  <div className="text-[12px] text-[#4a5280] py-6 text-center">
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
                className="text-[13px] font-semibold text-[#f0f2ff] flex items-center gap-2"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <Calendar size={14} className="text-[#ffd166]" />
                اجتماعات اليوم
                <Badge
                  variant="outline"
                  className="text-[10px] border-[#ffd166]/30 text-[#ffd166] bg-[#ffd166]/10 mr-auto"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {kpiData.meetingsCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                {categorizedActivities.meetings.length > 0 ? (
                  categorizedActivities.meetings
                    .map((activity) => (
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
                  <div className="text-[12px] text-[#4a5280] py-6 text-center">
                    لا توجد اجتماعات لهذا اليوم
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════
          5. SUMMARY / PERFORMANCE RATING
          ══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
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
              <span className="text-[16px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                تقييم الأداء:
              </span>
              <span
                className="text-[18px] font-extrabold"
                style={{ color: performanceRating.color, fontFamily: 'Cairo, sans-serif' }}
              >
                {performanceRating.label}
              </span>
            </div>
            <div className="text-[12px] text-[#8892b0] mt-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
              {performanceRating.description}
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="text-[11px] text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                ليدز: {kpiData.newLeadsCount} • مكالمات: {kpiData.callsMadeCount} • اجتماعات: {kpiData.meetingsCount} • تقفيلات: {kpiData.closedWonCount}
              </span>
            </div>
          </div>

          {/* Trend indicator */}
          <div
            className="flex items-center gap-1.5 shrink-0 relative z-10"
            style={{ color: performanceRating.color }}
          >
            <TrendingUp size={18} />
            <span className="text-[13px] font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
              {kpiData.newLeadsCount + kpiData.callsMadeCount + kpiData.meetingsCount + kpiData.closedWonCount > 0 ? 'نشط' : 'هادئ'}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
