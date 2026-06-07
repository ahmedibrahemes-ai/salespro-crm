'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Phone,
  ArrowRightLeft,
  Calendar,
  Trophy,
  Archive,
  Shield,
  Clock,
  TrendingUp,
  UserCheck,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import { useCrmStore } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { formatDate, formatRelativeTime, getAllLeadsForAnalytics } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ===== Animated Counter =====
function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (hasAnimated.current) return
    hasAnimated.current = true

    let start = 0
    const increment = target / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {count}
    </span>
  )
}

// ===== Stat Card =====
interface StatCardProps {
  icon: React.ReactNode
  value: number
  label: string
  accentColor: string
  glowColor: string
  index?: number
}

function StatCard({ icon, value, label, accentColor, glowColor, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: 'easeOut' }}
      whileHover={{ scale: 1.02 }}
      className="group"
    >
      <Card className="bg-card border border-border hover:border-venom/30 transition-all duration-300 overflow-hidden relative">
        {/* Subtle glow on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 70%)`,
          }}
        />
        <CardContent className="p-5 relative z-10">
          <div className="flex items-center gap-4">
            {/* Icon circle */}
            <div
              className="flex items-center justify-center w-12 h-12 rounded-full shrink-0"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <div style={{ color: accentColor }}>{icon}</div>
            </div>
            {/* Value and label */}
            <div className="flex-1 min-w-0">
              <div className="text-3xl font-bold tracking-tight" style={{ color: accentColor }}>
                <AnimatedCounter target={value} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ===== Activity Timeline Item =====
function ActivityItem({ lead, index }: { lead: Lead; index: number }) {
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'closed-won':
        return { color: '#10B981', label: 'تقفيل' }
      case 'meeting-done':
        return { color: '#00FF88', label: 'اجتماع' }
      case 'new':
        return { color: '#00FF88', label: 'جديد' }
      case 'followup':
        return { color: '#F59E0B', label: 'متابعة' }
      case 'closed-lost':
        return { color: '#EF4444', label: 'خسارة' }
      default:
        return { color: '#8B5CF6', label: status }
    }
  }

  const info = getStatusInfo(lead.status)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: info.color, boxShadow: `0 0 8px ${info.color}40` }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{lead.customerName || lead.storeUrl}</p>
        <p className="text-xs text-muted-foreground">{info.label}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatRelativeTime(lead.createdAt)}
      </span>
    </motion.div>
  )
}

// ===== Upcoming Meeting Card =====
function MeetingCard({ lead, index }: { lead: Lead; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      <Card className="bg-card border border-border hover:border-venom/20 transition-colors duration-300">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{lead.customerName || lead.storeUrl}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Clock className="w-3.5 h-3.5 text-venom" />
                <span className="text-xs text-muted-foreground">{lead.meetingTime}</span>
              </div>
              {lead.meetingType && (
                <Badge variant="secondary" className="mt-2 text-[10px]">
                  {lead.meetingType}
                </Badge>
              )}
            </div>
            <div className="text-left shrink-0">
              <p className="text-xs text-muted-foreground">{lead.meetingDate}</p>
              {lead.sales && (
                <p className="text-xs text-venom mt-1">{lead.sales}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ===== Team Member Mini Card =====
function TeamMemberCard({
  name,
  leadsCount,
  color,
  index,
}: {
  name: string
  leadsCount: number
  color: string
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="bg-card border border-border hover:border-venom/20 transition-colors duration-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {name.charAt(0)}
              </div>
              <span className="text-sm truncate">{name}</span>
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color }}>
              {leadsCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ===== Helper Functions =====
function isToday(ts: number | null): boolean {
  if (!ts) return false
  const d = new Date(ts)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function isUpcoming(lead: Lead): boolean {
  if (!lead.meetingDate) return false
  const meetingDate = new Date(lead.meetingDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  meetingDate.setHours(0, 0, 0, 0)
  return meetingDate >= today && lead.status !== 'closed-won' && lead.status !== 'closed-lost'
}

function getLast7DaysData(allLeads: Lead[]) {
  const days: { name: string; leads: number; calls: number }[] = []
  const dayNames = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']

  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const dayEnd = dayStart + 86400000

    const leadsCount = allLeads.filter((l) => l.createdAt >= dayStart && l.createdAt < dayEnd).length
    const callsCount = allLeads.filter(
      (l) => l.contactResultAt && l.contactResultAt >= dayStart && l.contactResultAt < dayEnd
    ).length

    days.push({
      name: dayNames[date.getDay()],
      leads: leadsCount,
      calls: callsCount,
    })
  }
  return days
}

// ===== TELE SALES Dashboard =====
function TeleDashboard({ userName, leads, archivedLeads }: { userName: string; leads: Lead[]; archivedLeads: Lead[] }) {
  const myLeads = leads.filter((l) => l.tele === userName)
  const allMyLeads = getAllLeadsForAnalytics(myLeads, archivedLeads.filter((l) => l.tele === userName))

  const totalLeads = myLeads.length
  const callsToday = myLeads.filter((l) => l.contactResult && isToday(l.contactResultAt)).length
  const transfersToday = myLeads.filter(
    (l) => l.sales && isToday(l.assignedAt)
  ).length
  const upcomingMeetings = myLeads.filter(isUpcoming)

  const recentActivity = [...myLeads]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold venom-text-glow">
          أهلاً {userName} 🐍
        </h1>
        <p className="text-muted-foreground mt-1">لوحة تحكم التلي ماركتينج</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          value={totalLeads}
          label="إجمالي العملاء"
          accentColor="#00FF88"
          glowColor="rgba(0,255,136,0.06)"
          index={0}
        />
        <StatCard
          icon={<Phone className="w-5 h-5" />}
          value={callsToday}
          label="مكالمات اليوم"
          accentColor="#8B5CF6"
          glowColor="rgba(139,92,246,0.06)"
          index={1}
        />
        <StatCard
          icon={<ArrowRightLeft className="w-5 h-5" />}
          value={transfersToday}
          label="تحويلات اليوم"
          accentColor="#F59E0B"
          glowColor="rgba(245,158,11,0.06)"
          index={2}
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          value={upcomingMeetings.length}
          label="اجتماعات قادمة"
          accentColor="#10B981"
          glowColor="rgba(16,185,129,0.06)"
          index={3}
        />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-venom" />
              آخر الأنشطة
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد أنشطة بعد</p>
            ) : (
              recentActivity.map((lead, i) => (
                <ActivityItem key={lead.id} lead={lead} index={i} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming Meetings */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-venom-purple" />
              اجتماعات قادمة
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-3">
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد اجتماعات قادمة</p>
            ) : (
              upcomingMeetings.map((lead, i) => (
                <MeetingCard key={lead.id} lead={lead} index={i} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ===== SALES Dashboard =====
function SalesDashboard({ userName, leads, archivedLeads }: { userName: string; leads: Lead[]; archivedLeads: Lead[] }) {
  const myLeads = leads.filter((l) => l.sales === userName)

  const totalMyLeads = myLeads.length
  const upcomingMeetings = myLeads.filter(isUpcoming)
  const attendedToday = myLeads.filter(
    (l) => l.attended === 'attended' && isToday(l.attendanceMarkedAt)
  ).length
  const closedWon = myLeads.filter((l) => l.salesStatus === 'closed-won').length

  const recentAssigned = [...myLeads]
    .sort((a, b) => (b.assignedAt || 0) - (a.assignedAt || 0))
    .slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold venom-text-glow">
          أهلاً {userName} 🐍
        </h1>
        <p className="text-muted-foreground mt-1">لوحة تحكم المبيعات</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          value={totalMyLeads}
          label="عملائي"
          accentColor="#00FF88"
          glowColor="rgba(0,255,136,0.06)"
          index={0}
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          value={upcomingMeetings.length}
          label="اجتماعات قادمة"
          accentColor="#8B5CF6"
          glowColor="rgba(139,92,246,0.06)"
          index={1}
        />
        <StatCard
          icon={<UserCheck className="w-5 h-5" />}
          value={attendedToday}
          label="حضور اليوم"
          accentColor="#F59E0B"
          glowColor="rgba(245,158,11,0.06)"
          index={2}
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          value={closedWon}
          label="تقفيلات"
          accentColor="#10B981"
          glowColor="rgba(16,185,129,0.06)"
          index={3}
        />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Meetings */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-venom-purple" />
              اجتماعات قادمة
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-3">
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد اجتماعات قادمة</p>
            ) : (
              upcomingMeetings.map((lead, i) => (
                <MeetingCard key={lead.id} lead={lead} index={i} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Assigned Leads */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-400" />
              آخر العملاء المحولين
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {recentAssigned.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد عملاء محولين</p>
            ) : (
              recentAssigned.map((lead, i) => (
                <ActivityItem key={lead.id} lead={lead} index={i} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ===== ADMIN Dashboard =====
function AdminDashboard({ userName, leads, archivedLeads, team }: { userName: string; leads: Lead[]; archivedLeads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const allLeads = getAllLeadsForAnalytics(leads, archivedLeads)

  const totalLeads = leads.length
  const callsToday = leads.filter((l) => l.contactResult && isToday(l.contactResultAt)).length
  const transfersToday = leads.filter((l) => l.sales && isToday(l.assignedAt)).length
  const attendedToday = leads.filter((l) => l.attended === 'attended' && isToday(l.attendanceMarkedAt)).length
  const closedWon = leads.filter((l) => l.salesStatus === 'closed-won').length
  const totalArchived = archivedLeads.length

  const chartData = getLast7DaysData(allLeads)

  // Recent transfers (leads assigned to sales today)
  const recentTransfers = [...leads]
    .filter((l) => l.sales)
    .sort((a, b) => (b.assignedAt || 0) - (a.assignedAt || 0))
    .slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-3"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold venom-text-glow">
            أهلاً {userName} 🐍
          </h1>
          <p className="text-muted-foreground mt-1">لوحة تحكم المدير</p>
        </div>
        <Badge className="bg-venom/15 text-venom border-venom/30 mr-auto">
          <Shield className="w-3 h-3 ml-1" />
          مدير
        </Badge>
      </motion.div>

      {/* Stats Grid - 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          value={totalLeads}
          label="إجمالي العملاء"
          accentColor="#00FF88"
          glowColor="rgba(0,255,136,0.06)"
          index={0}
        />
        <StatCard
          icon={<Phone className="w-5 h-5" />}
          value={callsToday}
          label="مكالمات اليوم"
          accentColor="#8B5CF6"
          glowColor="rgba(139,92,246,0.06)"
          index={1}
        />
        <StatCard
          icon={<ArrowRightLeft className="w-5 h-5" />}
          value={transfersToday}
          label="تحويلات اليوم"
          accentColor="#F59E0B"
          glowColor="rgba(245,158,11,0.06)"
          index={2}
        />
        <StatCard
          icon={<UserCheck className="w-5 h-5" />}
          value={attendedToday}
          label="حضور اليوم"
          accentColor="#10B981"
          glowColor="rgba(16,185,129,0.06)"
          index={3}
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          value={closedWon}
          label="تقفيلات"
          accentColor="#06B6D4"
          glowColor="rgba(6,182,212,0.06)"
          index={4}
        />
        <StatCard
          icon={<Archive className="w-5 h-5" />}
          value={totalArchived}
          label="إجمالي الأرشيف"
          accentColor="#F43F5E"
          glowColor="rgba(244,63,94,0.06)"
          index={5}
        />
      </div>

      {/* Chart + Team Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mini Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-venom" />
                النشاط اليومي (آخر 7 أيام)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="venomGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00FF88" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#00FF88" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6b8f7b' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6b8f7b' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a1410',
                        border: '1px solid #1a2e22',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#e8f5ee',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke="#00FF88"
                      strokeWidth={2}
                      fill="url(#venomGradient)"
                      name="عملاء"
                    />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      fill="url(#purpleGradient)"
                      name="مكالمات"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-venom" />
                أداء الفريق
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[260px] overflow-y-auto">
              {/* Tele team */}
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">فريق التلي</p>
                <div className="space-y-2">
                  {team.tele.map((name, i) => {
                    const memberLeads = leads.filter((l) => l.tele === name).length
                    return (
                      <TeamMemberCard
                        key={name}
                        name={name}
                        leadsCount={memberLeads}
                        color="#00FF88"
                        index={i}
                      />
                    )
                  })}
                </div>
              </div>
              {/* Sales team */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">فريق المبيعات</p>
                <div className="space-y-2">
                  {team.sales.map((name, i) => {
                    const memberLeads = leads.filter((l) => l.sales === name).length
                    return (
                      <TeamMemberCard
                        key={name}
                        name={name}
                        leadsCount={memberLeads}
                        color="#8B5CF6"
                        index={i + team.tele.length}
                      />
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Transfers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-400" />
              آخر التحويلات
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {recentTransfers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد تحويلات</p>
            ) : (
              recentTransfers.map((lead, i) => (
                <ActivityItem key={lead.id} lead={lead} index={i} />
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ===== Main Dashboard Component =====
export default function Dashboard() {
  const { currentUser, currentRole, leads, archivedLeads, team } = useCrmStore()

  if (!currentUser || !currentRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">يرجى تسجيل الدخول</p>
      </div>
    )
  }

  return (
    <div className="snake-pattern p-4 md:p-6 lg:p-8">
      {currentRole === 'tele' && (
        <TeleDashboard userName={currentUser} leads={leads} archivedLeads={archivedLeads} />
      )}
      {currentRole === 'sales' && (
        <SalesDashboard userName={currentUser} leads={leads} archivedLeads={archivedLeads} />
      )}
      {currentRole === 'admin' && (
        <AdminDashboard
          userName={currentUser}
          leads={leads}
          archivedLeads={archivedLeads}
          team={team}
        />
      )}
    </div>
  )
}
