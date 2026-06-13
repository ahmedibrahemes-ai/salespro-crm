'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useCrmStore, getDateRange } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import {
  Flame, UserPlus, Phone, CalendarCheck, UserCheck, Percent,
  TrendingUp, TrendingDown, PhoneCall, MessageCircle, Trophy,
  Target, ArrowLeft, Clock, Users, Settings2, Save, PhoneOff,
  PhoneIncoming, Calendar, CheckCircle2, Hourglass,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface TargetSettings {
  type: 'meetings' | 'money' | 'closings'
  value: number
}

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function getInitials(name: string): string {
  if (!name) return '؟'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return name.slice(0, 2)
}

function getCurrentMonthAr(): string {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ]
  const nowEgypt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  return months[nowEgypt.getMonth()]
}

function getDaysRemainingInMonth(): number {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return end.getDate() - now.getDate()
}

function formatCurrency(val: number): string {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `${Math.round(val / 1000)}K`
  return val.toString()
}

/**
 * Get the start of the current Arabic work week (Saturday).
 * Week runs Saturday(6) to Friday(5).
 */
function getWeekRange(): { satStart: number; friEnd: number } {
  // Use Egypt timezone for correct week boundary
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfWeek = today.getDay() // 0=Sun, 6=Sat

  // Days since last Saturday (if today is Saturday, offset = 0)
  const daysSinceSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1
  const satStart = new Date(today.getTime() - daysSinceSaturday * 86400000).getTime()
  const friEnd = satStart + 7 * 86400000

  return { satStart, friEnd }
}

/** Get the day-of-week index (0=Sat, 1=Sun, ..., 6=Fri) for a timestamp — uses Egypt timezone */
function getArabicDayIndex(ts: number): number {
  // Use Egypt timezone for correct day-of-week after midnight
  const d = new Date(new Date(ts).toLocaleString('en-US', { timeZone: 'Africa/Cairo' })).getDay()
  // Convert to Sat=0, Sun=1, ..., Fri=6
  return d === 6 ? 0 : d + 1
}

const ARABIC_DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

function getPositionLabelAr(pos: number): string {
  if (pos === 1) return 'المركز الأول'
  if (pos === 2) return 'المركز الثاني'
  if (pos === 3) return 'المركز الثالث'
  return `المركز ${pos}`
}

/** Get motivational message based on performance */
function getMotivationalMessage(meetingsBooked: number, callsMade: number, targetPct: number): { text: string; emoji: string } {
  if (targetPct >= 100) return { text: '🎉 هدف محقق! أداء أسطوري!', emoji: '🏆' }
  if (targetPct >= 80) return { text: '🔥 أداء ممتاز! قريب من الهدف!', emoji: '🔥' }
  if (targetPct >= 50) return { text: '💪 أداء جيد! استمر!', emoji: '💪' }
  if (meetingsBooked === 0 && callsMade === 0) return { text: '🚀 ابدأ الأسبوع بقوة!', emoji: '🚀' }
  if (meetingsBooked < 3) return { text: '💪 يمكنك تحقيق المزيد!', emoji: '💪' }
  return { text: '⭐ استمر في العمل الجاد!', emoji: '⭐' }
}

/* ═══════════════════════════════════════════════════════
   Animated Counter Component
   Uses ref + DOM manipulation to avoid setState in effect
   ═══════════════════════════════════════════════════════ */

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const prevValue = useRef(value)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const start = prevValue.current
    const end = value
    const el = spanRef.current
    if (!el) return

    if (start === end) {
      el.textContent = String(end)
      return
    }

    const startTime = performance.now()

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * eased)
      if (spanRef.current) spanRef.current.textContent = String(current)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        prevValue.current = end
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [value, duration])

  return <span ref={spanRef}>{value}</span>
}

/* ═══════════════════════════════════════════════════════
   Animated Progress Bar Component
   ═══════════════════════════════════════════════════════ */

function AnimatedProgressBar({
  percentage,
  color = '#8b83ff',
  height = 6,
  pulse = false,
  delay = 0,
}: {
  percentage: number
  color?: string
  height?: number
  pulse?: boolean
  delay?: number
}) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setWidth(percentage)
    }, 100 + delay)
    return () => clearTimeout(timer)
  }, [percentage, delay])

  return (
    <div
      className="rounded-full overflow-hidden"
      style={{ height, background: 'rgba(255,255,255,0.06)' }}
    >
      <div
        className={`h-full rounded-full transition-all ease-out ${pulse ? 'animate-pulse' : ''}`}
        style={{
          width: `${width}%`,
          background: color,
          transitionDuration: '1.2s',
        }}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   API helpers for target settings
   ═══════════════════════════════════════════════════════ */

async function apiGetTarget(): Promise<TargetSettings | null> {
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'getSetting', data: 'target' }),
    })
    if (res.ok) {
      const json = await res.json()
      if (json.data) {
        return json.data as TargetSettings
      }
    }
  } catch (err) {
    console.warn('[Dashboard] Failed to load target settings:', err)
  }
  return null
}

async function apiSaveTarget(settings: TargetSettings): Promise<boolean> {
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'saveSetting', data: { key: 'target', value: settings } }),
    })
    return res.ok
  } catch (err) {
    console.warn('[Dashboard] Failed to save target settings:', err)
    return false
  }
}

/* ═══════════════════════════════════════════════════════
   CSS Keyframes for animations (injected once)
   ═══════════════════════════════════════════════════════ */

function InjectAnimations() {
  return (
    <style>{`
      @keyframes kpi-card-enter {
        from { opacity: 0; transform: translateY(16px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes section-enter {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes progress-fill {
        from { width: 0%; }
      }
      @keyframes glow-pulse {
        0%, 100% { box-shadow: 0 0 8px var(--glow-color, rgba(108,99,255,0.2)); }
        50% { box-shadow: 0 0 20px var(--glow-color, rgba(108,99,255,0.4)); }
      }
      @keyframes target-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .kpi-card-animate {
        animation: kpi-card-enter 0.5s ease-out both;
      }
      .section-animate {
        animation: section-enter 0.6s ease-out both;
      }
      .kpi-card-animate:hover {
        transform: translateY(-3px) scale(1.02);
      }
      .motivational-banner {
        animation: section-enter 0.8s ease-out both;
      }
    `}</style>
  )
}

/* ═══════════════════════════════════════════════════════
   Dashboard Component — COMPLETE REWRITE
   - No Framer Motion — CSS transitions only
   - Event-timestamp based stats (contactResultAt, assignedAt)
   - Current-month KPI stats (not today-based)
   - RTL layout, Cairo font, dark theme
   - Interactive animations & progress indicators
   ═══════════════════════════════════════════════════════ */

export function Dashboard() {
  const leads = useCrmStore((s) => s.leads)
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)
  const team = useCrmStore((s) => s.team)
  const setCurrentView = useCrmStore((s) => s.setCurrentView)
  const setActiveFilter = useCrmStore((s) => s.setActiveFilter)
  const targetSettings = useCrmStore((s) => s.targetSettings)
  const setTargetSettings = useCrmStore((s) => s.setTargetSettings)

  /* ─── Target settings dialog state ─── */
  const [targetDialogOpen, setTargetDialogOpen] = useState(false)
  const [editTargetType, setEditTargetType] = useState<TargetSettings['type']>('meetings')
  const [editTargetValue, setEditTargetValue] = useState<number>(50)
  const [savingTarget, setSavingTarget] = useState(false)

  /* ─── Load target from Supabase on mount ─── */
  useEffect(() => {
    let cancelled = false
    async function loadTarget() {
      const settings = await apiGetTarget()
      if (!cancelled && settings) {
        setTargetSettings(settings)
      }
    }
    loadTarget()
    return () => { cancelled = true }
  }, [setTargetSettings])

  /* ─── Single-pass: Filter leads by role ─── */
  const myLeads = useMemo(() => {
    if (currentRole === 'tele' && currentUser) {
      return leads.filter((l) => l.tele === currentUser && !l.isArchived)
    }
    if (currentRole === 'sales' && currentUser) {
      return leads.filter((l) => l.sales === currentUser && !l.isArchived)
    }
    return leads.filter((l) => !l.isArchived)
  }, [leads, currentUser, currentRole])

  /* ─── All leads (admin sees all, others see own) ─── */
  const allActiveLeads = useMemo(() => {
    return leads.filter((l) => !l.isArchived)
  }, [leads])

  /* ─── Current month range ─── */
  const monthRange = useMemo(() => getDateRange('month'), [])

  /* ─── KPI computation — CURRENT MONTH based ─── */
  const kpiValues = useMemo(() => {
    const { from, to } = monthRange

    let leadsCreatedMonth = 0
    let callsMonth = 0
    let meetingsBooked = 0
    let attendedConfirmed = 0
    let closedWon = 0

    for (const l of myLeads) {
      // Leads created this month
      if (l.createdAt >= from && l.createdAt < to) leadsCreatedMonth++

      // Calls this month: based on contactResultAt
      if (l.contactResultAt && l.contactResultAt >= from && l.contactResultAt < to) {
        if (l.contactResult && l.contactResult !== 'none' && l.contactResult !== '') {
          callsMonth++
        }
      }

      // Meetings this month: based on assignedAt
      if (l.assignedAt && l.assignedAt >= from && l.assignedAt < to) {
        meetingsBooked++
      }

      // Attended confirmed this month (based on assignedAt within month)
      if (l.attended === 'attended' && l.assignedAt && l.assignedAt >= from && l.assignedAt < to) {
        attendedConfirmed++
      }

      // Closed won (all-time for conversion rate)
      if (l.status === 'closed-won') closedWon++
    }

    // Conversion rate: this month meetings → closed-won
    const conversionRate = meetingsBooked > 0 ? Math.round((attendedConfirmed / meetingsBooked) * 1000) / 10 : 0

    return { leadsCreatedMonth, callsMonth, meetingsBooked, attendedConfirmed, closedWon, conversionRate }
  }, [myLeads, monthRange])

  /* ─── Uncontacted leads count (for urgent strip) ─── */
  const uncontactedCount = useMemo(() => {
    return myLeads.filter((l) => !l.contactResult || l.contactResult === 'none' || l.contactResult === '').length
  }, [myLeads])

  /* ─── PENDING CLIENTS TRACKING (عملاء في الانتظار) ─── */
  const pendingClients = useMemo(() => {
    let filtered: Lead[]
    if (currentRole === 'tele' && currentUser) {
      filtered = myLeads.filter(
        (l) => l.sales && l.sales.trim() !== '' && (!l.attended || l.attended === 'pending')
      )
    } else {
      filtered = allActiveLeads.filter(
        (l) => l.sales && l.sales.trim() !== '' && (!l.attended || l.attended === 'pending')
      )
    }
    return filtered.slice(0, 5)
  }, [myLeads, allActiveLeads, currentRole, currentUser])

  const pendingClientsTotal = useMemo(() => {
    if (currentRole === 'tele' && currentUser) {
      return myLeads.filter(
        (l) => l.sales && l.sales.trim() !== '' && (!l.attended || l.attended === 'pending')
      ).length
    }
    return allActiveLeads.filter(
      (l) => l.sales && l.sales.trim() !== '' && (!l.attended || l.attended === 'pending')
    ).length
  }, [myLeads, allActiveLeads, currentRole, currentUser])

  /* ─── Target progress (admin-controlled) ─── */
  const targetProgress = useMemo(() => {
    const { type, value } = targetSettings
    const { from, to } = monthRange
    let achieved = 0

    if (type === 'meetings') {
      // Count meetings this month based on assignedAt
      achieved = myLeads.filter((l) => l.assignedAt && l.assignedAt >= from && l.assignedAt < to).length
    } else if (type === 'closings') {
      // Count closed-won deals
      achieved = myLeads.filter((l) => l.status === 'closed-won').length
    } else if (type === 'money') {
      achieved = myLeads.filter((l) => l.status === 'closed-won').length
    }

    const pct = value > 0 ? Math.min(Math.round((achieved / value) * 100), 100) : 0
    const remaining = Math.max(value - achieved, 0)

    return { achieved, pct, remaining, type, value }
  }, [targetSettings, myLeads, monthRange])

  const daysLeft = getDaysRemainingInMonth()
  const monthAr = getCurrentMonthAr()

  /* ─── Weekly Performance (Saturday to Friday) ─── */
  const weeklyCallsData = useMemo(() => {
    const { satStart, friEnd } = getWeekRange()
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]

    for (const l of myLeads) {
      if (l.contactResultAt && l.contactResultAt >= satStart && l.contactResultAt < friEnd) {
        if (l.contactResult && l.contactResult !== 'none' && l.contactResult !== '') {
          const dayIdx = getArabicDayIndex(l.contactResultAt)
          dayCounts[dayIdx]++
        }
      }
    }

    return ARABIC_DAYS.map((day, i) => ({ day, count: dayCounts[i] }))
  }, [myLeads])

  const maxWeeklyCall = useMemo(
    () => Math.max(...weeklyCallsData.map((d) => d.count), 1),
    [weeklyCallsData]
  )

  /* ─── Call Stats Period Filter ─── */
  const [callStatsPeriod, setCallStatsPeriod] = useState<'today' | 'month' | '3months'>('today')

  /* ─── Meeting Stats Period Filter ─── */
  const [meetingStatsPeriod, setMeetingStatsPeriod] = useState<'today' | 'month' | '3months'>('month')

  /* ─── Call Stats (إحصائيات المكالمات) ─── */
  const callStats = useMemo(() => {
    const { from, to } = getDateRange(callStatsPeriod)

    let totalCalls = 0
    let answered = 0
    let unanswered = 0

    for (const l of myLeads) {
      if (l.contactResult && l.contactResult !== 'none' && l.contactResult !== '') {
        if (l.contactResultAt && l.contactResultAt >= from && l.contactResultAt < to) {
          totalCalls++
          if (l.contactResult === 'replied') {
            answered++
          }
          if (l.contactResult === 'no-reply' || l.contactResult === 'busy') {
            unanswered++
          }
        }
      }
    }

    const answerRate = totalCalls > 0 ? Math.round((answered / totalCalls) * 100) : 0

    return { totalCalls, answered, unanswered, answerRate }
  }, [myLeads, callStatsPeriod])

  /* ─── Meeting Stats (إحصائيات الاجتماعات) ─── */
  const meetingStats = useMemo(() => {
    const { from, to } = getDateRange(meetingStatsPeriod)

    let totalMeetings = 0
    let attendedMeetings = 0
    let pendingMeetings = 0
    let noShowMeetings = 0

    for (const l of myLeads) {
      // Filter by assignedAt within the selected period
      if (l.assignedAt && l.assignedAt >= from && l.assignedAt < to) {
        totalMeetings++
        if (l.attended === 'attended') {
          attendedMeetings++
        } else if (l.attended === 'no-show') {
          noShowMeetings++
        } else {
          pendingMeetings++
        }
      }
    }

    const attendanceRate = totalMeetings > 0 ? Math.round((attendedMeetings / totalMeetings) * 100) : 0

    return { totalMeetings, attendedMeetings, pendingMeetings, noShowMeetings, attendanceRate }
  }, [myLeads, meetingStatsPeriod])

  /* ─── RANK (مركزك) — Tele team only, based on meetings booked ─── */
  const rankInfo = useMemo(() => {
    if (currentRole !== 'tele' || !currentUser) {
      return { position: 0, totalMembers: 0, meetingsCount: 0, percentile: 0 }
    }

    const meetingCounts: Record<string, number> = {}
    for (const member of team.tele) {
      meetingCounts[member] = 0
    }

    for (const l of allActiveLeads) {
      if (l.assignedAt && l.tele && team.tele.includes(l.tele)) {
        meetingCounts[l.tele] = (meetingCounts[l.tele] || 0) + 1
      }
    }

    const sorted = Object.entries(meetingCounts).sort((a, b) => b[1] - a[1])
    const idx = sorted.findIndex(([name]) => name === currentUser)
    const position = idx >= 0 ? idx + 1 : sorted.length
    const meetingsCount = meetingCounts[currentUser] || 0
    const totalMembers = sorted.length

    const membersBelow = sorted.filter(([_, count]) => count < meetingsCount).length
    const percentile = totalMembers > 1 ? Math.round((membersBelow / (totalMembers - 1)) * 100) : 0

    return { position, totalMembers, meetingsCount, percentile }
  }, [currentRole, currentUser, team.tele, allActiveLeads])

  /* ─── Motivational message ─── */
  const motivation = useMemo(() => {
    return getMotivationalMessage(kpiValues.meetingsBooked, kpiValues.callsMonth, targetProgress.pct)
  }, [kpiValues.meetingsBooked, kpiValues.callsMonth, targetProgress.pct])

  /* ─── KPI Cards Config — MONTH BASED ─── */
  const kpis = [
    {
      icon: <UserPlus size={20} />,
      color: '#6c63ff',
      colorBg: 'rgba(108,99,255,.15)',
      value: kpiValues.leadsCreatedMonth,
      label: 'ليدز جديدة الشهر',
      target: 100, // default monthly target for progress bar
    },
    {
      icon: <Phone size={20} />,
      color: '#00d4aa',
      colorBg: 'rgba(0,212,170,.15)',
      value: kpiValues.callsMonth,
      label: 'مكالمات الشهر',
      target: 200,
    },
    {
      icon: <CalendarCheck size={20} />,
      color: '#ffd166',
      colorBg: 'rgba(255,209,102,.15)',
      value: kpiValues.meetingsBooked,
      label: 'اجتماعات الشهر',
      target: 50,
    },
    {
      icon: <UserCheck size={20} />,
      color: '#00d4aa',
      colorBg: 'rgba(0,212,170,.15)',
      value: kpiValues.attendedConfirmed,
      label: 'حضور مؤكد',
      target: 30,
    },
    {
      icon: <Percent size={20} />,
      color: '#ff6b6b',
      colorBg: 'rgba(255,107,107,.15)',
      value: kpiValues.conversionRate,
      label: 'نسبة التحويل',
      target: 50, // 50% target
      isPercentage: true,
    },
  ]

  /* ─── Important Ratios (نسب مهمة) ─── */
  const importantRatios = useMemo(() => {
    const { from, to } = monthRange

    let totalLeads = 0
    let contactedLeads = 0
    let repliedLeads = 0
    let meetingsBooked = 0
    let attendedLeads = 0

    for (const l of myLeads) {
      if (l.createdAt >= from && l.createdAt < to) {
        totalLeads++
        if (l.contactResult && l.contactResult !== 'none' && l.contactResult !== '') {
          contactedLeads++
        }
        if (l.contactResult === 'replied') {
          repliedLeads++
        }
      }
      if (l.assignedAt && l.assignedAt >= from && l.assignedAt < to) {
        meetingsBooked++
        if (l.attended === 'attended') {
          attendedLeads++
        }
      }
    }

    return [
      {
        label: 'نسبة التواصل',
        value: totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0,
        color: '#6c63ff',
        description: 'العملاء الذين تم التواصل معهم من إجمالي الليدز',
      },
      {
        label: 'نسبة الرد',
        value: contactedLeads > 0 ? Math.round((repliedLeads / contactedLeads) * 100) : 0,
        color: '#00d4aa',
        description: 'العملاء الذين ردوا من إجمالي المتواصل معهم',
      },
      {
        label: 'نسبة الاجتماعات',
        value: contactedLeads > 0 ? Math.round((meetingsBooked / contactedLeads) * 100) : 0,
        color: '#ffd166',
        description: 'الاجتماعات المحجوزة من إجمالي المتواصل معهم',
      },
      {
        label: 'نسبة الحضور',
        value: meetingsBooked > 0 ? Math.round((attendedLeads / meetingsBooked) * 100) : 0,
        color: '#ff6b6b',
        description: 'العملاء الذين حضروا من إجمالي الاجتماعات',
      },
    ]
  }, [myLeads, monthRange])

  /* ─── Target dialog handlers ─── */
  const openTargetDialog = useCallback(() => {
    setEditTargetType(targetSettings.type)
    setEditTargetValue(targetSettings.value)
    setTargetDialogOpen(true)
  }, [targetSettings])

  const handleSaveTarget = useCallback(async () => {
    setSavingTarget(true)
    const newSettings: TargetSettings = { type: editTargetType, value: editTargetValue }
    const success = await apiSaveTarget(newSettings)
    if (success) {
      setTargetSettings(newSettings)
    }
    setSavingTarget(false)
    setTargetDialogOpen(false)
  }, [editTargetType, editTargetValue, setTargetSettings])

  /* ─── Urgent strip handler ─── */
  const handleShowUncontacted = useCallback(() => {
    setCurrentView('my-sheet')
    setActiveFilter('tele-sheet', 'uncontacted')
  }, [setCurrentView, setActiveFilter])

  /* ─── Pending clients handler ─── */
  const handleShowPendingClients = useCallback(() => {
    // Admin monitors meetings via the general meetings page; tele goes to transfers
    setCurrentView(currentRole === 'admin' ? 'meetings' : 'transfers')
  }, [setCurrentView, currentRole])

  /* ─── Target type labels ─── */
  const targetTypeLabel = useMemo(() => {
    switch (targetSettings.type) {
      case 'meetings': return 'اجتماعات'
      case 'money': return 'إيرادات'
      case 'closings': return 'تقفيلات'
    }
  }, [targetSettings.type])

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div dir="rtl" className="space-y-6" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <InjectAnimations />

      {/* ══════════════════════════════════════════════════
          1. URGENT STRIP — Uncontacted leads
          ══════════════════════════════════════════════════ */}
      {currentRole === 'tele' && uncontactedCount > 0 && (
        <div className="section-animate" style={{ animationDelay: '0.1s' }}>
          <div className="relative flex items-center gap-3 bg-gradient-to-br from-[#ff6b6b]/10 to-[#ff6b6b]/4 border border-[#ff6b6b]/20 rounded-2xl px-5 md:px-6 py-4 overflow-hidden">
            {/* Ping indicator */}
            <span className="absolute -top-1 -right-1 w-3 h-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b6b] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#ff6b6b]" />
            </span>

            {/* Fire icon */}
            <div className="w-12 h-12 rounded-xl bg-[#ff6b6b]/15 flex items-center justify-center shrink-0">
              <Flame size={24} className="text-[#ff6b6b]" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="text-[19px] font-extrabold text-[#ffffff]">
                {uncontactedCount} عملاء لم يتم التواصل معهم!
              </div>
              <div className="text-[14px] font-bold text-[#b0b8d0] mt-0.5 truncate">
                ابدأ بالتواصل معهم الآن
              </div>
            </div>

            {/* CTA button */}
            <button
              onClick={handleShowUncontacted}
              className="bg-[#161b28] border border-[#ff6b6b]/50 text-[#ff6b6b] px-4 py-2 rounded-xl text-[13px] font-bold hover:bg-[#ff6b6b]/10 transition-all cursor-pointer shrink-0 hidden sm:flex items-center gap-1.5"
            >
              عرض الكل
              <ArrowLeft size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          2. MOTIVATIONAL BANNER
          ══════════════════════════════════════════════════ */}
      <div className="motivational-banner" style={{ animationDelay: '0.2s' }}>
        <div className="bg-gradient-to-br from-[#6c63ff]/10 to-[#00d4aa]/5 border border-[#6c63ff]/15 rounded-2xl px-5 py-3.5 flex items-center gap-3">
          <span className="text-[28px]">{motivation.emoji}</span>
          <span className="text-[16px] font-bold text-[#f0f2ff]">{motivation.text}</span>
          <span className="text-[13px] font-bold text-[#8b83ff] mr-auto">
            {monthAr} {new Date().getFullYear()}
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          3. KPI CARDS ROW — Current Month Based
          ══════════════════════════════════════════════════ */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        {kpis.map((kpi, i) => {
          const progressPct = kpi.isPercentage
            ? kpi.value
            : Math.min(Math.round((kpi.value / kpi.target) * 100), 100)

          return (
            <div
              key={i}
              className="kpi-card-animate bg-[#111520] border border-white/[0.06] rounded-2xl p-5 relative overflow-hidden transition-all duration-300 cursor-default group"
              style={{
                animationDelay: `${0.1 + i * 0.08}s`,
                '--glow-color': `${kpi.color}33` as string,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 24px ${kpi.color}22`
                e.currentTarget.style.borderColor = `${kpi.color}44`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              }}
            >
              {/* Decorative corner */}
              <div
                className="absolute top-0 right-0 w-[64px] h-[64px] rounded-t-2xl rounded-bl-[64px] opacity-[0.07]"
                style={{ background: kpi.color }}
              />

              {/* Icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{ background: kpi.colorBg, color: kpi.color }}
              >
                {kpi.icon}
              </div>

              {/* Value — animated counter */}
              <div
                className="text-[30px] md:text-[32px] font-black leading-tight"
                style={{ color: kpi.color, fontFamily: 'Cairo, sans-serif' }}
              >
                {kpi.isPercentage ? (
                  <><AnimatedCounter value={kpi.value} />%</>
                ) : (
                  <AnimatedCounter value={kpi.value} />
                )}
              </div>

              {/* Label */}
              <div className="text-[14px] font-bold text-[#b0b8d0] mt-1">{kpi.label}</div>

              {/* Progress bar at bottom */}
              <div className="mt-3">
                <AnimatedProgressBar
                  percentage={progressPct}
                  color={kpi.color}
                  height={3}
                  delay={i * 80}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] font-bold text-[#6b7394]">
                    {kpi.isPercentage ? `${kpi.value}%` : `${progressPct}% من الهدف`}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════
          4. IMPORTANT RATIOS (نسب مهمة) — Animated Progress Bars
          ══════════════════════════════════════════════════ */}
      <div className="section-animate" style={{ animationDelay: '0.5s' }}>
        <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 md:p-6">
          <div className="flex items-center gap-2 text-[19px] font-extrabold text-[#ffffff] mb-4">
            <TrendingUp size={20} className="text-[#8b83ff]" />
            نسب مهمة — {monthAr}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {importantRatios.map((ratio, i) => (
              <div key={i} className="bg-[#0a0d14] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[15px] font-bold text-[#f0f2ff]">{ratio.label}</span>
                  <span
                    className="text-[20px] font-black"
                    style={{ color: ratio.color, fontFamily: 'Cairo, sans-serif' }}
                  >
                    <AnimatedCounter value={ratio.value} />%
                  </span>
                </div>
                <AnimatedProgressBar
                  percentage={ratio.value}
                  color={ratio.color}
                  height={8}
                  delay={i * 120}
                />
                <div className="text-[12px] font-bold text-[#6b7394] mt-2">
                  {ratio.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          5. TARGET PROGRESS BAR — Admin-controlled
          ══════════════════════════════════════════════════ */}
      <div className="section-animate" style={{ animationDelay: '0.6s' }}>
        <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 md:p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="text-[19px] font-extrabold text-[#ffffff] flex items-center gap-2">
                <Target size={20} className="text-[#8b83ff]" />
                تارجت الشهر — {monthAr} {new Date().getFullYear()}
                {currentRole === 'admin' && (
                  <button
                    onClick={openTargetDialog}
                    className="w-8 h-8 rounded-lg bg-[#8b83ff]/10 flex items-center justify-center text-[#8b83ff] hover:bg-[#8b83ff]/20 transition-colors cursor-pointer"
                    title="تعديل التارجت"
                  >
                    <Settings2 size={16} />
                  </button>
                )}
              </div>
              <div className="text-[14px] font-bold text-[#b0b8d0] mt-1">
                {targetProgress.achieved} من أصل {targetProgress.value} {targetTypeLabel}
              </div>
            </div>
            <div
              className="text-[34px] font-black text-[#8b83ff]"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {targetProgress.pct}%
            </div>
          </div>

          {/* Progress bar — pulses when near target */}
          <div className="h-3 bg-[#0a0d14] rounded-full overflow-hidden mb-2.5 relative">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${targetProgress.pct >= 80 ? 'animate-pulse' : ''}`}
              style={{
                background: targetProgress.pct >= 80
                  ? 'linear-gradient(to left, #00ffbb, #8b83ff, #ffd166)'
                  : 'linear-gradient(to left, #8b83ff, #00ffbb)',
                width: `${targetProgress.pct}%`,
              }}
            />
            {targetProgress.pct >= 80 && (
              <div className="absolute inset-0 rounded-full" style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                animation: 'target-pulse 2s ease-in-out infinite',
              }} />
            )}
          </div>

          <div className="flex items-center justify-between text-[14px] font-bold text-[#b0b8d0]">
            <span>تبقى {targetProgress.remaining} {targetTypeLabel} للوصول للهدف</span>
            <span>{daysLeft} يوم متبقي</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          6. TWO-COLUMN GRID
          ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 section-animate" style={{ animationDelay: '0.7s' }}>
        {/* ─── LEFT: Pending Clients (عملاء في الانتظار) ─── */}
        <div>
          <div
            className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 md:p-6 h-full cursor-pointer hover:border-[#ffd166]/20 transition-all"
            onClick={handleShowPendingClients}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[19px] font-extrabold text-[#ffffff]">
                <Clock size={20} className="text-[#ffd166]" />
                عملاء في الانتظار
              </div>
              {pendingClientsTotal > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleShowPendingClients() }}
                  className="bg-[#161b28] border border-[#ffd166]/50 text-[#ffd166] px-3 py-1.5 rounded-xl text-[12px] font-bold hover:bg-[#ffd166]/10 transition-all cursor-pointer flex items-center gap-1"
                >
                  عرض الكل
                  <ArrowLeft size={10} />
                </button>
              )}
            </div>

            {pendingClients.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {pendingClients.map((lead) => {
                  const initials = getInitials(lead.customerName || lead.phone)
                  return (
                    <div
                      key={lead.id}
                      className="flex items-center gap-3 py-2.5 px-3 border border-white/[0.04] rounded-xl hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                        style={{
                          background: 'rgba(255,209,102,0.15)',
                          color: '#ffd166',
                          border: '1px solid rgba(255,209,102,0.2)',
                        }}
                      >
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold text-[#ffffff] truncate">
                          {lead.customerName || 'عميل'}
                        </div>
                        <div className="text-[13px] font-bold text-[#b0b8d0] truncate">
                          {lead.sales && (
                            <span className="text-[#00d4aa]">السيلز: {lead.sales}</span>
                          )}
                          {lead.meetingDate && (
                            <span className="mr-2">📅 {lead.meetingDate}{lead.meetingTime ? ` ${lead.meetingTime}` : ''}</span>
                          )}
                        </div>
                      </div>

                      {/* Pending badge */}
                      <span
                        className="text-[12px] font-bold px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: 'rgba(255,209,102,0.15)', color: '#ffd166' }}
                      >
                        ⏳ انتظار
                      </span>

                      {/* Phone action */}
                      <a
                        href={`tel:${lead.phone}`}
                        className="w-9 h-9 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors shrink-0"
                        title="اتصال"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone size={15} />
                      </a>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-[13px] font-semibold text-[#8892b0] py-6 text-center">
                لا يوجد عملاء في الانتظار 🎉
              </div>
            )}

            {pendingClientsTotal > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[14px] font-bold text-[#b0b8d0]">إجمالي العملاء في الانتظار</span>
                <span className="text-[17px] font-bold text-[#ffd166]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {pendingClientsTotal}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Weekly Performance (Saturday to Friday) ─── */}
        <div>
          <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 md:p-6 h-full">
            <div className="flex items-center gap-2 text-[19px] font-extrabold text-[#ffffff] mb-4">
              <PhoneCall size={20} className="text-[#8b83ff]" />
              أداء الأسبوع
            </div>

            <div className="space-y-3">
              {weeklyCallsData.map((dayData) => {
                const pct = (dayData.count / maxWeeklyCall) * 100
                const isMax = dayData.count === maxWeeklyCall && dayData.count > 0
                return (
                  <div key={dayData.day} className="flex items-center gap-3">
                    {/* Day label */}
                    <div className="w-16 text-[14px] font-bold text-[#b0b8d0] text-left shrink-0">
                      {dayData.day}
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-6 bg-[#0a0d14] rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-700 ease-out"
                        style={{
                          background: isMax
                            ? 'linear-gradient(to left, #6c63ff, #00d4aa)'
                            : 'rgba(108,99,255,0.5)',
                          width: `${pct}%`,
                        }}
                      />
                      {/* Count inside bar */}
                      <div className="absolute inset-0 flex items-center justify-end px-2">
                        <span className="text-[14px] font-bold text-[#ffffff]">
                          {dayData.count}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Weekly total */}
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[14px] font-bold text-[#b0b8d0]">إجمالي الأسبوع</span>
              <span
                className="text-[17px] font-bold text-[#8b83ff]"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {weeklyCallsData.reduce((s, d) => s + d.count, 0)} مكالمة
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          7. THREE-COLUMN GRID
          ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 section-animate" style={{ animationDelay: '0.8s' }}>
        {/* ─── Call Stats (إحصائيات المكالمات) ─── */}
        <div>
          <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 md:p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-[19px] font-extrabold text-[#ffffff] mb-4">
              <Phone size={20} className="text-[#8b83ff]" />
              إحصائيات المكالمات
            </div>

            {/* Period filter tabs */}
            <div className="flex justify-center gap-2 mb-4">
              {([
                { key: 'today' as const, label: 'اليوم' },
                { key: 'month' as const, label: 'الشهر' },
                { key: '3months' as const, label: '3 شهور' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setCallStatsPeriod(opt.key)}
                  className={`px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer border ${
                    callStatsPeriod === opt.key
                      ? 'bg-[#6c63ff]/20 border-[#6c63ff] text-[#6c63ff]'
                      : 'bg-[#0a0d14] border-white/[0.06] text-[#8892b0] hover:border-white/[0.12]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Total calls */}
            <div className="text-[34px] font-black text-[#00ffbb]" style={{ fontFamily: 'Cairo, sans-serif' }}>
              <AnimatedCounter value={callStats.totalCalls} />
            </div>
            <div className="text-[14px] font-bold text-[#b0b8d0] mt-1">إجمالي المكالمات</div>

            <div className="flex justify-center gap-5 mt-4 pt-3 border-t border-white/[0.06]">
              <div>
                <div className="flex items-center justify-center gap-1 text-[#00d4aa]">
                  <PhoneIncoming size={14} />
                  <span className="text-[20px] font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <AnimatedCounter value={callStats.answered} />
                  </span>
                </div>
                <div className="text-[13px] font-bold text-[#b0b8d0]">مجابة</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-[#ff6b6b]">
                  <PhoneOff size={14} />
                  <span className="text-[20px] font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <AnimatedCounter value={callStats.unanswered} />
                  </span>
                </div>
                <div className="text-[13px] font-bold text-[#b0b8d0]">غير مجابة</div>
              </div>
            </div>

            {/* Answer rate */}
            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-center gap-1.5">
                <Percent size={14} className="text-[#8b83ff]" />
                <span className="text-[16px] font-bold text-[#8b83ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  نسبة الإجابة: <AnimatedCounter value={callStats.answerRate} />%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Meeting Stats (إحصائيات الاجتماعات) ─── */}
        <div>
          <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 md:p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-[19px] font-extrabold text-[#ffffff] mb-4">
              <Calendar size={20} className="text-[#ffd166]" />
              إحصائيات الاجتماعات
            </div>

            {/* Period filter tabs — same as call stats */}
            <div className="flex justify-center gap-2 mb-4">
              {([
                { key: 'today' as const, label: 'اليوم' },
                { key: 'month' as const, label: 'الشهر' },
                { key: '3months' as const, label: '3 شهور' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setMeetingStatsPeriod(opt.key)}
                  className={`px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer border ${
                    meetingStatsPeriod === opt.key
                      ? 'bg-[#ffd166]/20 border-[#ffd166] text-[#ffd166]'
                      : 'bg-[#0a0d14] border-white/[0.06] text-[#8892b0] hover:border-white/[0.12]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Total meetings */}
            <div className="text-[34px] font-black text-[#ffd166]" style={{ fontFamily: 'Cairo, sans-serif' }}>
              <AnimatedCounter value={meetingStats.totalMeetings} />
            </div>
            <div className="text-[14px] font-bold text-[#b0b8d0] mt-1">إجمالي الاجتماعات</div>

            <div className="flex justify-center gap-4 mt-4 pt-3 border-t border-white/[0.06]">
              <div>
                <div className="flex items-center justify-center gap-1 text-[#00d4aa]">
                  <CheckCircle2 size={14} />
                  <span className="text-[20px] font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <AnimatedCounter value={meetingStats.attendedMeetings} />
                  </span>
                </div>
                <div className="text-[13px] font-bold text-[#b0b8d0]">حضروا</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-[#ffd166]">
                  <Hourglass size={14} />
                  <span className="text-[20px] font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <AnimatedCounter value={meetingStats.pendingMeetings} />
                  </span>
                </div>
                <div className="text-[13px] font-bold text-[#b0b8d0]">انتظار</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-[#ff6b6b]">
                  <PhoneOff size={14} />
                  <span className="text-[20px] font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <AnimatedCounter value={meetingStats.noShowMeetings} />
                  </span>
                </div>
                <div className="text-[13px] font-bold text-[#b0b8d0]">لم يحضروا</div>
              </div>
            </div>

            {/* Attendance rate */}
            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-center gap-1.5">
                <Percent size={14} className="text-[#ffd166]" />
                <span className="text-[16px] font-bold text-[#ffd166]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  نسبة الحضور: <AnimatedCounter value={meetingStats.attendanceRate} />%
                </span>
              </div>
              {/* Mini progress bar for attendance rate */}
              <div className="mt-2">
                <AnimatedProgressBar
                  percentage={meetingStats.attendanceRate}
                  color="#ffd166"
                  height={4}
                  delay={200}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── مركزك (Your Rank) — Tele team only ─── */}
        <div>
          <div className="bg-[#111520] border border-white/[0.06] rounded-2xl p-5 md:p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-[19px] font-extrabold text-[#ffffff] mb-4">
              <Trophy size={20} className="text-[#ffdd88]" />
              مركزك
            </div>

            {currentRole === 'tele' && currentUser ? (
              <>
                <div className="text-[46px] leading-none">
                  {rankInfo.position === 1 ? '🥇' : rankInfo.position === 2 ? '🥈' : rankInfo.position === 3 ? '🥉' : '🏆'}
                </div>
                <div
                  className="text-[22px] font-bold text-[#ffdd88] mt-2"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {getPositionLabelAr(rankInfo.position)}
                </div>
                <div className="text-[14px] font-bold text-[#b0b8d0] mt-1">
                  {rankInfo.meetingsCount} اجتماع — {monthAr} {new Date().getFullYear()}
                </div>
                {rankInfo.totalMembers > 1 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full bg-[#00ffbb]" />
                      <span className="text-[14px] font-bold text-[#00ffbb]">
                        أعلى من {rankInfo.percentile}% من الفريق
                      </span>
                    </div>
                    {/* Percentile progress bar */}
                    <AnimatedProgressBar
                      percentage={rankInfo.percentile}
                      color="#00ffbb"
                      height={4}
                      delay={300}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-[46px] leading-none">🏆</div>
                <div
                  className="text-[18px] font-bold text-[#8892b0] mt-2"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  متاح لفريق التلي فقط
                </div>
                <div className="text-[14px] font-bold text-[#b0b8d0] mt-1">
                  تصنيف بناءً على عدد الاجتماعات
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TARGET SETTINGS DIALOG (Admin only)
          ══════════════════════════════════════════════════ */}
      <Dialog open={targetDialogOpen} onOpenChange={setTargetDialogOpen}>
        <DialogContent className="bg-[#111520] border-white/[0.06] text-[#f0f2ff]" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
          <DialogHeader>
            <DialogTitle className="text-[#f0f2ff] text-right">إعدادات التارجت</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Target type */}
            <div>
              <label className="text-[14px] font-bold text-[#b0b8d0] block mb-2">نوع التارجت</label>
              <div className="flex gap-2">
                {([
                  { key: 'meetings', label: 'اجتماعات' },
                  { key: 'money', label: 'إيرادات' },
                  { key: 'closings', label: 'تقفيلات' },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setEditTargetType(opt.key)}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer border ${
                      editTargetType === opt.key
                        ? 'bg-[#6c63ff]/20 border-[#6c63ff] text-[#6c63ff]'
                        : 'bg-[#0a0d14] border-white/[0.06] text-[#8892b0] hover:border-white/[0.12]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target value */}
            <div>
              <label className="text-[14px] font-bold text-[#b0b8d0] block mb-2">القيمة المستهدفة</label>
              <input
                type="number"
                value={editTargetValue}
                onChange={(e) => setEditTargetValue(Number(e.target.value))}
                className="w-full bg-[#0a0d14] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[16px] font-bold text-[#f0f2ff] focus:border-[#6c63ff] focus:outline-none transition-colors"
                min={1}
                dir="ltr"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-xl text-[14px] font-bold bg-[#0a0d14] border border-white/[0.06] text-[#8892b0] hover:text-[#b0b8d0] transition-colors cursor-pointer">
                إلغاء
              </button>
            </DialogClose>
            <button
              onClick={handleSaveTarget}
              disabled={savingTarget || editTargetValue < 1}
              className="px-4 py-2 rounded-xl text-[14px] font-bold bg-[#6c63ff] text-white hover:bg-[#5a52e0] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Save size={14} />
              {savingTarget ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
