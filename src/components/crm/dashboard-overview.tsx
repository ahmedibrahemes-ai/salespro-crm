'use client'

import { useMemo } from 'react'
import { useCrmStore, formatCurrency, formatCurrencyFull, isOverdue, isToday, getInitials, getTemperatureLabel } from '@/lib/store'
import { UserPlus, Phone, Handshake, DollarSign, Percent, TrendingUp, TrendingDown, Flame, PhoneCall, Trophy, MessageCircle, Bot } from 'lucide-react'
import { motion } from 'framer-motion'

/* ─── helpers ─── */
function formatSalesValue(v: number): string {
  if (v >= 1000) return `${Math.round(v / 1000)}K`
  return v.toString()
}

function getDaysRemainingInMonth(): number {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return end.getDate() - now.getDate()
}

function getCurrentMonthAr(): string {
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  return months[new Date().getMonth()]
}

/* ─── badge type for attention leads ─── */
type AttentionBadge = 'Overdue' | 'Hot' | 'Today'

function getAttentionBadge(lead: {
  nextFollowUp: string | null
  hot: boolean
  status: string
}): { label: string; type: AttentionBadge; color: string; bg: string } {
  if (isOverdue(lead as any)) return { label: 'Overdue', type: 'Overdue', color: '#ff6b6b', bg: 'rgba(255,107,107,.15)' }
  if (isToday(lead.nextFollowUp)) return { label: 'Today', type: 'Today', color: '#ffd166', bg: 'rgba(255,209,102,.15)' }
  if (lead.hot) return { label: 'Hot', type: 'Hot', color: '#ff6b6b', bg: 'rgba(255,107,107,.15)' }
  return { label: 'Warm', type: 'Hot', color: '#ffd166', bg: 'rgba(255,209,102,.15)' }
}

/* ─── main component ─── */
export function DashboardOverview() {
  const { stats, leads, setCurrentView } = useCrmStore()

  /* derived data */
  const attentionLeads = useMemo(() => {
    const scored = leads
      .filter(l => l.status !== 'won' && l.status !== 'lost' && !l.isArchived)
      .map(l => {
        let score = 0
        if (isOverdue(l)) score += 10
        if (isToday(l.nextFollowUp)) score += 7
        if (l.hot) score += 5
        if (l.probability >= 60) score += 3
        return { ...l, score }
      })
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, 3)
  }, [leads])

  const overdueCount = useMemo(() => leads.filter(l => isOverdue(l)).length, [leads])

  const targetPct = stats
    ? stats.targetAmount > 0
      ? Math.min(Math.round((stats.achievedAmount / stats.targetAmount) * 100), 100)
      : 0
    : 0

  const remaining = stats ? stats.targetAmount - stats.achievedAmount : 0
  const daysLeft = getDaysRemainingInMonth()
  const monthAr = getCurrentMonthAr()

  /* KPI cards */
  const kpis = [
    { icon: <UserPlus size={16} />, color: '#6c63ff', colorBg: 'rgba(108,99,255,.15)', value: stats?.leadsToday ?? 0, label: 'ليدز جديدة اليوم', delta: '+12%', up: true },
    { icon: <Phone size={16} />, color: '#00d4aa', colorBg: 'rgba(0,212,170,.15)', value: stats?.totalCalls ?? 0, label: 'مكالمات منفذة', delta: '+8%', up: true },
    { icon: <Handshake size={16} />, color: '#ffd166', colorBg: 'rgba(255,209,102,.15)', value: stats?.closedDeals ?? 0, label: 'صفقات مقفولة', delta: '+22%', up: true },
    { icon: <DollarSign size={16} />, color: '#00d4aa', colorBg: 'rgba(0,212,170,.15)', value: formatSalesValue(stats?.salesValue ?? 0), label: 'قيمة المبيعات EGP', delta: '+18%', up: true },
    { icon: <Percent size={16} />, color: '#ff6b6b', colorBg: 'rgba(255,107,107,.15)', value: `${stats?.conversionRate ?? 0}%`, label: 'Conversion Rate', delta: '-2%', up: false },
  ]

  /* weekly calls */
  const weeklyCalls = stats?.weeklyCalls ?? []
  const maxCallCount = Math.max(...weeklyCalls.map(d => d.count), 1)

  /* call analytics */
  const callAnalytics = stats?.callAnalytics ?? { totalMinutes: 0, successCount: 0, failCount: 0, avgDuration: '0:00' }
  const totalCallHours = (callAnalytics.totalMinutes / 60).toFixed(1)

  /* ai score */
  const aiScore = stats?.aiScore ?? 0
  const aiQualityLabel = aiScore >= 8 ? 'ممتاز! أعلى من المتوسط بـ 15%' : aiScore >= 6 ? 'جيد — قريب من المتوسط' : 'يحتاج تحسين'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-5"
    >
      {/* ═══════════════ 1. URGENT STRIP ═══════════════ */}
      <div className="relative flex items-center gap-3 bg-gradient-to-br from-[#ff6b6b]/10 to-[#ff6b6b]/4 border border-[#ff6b6b]/20 rounded-2xl px-5 py-4 overflow-hidden">
        {/* pulse ring */}
        <span className="absolute -top-1 -right-1 w-3 h-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b6b] opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#ff6b6b]" />
        </span>

        <div className="w-10 h-10 rounded-xl bg-[#ff6b6b]/15 flex items-center justify-center shrink-0">
          <Flame size={22} className="text-[#ff6b6b]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-[#f0f2ff]">
            {overdueCount > 0 ? overdueCount : 3} عملاء يحتاجون اهتمامك الآن!
          </div>
          <div className="text-[12px] text-[#8892b0] mt-0.5 truncate">
            {attentionLeads.length > 0
              ? attentionLeads.map(l => l.name).join(' · ')
              : 'لا يوجد عملاء بحاجة لاهتمام فوري'}
          </div>
        </div>

        <button
          onClick={() => setCurrentView('followup')}
          className="bg-[#161b28] border border-[#ff6b6b]/40 text-[#ff6b6b] px-4 py-2 rounded-xl text-[12px] font-semibold hover:bg-[#ff6b6b]/10 transition-all cursor-pointer shrink-0"
        >
          عرض الكل
        </button>
      </div>

      {/* ═══════════════ 2. KPI CARDS ROW ═══════════════ */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        {kpis.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            className="bg-[#111520] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden hover:-translate-y-0.5 hover:border-[#6c63ff]/20 transition-all group"
          >
            {/* decorative corner */}
            <div
              className="absolute top-0 right-0 w-[56px] h-[56px] rounded-t-2xl rounded-bl-[56px] opacity-[0.07]"
              style={{ background: kpi.color }}
            />

            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: kpi.colorBg, color: kpi.color }}
            >
              {kpi.icon}
            </div>

            <div
              className="text-[26px] font-extrabold leading-tight"
              style={{ color: kpi.color, fontFamily: 'Cairo, sans-serif' }}
            >
              {kpi.value}
            </div>

            <div className="text-[12px] text-[#8892b0] mt-0.5">{kpi.label}</div>

            <div className={`text-[11px] mt-2 flex items-center gap-1 ${kpi.up ? 'text-[#00d4aa]' : 'text-[#ff6b6b]'}`}>
              {kpi.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {kpi.delta} من الأسبوع الماضي
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══════════════ 3. TARGET BAR ═══════════════ */}
      <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-3.5">
          <div>
            <div className="text-[14px] font-semibold text-[#f0f2ff]">
              Target vs Achievement — {monthAr} {new Date().getFullYear()}
            </div>
            <div className="text-[12px] text-[#8892b0] mt-0.5">
              {formatCurrencyFull(stats?.achievedAmount ?? 0)} من أصل {formatCurrencyFull(stats?.targetAmount ?? 0)} EGP
            </div>
          </div>
          <div
            className="text-[28px] font-extrabold text-[#6c63ff]"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {targetPct}%
          </div>
        </div>

        <div className="h-3 bg-[#0a0d14] rounded-full overflow-hidden mb-2.5">
          <motion.div
            className="h-full bg-gradient-to-l from-[#6c63ff] to-[#00d4aa] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${targetPct}%` }}
            transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>

        <div className="flex items-center justify-between text-[12px] text-[#8892b0]">
          <span>تبقى {formatCurrency(remaining > 0 ? remaining : 0)} EGP للوصول للـ Target</span>
          <span>{daysLeft} يوم متبقي</span>
        </div>
      </div>

      {/* ═══════════════ 4. TWO-COLUMN GRID ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: Needs Attention */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
            <Flame size={16} className="text-[#ff6b6b]" />
            يحتاجون اهتمامك الآن
          </div>

          {attentionLeads.length > 0 ? (
            <div className="space-y-2">
              {attentionLeads.map((lead) => {
                const badge = getAttentionBadge(lead)
                const initials = getInitials(lead.name)
                return (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 py-2.5 px-3 border border-white/[0.04] rounded-xl hover:bg-white/[0.02] transition-colors"
                  >
                    {/* avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.color}33`,
                      }}
                    >
                      {initials}
                    </div>

                    {/* info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#f0f2ff] truncate">{lead.name}</div>
                      <div className="text-[11px] text-[#8892b0] truncate">
                        {lead.company || lead.source} · {lead.phone}
                      </div>
                    </div>

                    {/* badge */}
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>

                    {/* action buttons */}
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

        {/* RIGHT: Weekly Calls Chart */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
            <PhoneCall size={16} className="text-[#6c63ff]" />
            أداء الأسبوع (مكالمات)
          </div>

          <div className="flex flex-col gap-3">
            {weeklyCalls.map((item, i) => (
              <div key={item.day} className="flex items-center gap-2.5">
                <span className="text-[11px] text-[#8892b0] w-[52px] text-right shrink-0">
                  {item.day}
                </span>
                <div className="flex-1 h-2 bg-[#0a0d14] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        i === weeklyCalls.length - 1
                          ? '#00d4aa'
                          : i % 2 === 0
                            ? '#6c63ff'
                            : '#6c63ff99',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.count / maxCallCount) * 100}%` }}
                    transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[12px] font-semibold text-[#f0f2ff] w-7 text-left shrink-0" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>

          {/* weekly total */}
          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[12px] text-[#8892b0]">إجمالي الأسبوع</span>
            <span className="text-[14px] font-bold text-[#6c63ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
              {weeklyCalls.reduce((s, d) => s + d.count, 0)} مكالمة
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════ 5. THREE-COLUMN GRID ═══════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Call Analytics */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
            <Phone size={16} className="text-[#6c63ff]" />
            Call Analytics
          </div>

          <div className="text-[32px] font-extrabold text-[#00d4aa]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {totalCallHours} ساعة
          </div>
          <div className="text-[12px] text-[#8892b0] mt-1">إجمالي وقت المكالمات</div>

          <div className="flex justify-center gap-5 mt-4 pt-3 border-t border-white/[0.06]">
            <div>
              <div className="text-[18px] font-bold text-[#00d4aa]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {callAnalytics.successCount}
              </div>
              <div className="text-[11px] text-[#8892b0]">ناجحة</div>
            </div>
            <div>
              <div className="text-[18px] font-bold text-[#ff6b6b]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {callAnalytics.failCount}
              </div>
              <div className="text-[11px] text-[#8892b0]">فاشلة</div>
            </div>
            <div>
              <div className="text-[18px] font-bold text-[#6c63ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {callAnalytics.avgDuration}
              </div>
              <div className="text-[11px] text-[#8892b0]">متوسط</div>
            </div>
          </div>
        </div>

        {/* AI Score */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
            <Bot size={16} className="text-[#6c63ff]" />
            AI Score اليوم
          </div>

          <div className="relative inline-flex items-center justify-center">
            {/* ring background */}
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(108,99,255,0.1)" strokeWidth="8" />
              <motion.circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#6c63ff"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - aiScore / 10) }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[32px] font-black text-[#6c63ff] leading-none" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {aiScore.toFixed(1)}
              </span>
              <span className="text-[12px] text-[#8892b0]">/10</span>
            </div>
          </div>

          <div className="text-[12px] text-[#8892b0] mt-3">متوسط جودة المكالمات</div>
          <div className={`text-[12px] mt-1.5 font-medium ${aiScore >= 8 ? 'text-[#00d4aa]' : aiScore >= 6 ? 'text-[#ffd166]' : 'text-[#ff6b6b]'}`}>
            {aiQualityLabel}
          </div>
        </div>

        {/* Ranking */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
            <Trophy size={16} className="text-[#ffd166]" />
            مركزك
          </div>

          <div className="text-[52px] leading-none">🏆</div>

          <div className="text-[20px] font-bold text-[#ffd166] mt-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
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
    </motion.div>
  )
}
