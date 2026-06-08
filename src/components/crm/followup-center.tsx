'use client'

import { useCrmStore, getInitials, getTemperatureLabel, isToday, formatCurrency, getDaysSince } from '@/lib/store'
import { Bell, CalendarPlus, Phone, MessageCircle, Mail, Send, Sparkles, Clock, MessageSquareText, Smartphone } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useCallback } from 'react'
import type { Lead } from '@/lib/store'

const FOLLOWUP_TYPES = [
  { key: 'call', label: 'مكالمة هاتفية', icon: Phone, color: '#6c63ff' },
  { key: 'online-meeting', label: 'اجتماع أونلاين', icon: MessageCircle, color: '#00d4aa' },
  { key: 'in-person', label: 'اجتماع وجاهي', icon: CalendarPlus, color: '#ffd166' },
  { key: 'whatsapp', label: 'واتساب', icon: MessageCircle, color: '#25d366' },
]

// ===== Reminder Row =====
function ReminderRow({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const { updateLead } = useCrmStore()
  const temp = getTemperatureLabel(lead)
  const followUpDate = lead.nextFollowUp ? new Date(lead.nextFollowUp) : null
  const timeStr = followUpDate
    ? followUpDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : ''

  const handleAction = async (type: 'call' | 'whatsapp') => {
    if (type === 'whatsapp' && lead.phone) {
      window.open(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`, '_blank')
    }

    // Mark as contacted
    updateLead(lead.id, {
      lastContactAt: new Date().toISOString(),
      nextFollowUp: null,
    })

    try {
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          lastContactAt: new Date().toISOString(),
          nextFollowUp: null,
        }),
      })
      onRefresh()
    } catch (err) {
      console.error('Failed to update lead:', err)
    }
  }

  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] rounded-lg px-2 transition-colors">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
        style={{ background: temp.bg, color: temp.color, border: `1px solid ${temp.color}33` }}
      >
        {getInitials(lead.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#f0f2ff] truncate">{lead.name}</div>
        <div className="text-[11px] text-[#8892b0] flex items-center gap-1.5">
          <Clock size={10} />
          <span>{timeStr}</span>
          {lead.company && (
            <>
              <span className="text-[#4a5280]">·</span>
              <span className="truncate">{lead.company}</span>
            </>
          )}
        </div>
      </div>

      {/* Follow-up type badge */}
      {lead.followUpType && (
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: `${temp.bg}`, color: temp.color }}
        >
          {FOLLOWUP_TYPES.find(t => t.key === lead.followUpType)?.label || lead.followUpType}
        </span>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => handleAction('call')}
          className="bg-[#161b28] border border-white/[0.06] px-2.5 py-1.5 rounded-lg text-[11px] text-[#f0f2ff] flex items-center gap-1 hover:border-[#6c63ff] hover:bg-[#6c63ff]/10 transition-all cursor-pointer"
        >
          <Phone size={11} className="text-[#6c63ff]" /> اتصل
        </button>
        <button
          onClick={() => handleAction('whatsapp')}
          className="bg-[#161b28] border border-white/[0.06] px-2.5 py-1.5 rounded-lg text-[11px] text-[#f0f2ff] flex items-center gap-1 hover:border-[#25d366] hover:bg-[#25d366]/10 transition-all cursor-pointer"
        >
          <MessageCircle size={11} className="text-[#25d366]" /> واتساب
        </button>
      </div>
    </div>
  )
}

// ===== Main Follow-up Center =====
export function FollowupCenter() {
  const { leads, updateLead, stats } = useCrmStore()
  const [message, setMessage] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    clientName: '',
    dateTime: '',
    type: 'call',
  })
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Leads with today's follow-ups
  const todayFollowups = leads.filter(
    l => !l.isArchived && l.status !== 'won' && l.status !== 'lost' && isToday(l.nextFollowUp)
  )

  // Overdue follow-ups (past due, not today)
  const overdueFollowups = leads.filter(
    l => !l.isArchived && l.status !== 'won' && l.status !== 'lost' && l.nextFollowUp && !isToday(l.nextFollowUp) && new Date(l.nextFollowUp) < new Date()
  )

  // All active follow-ups (for the general list)
  const upcomingFollowups = leads
    .filter(l => !l.isArchived && l.status !== 'won' && l.status !== 'lost' && l.nextFollowUp && new Date(l.nextFollowUp) >= new Date())
    .sort((a, b) => new Date(a.nextFollowUp!).getTime() - new Date(b.nextFollowUp!).getTime())
    .slice(0, 5)

  const handleSchedule = async () => {
    if (!scheduleForm.clientName || !scheduleForm.dateTime) return

    setScheduleLoading(true)

    // Find lead by name (partial match)
    const lead = leads.find(
      l => !l.isArchived && l.name.includes(scheduleForm.clientName)
    )

    if (lead) {
      updateLead(lead.id, {
        nextFollowUp: scheduleForm.dateTime,
        followUpType: scheduleForm.type,
      })

      try {
        await fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: lead.id,
            nextFollowUp: scheduleForm.dateTime,
            followUpType: scheduleForm.type,
          }),
        })
      } catch (err) {
        console.error('Failed to schedule follow-up:', err)
      }
    }

    setScheduleForm({ clientName: '', dateTime: '', type: 'call' })
    setScheduleLoading(false)
  }

  const handleSmartReply = useCallback(async () => {
    if (!message.trim()) return
    setAiLoading(true)
    setAiSuggestion('')

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'smart-reply',
          data: { message, leadName: '', stage: '' },
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setAiSuggestion(data.response || '')
      }
    } catch (err) {
      console.error('AI smart reply error:', err)
      setAiSuggestion('حدث خطأ، حاول مرة أخرى')
    } finally {
      setAiLoading(false)
    }
  }, [message])

  const applySuggestion = () => {
    if (aiSuggestion) {
      setMessage(aiSuggestion)
      setAiSuggestion('')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-[#f0f2ff]">Follow-up Center</h2>
          <p className="text-[12px] text-[#4a5280] mt-0.5">متابعة العملاء والمهام اليومية</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[#111520] border border-white/[0.06] rounded-xl px-4 py-2.5">
            <div className="text-[10px] text-[#4a5280] uppercase tracking-wider">Today</div>
            <div className="text-[16px] font-bold text-[#ffd166] mt-0.5">{todayFollowups.length}</div>
          </div>
          {overdueFollowups.length > 0 && (
            <div className="bg-[#111520] border border-[#ff4d4d]/20 rounded-xl px-4 py-2.5">
              <div className="text-[10px] text-[#ff4d4d] uppercase tracking-wider">Overdue</div>
              <div className="text-[16px] font-bold text-[#ff4d4d] mt-0.5">{overdueFollowups.length}</div>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Left - Reminders اليوم */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f2ff] mb-3.5">
            <Bell size={15} className="text-[#ffd166]" />
            Reminders اليوم
          </div>

          {/* Today's follow-ups */}
          <div className="max-h-[400px] overflow-y-auto">
            {todayFollowups.length > 0 ? (
              todayFollowups.map(lead => (
                <ReminderRow key={lead.id} lead={lead} onRefresh={() => setRefreshKey(k => k + 1)} />
              ))
            ) : (
              <div className="py-8 text-center">
                <Bell size={28} className="text-[#4a5280] mx-auto mb-2" />
                <p className="text-[12px] text-[#4a5280]">لا يوجد متابعات اليوم</p>
              </div>
            )}

            {/* Overdue section */}
            {overdueFollowups.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 mt-4 mb-2 pt-3 border-t border-[#ff4d4d]/20">
                  <span className="text-[11px] font-bold text-[#ff4d4d]">⚠️ متأخر ({overdueFollowups.length})</span>
                </div>
                {overdueFollowups.map(lead => (
                  <ReminderRow key={lead.id} lead={lead} onRefresh={() => setRefreshKey(k => k + 1)} />
                ))}
              </>
            )}

            {/* Upcoming section */}
            {upcomingFollowups.length > 0 && todayFollowups.length === 0 && overdueFollowups.length === 0 && (
              <>
                <div className="flex items-center gap-1.5 mt-3 mb-2 pt-2 border-t border-white/[0.06]">
                  <span className="text-[11px] font-bold text-[#8892b0]">القادمة</span>
                </div>
                {upcomingFollowups.map(lead => (
                  <ReminderRow key={lead.id} lead={lead} onRefresh={() => setRefreshKey(k => k + 1)} />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right - جدولة سريعة */}
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f2ff] mb-3.5">
            <CalendarPlus size={15} className="text-[#00d4aa]" />
            جدولة سريعة
          </div>

          <div className="flex flex-col gap-3">
            {/* Client name */}
            <div>
              <label className="text-[11px] text-[#8892b0] mb-1 block">اسم العميل</label>
              <input
                type="text"
                placeholder="ابحث عن العميل..."
                value={scheduleForm.clientName}
                onChange={(e) => setScheduleForm(f => ({ ...f, clientName: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-[#161b28] border border-white/[0.06] rounded-lg text-[13px] text-[#f0f2ff] outline-none focus:border-[#6c63ff]/30 transition-colors"
                dir="rtl"
              />
              {/* Quick name suggestions */}
              {scheduleForm.clientName && (
                <div className="mt-1 max-h-[80px] overflow-y-auto">
                  {leads
                    .filter(l => !l.isArchived && l.name.includes(scheduleForm.clientName))
                    .slice(0, 3)
                    .map(l => (
                      <button
                        key={l.id}
                        className="w-full text-right px-3 py-1.5 text-[11px] text-[#8892b0] hover:bg-white/[0.03] rounded-lg transition-colors cursor-pointer"
                        onClick={() => setScheduleForm(f => ({ ...f, clientName: l.name }))}
                      >
                        {l.name} {l.company && <span className="text-[#4a5280]">· {l.company}</span>}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Date/Time */}
            <div>
              <label className="text-[11px] text-[#8892b0] mb-1 block">التاريخ والوقت</label>
              <input
                type="datetime-local"
                value={scheduleForm.dateTime}
                onChange={(e) => setScheduleForm(f => ({ ...f, dateTime: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-[#161b28] border border-white/[0.06] rounded-lg text-[13px] text-[#f0f2ff] outline-none focus:border-[#6c63ff]/30 transition-colors [color-scheme:dark]"
              />
            </div>

            {/* Follow-up type */}
            <div>
              <label className="text-[11px] text-[#8892b0] mb-1 block">نوع المتابعة</label>
              <div className="grid grid-cols-2 gap-2">
                {FOLLOWUP_TYPES.map(ft => {
                  const Icon = ft.icon
                  const isActive = scheduleForm.type === ft.key
                  return (
                    <button
                      key={ft.key}
                      onClick={() => setScheduleForm(f => ({ ...f, type: ft.key }))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-white/[0.05] border-white/[0.15] text-[#f0f2ff]'
                          : 'bg-[#161b28] border-white/[0.06] text-[#8892b0] hover:border-white/[0.1]'
                      }`}
                    >
                      <Icon size={13} style={{ color: ft.color }} />
                      {ft.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSchedule}
              disabled={scheduleLoading || !scheduleForm.clientName || !scheduleForm.dateTime}
              className="bg-gradient-to-br from-[#6c63ff] to-[#8b84ff] text-white px-4 py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(108,99,255,0.4)] transition-all cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <CalendarPlus size={14} />
              {scheduleLoading ? 'جاري الجدولة...' : 'جدول الآن'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Send Section */}
      <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-4">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f2ff]">
            <Send size={15} className="text-[#6c63ff]" />
            إرسال سريع
          </div>
          <button
            onClick={handleSmartReply}
            disabled={aiLoading || !message.trim()}
            className="flex items-center gap-1.5 text-[12px] text-[#6c63ff] hover:text-[#8b84ff] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={13} className={aiLoading ? 'animate-spin' : ''} />
            {aiLoading ? 'يفكر...' : 'اقتراح رد ذكي'}
          </button>
        </div>

        {/* Send buttons */}
        <div className="flex gap-2.5 flex-wrap mb-3">
          <button className="flex-1 bg-[#161b28] border border-white/[0.06] px-3 py-2.5 rounded-lg text-[13px] text-[#f0f2ff] flex items-center justify-center gap-1.5 hover:border-[#25d366] hover:bg-[#25d366]/5 transition-all cursor-pointer min-w-[140px]">
            <MessageCircle size={14} className="text-[#25d366]" /> إرسال واتساب
          </button>
          <button className="flex-1 bg-[#161b28] border border-white/[0.06] px-3 py-2.5 rounded-lg text-[13px] text-[#f0f2ff] flex items-center justify-center gap-1.5 hover:border-[#6c9fff] hover:bg-[#6c9fff]/5 transition-all cursor-pointer min-w-[140px]">
            <Mail size={14} className="text-[#6c9fff]" /> إرسال إيميل
          </button>
          <button className="flex-1 bg-[#161b28] border border-white/[0.06] px-3 py-2.5 rounded-lg text-[13px] text-[#f0f2ff] flex items-center justify-center gap-1.5 hover:border-[#ffd166] hover:bg-[#ffd166]/5 transition-all cursor-pointer min-w-[140px]">
            <Smartphone size={14} className="text-[#ffd166]" /> إرسال SMS
          </button>
        </div>

        {/* AI Suggestion */}
        {aiSuggestion && (
          <div className="bg-[#6c63ff]/10 border border-[#6c63ff]/20 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[#6c63ff] font-semibold">
                <Sparkles size={11} /> اقتراح AI
              </div>
              <button
                onClick={applySuggestion}
                className="text-[10px] text-[#6c63ff] hover:text-[#8b84ff] underline cursor-pointer"
              >
                تطبيق
              </button>
            </div>
            <p className="text-[12px] text-[#c4c8f0] leading-relaxed">{aiSuggestion}</p>
          </div>
        )}

        {/* Message textarea */}
        <textarea
          placeholder="اكتب رسالتك هنا..."
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-3 py-3 bg-[#161b28] border border-white/[0.06] rounded-lg text-[13px] text-[#f0f2ff] outline-none resize-y focus:border-[#6c63ff]/30 transition-colors"
          dir="rtl"
        />
      </div>
    </motion.div>
  )
}
