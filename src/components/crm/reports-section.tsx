'use client'

import { useCrmStore, formatCurrency, getSourceLabel, getLostReasonLabel } from '@/lib/store'
import { Filter, XCircle, TrendingUp, UserCog, BarChart3, PieChart as PieIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, CartesianGrid } from 'recharts'

const SOURCE_COLORS: Record<string, string> = {
  'meta-ads': '#6c63ff',
  'google-ads': '#00d4aa',
  'website': '#6c9fff',
  'referral': '#ffd166',
  'linkedin': '#ff6b6b',
  'cold-call': '#4a5280',
}

const LOSS_RED_SHADES = ['#ff6b6b', '#ff4d4d', '#e63946', '#d62828', '#ff8c42']

/* Custom tooltip */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#161b28] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] shadow-xl">
      <div className="text-[#8892b0] mb-1">{label}</div>
      <div className="text-[#f0f2ff] font-bold">{payload[0].value}%</div>
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#161b28] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] shadow-xl">
      <div className="text-[#f0f2ff] font-bold">{payload[0].name}: {payload[0].value}</div>
    </div>
  )
}

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

  // Source pie chart data
  const sourcePieData = sourceData.map(s => ({ name: s.label, value: s.count, color: s.color }))

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

  // Loss bar chart data
  const lossBarData = lossData.map(l => ({
    name: l.label,
    value: l.pct,
    fill: LOSS_RED_SHADES[lossData.indexOf(l) % LOSS_RED_SHADES.length],
  }))

  // Monthly trend data (simulated)
  const monthlyTrend = [
    { month: 'يناير', leads: 32, deals: 4, revenue: 28000 },
    { month: 'فبراير', leads: 38, deals: 5, revenue: 35000 },
    { month: 'مارس', leads: 45, deals: 7, revenue: 52000 },
    { month: 'أبريل', leads: 42, deals: 8, revenue: 61000 },
    { month: 'مايو', leads: 51, deals: 10, revenue: 78000 },
    { month: 'يونيو', leads: stats?.totalLeads ?? 47, deals: stats?.closedDeals ?? 11, revenue: stats?.salesValue ?? 84000 },
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
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
      {/* Row 1: Source Pie + Loss Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best Lead Sources - Pie Chart */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#f0f2ff] mb-4">
            <PieIcon size={17} className="text-[#6c63ff]" />
            أفضل مصادر الليدز
          </div>
          <div className="flex items-center gap-4">
            <div className="w-[160px] h-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourcePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    stroke="none"
                  >
                    {sourcePieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2.5 flex-1">
              {sourceData.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[12px] text-[#8892b0] flex-1">{s.label}</span>
                  <span className="text-[12px] font-bold" style={{ color: s.color }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Loss Reasons - Horizontal Bar Chart */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#f0f2ff] mb-4">
            <XCircle size={17} className="text-[#ff6b6b]" />
            أسباب خسارة الصفقات
          </div>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lossBarData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: '#4a5280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,107,107,0.05)' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={20}>
                  {lossBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Monthly Trend Line Chart */}
      <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#f0f2ff]">
            <BarChart3 size={17} className="text-[#00d4aa]" />
            اتجاه المبيعات الشهري
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[#6c63ff]">
              <div className="w-2 h-2 rounded-full bg-[#6c63ff]" /> ليدز
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#00d4aa]">
              <div className="w-2 h-2 rounded-full bg-[#00d4aa]" /> إيرادات
            </div>
          </div>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4a5280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#161b28', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#8892b0' }}
                itemStyle={{ color: '#f0f2ff' }}
              />
              <Line type="monotone" dataKey="leads" stroke="#6c63ff" strokeWidth={2} dot={{ fill: '#6c63ff', r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="deals" stroke="#00d4aa" strokeWidth={2} dot={{ fill: '#00d4aa', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: KPIs & Team Performance */}
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
