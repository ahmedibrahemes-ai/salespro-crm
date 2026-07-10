'use client'

import { useMemo, useState } from 'react'
import { Sparkles, TrendingUp, Target, Award, Activity, DollarSign, Phone } from 'lucide-react'
import { useCrmStore, getDateRange } from '@/lib/store'
import { isClosedWon, isCallContactResult } from '@/lib/crm-utils'
import { AIInsightButton } from './ai-insight-button'
import { SmartReplyButton } from './smart-reply-button'

/**
 * AIPanel — AI insights panel for the admin dashboard.
 *
 * Shows AI-powered analysis buttons:
 * - Team Performance Analysis (overall)
 * - Per-employee coaching
 * - Call analytics insights
 *
 * Reads lead/team data from the store and sends to /api/ai for analysis.
 */

export function AIPanel() {
  const allLeads = useCrmStore((s) => s.leads)
  const team = useCrmStore((s) => s.team)
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)

  // FIX: Filter leads by role — employees see only their own leads,
  // admin sees all. This makes the AI panel personalized per user.
  const leads = useMemo(() => {
    if (!allLeads) return []
    if (currentRole === 'admin') return allLeads.filter((l) => !l.isArchived)
    if (currentRole === 'tele' && currentUser) {
      return allLeads.filter((l) => l.tele === currentUser && !l.isArchived)
    }
    if (currentRole === 'sales' && currentUser) {
      return allLeads.filter((l) => l.sales === currentUser && !l.isArchived)
    }
    return allLeads.filter((l) => !l.isArchived)
  }, [allLeads, currentRole, currentUser])

  // Compute team performance metrics for AI analysis — CURRENT MONTH ONLY.
  // Uses the same logic as the dashboard KPIs to ensure consistency.
  const teamMetrics = useMemo(() => {
    const { from, to } = getDateRange('month')

    const perTele: Record<string, { total: number; meetings: number; attended: number; noShow: number; closedWon: number; calls: number; transfers: number }> = {}
    const perSales: Record<string, { total: number; meetings: number; attended: number; noShow: number; closedWon: number; calls: number; transfers: number }> = {}

    for (const lead of leads) {
      // Tele metrics
      if (lead.tele) {
        if (!perTele[lead.tele]) perTele[lead.tele] = { total: 0, meetings: 0, attended: 0, noShow: 0, closedWon: 0, calls: 0, transfers: 0 }
        perTele[lead.tele].total++
        // meetings (transfers): assignedAt within this month
        if (lead.assignedAt && lead.assignedAt >= from && lead.assignedAt < to) {
          perTele[lead.tele].meetings++
          perTele[lead.tele].transfers++
          if (lead.attended === 'attended') perTele[lead.tele].attended++
          if (lead.attended === 'no-show') perTele[lead.tele].noShow++
        }
        // calls: isCallContactResult + contactResultAt within this month
        if (lead.contactResultAt && lead.contactResultAt >= from && lead.contactResultAt < to && isCallContactResult(lead.contactResult)) {
          perTele[lead.tele].calls++
        }
      }
      // Sales metrics
      if (lead.sales) {
        if (!perSales[lead.sales]) perSales[lead.sales] = { total: 0, meetings: 0, attended: 0, noShow: 0, closedWon: 0, calls: 0, transfers: 0 }
        perSales[lead.sales].total++
        // meetings: assignedAt within this month (tele-transferred + sales-originated)
        if (lead.assignedAt && lead.assignedAt >= from && lead.assignedAt < to) {
          perSales[lead.sales].meetings++
          perSales[lead.sales].transfers++
          if (lead.attended === 'attended') perSales[lead.sales].attended++
          if (lead.attended === 'no-show') perSales[lead.sales].noShow++
        }
        // calls: isCallContactResult + contactResultAt within this month
        if (lead.contactResultAt && lead.contactResultAt >= from && lead.contactResultAt < to && isCallContactResult(lead.contactResult)) {
          perSales[lead.sales].calls++
        }
        // closedWon: isClosedWon + assignedAt within this month
        if (isClosedWon(lead) && lead.assignedAt && lead.assignedAt >= from && lead.assignedAt < to) {
          perSales[lead.sales].closedWon++
        }
      }
    }

    return {
      totalLeads: leads.length,
      perTele: Object.entries(perTele).map(([name, m]) => ({
        name,
        role: 'tele' as const,
        ...m,
        // convRate = attended / total transfers (NOT total leads)
        convRate: m.transfers > 0 ? Math.round((m.attended / m.transfers) * 100) : 0,
      })),
      perSales: Object.entries(perSales).map(([name, m]) => ({
        name,
        role: 'sales' as const,
        ...m,
        // convRate = closedWon / total meetings this month
        convRate: m.meetings > 0 ? Math.round((m.closedWon / m.meetings) * 100) : 0,
      })),
    }
  }, [leads])

  // Overall performance data for AI
  const performanceData = useMemo(() => ({
    totalLeads: teamMetrics.totalLeads,
    teleCount: teamMetrics.perTele.length,
    salesCount: teamMetrics.perSales.length,
    totalMeetings: teamMetrics.perTele.reduce((sum, t) => sum + t.meetings, 0),
    totalAttended: teamMetrics.perTele.reduce((sum, t) => sum + t.attended, 0),
    totalNoShow: teamMetrics.perTele.reduce((sum, t) => sum + t.noShow, 0),
    totalClosedWon: teamMetrics.perSales.reduce((sum, s) => sum + s.closedWon, 0),
    perTele: teamMetrics.perTele,
    perSales: teamMetrics.perSales,
  }), [teamMetrics])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#6c63ff] to-[#00d4aa]">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            تحليلات الذكاء الاصطناعي
          </h2>
          <p className="text-[11px] text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            رؤى وتوصيات ذكية لتحسين الأداء
          </p>
        </div>
      </div>

      {/* Quick stats — 4th card differs by role:
          Tele: 'لم يحضروا' (no-show) — tele is not responsible for closings
          Sales/Admin: 'تقفيل' (closed-won) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Phone className="w-4 h-4" />}
          label="إجمالي العملاء"
          value={String(teamMetrics.totalLeads)}
          color="text-blue-400 bg-blue-500/10"
        />
        <StatCard
          icon={<Target className="w-4 h-4" />}
          label="اجتماعات"
          value={String(performanceData.totalMeetings)}
          color="text-purple-400 bg-purple-500/10"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="حضروا"
          value={String(performanceData.totalAttended)}
          color="text-emerald-400 bg-emerald-500/10"
        />
        {currentRole === 'tele' ? (
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="لم يحضروا"
            value={String(performanceData.totalNoShow)}
            color="text-red-400 bg-red-500/10"
          />
        ) : (
          <StatCard
            icon={<Award className="w-4 h-4" />}
            label="تقفيل"
            value={String(performanceData.totalClosedWon)}
            color="text-amber-400 bg-amber-500/10"
          />
        )}
      </div>

      {/* AI Analysis buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Team Performance Analysis */}
        <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-[14px] font-bold text-[#f0f2ff] mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                تحليل أداء الفريق
              </h3>
              <p className="text-[11px] text-[#8892b0]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                نظرة شاملة على أداء التيلي والسيلز
              </p>
            </div>
            <AIInsightButton
              type="analyze-performance"
              data={performanceData}
              label="تحليل"
              variant="full"
            />
          </div>
          <div className="space-y-1.5">
            {teamMetrics.perTele.slice(0, 3).map((t) => (
              <div key={t.name} className="flex items-center justify-between text-[11px]">
                <span className="text-[#8892b0]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {t.name} (تيلي)
                </span>
                <span className="text-[#4a5280]">
                  {t.total} عميل · {t.convRate}% حضور
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Coaching for current user (or top performer if admin) */}
        <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-[14px] font-bold text-[#f0f2ff] mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                كوتشينج شخصي
              </h3>
              <p className="text-[11px] text-[#8892b0]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                نصائح تطويرية مخصصة
              </p>
            </div>
            {currentUser && (() => {
              // Find current user's metrics
              const userRole = currentRole === 'tele' ? teamMetrics.perTele : teamMetrics.perSales
              const userMetrics = userRole.find((u) => u.name === currentUser)
              if (!userMetrics) return null
              return (
                <AIInsightButton
                  type="coaching"
                  data={{
                    name: userMetrics.name,
                    deals: userMetrics.closedWon,
                    revenue: 0, // not tracked yet
                    calls: userMetrics.calls,
                    convRate: userMetrics.convRate,
                    points: 0,
                  }}
                  label="كوتشينج"
                  variant="full"
                />
              )
            })()}
          </div>
          <p className="text-[11px] text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            احصل على تقييم ومهارة مقترحة لتطويرها وهدف أسبوعي
          </p>
        </div>
      </div>

      {/* Per-employee coaching list — admin sees all, employees see only themselves */}
      {currentRole === 'admin' && (
      <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-4">
        <h3 className="text-[14px] font-bold text-[#f0f2ff] mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
          كوتشينج لكل موظف
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[...teamMetrics.perTele, ...teamMetrics.perSales].map((emp) => (
            <div
              key={`${emp.role}-${emp.name}`}
              className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold shrink-0 ${emp.role === 'tele' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                  {emp.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#f0f2ff] truncate" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    {emp.name}
                  </p>
                  <p className="text-[10px] text-[#4a5280]">
                    {emp.role === 'tele' ? 'تيلي' : 'سيلز'} · {emp.total} عميل
                  </p>
                </div>
              </div>
              <AIInsightButton
                type="coaching"
                data={{
                  name: emp.name,
                  deals: emp.closedWon,
                  revenue: 0,
                  calls: emp.calls,
                  convRate: emp.convRate,
                  points: 0,
                }}
                label=""
                variant="compact"
              />
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Smart Reply tool */}
      <SmartReplyTool />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Smart Reply Tool — generate professional reply suggestions
   ═══════════════════════════════════════════════════════ */
function SmartReplyTool() {
  const [message, setMessage] = useState('')
  const [leadName, setLeadName] = useState('')
  const [stage, setStage] = useState('new')

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6c63ff]/20 to-[#00d4aa]/20">
          <Sparkles className="w-4 h-4 text-[#6c63ff]" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            مولّد الردود الذكية
          </h3>
          <p className="text-[11px] text-[#8892b0]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            اكتب رسالة العميل واحصل على رد مقترح
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
        <input
          type="text"
          value={leadName}
          onChange={(e) => setLeadName(e.target.value)}
          placeholder="اسم العميل"
          className="bg-[#0a0d14] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#f0f2ff] placeholder:text-[#4a5280] focus:border-[#6c63ff] focus:outline-none transition-colors"
          style={{ fontFamily: 'Cairo, sans-serif' }}
          dir="rtl"
        />
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="bg-[#0a0d14] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#f0f2ff] focus:border-[#6c63ff] focus:outline-none transition-colors cursor-pointer"
          style={{ fontFamily: 'Cairo, sans-serif' }}
          dir="rtl"
        >
          <option value="new">جديد</option>
          <option value="contacted">تم التواصل</option>
          <option value="followup">متابعة</option>
          <option value="meeting">اجتماع</option>
          <option value="negotiation">تفاوض</option>
          <option value="closed-won">تم التقفيل</option>
        </select>
        <div className="flex items-end">
          <SmartReplyButton
            message={message}
            leadName={leadName || 'عميل'}
            stage={stage}
          />
        </div>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="اكتب رسالة العميل هنا..."
        rows={3}
        className="w-full bg-[#0a0d14] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#f0f2ff] placeholder:text-[#4a5280] focus:border-[#6c63ff] focus:outline-none transition-colors resize-none"
        style={{ fontFamily: 'Cairo, sans-serif' }}
        dir="rtl"
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}>
          {icon}
        </div>
        <span className="text-[11px] text-[#8892b0]" style={{ fontFamily: 'Cairo, sans-serif' }}>
          {label}
        </span>
      </div>
      <p className="text-[20px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
        {value}
      </p>
    </div>
  )
}
