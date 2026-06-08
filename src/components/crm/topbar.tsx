'use client'

import { useCrmStore } from '@/lib/store'
import { Calendar, Plus } from 'lucide-react'

const VIEW_TITLES: Record<string, [string, string]> = {
  overview: ['Dashboard Overview', 'لوحة التحكم الرئيسية'],
  leads: ['إدارة العملاء', 'تتبع وإدارة كل العملاء'],
  pipeline: ['Sales Pipeline', 'اسحب الكارت بين مراحل البيع'],
  followup: ['مركز المتابعة', 'جدولة وإرسال رسائل مباشرة'],
  whatsapp: ['WhatsApp', 'كل محادثاتك في مكان واحد'],
  ai: ['AI Features', 'مدعوم بالذكاء الاصطناعي'],
  team: ['Team Competition', 'Leaderboard والمنافسة بين الفريق'],
  client360: ['Client 360°', 'ملف شامل لكل عميل'],
  reports: ['تقارير', 'تقارير المبيعات والأداء'],
}

export function Topbar() {
  const { currentView, setAddLeadDialogOpen } = useCrmStore()
  const [title, subtitle] = VIEW_TITLES[currentView] || ['Dashboard', '']

  const now = new Date()
  const monthYearAr = now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })

  return (
    <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
      {/* Title section */}
      <div className="text-right mr-10 md:mr-0">
        <h1 className="text-[19px] md:text-[20px] font-bold text-[#f0f2ff] leading-tight">{title}</h1>
        <p className="text-[12px] md:text-[13px] text-[#8892b0] mt-0.5">{subtitle}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2.5 items-center">
        {/* Date chip */}
        <div className="hidden sm:flex px-3.5 py-2 bg-[#161b28] border border-white/[0.06] rounded-lg text-[12px] text-[#8892b0] items-center gap-2 select-none">
          <Calendar size={14} className="text-[#6c63ff]" />
          {monthYearAr}
        </div>

        {/* New Lead button */}
        <button
          onClick={() => setAddLeadDialogOpen(true)}
          className="text-white px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-1.5 hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(108,99,255,0.4)] transition-all border-0 cursor-pointer active:translate-y-0"
          style={{ background: 'linear-gradient(135deg, #6c63ff 0%, #8b84ff 100%)' }}
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Lead</span> جديد
        </button>
      </div>
    </div>
  )
}
