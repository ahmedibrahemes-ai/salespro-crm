'use client'

import { useCrmStore, getInitials, formatCurrency, getStatusColor, getSourceLabel, getTemperatureLabel, PIPELINE_STAGES } from '@/lib/store'
import { Phone, MessageCircle, Mail, MapPin, Tag, Filter, Bot, Activity } from 'lucide-react'
import { motion } from 'framer-motion'

const ACTIVITY_COLORS: Record<string, { dot: string; bg: string; icon: React.ReactNode }> = {
  call: { dot: '#6c63ff', bg: 'rgba(108,99,255,.15)', icon: <Phone size={13} /> },
  whatsapp: { dot: '#00d4aa', bg: 'rgba(0,212,170,.15)', icon: <MessageCircle size={13} /> },
  email: { dot: '#6c9fff', bg: 'rgba(108,159,255,.15)', icon: <Mail size={13} /> },
  note: { dot: '#ffd166', bg: 'rgba(255,209,102,.15)', icon: <Tag size={13} /> },
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `منذ ${diffMins} دقيقة`
  if (diffHours < 24) return `منذ ${diffHours} ساعة`
  if (diffDays < 7) return `منذ ${diffDays} يوم`
  return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
}

export function Client360() {
  const { leads, selectedLeadId } = useCrmStore()

  // Find selected lead, or default to first hot lead (hot=true, status not won/lost)
  const lead = leads.find(l => l.id === selectedLeadId)
    || leads.find(l => l.hot && l.status !== 'won' && l.status !== 'lost')
    || leads[0]

  if (!lead) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="text-[#8892b0] text-center py-12 text-[14px]">لا يوجد بيانات عملاء — أضف ليدز أولاً</div>
      </motion.div>
    )
  }

  const stageInfo = getStatusColor(lead.status)
  const currentStage = PIPELINE_STAGES.find(s => s.key === lead.status)
  const tempInfo = getTemperatureLabel(lead)

  const infoItems = [
    { icon: <Tag size={14} />, label: 'مصدر الـ Lead', value: getSourceLabel(lead.source) },
    { icon: <Phone size={14} />, label: 'موبايل', value: lead.phone, color: '#6c63ff' },
    { icon: <Mail size={14} />, label: 'إيميل', value: lead.email || '—', color: '#6c9fff' },
    { icon: <MapPin size={14} />, label: 'موقع', value: lead.location || '—' },
    {
      icon: <Filter size={14} />,
      label: 'المرحلة',
      value: currentStage?.label || lead.status,
      badge: true,
      badgeColor: stageInfo.color,
      badgeBg: stageInfo.bg,
    },
    {
      icon: <Bot size={14} />,
      label: 'AI Score إغلاق',
      value: `${lead.probability}%`,
      color: '#00d4aa',
      big: true,
    },
  ]

  const activities = lead.activities || []

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-[14px] mb-4">
        {/* Gradient BG */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#6c63ff]/12 to-[#00d4aa]/6" />
        <div className="absolute inset-0 border border-[#6c63ff]/15 rounded-[14px]" />

        <div className="relative flex items-center gap-4 p-5">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#00d4aa] flex items-center justify-center text-[18px] font-bold text-white shrink-0 shadow-lg shadow-[#6c63ff]/20">
            {getInitials(lead.name)}
          </div>

          {/* Name + Company + Temperature */}
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-bold text-[#f0f2ff]">{lead.name}</div>
            <div className="flex items-center gap-2 mt-1">
              {lead.company && <span className="text-[13px] text-[#8892b0]">{lead.company}</span>}
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: tempInfo.bg, color: tempInfo.color }}
              >
                {tempInfo.label}
              </span>
            </div>
          </div>

          {/* Deal value */}
          <div className="text-left shrink-0">
            <div className="text-[24px] font-extrabold text-[#00d4aa]" style={{ fontFamily: 'Cairo' }}>
              {formatCurrency(lead.value)}
            </div>
            <div className="text-[12px] text-[#8892b0]">قيمة الفرصة EGP</div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 shrink-0">
            <button className="bg-[#161b28] border border-white/[0.06] px-3 py-2 rounded-lg text-[12px] text-[#f0f2ff] flex items-center gap-1.5 hover:border-[#6c63ff]/40 hover:bg-[#6c63ff]/8 transition-all cursor-pointer">
              <Phone size={13} className="text-[#6c63ff]" /> اتصل
            </button>
            <button className="bg-[#161b28] border border-[#25d366]/30 text-[#25d366] px-3 py-2 rounded-lg text-[12px] flex items-center gap-1.5 hover:bg-[#25d366]/10 transition-all cursor-pointer">
              <MessageCircle size={13} /> واتساب
            </button>
            <button className="bg-[#161b28] border border-white/[0.06] px-3 py-2 rounded-lg text-[12px] text-[#f0f2ff] flex items-center gap-1.5 hover:border-[#6c9fff]/40 hover:bg-[#6c9fff]/8 transition-all cursor-pointer">
              <Mail size={13} className="text-[#6c9fff]" /> إيميل
            </button>
          </div>
        </div>
      </div>

      {/* Info Grid - 2 columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {infoItems.map((item, i) => (
          <motion.div
            key={i}
            className="bg-[#161b28] border border-white/[0.06] rounded-[10px] p-3.5 hover:border-white/[0.1] transition-colors"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <div className="text-[11px] text-[#8892b0] mb-1.5 flex items-center gap-1.5">
              <span style={{ color: item.color || '#6c63ff' }}>{item.icon}</span>
              {item.label}
            </div>
            {item.badge ? (
              <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: item.badgeBg, color: item.badgeColor }}>
                {item.value}
              </span>
            ) : (
              <div
                className={`font-medium ${item.big ? 'text-[22px] font-extrabold' : 'text-[13px]'}`}
                style={{ color: item.color || '#f0f2ff', fontFamily: item.big ? 'Cairo' : undefined }}
              >
                {item.value}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Timeline Card */}
      <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-[#f0f2ff] mb-4">
          <Activity size={17} className="text-[#6c63ff]" />
          Timeline كامل
        </div>

        {activities.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute right-[15px] top-2 bottom-2 w-[1px] bg-white/[0.06]" />

            {activities.map((activity, i) => {
              const actInfo = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.note
              return (
                <motion.div
                  key={activity.id}
                  className="flex gap-3 py-3 relative"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.06 }}
                >
                  {/* Icon dot */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-[#111520]"
                    style={{ background: actInfo.bg, color: actInfo.dot }}
                  >
                    {actInfo.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-[12px] text-[#f0f2ff] leading-relaxed">{activity.text}</div>
                    <div className="text-[11px] text-[#4a5280] mt-1">{formatTimeAgo(activity.createdAt)}</div>
                  </div>

                  {/* Score badge for calls */}
                  {activity.type === 'call' && activity.score > 0 && (
                    <span className="text-[10px] font-bold text-[#6c63ff] bg-[#6c63ff]/10 px-2 py-0.5 rounded-md shrink-0 self-start">
                      {activity.score}/10
                    </span>
                  )}
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="text-[12px] text-[#4a5280] py-8 text-center">لا يوجد نشاط مسجل لهذا العميل</div>
        )}
      </div>
    </motion.div>
  )
}
