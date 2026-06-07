'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import {
  Flame, UserPlus, Phone, CalendarCheck, UserCheck, Percent,
  TrendingUp, TrendingDown, PhoneCall, MessageCircle, Trophy, Bot,
  Target, ArrowLeft,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface ApiStats {
  totalLeads: number
  totalCalls: number
  closedDeals: number
  salesValue: number
  conversionRate: number
  leadsToday: number
  callsToday: number
  dealsToday: number
  pipelineValue: number
  avgDealValue: number
  targetAmount: number
  achievedAmount: number
  hotCount: number
  warmCount: number
  coldCount: number
  overdueCount: number
  weeklyCalls: { day: string; count: number }[]
  callAnalytics: {
    totalMinutes: number
    successCount: number
    failCount: number
    avgDuration: string
  }
  aiScore: number
}

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

function isOverdueLead(lead: Lead): boolean {
  if (lead.isArchived) return false
  if (lead.status === 'closed-won' || lead.status === 'closed-lost') return false
  const needsFollowup = ['followup', 'no-reply', 'callback', 'new', 'whatsapp'].includes(lead.status)
  if (!needsFollowup) return false
  const lastContact = lead.contactResultAt
  if (!lastContact) return true
  const hoursSince = (Date.now() - lastContact) / (1000 * 60 * 60)
  return hoursSince > 24
}

function getInitials(name: string): string {
  if (!name) return '؟'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return name.slice(0, 2)
}

function getTemperatureColor(lead: Lead): string {
  const s = lead.status
  if (s === 'closed-won') return '#00d4aa'
  if (s === 'negotiation' || s === 'proposal-sent') return '#6c63ff'
  if (s === 'followup' || s === 'meeting-done') return '#ffd166'
  if (s === 'closed-lost' || s === 'not-interested') return '#ff6b6b'
  if (s === 'objection-price' || s === 'objection-other') return '#ff6b6b'
  return '#8892b0'
}

function getBadgeForLead(lead: Lead): { label: string; color: string; bg: string } {
  if (isOverdueLead(lead)) return { label: 'متأخر', color: '#ff6b6b', bg: 'rgba(255,107,107,.15)' }
  if (lead.status === 'closed-won') return { label: 'تم التقفيل', color: '#00d4aa', bg: 'rgba(0,212,170,.15)' }
  if (lead.meetingDate) return { label: 'عنده اجتماع', color: '#ffd166', bg: 'rgba(255,209,102,.15)' }
  if (lead.status === 'followup') return { label: 'متابعة', color: '#6c63ff', bg: 'rgba(108,99,255,.15)' }
  if (lead.status === 'new') return { label: 'جديد', color: '#6c9fff', bg: 'rgba(108,159,255,.15)' }
  return { label: lead.status, color: '#8892b0', bg: 'rgba(136,146,176,.1)' }
}

function getCurrentMonthAr(): string {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ]
  return months[new Date().getMonth()]
}

function getDaysRemainingInMonth(): number {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return end.getDate() - now.getDate()
}

function formatCurrency(val: number): string {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `${Math.round(val / 1000)}K`
  return val.toString()
}

/* ═══════════════════════════════════════════════════════
   Dashboard Component — PERFORMANCE OPTIMIZED
   - Removed Framer Motion (was creating stagger timers)
   - Using CSS transitions instead
   - Single-pass KPI computation
   ═══════════════════════════════════════════════════════ */

export function Dashboard() {
  const leads = useCrmStore((s) => s.leads)
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)
  const team = useCrmStore((s) => s.team)
  const setCurrentView = useCrmStore((s) => s.setCurrentView)

  /* ─── Fetch API stats ─── */
  const [apiStats, setApiStats] = useState<ApiStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      try {
        setStatsLoading(true)
        const res = await fetch('/api/stats')
        if (res.ok && !cancelled) {
          const data = await res.json()
          setApiStats(data)
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    loadStats()
    return () => { cancelled = true }
  }, [])

  /* ─── Single-pass: Filter leads by role + compute KPIs ─── */
  const { myLeads, kpiValues, attentionLeads, overdueCount } = useMemo(() => {
    // Step 1: Filter by role
    let filtered: Lead[]
    if (currentRole === 'tele' && currentUser) {
      filtered = leads.filter((l) => l.tele === currentUser && !l.isArchived)
    } else if (currentRole === 'sales' && currentUser) {
      filtered = leads.filter((l) => l.sales === currentUser && !l.isArchived)
    } else {
      filtered = leads.filter((l) => !l.isArchived)
    }

    // Step 2: Single-pass KPI computation
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayTs = todayStart.getTime()

    let leadsCreatedToday = 0
    let callsExecuted = 0
    let meetingsBooked = 0
    let attendedConfirmed = 0
    let closedWon = 0
    const overdue: Lead[] = []

    for (const l of filtered) {
      if (l.createdAt >= todayTs) leadsCreatedToday++
      if (l.contactResult && l.contactResult !== 'none' && l.contactResult !== '') callsExecuted++
      if (l.meetingDate && l.meetingDate !== '') meetingsBooked++
      if (l.attended === 'attended') attendedConfirmed++
      if (l.status === 'closed-won') closedWon++
      if (isOverdueLead(l) && overdue.length < 5) overdue.push(l)
    }

    const conversionRate = filtered.length > 0 ? Math.round((closedWon / filtered.length) * 1000) / 10 : 0

    // Count total overdue
    let totalOverdue = 0
    for (const l of filtered) {
      if (isOverdueLead(l)) totalOverdue++
    }

    return {
      myLeads: filtered,
      kpiValues: { leadsCreatedToday, callsExecuted, meetingsBooked, attendedConfirmed, closedWon, conversionRate },
      attentionLeads: overdue,
      overdueCount: totalOverdue,
    }
  }, [leads, currentUser, currentRole])

  /* ─── Target progress ─── */
  const targetAmount = apiStats?.targetAmount || 115000
  const achievedAmount = apiStats?.achievedAmount || apiStats?.salesValue || 0
  const targetPct = targetAmount > 0 ? Math.min(Math.round((achievedAmount / targetAmount) * 100), 100) : 0
  const remaining = targetAmount - achievedAmount
  const daysLeft = getDaysRemainingInMonth()
  const monthAr = getCurrentMonthAr()

  /* ─── Weekly calls data ─── */
  const weeklyCallsData = useMemo(() => {
    if (apiStats?.weeklyCalls?.length) return apiStats.weeklyCalls
    return [
      { day: 'الأحد', count: 16 },
      { day: 'الإثنين', count: 8 },
      { day: 'الثلاثاء', count: 14 },
      { day: 'الأربعاء', count: 11 },
      { day: 'الخميس', count: 19 },
      { day: 'الجمعة', count: 9 },
      { day: 'السبت', count: 12 },
    ]
  }, [apiStats])

  const maxWeeklyCall = useMemo(
    () => Math.max(...weeklyCallsData.map((d) => d.count), 1),
    [weeklyCallsData]
  )

  /* ─── Call analytics ─── */
  const callAnalytics = apiStats?.callAnalytics ?? { totalMinutes: 0, successCount: 0, failCount: 0, avgDuration: '0:00' }
  const totalCallHours = (callAnalytics.totalMinutes / 60).toFixed(1)

  /* ─── AI Score ─── */
  const aiScore = apiStats?.aiScore ?? 0

  /* ─── KPI Cards Config ─── */
  const kpis = [
    {
      icon: <UserPlus size={16} />,
      color: '#6c63ff',
      colorBg: 'rgba(108,99,255,.15)',
      value: kpiValues.leadsCreatedToday,
      label: 'ليدز جديدة اليوم',
      delta: '+12%',
      up: true,
    },
    {
      icon: <Phone size={16} />,
      color: '#00d4aa',
      colorBg: 'rgba(0,212,170,.15)',
      value: kpiValues.callsExecuted,
      label: 'مكالمات منفذة',
      delta: '+8%',
      up: true,
    },
    {
      icon: <CalendarCheck size={16} />,
      color: '#ffd166',
      colorBg: 'rgba(255,209,102,.15)',
      value: kpiValues.meetingsBooked,
      label: 'اجتماعات محجوزة',
      delta: '+22%',
      up: true,
    },
    {
      icon: <UserCheck size={16} />,
      color: '#00d4aa',
      colorBg: 'rgba(0,212,170,.15)',
      value: kpiValues.attendedConfirmed,
      label: 'حضور مؤكد',
      delta: '+15%',
      up: true,
    },
    {
      icon: <Percent size={16} />,
      color: '#ff6b6b',
      colorBg: 'rgba(255,107,107,.15)',
      value: `${kpiValues.conversionRate}%`,
      label: 'نسبة التحويل',
      delta: kpiValues.conversionRate >= 20 ? '+3%' : '-2%',
      up: kpiValues.conversionRate >= 20,
    },
  ]

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ══════════════════════════════════════════════════
          1. URGENT STRIP
          ══════════════════════════════════════════════════ */}
      <div>
        <div className="relative flex items-center gap-3 bg-gradient-to-br from-[#ff6b6b]/10 to-[#ff6b6b]/4 border border-[#ff6b6b]/20 rounded-2xl px-4 md:px-5 py-4 overflow-hidden">
          {/* Ping indicator */}
          <span className="absolute -top-1 -right-1 w-3 h-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b6b] opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#ff6b6b]" />
          </span>

          {/* Fire icon */}
          <div className="w-10 h-10 rounded-xl bg-[#ff6b6b]/15 flex items-center justify-center shrink-0">
            <Flame size={22} className="text-[#ff6b6b]" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[#f0f2ff]">
              {overdueCount > 0 ? overdueCount : 0} عملاء يحتاجون اهتمامك الآن!
            </div>
            <div className="text-[12px] text-[#8892b0] mt-0.5 truncate">
              {attentionLeads.length > 0
                ? attentionLeads.map((l) => l.customerName || l.phone).join(' · ')
                : 'لا يوجد عملاء بحاجة لاهتمام فوري'}
            </div>
          </div>

          {/* CTA button */}
          <button
            onClick={() => setCurrentView('my-meetings')}
            className="bg-[#161b28] border border-[#ff6b6b]/40 text-[#ff6b6b] px-4 py-2 rounded-xl text-[12px] font-semibold hover:bg-[#ff6b6b]/10 transition-all cursor-pointer shrink-0 hidden sm:flex items-center gap-1.5"
          >
            عرض الكل
            <ArrowLeft size={12} />
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          2. KPI CARDS ROW
          ══════════════════════════════════════════════════ */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
      >
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className="bg-[#111520] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden hover:-translate-y-0.5 hover:border-[#6c63ff]/20 transition-all group"
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
              style={{ color: kpi.color, fontFamily: 'Cairo, sans-serif' }}
            >
              {statsLoading ? '—' : kpi.value}
            </div>

            {/* Label */}
            <div className="text-[12px] text-[#8892b0] mt-0.5">{kpi.label}</div>

            {/* Delta */}
            <div
              className={`text-[11px] mt-2 flex items-center gap-1 ${
                kpi.up ? 'text-[#00d4aa]' : 'text-[#ff6b6b]'
              }`}
            >
              {kpi.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {kpi.delta}
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          3. TARGET PROGRESS BAR
          ══════════════════════════════════════════════════ */}
      <div>
        <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3.5">
            <div>
              <div className="text-[14px] font-semibold text-[#f0f2ff] flex items-center gap-2">
                <Target size={16} className="text-[#6c63ff]" />
                تارجت الشهر — {monthAr} {new Date().getFullYear()}
              </div>
              <div className="text-[12px] text-[#8892b0] mt-0.5">
                {formatCurrency(achievedAmount)} من أصل {formatCurrency(targetAmount)} EGP
              </div>
            </div>
            <div
              className="text-[28px] font-extrabold text-[#6c63ff]"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {targetPct}%
            </div>
          </div>

          {/* Progress bar - CSS transition instead of Framer Motion */}
          <div className="h-3 bg-[#0a0d14] rounded-full overflow-hidden mb-2.5">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                background: 'linear-gradient(to left, #6c63ff, #00d4aa)',
                width: `${targetPct}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[12px] text-[#8892b0]">
            <span>تبقى {formatCurrency(remaining > 0 ? remaining : 0)} EGP للوصول للهدف</span>
            <span>{daysLeft} يوم متبقي</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          4. TWO-COLUMN GRID
          ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── LEFT: Needs Attention ─── */}
        <div>
          <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 h-full">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
              <Flame size={16} className="text-[#ff6b6b]" />
              يحتاجون اهتمامك الآن
            </div>

            {attentionLeads.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {attentionLeads.map((lead) => {
                  const badge = getBadgeForLead(lead)
                  const initials = getInitials(lead.customerName || lead.phone)
                  const tempColor = getTemperatureColor(lead)
                  return (
                    <div
                      key={lead.id}
                      className="flex items-center gap-3 py-2.5 px-3 border border-white/[0.04] rounded-xl hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{
                          background: `${tempColor}20`,
                          color: tempColor,
                          border: `1px solid ${tempColor}33`,
                        }}
                      >
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[#f0f2ff] truncate">
                          {lead.customerName || 'عميل'}
                        </div>
                        <div className="text-[11px] text-[#8892b0] truncate">
                          {lead.storeUrl || lead.phone}
                        </div>
                      </div>

                      {/* Badge */}
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={`tel:${lead.phone}`}
                          className="w-8 h-8 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors"
                          title="اتصال"
                        >
                          <Phone size={14} />
                        </a>
                        <a
                          href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                          title="واتساب"
                        >
                          <MessageCircle size={14} />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-[12px] text-[#8892b0] py-6 text-center">
                لا يوجد عملاء بحاجة لاهتمام فوري 🎉
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Weekly Performance ─── */}
        <div>
          <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 h-full">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
              <PhoneCall size={16} className="text-[#6c63ff]" />
              أداء الأسبوع
            </div>

            <div className="space-y-3">
              {weeklyCallsData.map((dayData, i) => {
                const pct = (dayData.count / maxWeeklyCall) * 100
                const isMax = dayData.count === maxWeeklyCall
                return (
                  <div key={dayData.day} className="flex items-center gap-3">
                    {/* Day label */}
                    <div className="w-16 text-[12px] text-[#8892b0] text-left shrink-0">
                      {dayData.day}
                    </div>

                    {/* Bar — CSS transition instead of Framer Motion */}
                    <div className="flex-1 h-6 bg-[#0a0d14] rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-700 ease-out"
                        style={{
                          background: isMax
                            ? 'linear-gradient(to left, #6c63ff, #00d4aa)'
                            : 'rgba(108,99,255,0.5)',
                          width: `${pct}%`,
                        }}
                      />
                      {/* Count inside bar */}
                      <div className="absolute inset-0 flex items-center justify-end px-2">
                        <span className="text-[11px] font-bold text-[#f0f2ff]">
                          {dayData.count}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Weekly total */}
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[12px] text-[#8892b0]">إجمالي الأسبوع</span>
              <span
                className="text-[14px] font-bold text-[#6c63ff]"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {weeklyCallsData.reduce((s, d) => s + d.count, 0)} مكالمة
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          5. THREE-COLUMN GRID
          ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ─── Call Analytics ─── */}
        <div>
          <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
              <Phone size={16} className="text-[#6c63ff]" />
              Call Analytics
            </div>

            <div
              className="text-[32px] font-extrabold text-[#00d4aa]"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {statsLoading ? '—' : totalCallHours}
              <span className="text-[16px] font-normal text-[#8892b0] mr-1">ساعة</span>
            </div>
            <div className="text-[12px] text-[#8892b0] mt-1">إجمالي وقت المكالمات</div>

            <div className="flex justify-center gap-5 mt-4 pt-3 border-t border-white/[0.06]">
              <div>
                <div
                  className="text-[18px] font-bold text-[#00d4aa]"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {statsLoading ? '—' : callAnalytics.successCount}
                </div>
                <div className="text-[11px] text-[#8892b0]">ناجحة</div>
              </div>
              <div>
                <div
                  className="text-[18px] font-bold text-[#ff6b6b]"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {statsLoading ? '—' : callAnalytics.failCount}
                </div>
                <div className="text-[11px] text-[#8892b0]">فاشلة</div>
              </div>
              <div>
                <div
                  className="text-[18px] font-bold text-[#6c63ff]"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {statsLoading ? '—' : callAnalytics.avgDuration}
                </div>
                <div className="text-[11px] text-[#8892b0]">متوسط</div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── AI Score ─── */}
        <div>
          <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
              <Bot size={16} className="text-[#6c63ff]" />
              AI Score
            </div>

            {/* Circular progress - CSS transition */}
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(108,99,255,0.1)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#6c63ff"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - aiScore / 10)}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-[32px] font-black text-[#6c63ff] leading-none"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {statsLoading ? '—' : aiScore.toFixed(1)}
                </span>
                <span className="text-[12px] text-[#8892b0]">/10</span>
              </div>
            </div>

            <div className="text-[12px] text-[#8892b0] mt-3">متوسط جودة المكالمات</div>
            <div
              className={`text-[12px] mt-1.5 font-medium ${
                aiScore >= 8
                  ? 'text-[#00d4aa]'
                  : aiScore >= 6
                  ? 'text-[#ffd166]'
                  : 'text-[#ff6b6b]'
              }`}
            >
              {aiScore >= 8
                ? 'ممتاز! أعلى من المتوسط'
                : aiScore >= 6
                ? 'جيد — قريب من المتوسط'
                : 'يحتاج تحسين'}
            </div>
          </div>
        </div>

        {/* ─── مركزك (Your Rank) ─── */}
        <div>
          <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
              <Trophy size={16} className="text-[#ffd166]" />
              مركزك
            </div>

            <div className="text-[52px] leading-none">🏆</div>
            <div
              className="text-[20px] font-bold text-[#ffd166] mt-2"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              المركز الأول
            </div>
            <div className="text-[12px] text-[#8892b0] mt-1">
              1,240 نقطة — {monthAr} {new Date().getFullYear()}
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00d4aa]" />
              <span className="text-[11px] text-[#00d4aa]">أعلى من الفريق بـ 18%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
