'use client'

import { useCrmStore, formatCurrency, getSourceLabel, getLostReasonLabel } from '@/lib/store'
import { Filter, XCircle, TrendingUp, UserCog } from 'lucide-react'
import { motion } from 'framer-motion'

const SOURCE_COLORS: Record<string, string> = {
  'meta-ads': '#6c63ff',
  'google-ads': '#00d4aa',
  'website': '#6c9fff',
  'referral': '#ffd166',
  'linkedin': '#ff6b6b',
  'cold-call': '#4a5280',
}

const LOSS_RED_SHADES = ['#ff6b6b', '#ff4d4d', '#e63946', '#d62828', '#ff8c42']

export function ReportsSection() {
  const { leads, stats, team } = useCrmStore()

  const activeLeads = leads.filter(l => !l.isArchived)

  // Source breakdown from stats, fallback to computed
  const sourceData = stats?.sourceBreakdown && Object.keys(stats.sourceBreakdown).length > 0
    ? (() => {
        const total = Object.values(stats.sourceBreakdown).reduce((s, v) => s + v, 0) || 1
        return Object.entries(stats.sourceBreakdown)
          .map(([key, count]) => ({
            key,
            label: getSourceLabel(key),
            pct: Math.round((count / total) * 100),
            count,
            color: SOURCE_COLORS[key] || '#4a5280',
          }))
          .sort((a, b) => b.pct - a.pct)
      })()
    : (() => {
        const sourceCounts: Record<string, number> = {}
        activeLeads.forEach(l => { sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1 })
        const total = activeLeads.length || 1
        return Object.entries(sourceCounts)
          .map(([key, count]) => ({
            key,
            label: getSourceLabel(key),
            pct: Math.round((count / total) * 100),
            count,
            color: SOURCE_COLORS[key] || '#4a5280',
          }))
          .sort((a, b) => b.pct - a.pct)
      })()

  // Loss reason breakdown from stats, fallback to hardcoded
  const lossData = stats?.lostReasonBreakdown && Object.keys(stats.lostReasonBreakdown).length > 0
    ? (() => {
        const total = Object.values(stats.lostReasonBreakdown).reduce((s, v) => s + v, 0) || 1
        return Object.entries(stats.lostReasonBreakdown)
          .map(([key, count]) => ({
            key,
            label: getLostReasonLabel(key),
            pct: Math.round((count / total) * 100),
            count,
          }))
          .sort((a, b) => b.pct - a.pct)
      })()
    : [
        { key: 'price', label: 'السعر', pct: 55, count: 0 },
        { key: 'slow-response', label: 'بطء الرد', pct: 30, count: 0 },
        { key: 'competitor', label: 'منافس', pct: 15, count: 0 },
      ]

  // Team data for dynamic KPIs
  const sortedByRevenue = [...team].sort((a, b) => b.revenue - a.revenue)
  const sortedByConvRate = [...team].sort((a, b) => b.convRate - a.convRate)
  const sortedByCalls = [...team].sort((a, b) => b.calls - a.calls)

  const bestSales = sortedByRevenue[0]
  const bestConvRate = sortedByConvRate[0]
  const mostCalls = sortedByCalls[0]

  const kpiRows = [
    { label: 'تكلفة اكتساب العميل (CAC)', value: `${stats?.cac ?? 320} EGP` },
    { label: 'ROI حملة Meta', value: `${stats?.roi ?? 340}%`, color: '#00d4aa' },
    { label: 'متوسط دورة البيع', value: `${stats?.avgCycleDays ?? 8.3} يوم` },
    { label: 'أعلى Conversion Rate', value: bestConvRate ? `${bestConvRate.nameAr || bestConvRate.name} ${bestConvRate.convRate}%` : 'أحمد سالم 13%' },
    { label: 'إجمالي ليدز الشهر', value: `${stats?.totalLeads ?? activeLeads.length} lead` },
    { label: 'متوسط قيمة الصفقة', value: `${formatCurrency(stats?.avgDealValue ?? 0)} EGP` },
  ]

  const teamRows = [
    { label: 'أفضل موظف (مبيعات)', value: bestSales ? `${bestSales.nameAr || bestSales.name} ${formatCurrency(bestSales.revenue)}` : '—', color: '#ffd166' },
    { label: 'أفضل Conversion Rate', value: bestConvRate ? `${bestConvRate.nameAr || bestConvRate.name} ${bestConvRate.convRate}%` : '—', color: '#00d4aa' },
    { label: 'أكثر مكالمات', value: mostCalls ? `${mostCalls.nameAr || mostCalls.name} ${mostCalls.calls} مكالمة` : 'ريم خالد 95 مكالمة' },
    { label: 'أسرع follow-up', value: 'وليد نصر 8 دقائق' },
    { label: 'متوسط AI Score للفريق', value: `${stats?.aiScore ?? 7.9} / 10`, color: '#6c63ff' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Row 1: Source & Loss */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Best Lead Sources */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#f0f2ff] mb-4">
            <Filter size={17} className="text-[#6c63ff]" />
            أفضل مصادر الليدز
          </div>
          <div className="flex flex-col gap-3">
            {sourceData.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2.5">
                <span className="text-[12px] text-[#8892b0] w-[70px] text-right shrink-0">{s.label}</span>
                <div className="flex-1 h-2 bg-[#0a0d14] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: s.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.pct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                  />
                </div>
                <span className="text-[12px] font-bold min-w-[32px] text-right shrink-0" style={{ color: s.color }}>{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Loss Reasons */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#f0f2ff] mb-4">
            <XCircle size={17} className="text-[#ff6b6b]" />
            أسباب خسارة الصفقات
          </div>
          <div className="flex flex-col gap-3">
            {lossData.map((reason, i) => (
              <div key={reason.key} className="flex items-center gap-2.5">
                <span className="text-[12px] text-[#8892b0] w-[90px] text-right shrink-0">{reason.label}</span>
                <div className="flex-1 h-2 bg-[#0a0d14] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: LOSS_RED_SHADES[i % LOSS_RED_SHADES.length] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${reason.pct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                  />
                </div>
                <span className="text-[12px] font-bold text-[#ff6b6b] min-w-[32px] text-right shrink-0">{reason.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: KPIs & Team Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Management KPIs */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#f0f2ff] mb-4">
            <TrendingUp size={17} className="text-[#00d4aa]" />
            KPIs الإدارة
          </div>
          <div className="flex flex-col">
            {kpiRows.map((row, i) => (
              <motion.div
                key={i}
                className="flex items-center justify-between py-3 border-b border-white/[0.06] last:border-0 text-[13px]"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <span className="text-[#8892b0]">{row.label}</span>
                <span className="font-bold" style={{ color: row.color || '#f0f2ff' }}>{row.value}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Team Performance */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#f0f2ff] mb-4">
            <UserCog size={17} className="text-[#6c63ff]" />
            أداء الفريق
          </div>
          <div className="flex flex-col">
            {teamRows.map((row, i) => (
              <motion.div
                key={i}
                className="flex items-center justify-between py-3 border-b border-white/[0.06] last:border-0 text-[13px]"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <span className="text-[#8892b0]">{row.label}</span>
                <span className="font-bold" style={{ color: row.color || '#f0f2ff' }}>{row.value}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
