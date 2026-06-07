'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  User,
  Filter,
  CheckCircle2,
  XCircle,
  Hourglass,
  ExternalLink,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

// ===== Date filter options =====
const DATE_FILTERS = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'هذا الأسبوع' },
  { key: 'all', label: 'الكل' },
  { key: 'custom', label: 'تاريخ محدد' },
]

// ===== Attendance border color =====
function getAttendanceBorder(attended: string | null): string {
  if (attended === 'attended') return 'border-r-emerald-500'
  if (attended === 'no-show') return 'border-r-red-500'
  return 'border-r-amber-400'
}

function getAttendanceIcon(attended: string | null) {
  if (attended === 'attended') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
  if (attended === 'no-show') return <XCircle className="w-4 h-4 text-red-400" />
  return <Hourglass className="w-4 h-4 text-amber-400" />
}

function getAttendanceLabel(attended: string | null): string {
  const found = ATTENDANCE_STATUSES.find((s) => s.key === attended)
  return found ? found.label : '—'
}

// ===== Main Component =====
export function MyMeetings() {
  const { currentUser, leads, archivedLeads } = useCrmStore()
  const [dateFilter, setDateFilter] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Get all leads for current tele user with meetings
  const allLeads = useMemo(() => getAllLeadsForAnalytics(leads, archivedLeads), [leads, archivedLeads])

  const myMeetingLeads = useMemo(() => {
    if (!currentUser) return []
    return allLeads.filter(
      (l) => l.tele === currentUser && l.meetingDate && l.meetingDate.trim() !== ''
    )
  }, [allLeads, currentUser])

  // Apply date filter
  const filteredMeetings = useMemo(() => {
    const { from, to } = getDateRange(dateFilter, customFrom, customTo)

    return myMeetingLeads.filter((l) => {
      if (!l.meetingDate) return false
      const meetingTs = new Date(l.meetingDate).getTime()
      return meetingTs >= from && meetingTs < to
    })
  }, [myMeetingLeads, dateFilter, customFrom, customTo])

  // Stats
  const stats = useMemo(() => {
    const total = filteredMeetings.length
    const attended = filteredMeetings.filter((l) => l.attended === 'attended').length
    const noShow = filteredMeetings.filter((l) => l.attended === 'no-show').length
    const upcoming = filteredMeetings.filter((l) => {
      if (!l.meetingDate) return false
      const meetingDate = new Date(l.meetingDate)
      meetingDate.setHours(23, 59, 59, 999)
      return meetingDate.getTime() >= Date.now() && l.attended !== 'attended' && l.attended !== 'no-show'
    }).length
    return { total, attended, noShow, upcoming }
  }, [filteredMeetings])

  if (!currentUser) return null

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold venom-text-glow text-venom">اجتماعاتي</h1>
        <p className="text-muted-foreground mt-1">متابعة جميع اجتماعاتك مع العملاء</p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الاجتماعات', value: stats.total, icon: Calendar, color: '#00FF88' },
          { label: 'حضر', value: stats.attended, icon: CheckCircle2, color: '#10B981' },
          { label: 'لم يحضر', value: stats.noShow, icon: XCircle, color: '#EF4444' },
          { label: 'قادمة', value: stats.upcoming, icon: Hourglass, color: '#F59E0B' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            whileHover={{ scale: 1.03 }}
          >
            <Card className="bg-card border border-border hover:border-venom/30 transition-all duration-300 relative overflow-hidden group">
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at center, ${stat.color}10 0%, transparent 70%)` }}
              />
              <CardContent className="p-5 relative z-10">
                <div className="flex items-center gap-4">
                  <div
                    className="flex items-center justify-center w-11 h-11 rounded-full shrink-0"
                    style={{ backgroundColor: `${stat.color}15` }}
                  >
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: stat.color }}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Date Filter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="flex flex-wrap items-center gap-3"
      >
        <Filter className="w-4 h-4 text-venom" />
        {DATE_FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={dateFilter === f.key ? 'default' : 'outline'}
            size="sm"
            className={
              dateFilter === f.key
                ? 'bg-venom/20 text-venom border-venom/30 hover:bg-venom/30'
                : 'border-border hover:border-venom/30 hover:text-venom'
            }
            onClick={() => setDateFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-36 h-8 text-xs bg-background border-border"
            />
            <span className="text-muted-foreground text-xs">إلى</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-36 h-8 text-xs bg-background border-border"
            />
          </div>
        )}
      </motion.div>

      {/* Meeting Cards */}
      <ScrollArea className="max-h-[calc(100vh-320px)]">
        {filteredMeetings.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <Calendar className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-lg">لا توجد اجتماعات</p>
            <p className="text-muted-foreground/60 text-sm mt-1">لم يتم تحديد أي اجتماعات بعد</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredMeetings.map((lead, i) => (
              <MeetingCard key={lead.id} lead={lead} index={i} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ===== Meeting Card =====
function MeetingCard({ lead, index }: { lead: Lead; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02, y: -2 }}
    >
      <Card
        className={`bg-card border border-border hover:border-venom/20 transition-all duration-300 border-r-4 ${getAttendanceBorder(lead.attended)} relative overflow-hidden group`}
      >
        {/* Subtle glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none venom-gradient" />

        <CardContent className="p-5 relative z-10">
          {/* Customer Name */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {lead.customerName || 'عميل غير محدد'}
              </h3>
              {lead.storeUrl && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.storeUrl}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {getAttendanceIcon(lead.attended)}
              <Badge
                variant="secondary"
                className={`text-[10px] ${
                  lead.attended === 'attended'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : lead.attended === 'no-show'
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {getAttendanceLabel(lead.attended)}
              </Badge>
            </div>
          </div>

          {/* Meeting Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3.5 h-3.5 text-venom shrink-0" />
              <span className="text-muted-foreground">{formatDate(new Date(lead.meetingDate).getTime())}</span>
            </div>
            {lead.meetingTime && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 text-venom-purple shrink-0" />
                <span className="text-muted-foreground">{lead.meetingTime}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              {lead.meetingType === 'online' ? (
                <Video className="w-3.5 h-3.5 text-venom shrink-0" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="text-muted-foreground">
                {lead.meetingType === 'online' ? 'أونلاين' : lead.meetingType === 'offline' ? 'حضوري' : '—'}
              </span>
            </div>
            {lead.meetingLink && (
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="w-3.5 h-3.5 text-venom shrink-0" />
                <a
                  href={lead.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-venom hover:text-venom-dark truncate underline-offset-2 hover:underline"
                >
                  رابط الاجتماع
                </a>
              </div>
            )}
          </div>

          {/* Sales Person */}
          {lead.sales && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-3.5 h-3.5 text-venom-purple shrink-0" />
                <span className="text-muted-foreground">السيلز:</span>
                <span className="text-foreground font-medium">{lead.sales}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
