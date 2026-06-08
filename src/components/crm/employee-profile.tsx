'use client'

import { useMemo, useCallback, useState } from 'react'
import { useCrmStore, STATUSES, SALES_STATUSES, ATTENDANCE_STATUSES, CONTACT_RESULTS, formatDate, formatRelativeTime } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiUpdateLead } from '@/lib/supabase'
import {
  Phone, Briefcase, Calendar, Trophy, Users, TrendingUp,
  Clock, CheckCircle2, XCircle, HourglassIcon, Target,
  PhoneCall, UserCheck, ArrowRightLeft, Sun, Moon,
  UserPlus, FileSpreadsheet, MeetingRoom, Archive,
  Video, MapPin, Zap, Award, BarChart3, Activity,
  KeyRound, Eye, EyeOff, ChevronLeft, ChevronRight,
  PhoneOff, UserX, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/* ═══════════════════════════════════════════════════════
   Employee Profile — Comprehensive Personal Dashboard
   ═══════════════════════════════════════════════════════ */
export function EmployeeProfile() {
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)
  const leads = useCrmStore((s) => s.leads)
  const setCurrentView = useCrmStore((s) => s.setCurrentView)
  const addToast = useCrmStore((s) => s.addToast)
  const updateLeadInCache = useCrmStore((s) => s.updateLeadInCache)
  const userId = useCrmStore((s) => s.userId)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  /* ─── Date filter for tele stats ─── */
  const [teleFilterDate, setTeleFilterDate] = useState(new Date())

  const goToPrevDay = useCallback(() => {
    setTeleFilterDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 1)
      return d
    })
  }, [])

  const goToNextDay = useCallback(() => {
    setTeleFilterDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 1)
      const today = new Date()
      if (d > today) return prev
      return d
    })
  }, [])

  const goToToday = useCallback(() => {
    setTeleFilterDate(new Date())
  }, [])

  const isTeleFilterToday = useMemo(() => {
    const now = new Date()
    return (
      teleFilterDate.getFullYear() === now.getFullYear() &&
      teleFilterDate.getMonth() === now.getMonth() &&
      teleFilterDate.getDate() === now.getDate()
    )
  }, [teleFilterDate])

  const teleFilterDateStr = useMemo(() => {
    const d = teleFilterDate
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [teleFilterDate])

  const teleFilterDayLabel = useMemo(() => {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (
      teleFilterDate.getFullYear() === today.getFullYear() &&
      teleFilterDate.getMonth() === today.getMonth() &&
      teleFilterDate.getDate() === today.getDate()
    ) return 'اليوم'
    if (
      teleFilterDate.getFullYear() === yesterday.getFullYear() &&
      teleFilterDate.getMonth() === yesterday.getMonth() &&
      teleFilterDate.getDate() === yesterday.getDate()
    ) return 'أمس'
    return teleFilterDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
  }, [teleFilterDate])

  /* ─── Time-of-day greeting ─── */
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'صباح الخير'
    if (hour >= 12 && hour < 18) return 'مساء الخير'
    return 'مساء الخير'
  }, [])

  const greetingIcon = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return Sun
    return Moon
  }, [])

  /* ─── Today's date string ─── */
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  /* ─── Start of today timestamp ─── */
  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  /* ─── My leads only (non-archived) ─── */
  const myLeads = useMemo(() => {
    if (!currentUser) return []
    return leads.filter((l) => {
      if (l.isArchived) return false
      if (currentRole === 'tele') return l.tele === currentUser
      if (currentRole === 'sales') return l.sales === currentUser
      return false
    })
  }, [leads, currentUser, currentRole])

  /* ─── Last login indicator ─── */
  const lastLoginText = useMemo(() => {
    const latestActivity = myLeads.reduce<number>((max, l) => {
      const ts = l.contactResultAt || l.createdAt || 0
      return ts > max ? ts : max
    }, 0)
    if (!latestActivity) return 'لا يوجد نشاط'
    return formatRelativeTime(latestActivity)
  }, [myLeads])

  /* ─── Tele Stats (comprehensive, date-filtered) ─── */
  const teleStats = useMemo(() => {
    if (currentRole !== 'tele') return null

    // Helper: check if a timestamp falls on the selected filter date
    const isOnFilterDay = (ts: number | undefined | null) => {
      if (!ts) return false
      const d = new Date(ts)
      return (
        d.getFullYear() === teleFilterDate.getFullYear() &&
        d.getMonth() === teleFilterDate.getMonth() &&
        d.getDate() === teleFilterDate.getDate()
      )
    }

    // Filter leads: created on filter date OR had activity on filter date
    const filteredLeads = myLeads.filter((l) => {
      return isOnFilterDay(l.createdAt) || isOnFilterDay(l.contactResultAt) || l.meetingDate === teleFilterDateStr || isOnFilterDay(l.assignedAt)
    })

    // All-time stats (non-filtered, for overall KPIs)
    const totalAll = myLeads.length
    const contactedAll = myLeads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length

    // Filtered-date stats
    const total = filteredLeads.length
    const contacted = filteredLeads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length

    // Call stats
    const totalCalls = filteredLeads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length
    const answeredCalls = filteredLeads.filter((l) => l.contactResult === 'replied').length
    const unansweredCalls = filteredLeads.filter((l) => l.contactResult === 'no-reply').length

    // Meeting stats
    const meetings = filteredLeads.filter((l) => l.meetingDate).length
    const attended = filteredLeads.filter((l) => l.attended === 'attended').length
    const waiting = filteredLeads.filter((l) => !l.attended || l.attended === 'pending' || l.attended === '').length
    const noShow = filteredLeads.filter((l) => l.attended === 'no-show').length

    // Client stats
    const totalClients = filteredLeads.length
    const contactedClients = filteredLeads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length
    const noReplyClients = filteredLeads.filter((l) => l.contactResult === 'no-reply').length
    const notInterested = filteredLeads.filter((l) => l.status === 'not-interested').length
    const followup1 = filteredLeads.filter((l) => l.status === 'followup-1').length
    const followup2 = filteredLeads.filter((l) => l.status === 'followup-2').length
    const followup3 = filteredLeads.filter((l) => l.status === 'followup-3').length

    // Transferred
    const transferred = filteredLeads.filter((l) => l.sales && l.meetingDate).length

    // Rates
    const contactRate = totalClients > 0 ? Math.round((contactedClients / totalClients) * 100) : 0
    const answeredRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0
    const meetingRate = contactedClients > 0 ? Math.round((meetings / contactedClients) * 100) : 0
    const attendanceRate = (attended + noShow) > 0 ? Math.round((attended / (attended + noShow)) * 100) : 0
    const transferRate = meetings > 0 ? Math.round((transferred / meetings) * 100) : 0

    return {
      total, totalAll, contacted, meetings, transferred, totalCalls,
      answeredCalls, unansweredCalls, attended, waiting, noShow,
      totalClients, contactedClients, noReplyClients, notInterested,
      followup1, followup2, followup3,
      contactRate, answeredRate, meetingRate, attendanceRate, transferRate,
    }
  }, [myLeads, currentRole, teleFilterDate, teleFilterDateStr])

  /* ─── Sales Stats ─── */
  const salesStats = useMemo(() => {
    if (currentRole !== 'sales') return null
    const total = myLeads.length
    const meetings = myLeads.filter((l) => l.meetingDate).length
    const attended = myLeads.filter((l) => l.attended === 'attended').length
    const noShow = myLeads.filter((l) => l.attended === 'no-show').length
    const pending = myLeads.filter((l) => !l.attended || l.attended === 'pending').length
    const closedWon = myLeads.filter((l) => l.salesStatus === 'closed-won').length
    const attendanceRate = (attended + noShow) > 0 ? Math.round((attended / (attended + noShow)) * 100) : 0
    const closingRate = (attended + noShow) > 0 ? Math.round((closedWon / (attended + noShow)) * 100) : 0
    const inProgress = myLeads.filter((l) => l.salesStatus === 'followup' || l.salesStatus === 'negotiation').length

    // Today's stats
    const todayMeetings = myLeads.filter((l) => l.meetingDate === todayStr)
    const todayAttended = todayMeetings.filter((l) => l.attended === 'attended').length
    const todayPending = todayMeetings.filter((l) => !l.attended || l.attended === 'pending').length
    const todayNew = myLeads.filter((l) => l.assignedAt && l.assignedAt >= todayStart).length

    return { total, meetings, attended, noShow, pending, closedWon, attendanceRate, closingRate, inProgress, todayMeetings, todayAttended, todayPending, todayNew }
  }, [myLeads, currentRole, todayStr, todayStart])

  /* ─── Recent Transfer Activity ─── */
  const recentTransfers = useMemo(() => {
    if (!currentUser) return []
    if (currentRole === 'tele') {
      // Tele: show last 5 transfers made (leads where sales is set and status is meeting-done)
      return myLeads
        .filter((l) => l.sales && l.status === 'meeting-done')
        .sort((a, b) => (b.assignedAt || 0) - (a.assignedAt || 0))
        .slice(0, 5)
    }
    if (currentRole === 'sales') {
      // Sales: show last 5 transfers received
      return leads
        .filter((l) => l.sales === currentUser && l.assignedAt && !l.isArchived)
        .sort((a, b) => (b.assignedAt || 0) - (a.assignedAt || 0))
        .slice(0, 5)
    }
    return []
  }, [myLeads, leads, currentUser, currentRole])

  /* ─── Today's meetings ─── */
  const todayMeetings = useMemo(() => {
    if (currentRole === 'sales' && salesStats) return salesStats.todayMeetings
    if (currentRole === 'tele') {
      return myLeads.filter((l) => l.meetingDate === todayStr)
    }
    return []
  }, [myLeads, currentRole, salesStats, todayStr])

  /* ─── Recent leads ─── */
  const recentLeads = useMemo(() => {
    return [...myLeads]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 10)
  }, [myLeads])

  /* ─── Status distribution ─── */
  const statusDistribution = useMemo(() => {
    const statusList = currentRole === 'tele' ? STATUSES : SALES_STATUSES
    const statusField = currentRole === 'tele' ? 'status' : 'salesStatus'
    const total = myLeads.length || 1
    return statusList
      .map((s) => ({
        key: s.key,
        label: s.label,
        count: myLeads.filter((l) => (l as Record<string, unknown>)[statusField] === s.key).length,
        percentage: 0,
      }))
      .filter((s) => s.count > 0)
      .map((s) => ({ ...s, percentage: Math.round((s.count / total) * 100) }))
  }, [myLeads, currentRole])

  const maxStatusCount = Math.max(...statusDistribution.map((s) => s.count), 1)

  /* ─── Status colors map ─── */
  const statusColorMap: Record<string, string> = useMemo(() => ({
    'new': '#6c63ff',
    'meeting': '#00d4aa',
    'whatsapp': '#00d4aa',
    'not-interested': '#ff6b6b',
    'followup-1': '#ffd166',
    'followup-2': '#f0a030',
    'followup-3': '#e08020',
    'no-reply': '#4a5280',
    'followup': '#ffd166',
    'meeting-done': '#00d4aa',
    'objection-price': '#ff6b6b',
    'objection-other': '#ff6b6b',
    'proposal-sent': '#6c63ff',
    'negotiation': '#ffd166',
    'thinking': '#ffd166',
    'closed-won': '#00d4aa',
    'closed-lost': '#ff6b6b',
    'contacted': '#00d4aa',
  }), [])

  /* ─── Quick action handlers ─── */
  const handleQuickAction = useCallback((view: Parameters<typeof setCurrentView>[0]) => {
    setCurrentView(view)
  }, [setCurrentView])

  /* ─── Attendance marking handler for sales ─── */
  const handleMarkAttendance = useCallback(async (leadId: string, status: 'attended' | 'no-show') => {
    if (!currentUser) return
    try {
      const updates: Partial<Lead> = {
        attended: status,
        attendanceMarkedAt: Date.now(),
        attendanceMarkedBy: currentUser,
      }
      updateLeadInCache(leadId, updates)
      await apiUpdateLead(leadId, updates)
      addToast('success', status === 'attended' ? 'تم تسجيل الحضور ✓' : 'تم تسجيل عدم الحضور')
    } catch {
      addToast('error', 'فشل في تسجيل الحضور')
    }
  }, [currentUser, updateLeadInCache, addToast])

  /* ─── Change password handler ─── */
  const handleChangePassword = useCallback(async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast('warning', 'جميع الحقول مطلوبة')
      return
    }
    if (newPassword !== confirmPassword) {
      addToast('error', 'كلمة المرور الجديدة غير متطابقة')
      return
    }
    if (newPassword.length < 4) {
      addToast('warning', 'كلمة المرور يجب أن تكون 4 أحرف على الأقل')
      return
    }
    if (!userId) {
      addToast('error', 'معرف المستخدم غير متوفر')
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-password',
          userId,
          currentPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        addToast('error', data.error || 'فشل في تغيير كلمة المرور')
        return
      }
      addToast('success', 'تم تغيير كلمة المرور بنجاح ✅')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowChangePassword(false)
    } catch {
      addToast('error', 'فشل في تغيير كلمة المرور')
    } finally {
      setChangingPassword(false)
    }
  }, [currentPassword, newPassword, confirmPassword, userId, addToast])

  if (!currentUser) return null

  return (
    <div className="space-y-5 animate-in fade-in duration-200" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {/* ═══════════════════════════════════════════
         1. PERSONAL HEADER
         ═══════════════════════════════════════════ */}
      <Card className="bg-[#111520] border-white/[0.06] overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            {/* Avatar with gradient */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-[20px] font-bold text-white shrink-0 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)' }}
            >
              {currentUser.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {/* Greeting */}
              <div className="flex items-center gap-2 mb-1">
                {(() => {
                  const GIcon = greetingIcon
                  return <GIcon size={16} className="text-[#ffd166]" />
                })()}
                <span className="text-[14px] text-[#8892b0] font-medium">{greeting}،</span>
              </div>
              {/* Name */}
              <h2 className="text-[22px] font-extrabold text-[#f0f2ff] leading-tight">{currentUser}</h2>
              {/* Role badge + leads count */}
              <div className="flex items-center gap-2 mt-1.5">
                <Badge className={`text-[12px] border-0 font-bold ${currentRole === 'tele' ? 'bg-[#6c63ff]/20 text-[#a8a3ff]' : currentRole === 'sales' ? 'bg-[#00d4aa]/20 text-[#00d4aa]' : 'bg-amber-500/20 text-amber-400'}`}>
                  {currentRole === 'tele' ? 'تيلي' : currentRole === 'sales' ? 'سيلز' : 'أدمن'}
                </Badge>
                <span className="text-[13px] font-semibold text-[#8892b0]">
                  {myLeads.length} عميل مسند
                </span>
                <span className="text-[11px] text-[#4a5280]">•</span>
                <span className="text-[13px] font-semibold text-[#4a5280]">
                  آخر نشاط: {lastLoginText}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════
         2. QUICK ACTION BUTTONS
         ═══════════════════════════════════════════ */}
      <div className="flex gap-3 flex-wrap">
        {currentRole === 'tele' && (
          <>
            <button
              onClick={() => handleQuickAction('bulk-add')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6c63ff]/15 border border-[#6c63ff]/20 text-[#a8a3ff] text-[12px] font-semibold hover:bg-[#6c63ff]/25 transition-colors cursor-pointer"
            >
              <UserPlus size={15} />
              إضافة عميل
            </button>
            <button
              onClick={() => handleQuickAction('my-sheet')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00d4aa]/10 border border-[#00d4aa]/20 text-[#00d4aa] text-[12px] font-semibold hover:bg-[#00d4aa]/20 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              شيت التيلي
            </button>
            <button
              onClick={() => handleQuickAction('my-meetings')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ffd166]/10 border border-[#ffd166]/20 text-[#ffd166] text-[12px] font-semibold hover:bg-[#ffd166]/20 transition-colors cursor-pointer"
            >
              <Calendar size={15} />
              اجتماعاتي
            </button>
          </>
        )}
        {currentRole === 'sales' && (
          <>
            <button
              onClick={() => handleQuickAction('sales-sheet')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00d4aa]/10 border border-[#00d4aa]/20 text-[#00d4aa] text-[12px] font-semibold hover:bg-[#00d4aa]/20 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              شيت السيلز
            </button>
            <button
              onClick={() => handleQuickAction('my-meetings')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ffd166]/10 border border-[#ffd166]/20 text-[#ffd166] text-[12px] font-semibold hover:bg-[#ffd166]/20 transition-colors cursor-pointer"
            >
              <Calendar size={15} />
              اجتماعاتي
            </button>
            <button
              onClick={() => handleQuickAction('my-archive')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4a5280]/15 border border-[#4a5280]/20 text-[#8892b0] text-[12px] font-semibold hover:bg-[#4a5280]/25 transition-colors cursor-pointer"
            >
              <Archive size={15} />
              أرشيفي
            </button>
          </>
        )}
        {currentRole === 'admin' && (
          <>
            <button
              onClick={() => handleQuickAction('admin')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6c63ff]/15 border border-[#6c63ff]/20 text-[#a8a3ff] text-[12px] font-semibold hover:bg-[#6c63ff]/25 transition-colors cursor-pointer"
            >
              <Briefcase size={15} />
              لوحة التحكم
            </button>
            <button
              onClick={() => handleQuickAction('meetings')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ffd166]/10 border border-[#ffd166]/20 text-[#ffd166] text-[12px] font-semibold hover:bg-[#ffd166]/20 transition-colors cursor-pointer"
            >
              <Calendar size={15} />
              الاجتماعات
            </button>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════
         3. TELE COMPREHENSIVE STATS (with date filter)
         ═══════════════════════════════════════════ */}
      {teleStats && (
        <>
          {/* Date Filter */}
          <div className="flex items-center justify-between bg-[#111520] border border-white/[0.06] rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-[#6c63ff]" />
              <span className="text-[14px] font-bold text-[#f0f2ff]">إحصائيات التيلي</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevDay}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
              {/* Calendar date picker */}
              <div className="relative">
                <input
                  type="date"
                  value={teleFilterDateStr}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-').map(Number)
                      setTeleFilterDate(new Date(y, m - 1, d))
                    }
                  }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                  max={new Date().toISOString().split('T')[0]}
                />
                <button
                  onClick={goToToday}
                  className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer relative z-0"
                >
                  <Calendar size={14} className="text-[#6c63ff]" />
                  <span className="text-[14px] font-bold text-[#f0f2ff] min-w-[100px] text-center">
                    {teleFilterDayLabel}
                  </span>
                </button>
              </div>
              <button
                onClick={goToNextDay}
                disabled={isTeleFilterToday}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          {/* Call Stats */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PhoneCall size={14} className="text-[#00d4aa]" />
              <span className="text-[13px] font-bold text-[#8892b0]">إحصائيات المكالمات</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'عدد المكالمات الكلية', value: teleStats.totalCalls, color: '#6c63ff', icon: PhoneCall },
                { label: 'عدد المكالمات المجابة', value: teleStats.answeredCalls, color: '#00d4aa', icon: Phone },
                { label: 'عدد المكالمات الغير مجابة', value: teleStats.unansweredCalls, color: '#ff6b6b', icon: PhoneOff },
                { label: 'عدد الاجتماعات', value: teleStats.meetings, color: '#ffd166', icon: Calendar },
              ].map((k, i) => {
                const Icon = k.icon
                return (
                  <div key={i} className="bg-[#111520] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-bold text-[#8892b0]">{k.label}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}12` }}>
                        <Icon size={14} style={{ color: k.color }} />
                      </div>
                    </div>
                    <div className="text-[22px] font-bold" style={{ color: k.color }}>
                      {k.value}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Attendance Stats */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck size={14} className="text-[#00d4aa]" />
              <span className="text-[13px] font-bold text-[#8892b0]">إحصائيات الحضور</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'عدد العملاء الذين حضروا', value: teleStats.attended, color: '#00d4aa', icon: CheckCircle2 },
                { label: 'عدد العملاء في الانتظار', value: teleStats.waiting, color: '#ffd166', icon: HourglassIcon },
                { label: 'عدد العملاء لم يحضروا', value: teleStats.noShow, color: '#ff6b6b', icon: UserX },
                { label: 'عدد التحويلات', value: teleStats.transferred, color: '#a8a3ff', icon: ArrowRightLeft },
              ].map((k, i) => {
                const Icon = k.icon
                return (
                  <div key={i} className="bg-[#111520] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-bold text-[#8892b0]">{k.label}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}12` }}>
                        <Icon size={14} style={{ color: k.color }} />
                      </div>
                    </div>
                    <div className="text-[22px] font-bold" style={{ color: k.color }}>
                      {k.value}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Client Stats */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-[#6c63ff]" />
              <span className="text-[13px] font-bold text-[#8892b0]">إحصائيات العملاء</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'عدد العملاء الكلي', value: teleStats.totalClients, color: '#6c63ff', icon: Users },
                { label: 'عدد العملاء الذين كلمتهم', value: teleStats.contactedClients, color: '#00d4aa', icon: PhoneCall },
                { label: 'عدد العملاء الذين لم يردوا', value: teleStats.noReplyClients, color: '#ff6b6b', icon: PhoneOff },
                { label: 'عدد العملاء غير مهتم', value: teleStats.notInterested, color: '#ff6b6b', icon: UserX },
                { label: 'متابعة 1', value: teleStats.followup1, color: '#ffd166', icon: RefreshCw },
                { label: 'متابعة 2', value: teleStats.followup2, color: '#f0a030', icon: RefreshCw },
                { label: 'متابعة 3', value: teleStats.followup3, color: '#e08020', icon: RefreshCw },
                { label: 'إجمالي العملاء (كل الأيام)', value: teleStats.totalAll, color: '#4a5280', icon: BarChart3 },
              ].map((k, i) => {
                const Icon = k.icon
                return (
                  <div key={i} className="bg-[#111520] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-bold text-[#8892b0]">{k.label}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}12` }}>
                        <Icon size={14} style={{ color: k.color }} />
                      </div>
                    </div>
                    <div className="text-[22px] font-bold" style={{ color: k.color }}>
                      {k.value}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Important Ratios Section */}
          <Card className="bg-[#111520] border border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px] font-extrabold text-[#f0f2ff] flex items-center gap-2">
                <TrendingUp size={16} className="text-[#00d4aa]" />
                نسب مهمة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'نسبة التواصل', value: teleStats.contactRate, desc: `العملاء الذين تم التواصل معهم من إجمالي العملاء (${teleStats.contactedClients}/${teleStats.totalClients})`, color: '#6c63ff' },
                  { label: 'نسبة الرد', value: teleStats.answeredRate, desc: `المكالمات المجابة من إجمالي المكالمات (${teleStats.answeredCalls}/${teleStats.totalCalls})`, color: '#00d4aa' },
                  { label: 'نسبة الاجتماعات', value: teleStats.meetingRate, desc: `الاجتماعات من العملاء الذين تم التواصل معهم (${teleStats.meetings}/${teleStats.contactedClients})`, color: '#ffd166' },
                  { label: 'نسبة الحضور', value: teleStats.attendanceRate, desc: `العملاء الذين حضروا من الحاضرين والغائبين (${teleStats.attended}/${teleStats.attended + teleStats.noShow})`, color: '#a8a3ff' },
                ].map((r, i) => (
                  <div key={i} className="bg-[#0a0d14] border border-white/[0.04] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-bold text-[#f0f2ff]">{r.label}</span>
                      <span className="text-[18px] font-bold" style={{ color: r.color }}>{r.value}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#1c2234] overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(r.value, 100)}%`, backgroundColor: r.color }}
                      />
                    </div>
                    <div className="text-[11px] font-medium text-[#4a5280]">{r.desc}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {salesStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'اجتماعات اليوم', value: salesStats.todayMeetings.length, color: '#ffd166', icon: Calendar },
            { label: 'حضر اليوم', value: salesStats.todayAttended, color: '#00d4aa', icon: CheckCircle2 },
            { label: 'انتظار اليوم', value: salesStats.todayPending, color: '#ffd166', icon: HourglassIcon },
            { label: 'عملاء جدد اليوم', value: salesStats.todayNew, color: '#6c63ff', icon: UserPlus },
          ].map((k, i) => {
            const Icon = k.icon
            return (
              <div key={i} className="bg-[#111520] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-[#8892b0]">{k.label}</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}15` }}>
                    <Icon size={16} style={{ color: k.color }} />
                  </div>
                </div>
                <div className="text-[24px] font-bold" style={{ color: k.color }}>
                  {k.value}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
         4. KPI PERFORMANCE CARDS (Sales only)
         ═══════════════════════════════════════════ */}
      {salesStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'إجمالي العملاء', value: salesStats.total, color: '#6c63ff', icon: Users, progress: salesStats.attendanceRate, progressLabel: 'حضور' },
            { label: 'نسبة الحضور', value: `${salesStats.attendanceRate}%`, color: '#00d4aa', icon: UserCheck, progress: salesStats.attendanceRate, progressLabel: 'من الاجتماعات' },
            { label: 'نسبة التقفيل', value: `${salesStats.closingRate}%`, color: '#ffd166', icon: Target, progress: salesStats.closingRate, progressLabel: 'تقفيل' },
            { label: 'قيد المتابعة', value: salesStats.inProgress, color: '#a8a3ff', icon: Activity, progress: salesStats.total > 0 ? Math.round((salesStats.inProgress / salesStats.total) * 100) : 0, progressLabel: 'متابعة' },
            { label: 'تم التقفيل', value: salesStats.closedWon, color: '#00d4aa', icon: Trophy, progress: salesStats.total > 0 ? Math.round((salesStats.closedWon / salesStats.total) * 100) : 0, progressLabel: 'تقفيل' },
          ].map((k, i) => {
            const Icon = k.icon
            const progressVal = typeof k.progress === 'number' ? k.progress : 0
            return (
              <div key={i} className="bg-[#111520] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-[#8892b0]">{k.label}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}12` }}>
                    <Icon size={14} style={{ color: k.color }} />
                  </div>
                </div>
                <div className="text-[20px] font-bold mb-2" style={{ color: k.color }}>
                  {k.value}
                </div>
                <div className="h-1.5 rounded-full bg-[#1c2234] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(progressVal, 100)}%`, backgroundColor: k.color }}
                  />
                </div>
                <div className="text-[11px] font-medium text-[#4a5280] mt-1">{k.progressLabel} {progressVal}%</div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
         5. RECENT TRANSFER ACTIVITY
         ═══════════════════════════════════════════ */}
      {recentTransfers.length > 0 && (
        <Card className="bg-[#111520] border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-extrabold text-[#f0f2ff] flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-[#a8a3ff]" />
              التحويلات الأخيرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTransfers.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-[#0a0d14] border border-white/[0.04]">
                  {/* Customer initials */}
                  <div className="w-9 h-9 rounded-lg bg-[#6c63ff]/12 flex items-center justify-center text-[#a8a3ff] shrink-0 text-[12px] font-bold">
                    {lead.customerName?.slice(0, 2) || '؟'}
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#f0f2ff] truncate">{lead.customerName || 'عميل'}</div>
                    <div className="text-[11px] font-medium text-[#4a5280] mt-0.5">
                      {currentRole === 'tele' ? (
                        <>حوّل إلى <span className="text-[#00d4aa]">{lead.sales}</span></>
                      ) : (
                        <>محوّل من <span className="text-[#6c63ff]">{lead.tele}</span></>
                      )}
                    </div>
                  </div>
                  {/* Date/Time info */}
                  <div className="text-left shrink-0">
                    <div className="text-[11px] font-medium text-[#8892b0]">
                      {lead.assignedAt ? formatRelativeTime(lead.assignedAt) : '—'}
                    </div>
                    {lead.meetingDate && (
                      <div className="text-[11px] text-[#4a5280] mt-0.5">
                        اجتماع: {lead.meetingDate}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════
         6. TODAY'S MEETINGS
         ═══════════════════════════════════════════ */}
      {todayMeetings.length > 0 && (
        <Card className="bg-[#111520] border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-extrabold text-[#f0f2ff] flex items-center gap-2">
              <Calendar size={16} className="text-[#ffd166]" />
              اجتماعات اليوم
              <Badge className="bg-[#ffd166]/15 text-[#ffd166] text-[11px] font-bold border-0 mr-2">
                {todayMeetings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayMeetings.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-[#0a0d14] border border-white/[0.04]">
                  {/* Customer initials */}
                  <div className="w-9 h-9 rounded-lg bg-[#ffd166]/10 flex items-center justify-center text-[#ffd166] shrink-0 text-[12px] font-bold">
                    {lead.customerName?.slice(0, 2) || '؟'}
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#f0f2ff] truncate">{lead.customerName || 'عميل'}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[12px] font-medium text-[#8892b0]">{lead.meetingTime || '—'}</span>
                      {/* Meeting type badge */}
                      {lead.meetingType && (
                        <Badge className="text-[10px] border-0 bg-[#1c2234] text-[#8892b0] px-1.5 py-0">
                          {lead.meetingType === 'online' ? (
                            <span className="flex items-center gap-1"><Video size={8} /> أونلاين</span>
                          ) : lead.meetingType === 'offline' ? (
                            <span className="flex items-center gap-1"><MapPin size={8} /> حضوري</span>
                          ) : (
                            lead.meetingType
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Attendance status / action */}
                  <div className="shrink-0">
                    {currentRole === 'sales' && (!lead.attended || lead.attended === 'pending') ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleMarkAttendance(lead.id, 'attended')}
                          className="w-8 h-8 rounded-lg bg-[#00d4aa]/10 border border-[#00d4aa]/20 flex items-center justify-center text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors cursor-pointer"
                          title="حضر"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                        <button
                          onClick={() => handleMarkAttendance(lead.id, 'no-show')}
                          className="w-8 h-8 rounded-lg bg-[#ff6b6b]/10 border border-[#ff6b6b]/20 flex items-center justify-center text-[#ff6b6b] hover:bg-[#ff6b6b]/20 transition-colors cursor-pointer"
                          title="لم يحضر"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ) : (
                      <Badge className={`text-[11px] font-bold border-0 ${lead.attended === 'attended' ? 'bg-[#00d4aa]/15 text-[#00d4aa]' : lead.attended === 'no-show' ? 'bg-[#ff6b6b]/15 text-[#ff6b6b]' : 'bg-[#ffd166]/15 text-[#ffd166]'}`}>
                        {lead.attended === 'attended' ? 'حضر ✓' : lead.attended === 'no-show' ? 'لم يحضر ✗' : 'انتظار'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════
         7. STATUS DISTRIBUTION
         ═══════════════════════════════════════════ */}
      {statusDistribution.length > 0 && (
        <Card className="bg-[#111520] border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-extrabold text-[#f0f2ff] flex items-center gap-2">
              <BarChart3 size={16} className="text-[#6c63ff]" />
              توزيع الحالات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusDistribution.map((s, i) => {
                const barColor = statusColorMap[s.key] || '#6c63ff'
                const barWidth = maxStatusCount > 0 ? (s.count / maxStatusCount) * 100 : 0
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold text-[#f0f2ff] min-w-[100px] truncate">{s.label}</span>
                    <div className="flex-1 h-6 rounded-lg bg-[#1c2234] overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-500"
                        style={{ width: `${barWidth}%`, backgroundColor: barColor, opacity: 0.7 }}
                      />
                      <span className="absolute inset-0 flex items-center justify-start pr-2 text-[11px] font-bold text-[#f0f2ff]/70">
                        {s.count} ({s.percentage}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════
         8. RECENT LEADS
         ═══════════════════════════════════════════ */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-extrabold text-[#f0f2ff] flex items-center gap-2">
            <Clock size={16} className="text-[#6c63ff]" />
            آخر العملاء
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <div className="text-center py-8 text-[#4a5280] text-[13px] font-semibold">لا يوجد عملاء بعد</div>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1c2234 transparent' }}>
              {recentLeads.map((lead) => {
                const statusKey = currentRole === 'tele' ? lead.status : lead.salesStatus
                const statusObj = currentRole === 'tele'
                  ? STATUSES.find((s) => s.key === statusKey)
                  : SALES_STATUSES.find((s) => s.key === statusKey)
                return (
                  <div key={lead.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#1c2234]/50 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-[#6c63ff]/15 flex items-center justify-center text-[11px] text-[#a8a3ff] font-bold shrink-0">
                      {lead.customerName?.slice(0, 2) || '؟'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[#f0f2ff] truncate">{lead.customerName || 'عميل'}</div>
                      <div className="text-[11px] font-medium text-[#4a5280]">{formatDate(lead.createdAt)}</div>
                    </div>
                    {statusObj && (
                      <Badge className="text-[11px] font-bold border-0 bg-[#1c2234] text-[#8892b0]">
                        {statusObj.label}
                      </Badge>
                    )}
                    {lead.meetingDate && (
                      <Badge className="bg-[#ffd166]/15 text-[#ffd166] text-[11px] font-bold border-0">
                        📅 {lead.meetingDate}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════
         9. CHANGE PASSWORD
         ═══════════════════════════════════════════ */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] font-extrabold text-[#f0f2ff] flex items-center gap-2">
              <KeyRound size={16} className="text-[#6c63ff]" />
              الأمان
            </CardTitle>
            <button
              onClick={() => setShowChangePassword(!showChangePassword)}
              className="text-[12px] font-semibold text-[#6c63ff] hover:text-[#a8a3ff] transition-colors cursor-pointer"
            >
              {showChangePassword ? 'إلغاء' : 'تغيير كلمة المرور'}
            </button>
          </div>
        </CardHeader>
        {showChangePassword && (
          <CardContent>
            <div className="space-y-3 max-w-md">
              {/* Current Password */}
              <div>
                <label className="text-[13px] font-semibold text-[#8892b0] mb-1 block">كلمة المرور الحالية</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#0a0d14] px-3 text-[13px] font-medium text-[#f0f2ff] placeholder:text-[#4a5280] outline-none focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/30"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                    placeholder="أدخل كلمة المرور الحالية"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5280] hover:text-[#8892b0] cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              {/* New Password */}
              <div>
                <label className="text-[13px] font-semibold text-[#8892b0] mb-1 block">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#0a0d14] px-3 text-[13px] font-medium text-[#f0f2ff] placeholder:text-[#4a5280] outline-none focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/30"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                    placeholder="أدخل كلمة المرور الجديدة"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5280] hover:text-[#8892b0] cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              {/* Confirm Password */}
              <div>
                <label className="text-[13px] font-semibold text-[#8892b0] mb-1 block">تأكيد كلمة المرور</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#0a0d14] px-3 text-[13px] font-medium text-[#f0f2ff] placeholder:text-[#4a5280] outline-none focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/30"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                  placeholder="أعد كتابة كلمة المرور الجديدة"
                  dir="ltr"
                />
              </div>
              {/* Submit */}
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="w-full h-10 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-60 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)',
                  fontFamily: 'Cairo, sans-serif',
                }}
              >
                {changingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
              </button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
