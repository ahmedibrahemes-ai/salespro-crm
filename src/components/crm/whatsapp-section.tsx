'use client'

import { useCrmStore, getInitials, type ChatMessage } from '@/lib/store'
import { MessageCircle, Send, ArrowRightLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo, useRef } from 'react'

export function WhatsAppSection() {
  const { leads, updateLead } = useCrmStore()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Only show leads who have chat messages
  const chatLeads = useMemo(() => {
    return leads
      .filter(l => !l.isArchived && l.messages && l.messages.length > 0)
  }, [leads])

  // Initialize to Noha Ibrahim or first lead with messages
  const defaultLeadId = useMemo(() => {
    const noha = chatLeads.find(l => l.name.includes('نهى'))
    return noha?.id ?? (chatLeads.length > 0 ? chatLeads[0].id : null)
  }, [chatLeads])

  const activeLeadId = selectedLeadId ?? defaultLeadId
  const selectedLead = leads.find(l => l.id === activeLeadId)

  // Fetch messages when selected lead changes
  useEffect(() => {
    if (!activeLeadId) return
    fetch(`/api/chat?leadId=${activeLeadId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data)
      })
      .catch(() => {})
  }, [activeLeadId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!inputMsg.trim() || !activeLeadId || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: activeLeadId, fromMe: true, text: inputMsg, read: true }),
      })
      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      setInputMsg('')
    } catch {
      // silently fail
    } finally {
      setSending(false)
    }
  }

  const handleQuickReply = (reply: string) => {
    if (reply === 'حول لـ Opportunity') {
      // Move lead to proposal stage
      if (activeLeadId && selectedLead) {
        updateLead(activeLeadId, { status: 'proposal', probability: 60 })
      }
      return
    }
    setInputMsg(reply)
  }

  // Count unread for each lead
  const getUnreadCount = (leadId: string): number => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead?.messages) return 0
    return lead.messages.filter(m => !m.fromMe && !m.read).length
  }

  // Get last message for a lead
  const getLastMessage = (leadId: string): ChatMessage | null => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead?.messages || lead.messages.length === 0) return null
    return lead.messages[lead.messages.length - 1]
  }

  // Format time for display
  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'الآن'
    if (diffMins < 60) return `${diffMins} د`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} س`
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
  }

  const formatMessageTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const quickReplies = ['أهلاً بك!', 'شكراً لتواصلك', 'سأرسل التفاصيل', 'حول لـ Opportunity']

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col lg:flex-row gap-0 lg:gap-0 rounded-[14px] overflow-hidden border border-white/[0.06] bg-[#0d1017] h-[calc(100vh-180px)] min-h-[500px]">
        {/* Left Sidebar - Chat List */}
        <div className="w-full lg:w-[300px] shrink-0 bg-[#111520] border-b lg:border-b-0 lg:border-l border-white/[0.06] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#25d366]/15">
              <MessageCircle size={16} className="text-[#25d366]" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#f0f2ff]">واتساب</div>
              <div className="text-[11px] text-[#8892b0]">{chatLeads.length} محادثة</div>
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-260px)]" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(108,99,255,0.2) transparent',
          }}>
            {chatLeads.length > 0 ? chatLeads.map(lead => {
              const lastMsg = getLastMessage(lead.id)
              const unread = getUnreadCount(lead.id)
              const isSelected = activeLeadId === lead.id

              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-b border-white/[0.03] ${
                    isSelected
                      ? 'bg-[#6c63ff]/10 border-r-2 border-r-[#6c63ff]'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                    style={{
                      background: lead.hot ? 'rgba(255,107,107,.15)' : 'rgba(108,159,255,.15)',
                      color: lead.hot ? '#ff6b6b' : '#6c9fff',
                      border: `1.5px solid ${lead.hot ? 'rgba(255,107,107,.25)' : 'rgba(108,159,255,.25)'}`,
                    }}
                  >
                    {getInitials(lead.name)}
                  </div>

                  {/* Name + Last Message */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[#f0f2ff] truncate">
                        {lead.name}
                      </span>
                      <span className="text-[11px] text-[#4a5280] shrink-0">
                        {lastMsg ? formatTime(lastMsg.createdAt) : ''}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#8892b0] truncate mt-0.5">
                      {lastMsg
                        ? (lastMsg.fromMe ? 'أنت: ' : '') + lastMsg.text
                        : 'لا يوجد رسائل'
                      }
                    </div>
                  </div>

                  {/* Unread Badge */}
                  {unread > 0 && (
                    <span className="bg-[#25d366] text-white text-[11px] w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0">
                      {unread}
                    </span>
                  )}
                </div>
              )
            }) : (
              <div className="px-4 py-8 text-center text-[12px] text-[#8892b0]">
                لا يوجد محادثات بعد
              </div>
            )}
          </div>
        </div>

        {/* Right - Chat Window */}
        <div className="flex-1 flex flex-col bg-[#0d1017] min-w-0">
          {selectedLead ? (
            <>
              {/* Chat Header */}
              <div className="px-5 py-3.5 border-b border-white/[0.06] bg-[#111520]/80 backdrop-blur-sm flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#25d366] animate-pulse" />
                <div>
                  <span className="text-[14px] font-bold text-[#f0f2ff]">{selectedLead.name}</span>
                  <span className="text-[12px] text-[#25d366] mr-2">Online</span>
                </div>
                <div className="mr-auto flex items-center gap-2">
                  <span className="text-[11px] text-[#4a5280] bg-white/[0.04] px-2 py-1 rounded-lg">
                    {selectedLead.company || selectedLead.phone}
                  </span>
                </div>
              </div>

              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(108,99,255,0.2) transparent',
                }}
              >
                {/* Date separator */}
                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[11px] text-[#4a5280] bg-white/[0.04] px-3 py-1 rounded-full">
                    اليوم
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                <AnimatePresence>
                  {messages.length > 0 ? messages.map((msg, i) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      className={`${msg.fromMe ? 'self-end' : 'self-start'} max-w-[75%]`}
                    >
                      <div
                        className={`px-4 py-2.5 text-[13px] leading-relaxed ${
                          msg.fromMe
                            ? 'bg-[#6c63ff]/15 border border-[#6c63ff]/20 rounded-2xl rounded-tl-md'
                            : 'bg-[#161b28] border border-white/[0.06] rounded-2xl rounded-tr-md'
                        }`}
                      >
                        <span className="text-[#e8eaff]">{msg.text}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 mt-1 ${msg.fromMe ? 'justify-start' : ''}`}>
                        <span className="text-[11px] text-[#4a5280]">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                        {msg.fromMe && (
                          <span className={`text-[11px] ${msg.read ? 'text-[#25d366]' : 'text-[#4a5280]'}`}>
                            {msg.read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <MessageCircle size={32} className="text-[#4a5280] mx-auto mb-2" />
                        <div className="text-[13px] text-[#8892b0]">ابدأ المحادثة</div>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies & Input */}
              <div className="px-4 py-3 border-t border-white/[0.06] bg-[#111520]/60 backdrop-blur-sm">
                {/* Quick Reply Buttons */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {quickReplies.map(reply => (
                    <button
                      key={reply}
                      onClick={() => handleQuickReply(reply)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        reply === 'حول لـ Opportunity'
                          ? 'bg-[#00d4aa]/10 border border-[#00d4aa]/25 text-[#00d4aa] hover:bg-[#00d4aa]/20'
                          : 'bg-[#161b28] border border-white/[0.06] text-[#8892b0] hover:border-[#6c63ff]/40 hover:text-[#b8bfff]'
                      }`}
                    >
                      {reply === 'حول لـ Opportunity' && <ArrowRightLeft size={11} className="inline ml-1" />}
                      {reply}
                    </button>
                  ))}
                </div>

                {/* Input Bar */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="اكتب رسالة..."
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1 px-4 py-2.5 bg-[#161b28] border border-white/[0.06] rounded-xl text-[13px] text-[#f0f2ff] placeholder-[#4a5280] outline-none focus:border-[#6c63ff]/40 transition-colors"
                    dir="rtl"
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !inputMsg.trim()}
                    className="bg-gradient-to-br from-[#6c63ff] to-[#8b84ff] text-white px-4 py-2.5 rounded-xl hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(108,99,255,0.4)] transition-all cursor-pointer disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle size={40} className="text-[#4a5280] mx-auto mb-3" />
                <div className="text-[14px] text-[#8892b0]">اختر محادثة للبدء</div>
                <div className="text-[12px] text-[#4a5280] mt-1">اختر محادثة من القائمة على اليمين</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
