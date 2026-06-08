'use client'

import { Calendar, Sun, Moon, Bell } from 'lucide-react'
import { useCrmStore, type ViewName } from '@/lib/store'
import { Button } from '@/components/ui/button'

/* ------------------------------------------------------------------ */
/*  View Titles Map                                                    */
/* ------------------------------------------------------------------ */
const VIEW_TITLES: Record<ViewName, { title: string; subtitle: string }> = {
  login: { title: '', subtitle: '' },
  dashboard: { title: 'الرئيسية', subtitle: 'نظرة عامة على النشاط' },
  'my-sheet': { title: 'شيت التيلي', subtitle: 'إدارة العملاء والمتابعة' },
  'my-meetings': { title: 'اجتماعاتي', subtitle: 'متابعة الاجتماعات القادمة' },
  meetings: { title: 'الاجتماعات', subtitle: 'متابعة الاجتماعات' },
  'sales-sheet': { title: 'شيت السيلز', subtitle: 'إدارة عملاء المبيعات' },
  'customers-status': { title: 'حالة العملاء', subtitle: 'متابعة حالة جميع العملاء' },
  'daily-report': { title: 'تقرير يومي', subtitle: 'ملخص الأنشطة اليومية' },
  'my-archive': { title: 'أرشيفي', subtitle: 'بيانات مؤرشفة' },
  'bulk-add': { title: 'إضافة مجموعة', subtitle: 'إضافة عملاء جديد بالجملة' },
  admin: { title: 'لوحة التحكم', subtitle: 'إعدادات النظام والفريق' },
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
/*  Topbar Component                                                   */
/* ------------------------------------------------------------------ */
export function Topbar() {
  const currentView = useCrmStore((s) => s.currentView)
  const currentUser = useCrmStore((s) => s.currentUser)
  const theme = useCrmStore((s) => s.theme)
  const toggleTheme = useCrmStore((s) => s.toggleTheme)

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
          className="text-[26px] md:text-[28px] font-extrabold text-[#f0f2ff] leading-tight"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {viewInfo.title}
        </h1>
        <p
          className="text-[15px] md:text-[16px] font-semibold text-[#8892b0] mt-1"
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
          className="hidden sm:flex px-3.5 py-2 bg-[#161b28] border border-white/[0.06] rounded-lg text-[14px] font-medium text-[#8892b0] items-center gap-2 select-none"
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

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 w-9 h-9 rounded-lg bg-[#161b28] border border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-[#1c2234] relative"
        >
          <Bell className="w-4 h-4" />
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#00d4aa] rounded-full" />
        </Button>
      </div>
    </div>
  )
}
