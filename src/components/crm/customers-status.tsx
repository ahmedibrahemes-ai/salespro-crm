'use client'

import { useMemo, useState } from 'react'
import { useCrmStore, STATUSES, SALES_STATUSES, CONTACT_RESULTS, formatDate } from '@/lib/store'
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
   CustomersStatus Component — OPTIMIZED
   - Replaced Framer Motion with CSS transitions
   - Single-pass computation for all KPIs
   - Targeted Zustand selectors
   ═══════════════════════════════════════════════════════ */

export function CustomersStatus() {
  const leads = useCrmStore((s) => s.leads)
  const team = useCrmStore((s) => s.team)

  /* ─── Local State ─── */
  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  /* ─── Single-pass computation: filtered leads + all stats ─── */
  const { filteredLeads, statusBreakdown, teamPerformance, kpiValues, maxStatusCount } = useMemo(() => {
    // Step 1: Active leads
    let result = leads.filter((l) => !l.isArchived)

    // Step 2: Filter by team member
    if (memberFilter !== 'all') {
      if (memberFilter === 'tele') {
        result = result.filter((l) => l.tele && team.tele.includes(l.tele))
      } else if (memberFilter === 'sales') {
        result = result.filter((l) => l.sales && team.sales.includes(l.sales))
      } else {
        result = result.filter((l) => l.tele === memberFilter || l.sales === memberFilter)
      }
    }

    // Step 3: Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (l) =>
          (l.customerName && l.customerName.toLowerCase().includes(q)) ||
          (l.phone && l.phone.toLowerCase().includes(q))
      )
    }

    // Step 4: Status breakdown (single pass)
    const statusCounts: Record<string, number> = {}
    STATUSES.forEach((s) => { statusCounts[s.key] = 0 })
    for (const l of result) {
      const status = l.status || 'new'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    }
    const breakdown = STATUSES.map((s) => ({
      ...s,
      count: statusCounts[s.key] || 0,
      color: STATUS_COLORS[s.key] || '#8892b0',
    }))

    // Step 5: KPI values (single pass)
    let total = result.length
    let contacted = 0
    let meetings = 0
    let closedWon = 0
    let closedLost = 0
    let pending = 0

    for (const l of result) {
      if (l.contactResult && l.contactResult !== 'none' && l.contactResult !== '') contacted++
      if (l.meetingDate && l.meetingDate !== '') meetings++
      if (l.status === 'closed-won' || l.salesStatus === 'closed-won') closedWon++
      if (l.status === 'closed-lost' || l.salesStatus === 'closed-lost') closedLost++
      const s = l.status || 'new'
      if (s === 'new' || s === 'no-reply' || (!l.contactResult || l.contactResult === 'none' || l.contactResult === '')) pending++
    }

    const kpis = [total, contacted, meetings, closedWon, closedLost, pending]

    // Step 6: Team performance (single pass per member)
    const perfRows: TeamPerfRow[] = []
    for (const name of team.tele) {
      let mTotal = 0, mContacted = 0, mMeetings = 0, mClosed = 0
      for (const l of result) {
        if (l.tele !== name) continue
        mTotal++
        if (l.contactResult && l.contactResult !== 'none' && l.contactResult !== '') mContacted++
        if (l.meetingDate && l.meetingDate !== '') mMeetings++
        if (l.status === 'closed-won') mClosed++
      }
      perfRows.push({ name, role: 'tele', total: mTotal, contacted: mContacted, meetings: mMeetings, closedWon: mClosed })
    }
    for (const name of team.sales) {
      let mTotal = 0, mContacted = 0, mMeetings = 0, mClosed = 0
      for (const l of result) {
        if (l.sales !== name) continue
        mTotal++
        if (l.contactResult && l.contactResult !== 'none' && l.contactResult !== '') mContacted++
        if (l.meetingDate && l.meetingDate !== '') mMeetings++
        if (l.salesStatus === 'closed-won') mClosed++
      }
      perfRows.push({ name, role: 'sales', total: mTotal, contacted: mContacted, meetings: mMeetings, closedWon: mClosed })
    }

    // Max status count for bar chart
    const maxCount = Math.max(...breakdown.map((s) => s.count), 1)

    return {
      filteredLeads: result,
      statusBreakdown: breakdown,
      teamPerformance: perfRows,
      kpiValues: kpis,
      maxStatusCount: maxCount,
    }
  }, [leads, team, memberFilter, searchQuery])

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

  /* ─── KPI Card config ─── */
  const kpiCards = [
    { key: 'total', label: 'إجمالي العملاء', color: '#6c63ff', colorBg: 'rgba(108,99,255,.15)', icon: <Users size={16} /> },
    { key: 'contacted', label: 'تم التواصل', color: '#00d4aa', colorBg: 'rgba(0,212,170,.15)', icon: <Phone size={16} /> },
    { key: 'meeting', label: 'لديهم اجتماع', color: '#ffd166', colorBg: 'rgba(255,209,102,.15)', icon: <CalendarCheck size={16} /> },
    { key: 'closed-won', label: 'تم التقفيل', color: '#00d4aa', colorBg: 'rgba(0,212,170,.15)', icon: <Trophy size={16} /> },
    { key: 'closed-lost', label: 'خسارة', color: '#ff6b6b', colorBg: 'rgba(255,107,107,.15)', icon: <XCircle size={16} /> },
    { key: 'pending', label: 'في الانتظار', color: '#6c63ff', colorBg: 'rgba(108,99,255,.15)', icon: <Clock size={16} /> },
  ]

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-5 animate-in fade-in duration-300" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {/* ══════════════════════════════════════════════════
          1. HEADER
          ══════════════════════════════════════════════════ */}
      <div>
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
      </div>

      {/* ══════════════════════════════════════════════════
          2. KPI CARDS ROW
          ══════════════════════════════════════════════════ */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
      >
        {kpiCards.map((kpi, i) => {
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
      </div>

      {/* ══════════════════════════════════════════════════
          3. STATUS BREAKDOWN
          ══════════════════════════════════════════════════ */}
      <Card className="bg-[#111520] border-white/[0.06] rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-bold text-[#f0f2ff] flex items-center gap-2">
            <BarChart3 size={16} className="text-[#6c63ff]" />
            تفصيل الحالات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusBreakdown.map((status) => {
            const pct = filteredLeads.length > 0
              ? Math.round((status.count / filteredLeads.length) * 100)
              : 0
            const barWidth = maxStatusCount > 0
              ? (status.count / maxStatusCount) * 100
              : 0

            return (
              <div key={status.key} className="group">
                <div className="flex items-center gap-3">
                  {/* Label */}
                  <div className="w-32 md:w-40 text-[13px] text-[#f0f2ff] shrink-0 flex items-center gap-1.5">
                    <span className="text-[14px]">{status.label.split(' ')[0]}</span>
                    <span className="truncate">{status.label.split(' ').slice(1).join(' ')}</span>
                  </div>

                  {/* Bar — CSS transition instead of Framer Motion */}
                  <div className="flex-1 h-7 bg-[#0a0d14] rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg transition-all duration-700 ease-out"
                      style={{ background: `${status.color}cc`, width: `${barWidth}%` }}
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

      {/* ══════════════════════════════════════════════════
          4. TEAM PERFORMANCE TABLE
          ══════════════════════════════════════════════════ */}
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
                  filteredTeamPerf.map((member) => (
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
    </div>
  )
}
