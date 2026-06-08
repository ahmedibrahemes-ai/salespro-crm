'use client'

import { useCrmStore, formatCurrency } from '@/lib/store'
import { Mic, Brain, GraduationCap, Zap, Bell, Star, Phone, History, Loader2, Sparkles, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo } from 'react'

interface AIFeatureCard {
  id: string
  icon: React.ReactNode
  iconColor: string
  iconBg: string
  badge: string | null
  badgeColor: string
  title: string
  desc: string
  stat: string | null
  statColor: string
  clickable: boolean
}

const AI_FEATURES: AIFeatureCard[] = [
  {
    id: 'call-analysis',
    icon: <Mic size={28} />,
    iconColor: '#6c63ff',
    iconBg: 'rgba(108,99,255,.15)',
    badge: 'LIVE',
    badgeColor: '#00d4aa',
    title: 'تحليل المكالمة',
    desc: 'بيسمع المكالمة تلقائياً ويستخرج النقاط المهمة ويلخصها',
    stat: null,
    statColor: '',
    clickable: true,
  },
  {
    id: 'predict-closure',
    icon: <Brain size={28} />,
    iconColor: '#00d4aa',
    iconBg: 'rgba(0,212,170,.15)',
    badge: 'BETA',
    badgeColor: '#00d4aa',
    title: 'توقع الإغلاق',
    desc: 'نهى إبراهيم مستعدة للشراء!',
    stat: '87% احتمال إغلاق',
    statColor: '#00d4aa',
    clickable: false,
  },
  {
    id: 'ai-coach',
    icon: <GraduationCap size={28} />,
    iconColor: '#ffd166',
    iconBg: 'rgba(255,209,102,.15)',
    badge: null,
    badgeColor: '',
    title: 'AI Coach',
    desc: 'بعد كل مكالمة يقيّمها ويعطيك أفضل رد للمرحلة الجاية',
    stat: null,
    statColor: '',
    clickable: true,
  },
  {
    id: 'auto-followup',
    icon: <Zap size={28} />,
    iconColor: '#ff6b6b',
    iconBg: 'rgba(255,107,107,.15)',
    badge: null,
    badgeColor: '',
    title: 'Auto Follow-up',
    desc: 'بيبعت واتساب وإيميل تلقائي بعد كل مرحلة',
    stat: null,
    statColor: '',
    clickable: false,
  },
  {
    id: 'opportunity-alert',
    icon: <Bell size={28} />,
    iconColor: '#ffd166',
    iconBg: 'rgba(255,209,102,.15)',
    badge: null,
    badgeColor: '',
    title: 'تنبيه الفرصة',
    desc: 'لو العميل فتح الـ Proposal 3 مرات بيبعتلك تنبيه فوري',
    stat: null,
    statColor: '',
    clickable: false,
  },
  {
    id: 'call-quality',
    icon: <Star size={28} />,
    iconColor: '#00d4aa',
    iconBg: 'rgba(0,212,170,.15)',
    badge: null,
    badgeColor: '',
    title: 'جودة المكالمة',
    desc: 'تقييم من 10 بناءً على tone, objection handling, closing',
    stat: null,
    statColor: '',
    clickable: false,
  },
]

export function AIFeatures() {
  const { leads, stats } = useCrmStore()
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [aiType, setAiType] = useState<string | null>(null)

  // Get recent call analyses from lead activities
  const recentAnalyses = useMemo(() => {
    return leads
      .filter(l => l.activities && l.activities.length > 0)
      .flatMap(l =>
        (l.activities || [])
          .filter(a => a.type === 'call' && a.score > 0)
          .map(a => ({ ...a, leadName: l.name }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  }, [leads])

  // Handle AI analysis request
  const handleAiAnalysis = async (featureId: string) => {
    if (aiLoading) return

    setAiLoading(true)
    setAiType(featureId)
    setAiResponse(null)

    try {
      // Build stats and leads summary for the AI
      const leadsSummary = leads
        .filter(l => l.status !== 'won' && l.status !== 'lost')
        .slice(0, 10)
        .map(l => ({
          name: l.name,
          status: l.status,
          value: l.value,
          probability: l.probability,
          hot: l.hot,
          lastContactAt: l.lastContactAt,
          activityCount: l.activities?.length ?? 0,
        }))

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'analyze-performance',
          data: {
            stats: stats
              ? {
                  totalLeads: stats.totalLeads,
                  totalCalls: stats.totalCalls,
                  closedDeals: stats.closedDeals,
                  salesValue: stats.salesValue,
                  conversionRate: stats.conversionRate,
                  pipelineValue: stats.pipelineValue,
                }
              : {},
            leads: leadsSummary,
          },
        }),
      })

      const data = await res.json()
      if (data.success) {
        setAiResponse(data.response)
      } else {
        setAiResponse('حدث خطأ في التحليل. حاول مرة أخرى.')
      }
    } catch {
      setAiResponse('فشل الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setAiLoading(false)
    }
  }

  // Get score badge color
  const getScoreColor = (score: number): string => {
    if (score >= 8) return '#00d4aa'
    if (score >= 6) return '#ffd166'
    return '#ff6b6b'
  }

  const getScoreBg = (score: number): string => {
    if (score >= 8) return 'rgba(0,212,170,.12)'
    if (score >= 6) return 'rgba(255,209,102,.12)'
    return 'rgba(255,107,107,.12)'
  }

  const getScoreLabel = (score: number): string => {
    if (score >= 8) return 'ممتاز'
    if (score >= 6) return 'جيد'
    return 'يحتاج تحسين'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Page Title */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#6c63ff]/15">
          <Sparkles size={18} className="text-[#6c63ff]" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-[#f0f2ff]">ميزات الذكاء الاصطناعي</h2>
          <p className="text-[12px] text-[#8892b0]">أدوات AI لتعزيز أداء المبيعات</p>
        </div>
      </div>

      {/* AI Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {AI_FEATURES.map((feature, i) => (
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            onClick={() => feature.clickable ? handleAiAnalysis(feature.id) : undefined}
            className={`bg-[#111520] border border-white/[0.06] rounded-[14px] p-5 relative overflow-hidden transition-all ${
              feature.clickable
                ? 'cursor-pointer hover:-translate-y-1 hover:border-[#6c63ff]/40 hover:shadow-[0_8px_30px_rgba(108,99,255,0.15)]'
                : 'hover:-translate-y-0.5 hover:border-white/[0.1]'
            }`}
          >
            {/* Corner glow */}
            <div
              className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full opacity-20 blur-2xl"
              style={{ background: feature.iconColor }}
            />

            {/* Badge */}
            {feature.badge && (
              <span
                className="absolute top-3.5 left-3.5 text-[9px] font-bold px-2 py-0.5 rounded-md tracking-wider"
                style={{
                  background: `${feature.badgeColor}18`,
                  color: feature.badgeColor,
                  border: `1px solid ${feature.badgeColor}30`,
                }}
              >
                {feature.badge}
              </span>
            )}

            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3.5"
              style={{ background: feature.iconBg, color: feature.iconColor }}
            >
              {feature.icon}
            </div>

            {/* Title */}
            <div className="text-[15px] font-bold text-[#f0f2ff] mb-1.5">{feature.title}</div>

            {/* Description */}
            <div className="text-[12px] text-[#8892b0] leading-relaxed">{feature.desc}</div>

            {/* Stat */}
            {feature.stat && (
              <div
                className="text-[22px] font-extrabold mt-3"
                style={{ color: feature.statColor, fontFamily: 'Cairo' }}
              >
                {feature.stat}
              </div>
            )}

            {/* Clickable hint or Coming Soon */}
            {feature.clickable ? (
              <div className="absolute bottom-3.5 left-3.5 text-[10px] text-[#6c63ff]/60 flex items-center gap-1">
                <Sparkles size={10} />
                اضغط للتحليل
              </div>
            ) : (
              <div className="absolute bottom-3.5 left-3.5 text-[9px] text-[#4a5280]/60 flex items-center gap-1 border border-[#4a5280]/20 px-2 py-0.5 rounded-md">
                قريباً
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* AI Analysis Result */}
      <AnimatePresence>
        {(aiLoading || aiResponse) && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-gradient-to-br from-[#6c63ff]/8 to-[#111520] border border-[#6c63ff]/20 rounded-[14px] p-5 relative overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#6c63ff]/15">
                    {aiType === 'call-analysis' ? (
                      <Mic size={15} className="text-[#6c63ff]" />
                    ) : (
                      <GraduationCap size={15} className="text-[#6c63ff]" />
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[#f0f2ff]">
                      {aiType === 'call-analysis' ? 'تحليل الأداء' : 'AI Coach'}
                    </div>
                    <div className="text-[10px] text-[#6c63ff]/60">powered by AI</div>
                  </div>
                </div>
                {aiResponse && (
                  <button
                    onClick={() => { setAiResponse(null); setAiType(null) }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] text-[#8892b0] transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Content */}
              {aiLoading ? (
                <div className="flex items-center gap-3 py-6 justify-center">
                  <Loader2 size={20} className="text-[#6c63ff] animate-spin" />
                  <span className="text-[13px] text-[#8892b0]">جاري التحليل بالذكاء الاصطناعي...</span>
                </div>
              ) : (
                <div className="bg-[#0d1017]/60 rounded-xl p-4 border border-white/[0.04]">
                  <div className="text-[13px] text-[#c8cdea] leading-[1.85] whitespace-pre-wrap" dir="rtl">
                    {aiResponse}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent AI Analyses */}
      <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#6c63ff]/15">
              <History size={15} className="text-[#6c63ff]" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#f0f2ff]">آخر تحليلات AI</div>
              <div className="text-[11px] text-[#8892b0]">تحليلات المكالمات الأخيرة</div>
            </div>
          </div>
          {recentAnalyses.length > 0 && (
            <span className="text-[11px] text-[#6c63ff] bg-[#6c63ff]/10 px-2.5 py-1 rounded-lg">
              {recentAnalyses.length} تحليل
            </span>
          )}
        </div>

        {recentAnalyses.length > 0 ? (
          <div className="space-y-0">
            {recentAnalyses.map((analysis, i) => (
              <motion.div
                key={analysis.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.06 }}
                className="flex items-center gap-3.5 py-3.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.01] rounded-lg px-2 transition-colors"
              >
                {/* Phone Icon Avatar */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `${getScoreColor(analysis.score)}12`,
                    color: getScoreColor(analysis.score),
                    border: `1px solid ${getScoreColor(analysis.score)}20`,
                  }}
                >
                  <Phone size={16} />
                </div>

                {/* Call Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#f0f2ff] truncate">
                    مكالمة — {analysis.leadName}
                  </div>
                  <div className="text-[11px] text-[#8892b0] truncate mt-0.5">
                    {analysis.text}
                  </div>
                  <div className="text-[10px] text-[#4a5280] mt-0.5">
                    {new Date(analysis.createdAt).toLocaleDateString('ar-EG', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {' · '}
                    {Math.floor(analysis.duration / 60)}:{String(analysis.duration % 60).padStart(2, '0')} د
                  </div>
                </div>

                {/* Score Badge */}
                <div
                  className="text-center px-3 py-2 rounded-xl shrink-0"
                  style={{ background: getScoreBg(analysis.score) }}
                >
                  <div
                    className="text-[20px] font-extrabold leading-tight"
                    style={{ color: getScoreColor(analysis.score), fontFamily: 'Cairo' }}
                  >
                    {analysis.score}
                  </div>
                  <div
                    className="text-[9px] font-medium mt-0.5"
                    style={{ color: `${getScoreColor(analysis.score)}aa` }}
                  >
                    {getScoreLabel(analysis.score)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <Star size={28} className="text-[#4a5280] mx-auto mb-2" />
            <div className="text-[12px] text-[#8892b0]">لا يوجد تحليلات بعد</div>
            <div className="text-[11px] text-[#4a5280] mt-1">أضف بيانات تجريبية أولاً</div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
