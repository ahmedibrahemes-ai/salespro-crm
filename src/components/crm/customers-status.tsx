'use client'

import { useMemo, useState } from 'react'
import { useCrmStore, STATUSES, SALES_STATUSES, CONTACT_RESULTS, formatDate } from '@/lib/store'
import { motion } from 'framer-motion'
import {
  Users, Phone, Trophy, BarChart3, Search, Filter,
  CalendarCheck, UserCheck, XCircle, Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

/* ═══════════════════════════════════════════════════════
   Animation Variants
   ═══════════════════════════════════════════════════════ */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

/* ═══════════════════════════════════════════════════════
   Status Color Map
   ═══════════════════════════════════════════════════════ */

const STATUS_COLORS: Record<string, string> = {
  'new': '#6c63ff',
  'no-reply': '#8892b0',
  'whatsapp': '#25D366',
  'followup': '#6c63ff',
  'meeting-done': '#00d4aa',
  'objection-price': '#ff6b6b',
  'objection-other': '#ff6b6b',
  'proposal-sent': '#6c9fff',
  'negotiation': '#ffd166',
  'closed-won': '#00d4aa',
  'closed-lost': '#ff6b6b',
  'contacted': '#00d4aa',
  'thinking': '#ffd166',
}

/* ═══════════════════════════════════════════════════════
   KPI Card Config
   ═══════════════════════════════════════════════════════ */

interface KpiConfig {
  key: string
  label: string
  color: string
  colorBg: string
  icon: React.ReactNode
  getValue: (activeLeads: import('@/lib/supabase').Lead[]) => number
}

const KPI_CARDS: KpiConfig[] = [
  {
    key: 'total',
    label: 'إجمالي العملاء',
    color: '#6c63ff',
    colorBg: 'rgba(108,99,255,.15)',
    icon: <Users size={16} />,
    getValue: (leads) => leads.length,
  },
  {
    key: 'contacted',
    label: 'تم التواصل',
    color: '#00d4aa',
    colorBg: 'rgba(0,212,170,.15)',
    icon: <Phone size={16} />,
    getValue: (leads) => leads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length,
  },
  {
    key: 'meeting',
    label: 'لديهم اجتماع',
    color: '#ffd166',
    colorBg: 'rgba(255,209,102,.15)',
    icon: <CalendarCheck size={16} />,
    getValue: (leads) => leads.filter((l) => l.meetingDate && l.meetingDate !== '').length,
  },
  {
    key: 'closed-won',
    label: 'تم التقفيل',
    color: '#00d4aa',
    colorBg: 'rgba(0,212,170,.15)',
    icon: <Trophy size={16} />,
    getValue: (leads) => leads.filter((l) => l.status === 'closed-won' || l.salesStatus === 'closed-won').length,
  },
  {
    key: 'closed-lost',
    label: 'خسارة',
    color: '#ff6b6b',
    colorBg: 'rgba(255,107,107,.15)',
    icon: <XCircle size={16} />,
    getValue: (leads) => leads.filter((l) => l.status === 'closed-lost' || l.salesStatus === 'closed-lost').length,
  },
  {
    key: 'pending',
    label: 'في الانتظار',
    color: '#6c63ff',
    colorBg: 'rgba(108,99,255,.15)',
    icon: <Clock size={16} />,
    getValue: (leads) =>
      leads.filter((l) => {
        const s = l.status || 'new'
        return s === 'new' || s === 'no-reply' || (!l.contactResult || l.contactResult === 'none' || l.contactResult === '')
      }).length,
  },
]

/* ═══════════════════════════════════════════════════════
   Team Member Performance Row
   ═══════════════════════════════════════════════════════ */

interface TeamPerfRow {
  name: string
  role: 'tele' | 'sales'
  total: number
  contacted: number
  meetings: number
  closedWon: number
}

/* ═══════════════════════════════════════════════════════
   CustomersStatus Component
   ═══════════════════════════════════════════════════════ */

export function CustomersStatus() {
  const { leads, archivedLeads, team, currentUser, currentRole } = useCrmStore()

  /* ─── Local State ─── */
  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  /* ─── Active Leads (not archived) ─── */
  const activeLeads = useMemo(
    () => leads.filter((l) => !l.isArchived),
    [leads]
  )

  /* ─── Filtered Leads ─── */
  const filteredLeads = useMemo(() => {
    let result = activeLeads

    // Filter by team member
    if (memberFilter !== 'all') {
      if (memberFilter === 'tele') {
        result = result.filter((l) => l.tele && team.tele.includes(l.tele))
      } else if (memberFilter === 'sales') {
        result = result.filter((l) => l.sales && team.sales.includes(l.sales))
      } else {
        // specific member
        result = result.filter((l) => l.tele === memberFilter || l.sales === memberFilter)
      }
    }

    // Filter by search (name or phone)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (l) =>
          (l.customerName && l.customerName.toLowerCase().includes(q)) ||
          (l.phone && l.phone.toLowerCase().includes(q))
      )
    }

    return result
  }, [activeLeads, memberFilter, searchQuery, team])

  /* ─── Status Breakdown ─── */
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    STATUSES.forEach((s) => {
      counts[s.key] = 0
    })
    filteredLeads.forEach((l) => {
      const status = l.status || 'new'
      if (counts[status] !== undefined) {
        counts[status]++
      } else {
        counts[status] = 1
      }
    })
    return STATUSES.map((s) => ({
      ...s,
      count: counts[s.key] || 0,
      color: STATUS_COLORS[s.key] || '#8892b0',
    }))
  }, [filteredLeads])

  const maxStatusCount = useMemo(
    () => Math.max(...statusBreakdown.map((s) => s.count), 1),
    [statusBreakdown]
  )

  /* ─── Team Performance ─── */
  const teamPerformance = useMemo(() => {
    const rows: TeamPerfRow[] = []

    // Tele members
    team.tele.forEach((name) => {
      const memberLeads = filteredLeads.filter((l) => l.tele === name)
      rows.push({
        name,
        role: 'tele',
        total: memberLeads.length,
        contacted: memberLeads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length,
        meetings: memberLeads.filter((l) => l.meetingDate && l.meetingDate !== '').length,
        closedWon: memberLeads.filter((l) => l.status === 'closed-won').length,
      })
    })

    // Sales members
    team.sales.forEach((name) => {
      const memberLeads = filteredLeads.filter((l) => l.sales === name)
      rows.push({
        name,
        role: 'sales',
        total: memberLeads.length,
        contacted: memberLeads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length,
        meetings: memberLeads.filter((l) => l.meetingDate && l.meetingDate !== '').length,
        closedWon: memberLeads.filter((l) => l.salesStatus === 'closed-won').length,
      })
    })

    return rows
  }, [filteredLeads, team])

  /* ─── KPI Values (memoized) ─── */
  const kpiValues = useMemo(
    () => KPI_CARDS.map((kpi) => kpi.getValue(filteredLeads)),
    [filteredLeads]
  )

  /* ─── Filtered team performance (for search in table) ─── */
  const filteredTeamPerf = useMemo(() => {
    if (!searchQuery.trim()) return teamPerformance
    const q = searchQuery.trim().toLowerCase()
    return teamPerformance.filter((r) => r.name.toLowerCase().includes(q))
  }, [teamPerformance, searchQuery])

  /* ─── All members for dropdown ─── */
  const allMembers = useMemo(() => {
    const members: { name: string; role: string }[] = []
    team.tele.forEach((n) => members.push({ name: n, role: 'tele' }))
    team.sales.forEach((n) => members.push({ name: n, role: 'sales' }))
    return members
  }, [team])

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
      dir="rtl"
      style={{ fontFamily: 'Cairo, sans-serif' }}
    >
      {/* ══════════════════════════════════════════════════
          1. HEADER
          ══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] md:text-[26px] font-extrabold text-[#f0f2ff] flex items-center gap-2.5">
              <BarChart3 size={24} className="text-[#6c63ff]" />
              حالة العملاء
            </h1>
            <p className="text-[13px] text-[#8892b0] mt-1">
              نظرة شاملة على حالة جميع العملاء
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5280] pointer-events-none"
              />
              <Input
                placeholder="بحث بالاسم أو الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#111520] border-white/[0.06] text-[#f0f2ff] placeholder:text-[#4a5280] pr-9 h-9 text-[13px] rounded-xl w-full sm:w-[200px]"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              />
            </div>

            {/* Member Filter */}
            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger
                className="bg-[#111520] border-white/[0.06] text-[#f0f2ff] h-9 text-[13px] rounded-xl w-full sm:w-[180px]"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <Filter size={14} className="text-[#4a5280] ml-1" />
                <SelectValue placeholder="فلتر الفريق" />
              </SelectTrigger>
              <SelectContent
                className="bg-[#111520] border-white/[0.06] text-[#f0f2ff]"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="tele">فريق التلي</SelectItem>
                <SelectItem value="sales">فريق المبيعات</SelectItem>
                {allMembers.map((m) => (
                  <SelectItem key={m.name} value={m.name}>
                    {m.name} ({m.role === 'tele' ? 'تلي' : 'مبيعات'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════
          2. KPI CARDS ROW
          ══════════════════════════════════════════════════ */}
      <motion.div
        variants={itemVariants}
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
      >
        {KPI_CARDS.map((kpi, i) => {
          const value = kpiValues[i]
          return (
            <div
              key={kpi.key}
              className="bg-[#111520] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden hover:-translate-y-0.5 hover:border-white/[0.1] transition-all group"
            >
              {/* Decorative corner */}
              <div
                className="absolute top-0 right-0 w-[56px] h-[56px] rounded-t-2xl rounded-bl-[56px] opacity-[0.07]"
                style={{ background: kpi.color }}
              />

              {/* Icon */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ background: kpi.colorBg, color: kpi.color }}
              >
                {kpi.icon}
              </div>

              {/* Value */}
              <div
                className="text-[24px] md:text-[26px] font-extrabold leading-tight"
                style={{ color: kpi.color }}
              >
                {value}
              </div>

              {/* Label */}
              <div className="text-[12px] text-[#8892b0] mt-0.5">{kpi.label}</div>
            </div>
          )
        })}
      </motion.div>

      {/* ══════════════════════════════════════════════════
          3. STATUS BREAKDOWN
          ══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
        <Card className="bg-[#111520] border-white/[0.06] rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-bold text-[#f0f2ff] flex items-center gap-2">
              <BarChart3 size={16} className="text-[#6c63ff]" />
              تفصيل الحالات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusBreakdown.map((status, i) => {
              const pct = filteredLeads.length > 0
                ? Math.round((status.count / filteredLeads.length) * 100)
                : 0
              const barWidth = maxStatusCount > 0
                ? (status.count / maxStatusCount) * 100
                : 0

              return (
                <div
                  key={status.key}
                  className="group"
                >
                  <div className="flex items-center gap-3">
                    {/* Label */}
                    <div className="w-32 md:w-40 text-[13px] text-[#f0f2ff] shrink-0 flex items-center gap-1.5">
                      <span className="text-[14px]">{status.label.split(' ')[0]}</span>
                      <span className="truncate">{status.label.split(' ').slice(1).join(' ')}</span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-7 bg-[#0a0d14] rounded-lg overflow-hidden relative">
                      <motion.div
                        className="h-full rounded-lg"
                        style={{ background: `${status.color}cc` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.8, delay: i * 0.06, ease: 'easeOut' }}
                      />
                      {/* Count inside bar */}
                      {status.count > 0 && (
                        <div className="absolute inset-0 flex items-center justify-end px-2.5">
                          <span className="text-[12px] font-bold text-[#f0f2ff]">
                            {status.count}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Percentage */}
                    <div
                      className="w-14 text-left text-[12px] font-bold shrink-0"
                      style={{ color: status.color }}
                    >
                      {pct}%
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Total */}
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[12px] text-[#8892b0]">إجمالي العملاء النشطين</span>
              <span className="text-[14px] font-bold text-[#6c63ff]">
                {filteredLeads.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ══════════════════════════════════════════════════
          4. TEAM PERFORMANCE TABLE
          ══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
        <Card className="bg-[#111520] border-white/[0.06] rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-bold text-[#f0f2ff] flex items-center gap-2">
              <Users size={16} className="text-[#6c63ff]" />
              أداء الفريق
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-[#8892b0] text-[12px] font-semibold text-right">
                      العضو
                    </TableHead>
                    <TableHead className="text-[#8892b0] text-[12px] font-semibold text-right">
                      الدور
                    </TableHead>
                    <TableHead className="text-[#8892b0] text-[12px] font-semibold text-center">
                      إجمالي
                    </TableHead>
                    <TableHead className="text-[#8892b0] text-[12px] font-semibold text-center">
                      تم التواصل
                    </TableHead>
                    <TableHead className="text-[#8892b0] text-[12px] font-semibold text-center">
                      اجتماعات
                    </TableHead>
                    <TableHead className="text-[#8892b0] text-[12px] font-semibold text-center">
                      تقفيل
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeamPerf.length > 0 ? (
                    filteredTeamPerf.map((member, i) => (
                      <tr
                        key={`${member.name}-${member.role}`}
                        className="border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      >
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                              style={{
                                background: member.role === 'tele'
                                  ? 'rgba(108,99,255,0.15)'
                                  : 'rgba(0,212,170,0.15)',
                                color: member.role === 'tele' ? '#6c63ff' : '#00d4aa',
                              }}
                            >
                              {member.name.slice(0, 2)}
                            </div>
                            <span className="text-[13px] font-semibold text-[#f0f2ff]">
                              {member.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full border-0"
                            style={{
                              background: member.role === 'tele'
                                ? 'rgba(108,99,255,0.15)'
                                : 'rgba(0,212,170,0.15)',
                              color: member.role === 'tele' ? '#6c63ff' : '#00d4aa',
                            }}
                          >
                            {member.role === 'tele' ? 'تلي' : 'مبيعات'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[13px] font-bold text-[#f0f2ff]">
                            {member.total}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[13px] font-bold" style={{ color: '#00d4aa' }}>
                            {member.contacted}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[13px] font-bold" style={{ color: '#ffd166' }}>
                            {member.meetings}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[13px] font-bold" style={{ color: '#00d4aa' }}>
                            {member.closedWon}
                          </span>
                        </TableCell>
                      </tr>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="text-[13px] text-[#4a5280]">
                          لا توجد بيانات للعرض
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Team Summary */}
            {filteredTeamPerf.length > 0 && (
              <div className="px-5 py-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-[#8892b0]">
                  {filteredTeamPerf.length} عضو
                </span>
                <div className="flex items-center gap-4 text-[12px]">
                  <span className="text-[#8892b0]">
                    إجمالي:{' '}
                    <span className="font-bold text-[#f0f2ff]">
                      {filteredTeamPerf.reduce((s, m) => s + m.total, 0)}
                    </span>
                  </span>
                  <span className="text-[#8892b0]">
                    تقفيل:{' '}
                    <span className="font-bold text-[#00d4aa]">
                      {filteredTeamPerf.reduce((s, m) => s + m.closedWon, 0)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
