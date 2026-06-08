'use client'

import { useMemo, useCallback, useState } from 'react'
import { useCrmStore, STATUSES, SALES_STATUSES, ATTENDANCE_STATUSES, formatDate, formatRelativeTime } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiUpdateLead } from '@/lib/supabase'
import {
  Phone, Briefcase, Calendar, Trophy, Users, TrendingUp,
  Clock, CheckCircle2, XCircle, HourglassIcon, Target,
  PhoneCall, UserCheck, ArrowRightLeft, Sun, Moon,
  UserPlus, FileSpreadsheet, MeetingRoom, Archive,
  Video, MapPin, Zap, Award, BarChart3, Activity,
  KeyRound, Eye, EyeOff,
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

  /* ─── Tele Stats ─── */
  const teleStats = useMemo(() => {
    if (currentRole !== 'tele') return null
    const total = myLeads.length
    const contacted = myLeads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length
    const meetings = myLeads.filter((l) => l.meetingDate).length
    const transferred = myLeads.filter((l) => l.sales && l.meetingDate).length
    const closedWon = myLeads.filter((l) => l.status === 'closed-won').length
    const meetingRate = contacted > 0 ? Math.round((meetings / contacted) * 100) : 0
    const transferRate = meetings > 0 ? Math.round((transferred / meetings) * 100) : 0
    const contactRate = total > 0 ? Math.round((contacted / total) * 100) : 0

    // Today's stats
    const todayNew = myLeads.filter((l) => l.createdAt && l.createdAt >= todayStart).length
    const todayContacted = myLeads.filter((l) => l.contactResultAt && l.contactResultAt >= todayStart && l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length
    const todayMeetings = myLeads.filter((l) => l.meetingDate === todayStr).length
    const todayTransfers = myLeads.filter((l) => l.assignedAt && l.assignedAt >= todayStart && l.sales && l.meetingDate).length

    return { total, contacted, meetings, transferred, closedWon, meetingRate, transferRate, contactRate, todayNew, todayContacted, todayMeetings, todayTransfers }
  }, [myLeads, currentRole, todayStr, todayStart])

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
    'no-reply': '#4a5280',
    'whatsapp': '#00d4aa',
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
         3. TODAY'S SUMMARY CARDS
         ═══════════════════════════════════════════ */}
      {teleStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'عملاء جدد اليوم', value: teleStats.todayNew, color: '#6c63ff', icon: UserPlus },
            { label: 'تم التواصل اليوم', value: teleStats.todayContacted, color: '#00d4aa', icon: PhoneCall },
            { label: 'اجتماعات اليوم', value: teleStats.todayMeetings, color: '#ffd166', icon: Calendar },
            { label: 'تحويلات اليوم', value: teleStats.todayTransfers, color: '#a8a3ff', icon: ArrowRightLeft },
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
         4. KPI PERFORMANCE CARDS
         ═══════════════════════════════════════════ */}
      {teleStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'إجمالي العملاء', value: teleStats.total, color: '#6c63ff', icon: Users, progress: teleStats.contactRate, progressLabel: 'تواصل' },
            { label: 'تم التواصل', value: teleStats.contacted, color: '#00d4aa', icon: PhoneCall, progress: teleStats.meetingRate, progressLabel: 'اجتماعات' },
            { label: 'نسبة الاجتماعات', value: `${teleStats.meetingRate}%`, color: '#ffd166', icon: Target, progress: teleStats.meetingRate, progressLabel: 'من التواصل' },
            { label: 'نسبة التحويل', value: `${teleStats.transferRate}%`, color: '#a8a3ff', icon: ArrowRightLeft, progress: teleStats.transferRate, progressLabel: 'تحويل' },
            { label: 'تم التقفيل', value: teleStats.closedWon, color: '#00d4aa', icon: Trophy, progress: teleStats.total > 0 ? Math.round((teleStats.closedWon / teleStats.total) * 100) : 0, progressLabel: 'تقفيل' },
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
