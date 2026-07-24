'use client'

import { useCrmStore, formatCurrency } from '@/lib/store'
import { Trophy, Medal, Flame, Rocket, Star, Phone, Crown, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

const MEDALS = ['🥇', '🥈', '🥉']

const BADGE_MAP: Record<string, { icon: React.ReactNode; color: string }> = {
  'Closer': { icon: <Flame size={22} />, color: '#ff6b6b' },
  'Speed': { icon: <Rocket size={22} />, color: '#6c9fff' },
  'Top 10%': { icon: <Star size={22} />, color: '#ffd166' },
  '100 Calls': { icon: <Phone size={22} />, color: '#00d4aa' },
  'Champion': { icon: <Crown size={22} />, color: '#6c63ff' },
  'Steady': { icon: <Zap size={22} />, color: '#ffd166' },
  'Fast Follow-up': { icon: <Rocket size={22} />, color: '#6c9fff' },
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6c63ff, #00d4aa)',
  'linear-gradient(135deg, #ff6b6b, #ffd166)',
  'linear-gradient(135deg, #6c9fff, #6c63ff)',
  'linear-gradient(135deg, #00d4aa, #6c9fff)',
  'linear-gradient(135deg, #ffd166, #ff6b6b)',
]

function getCurrentMonthArabic(): string {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ]
  const now = new Date()
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}

function parseBadges(badgesStr: string): string[] {
  try {
    const parsed = JSON.parse(badgesStr)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function TeamSection() {
  const { team } = useCrmStore()

  const salesTeam = team.length > 0
    ? [...team].sort((a, b) => b.revenue - a.revenue)
    : [
        { id: '1', name: 'Ahmed Salem', nameAr: 'أحمد سالم', role: 'senior-sales', initials: 'أح', points: 1240, deals: 11, revenue: 84000, calls: 83, convRate: 13, avatar: '', badges: '["Closer","Speed","Top 10%","100 Calls","Champion"]' },
        { id: '2', name: 'Reem Khaled', nameAr: 'ريم خالد', role: 'sales', initials: 'ري', points: 890, deals: 9, revenue: 63000, calls: 95, convRate: 11, avatar: '', badges: '["100 Calls","Steady"]' },
        { id: '3', name: 'Waleed Nasser', nameAr: 'وليد نصر', role: 'sales', initials: 'ول', points: 720, deals: 7, revenue: 51000, calls: 68, convRate: 10, avatar: '', badges: '["Fast Follow-up"]' },
        { id: '4', name: 'Marwa Hussein', nameAr: 'مروة حسين', role: 'sales', initials: 'مر', points: 540, deals: 5, revenue: 38000, calls: 52, convRate: 9, avatar: '', badges: '[]' },
      ]

  const maxRevenue = Math.max(...salesTeam.map(m => m.revenue))
  const topMember = salesTeam[0]
  const topBadges = topMember ? parseBadges(topMember.badges) : []

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
            <Trophy size={17} className="text-[#ffd166]" />
            Leaderboard — {getCurrentMonthArabic()}
          </div>
          <div className="flex flex-col gap-1">
            {salesTeam.map((member, i) => {
              const pct = maxRevenue > 0 ? (member.revenue / maxRevenue) * 100 : 0
              const isCurrentUser = i === 0
              return (
                <motion.div
                  key={member.id}
                  className={`flex items-center gap-3 py-3 px-3 rounded-[10px] transition-colors ${isCurrentUser ? 'bg-[#6c63ff]/8 border border-[#6c63ff]/15' : 'hover:bg-white/[0.02]'}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                >
                  <span className="text-[15px] w-7 text-center shrink-0">
                    {i < 3 ? MEDALS[i] : <span className="text-[13px] text-[#4a5280] font-bold">{i + 1}</span>}
                  </span>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0 shadow-md"
                    style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}
                  >
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#f0f2ff]">{member.nameAr || member.name}</span>
                      {isCurrentUser && (
                        <span className="text-[11px] font-bold text-[#6c63ff] bg-[#6c63ff]/15 px-2 py-0.5 rounded-md">أنت</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#8892b0] mt-0.5">{member.deals} صفقات · {member.convRate}% conv</div>
                  </div>
                  <div className="w-[80px] h-[5px] bg-[#0a0d14] rounded-full overflow-hidden shrink-0">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: isCurrentUser ? 'linear-gradient(90deg, #6c63ff, #00d4aa)' : '#6c63ff' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                    />
                  </div>
                  <span className="text-[14px] font-bold text-[#00d4aa] min-w-[50px] text-left shrink-0" style={{ fontFamily: 'Cairo' }}>
                    {formatCurrency(member.revenue)}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Points & Badges */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-[14px] font-semibold text-[#f0f2ff] mb-4">
            <Medal size={17} className="text-[#6c63ff]" />
            نقاطك وشاراتك
          </div>

          <div className="mb-2">
            <div className="text-[46px] font-black text-[#6c63ff] leading-none" style={{ fontFamily: 'Cairo' }}>
              {topMember?.points?.toLocaleString() ?? '1,240'}
            </div>
            <div className="text-[14px] text-[#8892b0] mt-1">نقطة</div>
          </div>

          <div className="text-[14px] text-[#00d4aa] font-semibold mb-1">
            🏆 المركز الأول هذا الشهر!
          </div>
          <div className="text-[12px] text-[#4a5280] mb-5">+{topMember ? Math.round(topMember.points * 0.24) : 240} نقطة عن الشهر الماضي</div>

          <div className="grid grid-cols-5 gap-2">
            {topBadges.length > 0 ? topBadges.map((badgeKey, i) => {
              const badgeInfo = BADGE_MAP[badgeKey]
              return (
                <motion.div
                  key={i}
                  className="bg-[#161b28] border border-white/[0.06] rounded-[10px] py-3 px-1 text-center hover:border-[#ffd166]/40 hover:-translate-y-0.5 transition-all cursor-default"
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="flex justify-center mb-1.5" style={{ color: badgeInfo?.color || '#ffd166' }}>
                    {badgeInfo?.icon || <Star size={22} />}
                  </div>
                  <div className="text-[11px] text-[#8892b0] leading-tight">{badgeKey}</div>
                </motion.div>
              )
            }) : (
              <div className="col-span-5 text-[12px] text-[#4a5280] py-4">لا توجد شارات بعد</div>
            )}
          </div>

          {/* All available badges preview (if earned badges < 5) */}
          {topBadges.length > 0 && topBadges.length < 5 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <div className="text-[11px] text-[#4a5280] mb-2">شارات قادمة</div>
              <div className="flex gap-2 justify-center flex-wrap">
                {Object.entries(BADGE_MAP)
                  .filter(([key]) => !topBadges.includes(key))
                  .slice(0, 3)
                  .map(([key, info]) => (
                    <div key={key} className="bg-[#0a0d14] border border-white/[0.04] rounded-lg px-2.5 py-1.5 text-center opacity-40">
                      <div className="flex justify-center mb-0.5" style={{ color: info.color }}>{info.icon}</div>
                      <div className="text-[11px] text-[#4a5280]">{key}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
