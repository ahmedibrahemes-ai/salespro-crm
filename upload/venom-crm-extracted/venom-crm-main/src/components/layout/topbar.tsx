'use client'

import { Menu, Sun, Moon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCrmStore } from '@/lib/store'
import type { ViewName } from '@/lib/store'
import { Button } from '@/components/ui/button'

const VIEW_TITLES: Record<ViewName, { title: string; subtitle: string }> = {
  login: { title: '', subtitle: '' },
  dashboard: { title: 'الرئيسية', subtitle: 'نظرة عامة على النشاط' },
  'my-sheet': { title: 'شيتي', subtitle: 'إدارة العملاء والمتابعة' },
  'my-meetings': { title: 'اجتماعاتي', subtitle: 'متابعة الاجتماعات القادمة' },
  meetings: { title: 'الاجتماعات', subtitle: 'متابعة الاجتماعات' },
  'sales-sheet': { title: 'شيتي', subtitle: 'إدارة عملاء المبيعات' },
  'customers-status': { title: 'موقف العملاء', subtitle: 'متابعة حالة جميع العملاء' },
  'daily-report': { title: 'تقرير يومي', subtitle: 'ملخص الأنشطة اليومية' },
  'my-archive': { title: 'الأرشيف', subtitle: 'بيانات مؤرشفة' },
  'bulk-add': { title: 'إضافة بيانات', subtitle: 'إضافة عملاء جديد بالجملة' },
  admin: { title: 'الإدارة', subtitle: 'إعدادات النظام والفريق' },
  telegram: { title: 'إعداد التليجرام', subtitle: 'ربط إشعارات التليجرام' },
}

export function Topbar() {
  const { currentView, sidebarOpen, setSidebarOpen, theme, toggleTheme } = useCrmStore()
  const viewInfo = VIEW_TITLES[currentView] || { title: '', subtitle: '' }

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/80 backdrop-blur-md px-4 md:px-6 h-14"
    >
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0 text-muted-foreground hover:text-venom"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-semibold truncate">{viewInfo.title}</h2>
        <p className="text-xs text-muted-foreground truncate hidden sm:block">{viewInfo.subtitle}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-venom"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>
    </motion.header>
  )
}
