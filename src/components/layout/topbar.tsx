'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, Sun, Moon, Bell, UserCheck, UserX, ArrowRightLeft, UserPlus, StickyNote } from 'lucide-react'
import { useCrmStore, type ViewName, type Notification } from '@/lib/store'
import { Button } from '@/components/ui/button'

/* ------------------------------------------------------------------ */
/*  View Titles Map                                                    */
/* ------------------------------------------------------------------ */
const VIEW_TITLES: Record<ViewName, { title: string; subtitle: string }> = {
  login: { title: '', subtitle: '' },
  dashboard: { title: 'الرئيسية', subtitle: 'نظرة عامة على النشاط' },
  'my-sheet': { title: 'شيت التيلي', subtitle: 'إدارة العملاء والمتابعة' },
  'my-meetings': { title: 'اجتماعات التلي', subtitle: 'متابعة الاجتماعات القادمة' },
  'sales-sheet': { title: 'شيت السيلز', subtitle: 'إدارة عملاء المبيعات' },
  'follow-up': { title: 'Follow-Up', subtitle: 'متابعة العملاء في الاجتماعات' },
  'customers-status': { title: 'حالة العملاء', subtitle: 'متابعة حالة جميع العملاء' },
  'daily-report': { title: 'تقرير يومي', subtitle: 'ملخص الأنشطة اليومية' },
  'my-archive': { title: 'أرشيفي', subtitle: 'بيانات مؤرشفة' },
  'bulk-add': { title: 'إضافة ليدز', subtitle: 'إضافة عملاء جديد بالجملة' },
  admin: { title: 'لوحة التحكم', subtitle: 'إعدادات النظام والفريق' },
  'employee-profile': { title: 'صفحتي', subtitle: 'الملف الشخصي والإعدادات' },
  transfers: { title: 'التحويلات', subtitle: 'متابعة العملاء المحوَّلين للسيلز' },
}

/* ------------------------------------------------------------------ */
/*  Greeting based on time of day                                      */
/* ------------------------------------------------------------------ */
function getGreeting(name: string | null): string {
  const hour = new Date().getHours()
  let timeGreeting: string

  if (hour >= 5 && hour < 12) {
    timeGreeting = 'صباح الخير'
  } else if (hour >= 12 && hour < 17) {
    timeGreeting = 'مساء الخير'
  } else {
    timeGreeting = 'مساء الخير'
  }

  if (name) {
    return `${timeGreeting}، ${name}`
  }
  return timeGreeting
}

/* ------------------------------------------------------------------ */
/*  Notification icon helper                                           */
/* ------------------------------------------------------------------ */
function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'attendance':
      return <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    case 'transfer':
      return <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400 shrink-0" />
    case 'new-lead':
      return <UserPlus className="w-3.5 h-3.5 text-blue-400 shrink-0" />
    case 'note':
      return <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    default:
      return <Bell className="w-3.5 h-3.5 text-[#8892b0] shrink-0" />
  }
}

/* ------------------------------------------------------------------ */
/*  Relative time helper                                               */
/* ------------------------------------------------------------------ */
function formatNotifTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} د`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `منذ ${hours} س`
  const days = Math.floor(hours / 24)
  return `منذ ${days} ي`
}

/* ------------------------------------------------------------------ */
/*  Topbar Component                                                   */
/* ------------------------------------------------------------------ */
export function Topbar() {
  const currentView = useCrmStore((s) => s.currentView)
  const currentUser = useCrmStore((s) => s.currentUser)
  const theme = useCrmStore((s) => s.theme)
  const toggleTheme = useCrmStore((s) => s.toggleTheme)
  const notifications = useCrmStore((s) => s.notifications)
  const unreadCount = useCrmStore((s) => s.unreadNotificationsCount)
  const markNotificationRead = useCrmStore((s) => s.markNotificationRead)
  const markAllNotificationsRead = useCrmStore((s) => s.markAllNotificationsRead)
  const notificationsLoaded = useCrmStore((s) => s.notificationsLoaded)
  const loadNotificationsFromServer = useCrmStore((s) => s.loadNotificationsFromServer)

  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  // Load notifications from server on mount, then poll every 30s
  useEffect(() => {
    if (!notificationsLoaded) {
      loadNotificationsFromServer()
    }
    const interval = setInterval(() => {
      loadNotificationsFromServer()
    }, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [notificationsLoaded, loadNotificationsFromServer])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen])

  // Handle mark notification read — update local state + sync to server
  const handleMarkRead = async (id: string) => {
    markNotificationRead(id)
    try {
      const { apiMarkNotificationRead } = await import('@/lib/supabase')
      await apiMarkNotificationRead(id)
    } catch (err) {
      console.error('[topbar] Failed to sync notification read:', err)
    }
  }

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    markAllNotificationsRead()
    try {
      const { apiMarkAllNotificationsRead } = await import('@/lib/supabase')
      await apiMarkAllNotificationsRead()
    } catch (err) {
      console.error('[topbar] Failed to sync mark all read:', err)
    }
  }

  // Apply theme class to html element
  useEffect(() => {
    const html = document.documentElement
    if (theme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
    try {
      localStorage.setItem('venom-theme', theme)
    } catch { /* ignore */ }
  }, [theme])

  const viewInfo = VIEW_TITLES[currentView] || { title: '', subtitle: '' }

  const now = new Date()
  const dateStr = now.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
      {/* Right side: Page title + greeting */}
      <div className="text-right mr-10 md:mr-0">
        <h1
          className="text-[22px] md:text-[24px] font-extrabold text-[#f0f2ff] leading-tight"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {viewInfo.title}
        </h1>
        <p
          className="text-[13px] md:text-[14px] font-semibold text-[#8892b0] mt-1"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {viewInfo.subtitle
            ? `${viewInfo.subtitle} • ${getGreeting(currentUser)}`
            : getGreeting(currentUser)}
        </p>
      </div>

      {/* Left side: Date, theme toggle, notification bell */}
      <div className="flex gap-2.5 items-center">
        {/* Date chip */}
        <div
          className="hidden sm:flex px-3.5 py-2 bg-[#161b28] border border-white/[0.06] rounded-lg text-[12px] font-medium text-[#8892b0] items-center gap-2 select-none"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <Calendar size={14} className="text-[#6c63ff]" />
          {dateStr}
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 w-9 h-9 rounded-lg bg-[#161b28] border border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-[#1c2234]"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notification bell with dropdown */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 w-9 h-9 rounded-lg bg-[#161b28] border border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-[#1c2234] relative"
            onClick={() => setNotifOpen((prev) => !prev)}
          >
            <Bell className="w-4 h-4" />
            {/* Unread count badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#ff6b6b] rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>

          {/* Notification dropdown */}
          {notifOpen && (
            <div className="absolute left-0 top-full mt-2 w-80 bg-[#111520] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <span className="text-[14px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  الإشعارات
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-[#6c63ff] hover:text-[#8b85ff] transition-colors cursor-pointer"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    تعليم الكل كمقروء
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-80 overflow-y-auto" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-[#4a5280]">
                    لا يوجد إشعارات
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      className="w-full text-right px-4 py-3 flex items-start gap-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-0 cursor-pointer"
                      onClick={() => handleMarkRead(n.id)}
                    >
                      {/* Unread indicator */}
                      <div className="mt-1 shrink-0">
                        {!n.read ? (
                          <span className="block w-2 h-2 rounded-full bg-[#6c63ff]" />
                        ) : (
                          <span className="block w-2 h-2 rounded-full bg-transparent" />
                        )}
                      </div>
                      {/* Icon */}
                      <div className="mt-0.5">{getNotificationIcon(n.type)}</div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] leading-snug ${n.read ? 'text-[#8892b0]' : 'text-[#f0f2ff] font-semibold'}`}>
                          {n.message}
                        </p>
                        <p className="text-[11px] text-[#4a5280] mt-1">
                          {formatNotifTime(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
