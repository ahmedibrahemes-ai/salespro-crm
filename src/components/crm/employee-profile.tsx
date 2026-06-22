'use client'

import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { useCrmStore, STATUSES, SALES_STATUSES, ATTENDANCE_STATUSES, CONTACT_RESULTS, formatDate, formatRelativeTime } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiUpdateLead } from '@/lib/supabase'
import { isCallContactResult, isClosedWon } from '@/lib/crm-utils'
import {
  Phone, Briefcase, Calendar, CalendarCheck, Trophy, Users, TrendingUp,
  Clock, CheckCircle2, XCircle, HourglassIcon, Target,
  PhoneCall, UserCheck, ArrowRightLeft, Sun, Moon,
  UserPlus, FileSpreadsheet, DoorOpen, Archive,
  Video, MapPin, Zap, Award, BarChart3, Activity,
  ChevronLeft, ChevronRight,
  PhoneOff, UserX, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/* ═══════════════════════════════════════════════════════
   Animated Counter — counts from 0 to target value
   Uses direct DOM manipulation to avoid setState-in-effect lint
   ═══════════════════════════════════════════════════════ */
function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const startTime = performance.now()
    const animate = (timestamp: number) => {
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      if (spanRef.current) {
        spanRef.current.textContent = String(Math.floor(eased * value))
      }
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <span ref={spanRef}>0</span>
}

/* ═══════════════════════════════════════════════════════
   CSS Keyframes for animations
   ═══════════════════════════════════════════════════════ */
const PROFILE_ANIMATIONS_CSS = `
@keyframes ep-fill-bar {
  from { width: 0%; }
}
@keyframes ep-pulse-soft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
@keyframes ep-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(108,99,255,0.15); }
  50% { box-shadow: 0 0 18px rgba(108,99,255,0.3); }
}
.ep-bar-animated {
  animation: ep-fill-bar 1.2s cubic-bezier(0.4,0,0.2,1) forwards;
}
.ep-pulse-high {
  animation: ep-pulse-soft 2s ease-in-out infinite;
}
.ep-glow-hover:hover {
  animation: ep-glow 1s ease-in-out;
}
.ep-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.ep-stat-card:hover {
  transform: scale(1.02);
  box-shadow: 0 0 16px rgba(108,99,255,0.12);
}
.ep-ratio-card {
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  cursor: pointer;
}
.ep-ratio-card:hover {
  transform: scale(1.03);
  box-shadow: 0 0 20px rgba(108,99,255,0.2);
}
.ep-tooltip {
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s, visibility 0.2s;
}
.ep-ratio-card:hover .ep-tooltip {
  visibility: visible;
  opacity: 1;
}
`

/* ═══════════════════════════════════════════════════════
   Performance emoji indicator
   ═══════════════════════════════════════════════════════ */
function performanceEmoji(value: number): string {
  if (value >= 70) return '🟢'
  if (value >= 40) return '🟡'
  return '🔴'
}

/* ═══════════════════════════════════════════════════════
   Trend indicator (↑ ↓ =)
   ═══════════════════════════════════════════════════════ */
function TrendIndicator({ today, yesterday }: { today: number; yesterday: number }) {
  if (today > yesterday) return <span className="text-[#00d4aa] text-[11px] font-bold">↑{today - yesterday}</span>
  if (today < yesterday) return <span className="text-[#ff6b6b] text-[11px] font-bold">↓{yesterday - today}</span>
  if (today === yesterday && today > 0) return <span className="text-[#4a5280] text-[11px] font-bold">=</span>
  return null
}

/* ═══════════════════════════════════════════════════════
   Motivational feedback text
   ═══════════════════════════════════════════════════════ */
function motivationalText(key: string, value: number): string | null {
  if (key === 'calls' && value === 0) return 'ابدأ بالاتصال! 📞'
  if (key === 'calls' && value >= 20) return 'أداء رائع! 🚀'
  if (key === 'calls' && value >= 10) return 'استمر! 💪'
  if (key === 'answered' && value >= 10) return 'ممتاز! 🌟'
  if (key === 'meetings' && value >= 5) return 'رائع! 🎯'
  if (key === 'meetings' && value === 0) return 'حدد اجتماعات! 📅'
  if (key === 'attended' && value >= 3) return 'حضور ممتاز! ✨'
  if (key === 'transferred' && value >= 3) return 'تحويلات قوية! 🔥'
  if (key === 'totalClients' && value === 0) return 'أضف عملاء! 👥'
  if (key === 'contacted' && value >= 10) return 'تواصل ممتاز! 📱'
  if (key === 'salesMeetings' && value === 0) return 'لا اجتماعات اليوم 📅'
  if (key === 'salesAttended' && value >= 2) return 'حضور ممتاز! ✨'
  if (key === 'salesNew' && value >= 3) return 'عملاء جدد! 🆕'
  return null
}

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

  /* ─── Mount animation trigger ─── */
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

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

  const teleFilterDayLabel = (() => {
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
  })()

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
    const contactedAll = myLeads.filter((l) => isCallContactResult(l.contactResult)).length

    // Filtered-date stats
    const total = filteredLeads.length
    const contacted = filteredLeads.filter((l) => isCallContactResult(l.contactResult)).length

    // Call stats
    const totalCalls = filteredLeads.filter((l) => isCallContactResult(l.contactResult)).length
    const answeredCalls = filteredLeads.filter((l) => l.contactResult === 'replied').length
    const unansweredCalls = filteredLeads.filter((l) => l.contactResult === 'no-reply').length

    // Meeting stats
    const meetings = filteredLeads.filter((l) => l.status === 'meeting' || l.meetingDate).length
    const attended = filteredLeads.filter((l) => l.attended === 'attended').length
    const waiting = filteredLeads.filter((l) => !l.attended || l.attended === 'pending' || l.attended === '').length
    const noShow = filteredLeads.filter((l) => l.attended === 'no-show').length

    // Client stats
    const totalClients = filteredLeads.length
    const contactedClients = filteredLeads.filter((l) => isCallContactResult(l.contactResult)).length
    const noReplyClients = filteredLeads.filter((l) => l.contactResult === 'no-reply').length
    const notInterested = filteredLeads.filter((l) => l.status === 'not-interested').length
    const followup1 = filteredLeads.filter((l) => l.status === 'followup-1').length
    const followup2 = filteredLeads.filter((l) => l.status === 'followup-2').length
    const followup3 = filteredLeads.filter((l) => l.status === 'followup-3').length

    // Transferred
    const transferred = filteredLeads.filter((l) => l.sales && l.assignedAt).length

    // Rates
    const contactRate = totalClients > 0 ? Math.round((contactedClients / totalClients) * 100) : 0
    const answeredRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0
    const meetingRate = contactedClients > 0 ? Math.round((meetings / contactedClients) * 100) : 0
    const attendanceRate = (attended + noShow) > 0 ? Math.round((attended / (attended + noShow)) * 100) : 0
    const transferRate = meetings > 0 ? Math.round((transferred / meetings) * 100) : 0

    // Yesterday stats for trend comparison
    const prevDay = new Date(teleFilterDate)
    prevDay.setDate(prevDay.getDate() - 1)
    const isOnPrevDay = (ts: number | undefined | null) => {
      if (!ts) return false
      const d = new Date(ts)
      return (
        d.getFullYear() === prevDay.getFullYear() &&
        d.getMonth() === prevDay.getMonth() &&
        d.getDate() === prevDay.getDate()
      )
    }
    const prevDayStr = `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, '0')}-${String(prevDay.getDate()).padStart(2, '0')}`
    const prevDayLeads = myLeads.filter((l) => {
      return isOnPrevDay(l.createdAt) || isOnPrevDay(l.contactResultAt) || l.meetingDate === prevDayStr || isOnPrevDay(l.assignedAt)
    })
    const yCalls = prevDayLeads.filter((l) => isCallContactResult(l.contactResult)).length
    const yAnswered = prevDayLeads.filter((l) => l.contactResult === 'replied').length
    const yUnanswered = prevDayLeads.filter((l) => l.contactResult === 'no-reply').length
    const yMeetings = prevDayLeads.filter((l) => l.status === 'meeting' || l.meetingDate).length
    const yAttended = prevDayLeads.filter((l) => l.attended === 'attended').length
    const yWaiting = prevDayLeads.filter((l) => !l.attended || l.attended === 'pending' || l.attended === '').length
    const yNoShow = prevDayLeads.filter((l) => l.attended === 'no-show').length
    const yTransferred = prevDayLeads.filter((l) => l.sales && l.assignedAt).length
    const yTotalClients = prevDayLeads.length
    const yContactedClients = prevDayLeads.filter((l) => isCallContactResult(l.contactResult)).length
    const yNotInterested = prevDayLeads.filter((l) => l.status === 'not-interested').length
    const yFollowup1 = prevDayLeads.filter((l) => l.status === 'followup-1').length
    const yFollowup2 = prevDayLeads.filter((l) => l.status === 'followup-2').length
    const yFollowup3 = prevDayLeads.filter((l) => l.status === 'followup-3').length

    return {
      total, totalAll, contacted, meetings, transferred, totalCalls,
      answeredCalls, unansweredCalls, attended, waiting, noShow,
      totalClients, contactedClients, noReplyClients, notInterested,
      followup1, followup2, followup3,
      contactRate, answeredRate, meetingRate, attendanceRate, transferRate,
      // Yesterday comparison data
      yCalls, yAnswered, yUnanswered, yMeetings, yAttended, yWaiting, yNoShow, yTransferred,
      yTotalClients, yContactedClients, yNotInterested, yFollowup1, yFollowup2, yFollowup3,
    }
  }, [myLeads, currentRole, teleFilterDate, teleFilterDateStr])

  /* ─── Sales Stats ─── */
  const salesStats = useMemo(() => {
    if (currentRole !== 'sales') return null
    const total = myLeads.length

    // Split leads into sales-originated vs tele-transferred.
    // Sales-originated meetings do NOT have the attendance/waiting system,
    // so they are tracked separately as "اجتماعاتي" and excluded from
    // attended / noShow / pending / attendanceRate.
    const salesOriginated = myLeads.filter((l) => !l.tele || l.tele.trim() === '')
    const teleTransferred = myLeads.filter((l) => l.tele && l.tele.trim() !== '')

    // "اجتماعاتي" = meetings the sales rep booked themselves (sales-originated)
    const myMeetings = salesOriginated.filter((l) => l.meetingDate || l.status === 'meeting' || l.assignedAt).length
    // "اجتماعات التلي" = meetings tele transferred to this sales rep
    const teleMeetings = teleTransferred.length

    // Attendance stats apply ONLY to tele-transferred meetings
    const attended = teleTransferred.filter((l) => l.attended === 'attended').length
    const noShow = teleTransferred.filter((l) => l.attended === 'no-show').length
    const pending = teleTransferred.filter((l) => !l.attended || l.attended === 'pending').length
    const closedWon = myLeads.filter((l) => isClosedWon(l)).length
    const attendanceRate = (attended + noShow) > 0 ? Math.round((attended / (attended + noShow)) * 100) : 0
    const closingRate = (attended + noShow) > 0 ? Math.round((closedWon / (attended + noShow)) * 100) : 0
    // "قيد المتابعة" = leads in followup-1/2/3 status.
    // The UI dropdowns (sales-sheet, follow-up) write 'followup-1/2/3' to the
    // `status` field, NOT `salesStatus`. The old code checked salesStatus which
    // is only set to 'closed-won' or free-text notes → was always 0 (audit §2 row 2).
    const inProgress = myLeads.filter((l) => l.status === 'followup-1' || l.status === 'followup-2' || l.status === 'followup-3').length

    // Today's stats — attendance from tele-transferred only
    const todayMeetings = myLeads.filter((l) => l.meetingDate === todayStr)
    const todayAttended = todayMeetings.filter((l) => l.tele && l.tele.trim() !== '' && l.attended === 'attended').length
    const todayPending = todayMeetings.filter((l) => l.tele && l.tele.trim() !== '' && (!l.attended || l.attended === 'pending')).length
    const todayNew = myLeads.filter((l) => l.assignedAt && l.assignedAt >= todayStart).length

    // Yesterday comparison (simplified — count leads with yesterday's meeting date)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    const yMeetingsCount = myLeads.filter((l) => l.meetingDate === yesterdayStr).length
    const yAttendedCount = myLeads.filter((l) => l.meetingDate === yesterdayStr && l.tele && l.tele.trim() !== '' && l.attended === 'attended').length
    const yPendingCount = myLeads.filter((l) => l.meetingDate === yesterdayStr && l.tele && l.tele.trim() !== '' && (!l.attended || l.attended === 'pending')).length
    const yNewCount = myLeads.filter((l) => {
      if (!l.assignedAt) return false
      const assignedDate = new Date(l.assignedAt)
      return assignedDate.getFullYear() === yesterday.getFullYear() &&
        assignedDate.getMonth() === yesterday.getMonth() &&
        assignedDate.getDate() === yesterday.getDate()
    }).length

    return {
      total, myMeetings, teleMeetings, attended, noShow, pending, closedWon, attendanceRate, closingRate, inProgress,
      todayMeetings, todayAttended, todayPending, todayNew,
      yMeetingsCount, yAttendedCount, yPendingCount, yNewCount,
    }
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

  /* ─── Status distribution ─── */
  const statusDistribution = useMemo(() => {
    const statusList = currentRole === 'tele' ? STATUSES : SALES_STATUSES
    const statusField = currentRole === 'tele' ? 'status' : 'salesStatus'
    const total = myLeads.length || 1
    return statusList
      .map((s) => ({
        key: s.key,
        label: s.label,
        count: myLeads.filter((l) => (l as unknown as Record<string, unknown>)[statusField] === s.key).length,
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

  if (!currentUser) return null

  return (
    <div className="space-y-5 animate-in fade-in duration-200" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {/* Inject CSS animations */}
      <style>{PROFILE_ANIMATIONS_CSS}</style>

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
              اجتماعات التلي
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
              اجتماعات التلي
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
              onClick={() => handleQuickAction('my-meetings')}
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
                  lang="ar-EG"
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

          {/* Call Stats — Interactive */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PhoneCall size={14} className="text-[#00d4aa]" />
              <span className="text-[13px] font-bold text-[#8892b0]">إحصائيات المكالمات</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'عدد المكالمات الكلية', value: teleStats.totalCalls, yValue: teleStats.yCalls, color: '#6c63ff', icon: PhoneCall, motKey: 'calls', onClick: 'my-sheet' as const },
                { label: 'عدد المكالمات المجابة', value: teleStats.answeredCalls, yValue: teleStats.yAnswered, color: '#00d4aa', icon: Phone, motKey: 'answered', onClick: 'my-sheet' as const },
                { label: 'عدد المكالمات الغير مجابة', value: teleStats.unansweredCalls, yValue: teleStats.yUnanswered, color: '#ff6b6b', icon: PhoneOff, motKey: '', onClick: 'my-sheet' as const },
                { label: 'عدد الاجتماعات', value: teleStats.meetings, yValue: teleStats.yMeetings, color: '#ffd166', icon: Calendar, motKey: 'meetings', onClick: 'my-meetings' as const },
              ].map((k, i) => {
                const Icon = k.icon
                const motText = motivationalText(k.motKey, k.value)
                const isHigh = k.value >= 10
                return (
                  <div
                    key={i}
                    onClick={() => handleQuickAction(k.onClick)}
                    className={`ep-stat-card ep-glow-hover bg-[#111520] border border-white/[0.06] rounded-xl p-4 cursor-pointer ${isHigh ? 'ep-pulse-high' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-bold text-[#8892b0]">{k.label}</span>
                      <div className="flex items-center gap-1.5">
                        <TrendIndicator today={k.value} yesterday={k.yValue} />
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}12` }}>
                          <Icon size={14} style={{ color: k.color }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-[22px] font-bold" style={{ color: k.color }}>
                      <AnimatedCounter value={k.value} />
                    </div>
                    {motText && (
                      <div className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>{motText}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Attendance Stats — Interactive */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck size={14} className="text-[#00d4aa]" />
              <span className="text-[13px] font-bold text-[#8892b0]">إحصائيات الحضور</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'عدد العملاء الذين حضروا', value: teleStats.attended, yValue: teleStats.yAttended, color: '#00d4aa', icon: CheckCircle2, motKey: 'attended', onClick: 'my-meetings' as const },
                { label: 'عدد العملاء في الانتظار', value: teleStats.waiting, yValue: teleStats.yWaiting, color: '#ffd166', icon: HourglassIcon, motKey: '', onClick: 'my-meetings' as const },
                { label: 'عدد العملاء لم يحضروا', value: teleStats.noShow, yValue: teleStats.yNoShow, color: '#ff6b6b', icon: UserX, motKey: '', onClick: 'my-meetings' as const },
                { label: 'عدد التحويلات', value: teleStats.transferred, yValue: teleStats.yTransferred, color: '#a8a3ff', icon: ArrowRightLeft, motKey: 'transferred', onClick: 'transfers' as const },
              ].map((k, i) => {
                const Icon = k.icon
                const motText = motivationalText(k.motKey, k.value)
                const isHigh = k.value >= 5
                return (
                  <div
                    key={i}
                    onClick={() => handleQuickAction(k.onClick)}
                    className={`ep-stat-card ep-glow-hover bg-[#111520] border border-white/[0.06] rounded-xl p-4 cursor-pointer ${isHigh ? 'ep-pulse-high' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-bold text-[#8892b0]">{k.label}</span>
                      <div className="flex items-center gap-1.5">
                        <TrendIndicator today={k.value} yesterday={k.yValue} />
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}12` }}>
                          <Icon size={14} style={{ color: k.color }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-[22px] font-bold" style={{ color: k.color }}>
                      <AnimatedCounter value={k.value} />
                    </div>
                    {motText && (
                      <div className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>{motText}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Client Stats — Interactive */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-[#6c63ff]" />
              <span className="text-[13px] font-bold text-[#8892b0]">إحصائيات العملاء</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'عدد العملاء الكلي', value: teleStats.totalClients, yValue: teleStats.yTotalClients, color: '#6c63ff', icon: Users, motKey: 'totalClients', onClick: 'my-sheet' as const },
                { label: 'عدد العملاء الذين كلمتهم', value: teleStats.contactedClients, yValue: teleStats.yContactedClients, color: '#00d4aa', icon: PhoneCall, motKey: 'contacted', onClick: 'my-sheet' as const },
                { label: 'عدد العملاء الذين لم يردوا', value: teleStats.noReplyClients, yValue: 0, color: '#ff6b6b', icon: PhoneOff, motKey: '', onClick: 'my-sheet' as const },
                { label: 'عدد العملاء غير مهتم', value: teleStats.notInterested, yValue: teleStats.yNotInterested, color: '#ff6b6b', icon: UserX, motKey: '', onClick: 'my-sheet' as const },
                { label: 'متابعة 1', value: teleStats.followup1, yValue: teleStats.yFollowup1, color: '#ffd166', icon: RefreshCw, motKey: '', onClick: 'my-sheet' as const },
                { label: 'متابعة 2', value: teleStats.followup2, yValue: teleStats.yFollowup2, color: '#f0a030', icon: RefreshCw, motKey: '', onClick: 'my-sheet' as const },
                { label: 'متابعة 3', value: teleStats.followup3, yValue: teleStats.yFollowup3, color: '#e08020', icon: RefreshCw, motKey: '', onClick: 'my-sheet' as const },
                { label: 'إجمالي العملاء (كل الأيام)', value: teleStats.totalAll, yValue: 0, color: '#4a5280', icon: BarChart3, motKey: '', onClick: 'my-sheet' as const },
              ].map((k, i) => {
                const Icon = k.icon
                const motText = motivationalText(k.motKey, k.value)
                const isHigh = k.value >= 10
                return (
                  <div
                    key={i}
                    onClick={() => handleQuickAction(k.onClick)}
                    className={`ep-stat-card ep-glow-hover bg-[#111520] border border-white/[0.06] rounded-xl p-4 cursor-pointer ${isHigh ? 'ep-pulse-high' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-bold text-[#8892b0]">{k.label}</span>
                      <div className="flex items-center gap-1.5">
                        {k.yValue > 0 && <TrendIndicator today={k.value} yesterday={k.yValue} />}
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}12` }}>
                          <Icon size={14} style={{ color: k.color }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-[22px] font-bold" style={{ color: k.color }}>
                      <AnimatedCounter value={k.value} />
                    </div>
                    {motText && (
                      <div className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>{motText}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Important Ratios Section — Interactive */}
          <Card className="bg-[#111520] border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px] font-extrabold text-[#f0f2ff] flex items-center gap-2">
                <TrendingUp size={16} className="text-[#00d4aa]" />
                النسب المهمة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'نسبة التواصل', value: teleStats.contactRate, desc: `العملاء الذين تم التواصل معهم من إجمالي العملاء (${teleStats.contactedClients}/${teleStats.totalClients})`, color: '#6c63ff', onClick: 'my-sheet' as const },
                  { label: 'نسبة الرد', value: teleStats.answeredRate, desc: `المكالمات المجابة من إجمالي المكالمات (${teleStats.answeredCalls}/${teleStats.totalCalls})`, color: '#00d4aa', onClick: 'my-sheet' as const },
                  { label: 'نسبة الاجتماعات', value: teleStats.meetingRate, desc: `الاجتماعات من العملاء الذين تم التواصل معهم (${teleStats.meetings}/${teleStats.contactedClients})`, color: '#ffd166', onClick: 'my-meetings' as const },
                  { label: 'نسبة الحضور', value: teleStats.attendanceRate, desc: `العملاء الذين حضروا من الحاضرين والغائبين (${teleStats.attended}/${teleStats.attended + teleStats.noShow})`, color: '#a8a3ff', onClick: 'my-meetings' as const },
                ].map((r, i) => (
                  <div
                    key={i}
                    onClick={() => handleQuickAction(r.onClick)}
                    className="ep-ratio-card ep-glow-hover bg-[#0a0d14] border border-white/[0.04] rounded-xl p-4 relative"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[#f0f2ff]">{r.label}</span>
                        <span className="text-[14px]">{performanceEmoji(r.value)}</span>
                      </div>
                      <span className="text-[18px] font-bold" style={{ color: r.color }}>
                        <AnimatedCounter value={r.value} />%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#1c2234] overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full ep-bar-animated"
                        style={{
                          width: mounted ? `${Math.min(r.value, 100)}%` : '0%',
                          backgroundColor: r.color,
                        }}
                      />
                    </div>
                    {/* Hover tooltip */}
                    <div className="ep-tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-[#1c2234] border border-white/[0.08] text-[11px] font-medium text-[#8892b0] whitespace-nowrap z-20 shadow-lg">
                      {r.desc}
                    </div>
                    {/* Performance label */}
                    <div className="text-[11px] font-medium text-[#4a5280] flex items-center justify-between">
                      <span>{r.value >= 70 ? 'ممتاز' : r.value >= 40 ? 'مقبول' : 'يحتاج تحسين'}</span>
                      <span style={{ color: r.color }}>{r.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══════════════════════════════════════════
         SALES TODAY STATS — Interactive
         ═══════════════════════════════════════════ */}
      {salesStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'اجتماعات اليوم', value: salesStats.todayMeetings.length, yValue: salesStats.yMeetingsCount, color: '#ffd166', icon: Calendar, motKey: 'salesMeetings', onClick: 'my-meetings' as const },
            { label: 'حضر اليوم', value: salesStats.todayAttended, yValue: salesStats.yAttendedCount, color: '#00d4aa', icon: CheckCircle2, motKey: 'salesAttended', onClick: 'my-meetings' as const },
            { label: 'انتظار اليوم', value: salesStats.todayPending, yValue: salesStats.yPendingCount, color: '#ffd166', icon: HourglassIcon, motKey: '', onClick: 'my-meetings' as const },
            { label: 'عملاء جدد اليوم', value: salesStats.todayNew, yValue: salesStats.yNewCount, color: '#6c63ff', icon: UserPlus, motKey: 'salesNew', onClick: 'sales-sheet' as const },
          ].map((k, i) => {
            const Icon = k.icon
            const motText = motivationalText(k.motKey, k.value)
            const isHigh = k.value >= 5
            return (
              <div
                key={i}
                onClick={() => handleQuickAction(k.onClick)}
                className={`ep-stat-card ep-glow-hover bg-[#111520] border border-white/[0.06] rounded-xl p-4 cursor-pointer ${isHigh ? 'ep-pulse-high' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-[#8892b0]">{k.label}</span>
                  <div className="flex items-center gap-1.5">
                    <TrendIndicator today={k.value} yesterday={k.yValue} />
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}15` }}>
                      <Icon size={16} style={{ color: k.color }} />
                    </div>
                  </div>
                </div>
                <div className="text-[24px] font-bold" style={{ color: k.color }}>
                  <AnimatedCounter value={k.value} />
                </div>
                {motText && (
                  <div className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>{motText}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
         4. KPI PERFORMANCE CARDS (Sales only) — Interactive
         ═══════════════════════════════════════════ */}
      {salesStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'اجتماعاتي', value: salesStats.myMeetings, color: '#ffd166', icon: CalendarCheck, progress: salesStats.total > 0 ? Math.round((salesStats.myMeetings / salesStats.total) * 100) : 0, progressLabel: 'من العملاء', onClick: 'sales-sheet' as const },
            { label: 'اجتماعات التلي', value: salesStats.teleMeetings, color: '#6c9fff', icon: ArrowRightLeft, progress: salesStats.total > 0 ? Math.round((salesStats.teleMeetings / salesStats.total) * 100) : 0, progressLabel: 'من العملاء', onClick: 'my-meetings' as const },
            { label: 'إجمالي العملاء', value: salesStats.total, color: '#6c63ff', icon: Users, progress: salesStats.attendanceRate, progressLabel: 'حضور', onClick: 'sales-sheet' as const },
            { label: 'نسبة الحضور', value: `${salesStats.attendanceRate}%`, color: '#00d4aa', icon: UserCheck, progress: salesStats.attendanceRate, progressLabel: 'من اجتماعات التلي', onClick: 'my-meetings' as const },
            { label: 'نسبة التقفيل', value: `${salesStats.closingRate}%`, color: '#ffd166', icon: Target, progress: salesStats.closingRate, progressLabel: 'تقفيل', onClick: 'sales-sheet' as const },
            { label: 'قيد المتابعة', value: salesStats.inProgress, color: '#a8a3ff', icon: Activity, progress: salesStats.total > 0 ? Math.round((salesStats.inProgress / salesStats.total) * 100) : 0, progressLabel: 'متابعة', onClick: 'sales-sheet' as const },
            { label: 'تم التقفيل', value: salesStats.closedWon, color: '#00d4aa', icon: Trophy, progress: salesStats.total > 0 ? Math.round((salesStats.closedWon / salesStats.total) * 100) : 0, progressLabel: 'تقفيل', onClick: 'sales-sheet' as const },
          ].map((k, i) => {
            const Icon = k.icon
            const progressVal = typeof k.progress === 'number' ? k.progress : 0
            return (
              <div
                key={i}
                onClick={() => handleQuickAction(k.onClick)}
                className="ep-stat-card ep-glow-hover bg-[#111520] border border-white/[0.06] rounded-xl p-4 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-[#8892b0]">{k.label}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}12` }}>
                    <Icon size={14} style={{ color: k.color }} />
                  </div>
                </div>
                <div className="text-[20px] font-bold mb-2" style={{ color: k.color }}>
                  {typeof k.value === 'number' ? <AnimatedCounter value={k.value} /> : k.value}
                </div>
                <div className="h-1.5 rounded-full bg-[#1c2234] overflow-hidden">
                  <div
                    className="h-full rounded-full ep-bar-animated"
                    style={{
                      width: mounted ? `${Math.min(progressVal, 100)}%` : '0%',
                      backgroundColor: k.color,
                    }}
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
                    {currentRole === 'sales' && (!lead.tele || lead.tele.trim() === '') ? (
                      /* Sales-originated meeting — NO attendance tracking.
                         These meetings don't enter attended/waiting/no-show stats. */
                      <Badge className="bg-[#ffd166]/15 text-[#ffd166] text-[11px] font-bold border-0">📅 اجتماعي</Badge>
                    ) : currentRole === 'sales' && (!lead.attended || lead.attended === 'pending') ? (
                      /* Tele-transferred meeting, pending — sales can mark attendance */
                      <div className="flex gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkAttendance(lead.id, 'attended') }}
                          className="h-7 px-2 rounded-lg text-[11px] font-bold bg-[#00d4aa]/15 text-[#00d4aa] hover:bg-[#00d4aa]/25 transition-colors cursor-pointer"
                        >
                          ✅ حضر
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkAttendance(lead.id, 'no-show') }}
                          className="h-7 px-2 rounded-lg text-[11px] font-bold bg-[#ff6b6b]/15 text-[#ff6b6b] hover:bg-[#ff6b6b]/25 transition-colors cursor-pointer"
                        >
                          ❌ لم يحضر
                        </button>
                      </div>
                    ) : lead.attended === 'attended' ? (
                      <Badge className="bg-[#00d4aa]/15 text-[#00d4aa] text-[11px] font-bold border-0">✅ حضر</Badge>
                    ) : lead.attended === 'no-show' ? (
                      <Badge className="bg-[#ff6b6b]/15 text-[#ff6b6b] text-[11px] font-bold border-0">❌ لم يحضر</Badge>
                    ) : (
                      <Badge className="bg-[#ffd166]/15 text-[#ffd166] text-[11px] font-bold border-0">⏳ انتظار</Badge>
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
                        className="h-full rounded-lg ep-bar-animated"
                        style={{
                          width: mounted ? `${barWidth}%` : '0%',
                          backgroundColor: barColor,
                          opacity: 0.7,
                        }}
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
    </div>
  )
}
