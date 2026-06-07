'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Phone,
  Calendar,
  Trophy,
  Clock,
  TrendingUp,
  UserCheck,
  Shield,
  AlertCircle,
  Eye,
  Star,
  BarChart3,
  Lightbulb,
  ArrowUpRight,
  XCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Store,
  MessageSquare,
} from 'lucide-react'
import {
  useCrmStore,
  getAllLeadsForAnalytics,
  getRatingLabel,
  getRatingColor,
  formatDate,
  formatRelativeTime,
} from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

function isThisWeek(ts: number | null): boolean {
  if (!ts) return false
  const d = new Date(ts)
  const now = new Date()
  // Saudi/Egypt calendar: week starts Saturday
  const dayOfWeek = now.getDay()
  const daysSinceSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceSaturday)
  startOfWeek.setHours(0, 0, 0, 0)
  return d >= startOfWeek
}

function isThisMonth(ts: number | null): boolean {
  if (!ts) return false
  const d = new Date(ts)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

// ===== Last 7 Days Chart Data =====
interface DayData {
  name: string
  additions: number
  conversions: number
}

function getLast7DaysData(allLeads: Lead[], roleFilter?: (l: Lead) => boolean): DayData[] {
  const days: DayData[] = []
  const dayNames = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
  const filtered = roleFilter ? allLeads.filter(roleFilter) : allLeads

  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const dayEnd = dayStart + 86400000

    // Additions = leads created on that day
    const additions = filtered.filter((l) => l.createdAt >= dayStart && l.createdAt < dayEnd).length
    // Conversions = leads where assignedAt (conversion date) falls on that day
    const conversions = filtered.filter(
      (l) =>
        l.sales && l.assignedAt && l.assignedAt >= dayStart && l.assignedAt < dayEnd
    ).length

    days.push({ name: dayNames[date.getDay()], additions, conversions })
  }
  return days
}

// ===== Score Calculation =====
function calculateTeleScore(leads: Lead[]): number {
  if (leads.length === 0) return 0
  const contacted = leads.filter((l) => l.contactResult && l.contactResult !== 'none').length
  const converted = leads.filter((l) => l.sales).length
  const meetingDone = leads.filter((l) => l.status === 'meeting-done' || l.status === 'closed-won').length
  const contactRate = leads.length > 0 ? (contacted / leads.length) * 40 : 0
  const convertRate = leads.length > 0 ? (converted / leads.length) * 40 : 0
  const meetingRate = contacted > 0 ? (meetingDone / contacted) * 20 : 0
  return Math.min(100, Math.round(contactRate + convertRate + meetingRate))
}

function calculateSalesScore(leads: Lead[]): number {
  if (leads.length === 0) return 0
  const attended = leads.filter((l) => l.attended === 'attended').length
  const closed = leads.filter((l) => l.salesStatus === 'closed-won').length
  const attendRate = leads.length > 0 ? (attended / leads.length) * 50 : 0
  const closeRate = leads.length > 0 ? (closed / leads.length) * 50 : 0
  return Math.min(100, Math.round(attendRate + closeRate))
}

// ===== Bar Chart Component =====
function SimpleBarChart({ data }: { data: DayData[] }) {
  const maxValue = Math.max(...data.map((d) => Math.max(d.additions, d.conversions)), 1)

  return (
    <div className="flex items-end gap-2 h-[160px] w-full" dir="ltr">
      {data.map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="flex gap-0.5 items-end h-[120px] w-full">
            <div
              className="flex-1 rounded-t-sm transition-all duration-500"
              style={{
                height: `${(day.additions / maxValue) * 100}%`,
                minHeight: day.additions > 0 ? '4px' : '0px',
                background: 'linear-gradient(to top, #5eb8a6, #1f6357)',
              }}
            />
            <div
              className="flex-1 rounded-t-sm transition-all duration-500"
              style={{
                height: `${(day.conversions / maxValue) * 100}%`,
                minHeight: day.conversions > 0 ? '4px' : '0px',
                background: 'linear-gradient(to top, #8B5CF6, #a78bfa)',
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{day.name}</span>
        </div>
      ))}
    </div>
  )
}

// ===== KPI Card (Clickable) =====
interface KpiCardProps {
  icon: React.ReactNode
  value: number
  label: string
  sublabel?: string
  accentColor: string
  borderColor?: string
  onClick?: () => void
  index?: number
}

function KpiCard({ icon, value, label, sublabel, accentColor, borderColor, onClick, index = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="group"
    >
      <Card
        className={`bg-card border cursor-pointer transition-all duration-300 overflow-hidden relative ${
          borderColor ? borderColor : 'border-border hover:border-venom/30'
        }`}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <div style={{ color: accentColor }} className="w-5 h-5">
                {icon}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-2xl font-bold tracking-tight" style={{ color: accentColor }}>
                {value}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              {sublabel && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">{sublabel}</p>
              )}
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-venom transition-colors" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ===== Performance Hero Card =====
function PerformanceHeroCard({
  score,
  totalCustomers,
  ratingLabel,
  ratingColor,
  roleLabel,
}: {
  score: number
  totalCustomers: number
  ratingLabel: string
  ratingColor: string
  roleLabel: string
}) {
  const progressColor =
    score >= 80 ? '#10B981' : score >= 60 ? '#5eb8a6' : score >= 40 ? '#F59E0B' : '#EF4444'

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden border-0">
        <div
          className="relative p-6"
          style={{
            background: `linear-gradient(135deg, #0a1a10 0%, #0f2a18 50%, #0a1a10 100%)`,
          }}
        >
          {/* Decorative glow */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 30% 50%, ${progressColor}30 0%, transparent 60%)`,
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">{roleLabel}</p>
                <h2 className="text-xl font-bold text-foreground mt-1">أدائك اليوم</h2>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5" style={{ color: progressColor }} />
                <span className={`text-lg font-bold ${ratingColor}`}>{ratingLabel}</span>
              </div>
            </div>

            <div className="flex items-end gap-6">
              <div>
                <div className="text-5xl font-black tabular-nums" style={{ color: progressColor }}>
                  {score}
                </div>
                <p className="text-xs text-muted-foreground mt-1">من 100</p>
              </div>

              <div className="flex-1 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">التقييم</span>
                  <span className="text-sm font-medium" style={{ color: progressColor }}>
                    {score}%
                  </span>
                </div>
                <Progress value={score} className="h-3" />
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-venom" />
                    <span className="text-sm text-muted-foreground">
                      <span className="text-foreground font-bold">{totalCustomers}</span> عميل
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

// ===== Lead Card (for Admin) =====
function LeadCard({ lead, index }: { lead: Lead; index: number }) {
  const statusColors: Record<string, string> = {
    new: '#5eb8a6',
    'no-reply': '#F59E0B',
    followup: '#8B5CF6',
    'meeting-done': '#10B981',
    'closed-won': '#10B981',
    'closed-lost': '#EF4444',
    'objection-price': '#F59E0B',
    'objection-other': '#F59E0B',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          backgroundColor: statusColors[lead.status] || '#8B5CF6',
          boxShadow: `0 0 6px ${statusColors[lead.status] || '#8B5CF6'}40`,
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{lead.customerName || lead.storeUrl}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {lead.tele && (
            <span className="text-xs text-venom/70">تلي: {lead.tele}</span>
          )}
          {lead.sales && (
            <span className="text-xs text-purple-400/70">مبيعات: {lead.sales}</span>
          )}
        </div>
      </div>
      <div className="text-left shrink-0">
        <Badge variant="secondary" className="text-xs">
          {lead.status}
        </Badge>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatRelativeTime(lead.createdAt)}
        </p>
      </div>
    </motion.div>
  )
}

// ===== Tips Section =====
function TipsSection({ tips }: { tips: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
    >
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            نصائح لتحسين الأداء
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs text-amber-400 font-bold">{i + 1}</span>
              </div>
              <p className="text-sm text-muted-foreground">{tip}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ===================================================================
// ===== TELE PROFESSIONAL DASHBOARD =====
// ===================================================================
function TeleProfessionalDashboard() {
  const {
    currentUser,
    leads,
    archivedLeads,
    ratingConfig,
    setCurrentView,
    setActiveFilter,
    getAccessibleTeleSheets,
  } = useCrmStore()

  const [selectedSheet, setSelectedSheet] = useState<string>(currentUser || '')

  // Get accessible sheets
  const accessibleSheets = useMemo(
    () => (currentUser ? getAccessibleTeleSheets(currentUser) : []),
    [currentUser, getAccessibleTeleSheets]
  )

  // Filter leads for selected sheet
  const myLeads = useMemo(() => {
    const filtered = leads.filter((l) => l.tele === selectedSheet)
    return filtered
  }, [leads, selectedSheet])

  const myArchivedLeads = useMemo(
    () => archivedLeads.filter((l) => l.tele === selectedSheet),
    [archivedLeads, selectedSheet]
  )

  const allMyLeads = useMemo(
    () => getAllLeadsForAnalytics(myLeads, myArchivedLeads),
    [myLeads, myArchivedLeads]
  )

  // ===== KPI Calculations =====
  // Today = any activity today (created, called, converted)
  const { todayActive, weekActive, monthActive, todayConverted, todayCalls,
          assignedCount, attendedCount, withoutSalesCount, noShowCount, inProgressCount, closedWonCount } = useMemo(() => {
    let today = 0, week = 0, month = 0, todayConv = 0, todayCall = 0
    let assigned = 0, attended = 0, withoutSales = 0, noShow = 0, inProgress = 0, closedWon = 0
    for (const l of myLeads) {
      // Time-based: any activity in the period
      const hadActivityToday = isToday(l.createdAt) || isToday(l.contactResultAt) || isToday(l.assignedAt)
      const hadActivityWeek = isThisWeek(l.createdAt) || isThisWeek(l.contactResultAt) || isThisWeek(l.assignedAt)
      const hadActivityMonth = isThisMonth(l.createdAt) || isThisMonth(l.contactResultAt) || isThisMonth(l.assignedAt)
      if (hadActivityToday) today++
      if (hadActivityWeek) week++
      if (hadActivityMonth) month++
      // Today-specific counts
      if (isToday(l.assignedAt) && l.sales) todayConv++
      if (isToday(l.contactResultAt) && l.contactResult) todayCall++
      // All-time counts
      if (l.sales) assigned++
      if (l.attended === 'attended') attended++
      if (!l.sales && l.status !== 'closed-won' && l.status !== 'closed-lost') withoutSales++
      if (l.attended === 'no-show') noShow++
      if (l.status === 'followup' || l.status === 'negotiation' || l.status === 'proposal-sent') inProgress++
      if (l.status === 'closed-won' || l.salesStatus === 'closed-won') closedWon++
    }
    return { todayActive: today, weekActive: week, monthActive: month, todayConverted: todayConv, todayCalls: todayCall,
            assignedCount: assigned, attendedCount: attended, withoutSalesCount: withoutSales,
            noShowCount: noShow, inProgressCount: inProgress, closedWonCount: closedWon }
  }, [myLeads])

  const conversionRate = myLeads.length > 0 ? Math.round((assignedCount / myLeads.length) * 100) : 0
  const showUpRate = assignedCount > 0 ? Math.round((attendedCount / assignedCount) * 100) : 0

  // Score - calculated on TODAY's activity only
  const todayLeadsForScore = useMemo(() => myLeads.filter(l => isToday(l.createdAt) || isToday(l.contactResultAt) || isToday(l.assignedAt)), [myLeads])
  const score = calculateTeleScore(todayLeadsForScore)
  const ratingLabel = getRatingLabel(score, ratingConfig)
  const ratingColor = getRatingColor(score, ratingConfig)

  // Chart data
  const chartData = useMemo(
    () => getLast7DaysData(allMyLeads, (l) => l.tele === selectedSheet),
    [allMyLeads, selectedSheet]
  )

  // Tips
  const tips = useMemo(() => {
    const t: string[] = []
    if (conversionRate < 30) t.push('حاول تحسين نسبة التحويل بمتابعة العملاء بشكل أسرع')
    if (todayActive === 0) t.push('ابدأ بإضافة عملاء جدد اليوم لتحسين أدائك')
    if (noShowCount > 3) t.push('تأكد من تأكيد المواعيد مع العملاء قبل الموعد')
    if (withoutSalesCount > 10) t.push('ركز على تحويل العملاء المحتملين للمبيعات')
    if (todayCalls === 0 && todayActive > 0) t.push('عندك عملاء لسة ما اتصلتش بيهم - ابدأ بالاتصال!')
    if (t.length === 0) t.push('أداؤك ممتاز! استمر في الحفاظ على هذا المستوى')
    return t
  }, [conversionRate, todayActive, noShowCount, withoutSalesCount, todayCalls])

  // Navigation handlers
  const goToSheet = (filter?: string) => {
    setActiveFilter('my-sheet', filter || 'all')
    setCurrentView('my-sheet')
  }

  return (
    <div className="space-y-6">
      {/* Sheet Selector */}
      {accessibleSheets.length > 1 && (
        <div className="flex items-center gap-3">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedSheet} onValueChange={setSelectedSheet}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="اختر شيت" />
            </SelectTrigger>
            <SelectContent>
              {accessibleSheets.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-xs">
            {accessibleSheets.length} شيت
          </Badge>
        </div>
      )}

      {/* Performance Hero Card */}
      <PerformanceHeroCard
        score={score}
        totalCustomers={myLeads.length}
        ratingLabel={ratingLabel}
        ratingColor={ratingColor}
        roleLabel="لوحة تحكم التلي ماركتينج"
      />

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<Phone className="w-5 h-5" />}
          value={todayCalls}
          label="مكالمات اليوم"
          accentColor="#5eb8a6"
          onClick={() => goToSheet('today')}
          index={0}
        />
        <KpiCard
          icon={<Calendar className="w-5 h-5" />}
          value={todayConverted}
          label="تحويلات اليوم"
          accentColor="#8B5CF6"
          onClick={() => goToSheet('today')}
          index={1}
        />
        <KpiCard
          icon={<BarChart3 className="w-5 h-5" />}
          value={todayActive}
          label="نشط اليوم"
          accentColor="#06B6D4"
          onClick={() => goToSheet('today')}
          index={2}
        />
        <KpiCard
          icon={<ArrowUpRight className="w-5 h-5" />}
          value={weekActive}
          label="نشط الأسبوع"
          accentColor="#F59E0B"
          onClick={() => goToSheet('week')}
          index={3}
        />
        <KpiCard
          icon={<UserCheck className="w-5 h-5" />}
          value={monthActive}
          label="نشط الشهر"
          accentColor="#10B981"
          onClick={() => goToSheet('month')}
          index={4}
        />
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Clock className="w-5 h-5" />}
          value={withoutSalesCount}
          label="بدون مبيعات"
          accentColor="#F59E0B"
          borderColor="border-amber-500/40"
          onClick={() => goToSheet('pending')}
          index={0}
        />
        <KpiCard
          icon={<XCircle className="w-5 h-5" />}
          value={noShowCount}
          label="لم يحضر"
          accentColor="#EF4444"
          borderColor="border-red-500/40"
          onClick={() => goToSheet('no-show')}
          index={1}
        />
        <KpiCard
          icon={<Loader2 className="w-5 h-5" />}
          value={inProgressCount}
          label="قيد التنفيذ"
          accentColor="#8B5CF6"
          borderColor="border-purple-500/40"
          onClick={() => goToSheet('in-progress')}
          index={2}
        />
        <KpiCard
          icon={<Trophy className="w-5 h-5" />}
          value={closedWonCount}
          label="تم التقفيل"
          accentColor="#10B981"
          borderColor="border-emerald-500/40"
          onClick={() => goToSheet('closed-won')}
          index={3}
        />
      </div>

      {/* Empty Leads Notice */}
      {myLeads.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-amber-400 font-medium">لا يوجد عملاء حالياً</p>
              <p className="text-sm text-muted-foreground mt-1">
                ابدأ بإضافة عملاء جدد من صفحة الشيت أو الإضافة السريعة
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Last 7 Days Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-venom" />
                آخر 7 أيام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={chartData} />
              <div className="flex items-center justify-center gap-6 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-venom" />
                  <span className="text-xs text-muted-foreground">إضافات</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-purple-500" />
                  <span className="text-xs text-muted-foreground">تحويلات</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tips */}
        <TipsSection tips={tips} />
      </div>
    </div>
  )
}

// ===================================================================
// ===== SALES PROFESSIONAL DASHBOARD =====
// ===================================================================
function SalesProfessionalDashboard() {
  const {
    currentUser,
    leads,
    archivedLeads,
    ratingConfig,
    setCurrentView,
    setActiveFilter,
    getAccessibleSalesSheets,
  } = useCrmStore()

  const [selectedSheet, setSelectedSheet] = useState<string>(currentUser || '')

  // Get accessible sheets
  const accessibleSheets = useMemo(
    () => (currentUser ? getAccessibleSalesSheets(currentUser) : []),
    [currentUser, getAccessibleSalesSheets]
  )

  // Filter leads for selected sheet
  const myLeads = useMemo(
    () => leads.filter((l) => l.sales === selectedSheet),
    [leads, selectedSheet]
  )

  const myArchivedLeads = useMemo(
    () => archivedLeads.filter((l) => l.sales === selectedSheet),
    [archivedLeads, selectedSheet]
  )

  const allMyLeads = useMemo(
    () => getAllLeadsForAnalytics(myLeads, myArchivedLeads),
    [myLeads, myArchivedLeads]
  )

  // ===== KPI Calculations =====
  // Today = any activity today (assigned, called, status changed)
  const { todayActive, weekActive, monthActive, todayAttended, todayClosed, todayCalls,
          attendedCount, closedWonCount, callsCount } = useMemo(() => {
    let today = 0, week = 0, month = 0, todayAtt = 0, todayCl = 0, todayCall = 0
    let attended = 0, closedWon = 0, totalCalls = 0
    for (const l of myLeads) {
      // Time-based: any activity in the period
      const hadActivityToday = isToday(l.assignedAt) || isToday(l.contactResultAt) || isToday(l.attendanceMarkedAt) || isToday(l.createdAt)
      const hadActivityWeek = isThisWeek(l.assignedAt) || isThisWeek(l.contactResultAt) || isThisWeek(l.attendanceMarkedAt) || isThisWeek(l.createdAt)
      const hadActivityMonth = isThisMonth(l.assignedAt) || isThisMonth(l.contactResultAt) || isThisMonth(l.attendanceMarkedAt) || isThisMonth(l.createdAt)
      if (hadActivityToday) today++
      if (hadActivityWeek) week++
      if (hadActivityMonth) month++
      // Today-specific
      if (isToday(l.attendanceMarkedAt) && l.attended === 'attended') todayAtt++
      // FIXED: operator precedence - parentheses around OR condition
      if (l.salesStatus === 'closed-won' && (isToday(l.createdAt) || isToday(l.assignedAt))) todayCl++
      // Calls: count if contactResultAt is today and there's a contact result
      if (isToday(l.contactResultAt) && l.contactResult) todayCall++
      // All-time
      if (l.attended === 'attended') attended++
      if (l.salesStatus === 'closed-won') closedWon++
      if (l.contactResult) totalCalls++
    }
    return { todayActive: today, weekActive: week, monthActive: month, todayAttended: todayAtt, todayClosed: todayCl, todayCalls: todayCall,
            attendedCount: attended, closedWonCount: closedWon, callsCount: totalCalls }
  }, [myLeads])

  // Score - calculated on TODAY's activity only
  const todayLeadsForScore = useMemo(() => myLeads.filter(l => isToday(l.assignedAt) || isToday(l.contactResultAt) || isToday(l.attendanceMarkedAt) || isToday(l.createdAt)), [myLeads])
  const score = calculateSalesScore(todayLeadsForScore)
  const ratingLabelStr = getRatingLabel(score, ratingConfig)
  const ratingColor = getRatingColor(score, ratingConfig)

  // Need attention - pending meetings (not yet attended)
  const needAttention = useMemo(
    () =>
      myLeads
        .filter((l) => l.meetingDate && (!l.attended || l.attended === 'pending'))
        .sort((a, b) => {
          const dateA = new Date(a.meetingDate).getTime()
          const dateB = new Date(b.meetingDate).getTime()
          return dateA - dateB
        })
        .slice(0, 5),
    [myLeads]
  )

  // Chart data
  const chartData = useMemo(
    () => getLast7DaysData(allMyLeads, (l) => l.sales === selectedSheet),
    [allMyLeads, selectedSheet]
  )

  // Tips
  const tips = useMemo(() => {
    const t: string[] = []
    if (attendedCount === 0 && myLeads.length > 0)
      t.push('تأكد من تسجيل حضور العملاء في الاجتماعات')
    if (closedWonCount === 0 && myLeads.length > 0)
      t.push('ركز على إغلاق الصفقات لتحسين نسبة التقفيل')
    if (todayActive === 0) t.push('لا يوجد نشاط اليوم - تابع العملاء الحاليين')
    if (needAttention.length > 0)
      t.push(`عندك ${needAttention.length} اجتماع بحاجة لتأكيد الحضور`)
    if (t.length === 0) t.push('أداؤك ممتاز! استمر في الحفاظ على هذا المستوى')
    return t
  }, [attendedCount, closedWonCount, todayActive, needAttention.length, myLeads.length])

  // Navigation handlers
  const goToSheet = (filter?: string) => {
    setActiveFilter('sales-sheet', filter || 'all')
    setCurrentView('sales-sheet')
  }

  const goToMeetings = () => {
    setCurrentView('meetings')
  }

  return (
    <div className="space-y-6">
      {/* Sheet Selector */}
      {accessibleSheets.length > 1 && (
        <div className="flex items-center gap-3">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedSheet} onValueChange={setSelectedSheet}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="اختر شيت" />
            </SelectTrigger>
            <SelectContent>
              {accessibleSheets.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-xs">
            {accessibleSheets.length} شيت
          </Badge>
        </div>
      )}

      {/* Performance Hero Card */}
      <PerformanceHeroCard
        score={score}
        totalCustomers={myLeads.length}
        ratingLabel={ratingLabelStr}
        ratingColor={ratingColor}
        roleLabel="لوحة تحكم المبيعات"
      />

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<Phone className="w-5 h-5" />}
          value={todayCalls}
          label="مكالمات اليوم"
          accentColor="#5eb8a6"
          onClick={() => goToSheet('today')}
          index={0}
        />
        <KpiCard
          icon={<Trophy className="w-5 h-5" />}
          value={todayClosed}
          label="تقفيلات اليوم"
          accentColor="#8B5CF6"
          onClick={() => goToSheet('closed-won')}
          index={1}
        />
        <KpiCard
          icon={<UserCheck className="w-5 h-5" />}
          value={todayAttended}
          label="حضروا اليوم"
          accentColor="#06B6D4"
          onClick={() => goToSheet('attended')}
          index={2}
        />
        <KpiCard
          icon={<BarChart3 className="w-5 h-5" />}
          value={todayActive}
          label="نشط اليوم"
          accentColor="#F59E0B"
          onClick={() => goToSheet('today')}
          index={3}
        />
        <KpiCard
          icon={<Calendar className="w-5 h-5" />}
          value={monthActive}
          label="نشط الشهر"
          accentColor="#10B981"
          onClick={() => goToSheet('month')}
          index={4}
        />
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<MessageSquare className="w-5 h-5" />}
          value={callsCount}
          label="إجمالي المكالمات"
          accentColor="#5eb8a6"
          borderColor="border-venom/40"
          onClick={() => goToSheet('replied')}
          index={0}
        />
        <KpiCard
          icon={<Calendar className="w-5 h-5" />}
          value={weekActive}
          label="نشط الأسبوع"
          accentColor="#F59E0B"
          borderColor="border-amber-500/40"
          onClick={() => goToSheet('week')}
          index={1}
        />
        <KpiCard
          icon={<XCircle className="w-5 h-5" />}
          value={closedWonCount}
          label="تم التقفيل"
          accentColor="#10B981"
          borderColor="border-emerald-500/40"
          onClick={() => goToSheet('closed-won')}
          index={2}
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          value={attendedCount}
          label="حضروا"
          accentColor="#8B5CF6"
          borderColor="border-purple-500/40"
          onClick={() => goToSheet('attended')}
          index={3}
        />
      </div>

      {/* Need Attention Section */}
      {needAttention.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-card border border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                تحتاج اهتمام
                <Badge variant="secondary" className="text-xs mr-2">
                  {needAttention.length} اجتماع
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              {needAttention.map((lead, i) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {lead.customerName || lead.storeUrl}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lead.meetingDate} {lead.meetingTime && `• ${lead.meetingTime}`}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                      انتظار
                    </Badge>
                  </div>
                </div>
              ))}
              <button
                onClick={goToMeetings}
                className="w-full mt-3 py-2 text-sm text-venom hover:text-venom/80 transition-colors flex items-center justify-center gap-1"
              >
                عرض كل الاجتماعات
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Last 7 Days Chart + Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-venom" />
                آخر 7 أيام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={chartData} />
              <div className="flex items-center justify-center gap-6 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-venom" />
                  <span className="text-xs text-muted-foreground">عملاء</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-purple-500" />
                  <span className="text-xs text-muted-foreground">تقفيلات</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <TipsSection tips={tips} />
      </div>
    </div>
  )
}

// ===================================================================
// ===== ADMIN DASHBOARD =====
// ===================================================================
function AdminDashboard() {
  const { currentUser, leads, archivedLeads, team } = useCrmStore()

  const allLeads = useMemo(
    () => getAllLeadsForAnalytics(leads, archivedLeads),
    [leads, archivedLeads]
  )

  // Stats (single-pass for performance)
  const totalLeads = leads.length
  const { assignedLeads, pendingLeads, todayActive, todayConverted, todayCalls, teleStats, salesStats } = useMemo(() => {
    let assigned = 0, pending = 0, today = 0, todayConv = 0, todayCall = 0
    const teleMap: Record<string, { total: number; converted: number; todayActive: number; todayCalls: number }> = {}
    const salesMap: Record<string, { total: number; closed: number; todayActive: number; todayCalls: number }> = {}

    // Initialize maps
    team.tele.forEach((n) => { teleMap[n] = { total: 0, converted: 0, todayActive: 0, todayCalls: 0 } })
    team.sales.forEach((n) => { salesMap[n] = { total: 0, closed: 0, todayActive: 0, todayCalls: 0 } })

    for (const l of leads) {
      if (l.sales) assigned++
      if (!l.sales && l.status !== 'closed-won' && l.status !== 'closed-lost') pending++
      const hadActivityToday = isToday(l.createdAt) || isToday(l.contactResultAt) || isToday(l.assignedAt)
      const hadCallToday = isToday(l.contactResultAt) && !!l.contactResult
      if (hadActivityToday) today++
      if (isToday(l.assignedAt) && l.sales) todayConv++
      if (hadCallToday) todayCall++
      // Per-member stats
      if (l.tele && teleMap[l.tele]) {
        teleMap[l.tele].total++
        if (l.sales) teleMap[l.tele].converted++
        if (hadActivityToday) teleMap[l.tele].todayActive++
        if (hadCallToday) teleMap[l.tele].todayCalls++
      }
      if (l.sales && salesMap[l.sales]) {
        salesMap[l.sales].total++
        if (l.salesStatus === 'closed-won') salesMap[l.sales].closed++
        if (hadActivityToday) salesMap[l.sales].todayActive++
        if (hadCallToday) salesMap[l.sales].todayCalls++
      }
    }
    return { assignedLeads: assigned, pendingLeads: pending, todayActive: today, todayConverted: todayConv, todayCalls: todayCall, teleStats: teleMap, salesStats: salesMap }
  }, [leads, team])

  // Recent leads
  const recentLeads = useMemo(
    () => [...leads].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [leads]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-3"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold venom-text-glow">
            أهلاً {currentUser} 🐍
          </h1>
          <p className="text-muted-foreground mt-1">لوحة تحكم المدير</p>
        </div>
        <Badge className="bg-venom/15 text-venom border-venom/30 mr-auto">
          <Shield className="w-3 h-3 ml-1" />
          مدير
        </Badge>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          value={totalLeads}
          label="إجمالي العملاء"
          accentColor="#5eb8a6"
          index={0}
        />
        <KpiCard
          icon={<Phone className="w-5 h-5" />}
          value={todayCalls}
          label="مكالمات اليوم"
          accentColor="#8B5CF6"
          index={1}
        />
        <KpiCard
          icon={<ArrowUpRight className="w-5 h-5" />}
          value={todayConverted}
          label="تحويلات اليوم"
          accentColor="#F59E0B"
          index={2}
        />
        <KpiCard
          icon={<Calendar className="w-5 h-5" />}
          value={todayActive}
          label="نشط اليوم"
          accentColor="#06B6D4"
          index={3}
        />
      </div>

      {/* Team Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tele Team */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-venom" />
                فريق التلي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {team.tele.map((name) => {
                const stats = teleStats[name] || { total: 0, converted: 0, todayActive: 0, todayCalls: 0 }
                return (
                  <div key={name} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-venom/10 flex items-center justify-center text-xs font-bold text-venom">
                        {name.charAt(0)}
                      </div>
                      <span className="text-sm">{name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="text-xs text-muted-foreground">
                        <span className="text-foreground font-bold">{stats.total}</span> عميل
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {stats.converted} تحويل
                      </Badge>
                      {stats.todayCalls > 0 && (
                        <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          📞 {stats.todayCalls}
                        </Badge>
                      )}
                      {stats.todayActive > 0 && (
                        <Badge className="text-xs bg-venom/15 text-venom border-venom/30">
                          {stats.todayActive} اليوم
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Sales Team */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-purple-400" />
                فريق المبيعات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {team.sales.map((name) => {
                const stats = salesStats[name] || { total: 0, closed: 0, todayActive: 0, todayCalls: 0 }
                return (
                  <div key={name} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-xs font-bold text-purple-400">
                        {name.charAt(0)}
                      </div>
                      <span className="text-sm">{name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="text-xs text-muted-foreground">
                        <span className="text-foreground font-bold">{stats.total}</span> عميل
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {stats.closed} تقفيل
                      </Badge>
                      {stats.todayCalls > 0 && (
                        <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          📞 {stats.todayCalls}
                        </Badge>
                      )}
                      {stats.todayActive > 0 && (
                        <Badge className="text-xs bg-venom/15 text-venom border-venom/30">
                          {stats.todayActive} اليوم
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Leads */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-4 h-4 text-venom" />
              آخر العملاء
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {recentLeads.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا يوجد عملاء بعد</p>
              </div>
            ) : (
              recentLeads.map((lead, i) => (
                <LeadCard key={lead.id} lead={lead} index={i} />
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ===================================================================
// ===== MAIN DASHBOARD COMPONENT =====
// ===================================================================
export default function Dashboard() {
  const { currentUser, currentRole } = useCrmStore()

  if (!currentUser || !currentRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">يرجى تسجيل الدخول</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {currentRole === 'tele' && <TeleProfessionalDashboard />}
      {currentRole === 'sales' && <SalesProfessionalDashboard />}
      {currentRole === 'admin' && <AdminDashboard />}
    </div>
  )
}
