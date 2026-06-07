'use client'

import { useCrmStore, type ViewName } from '@/lib/store'
import {
  ChartPie, Users, Columns3, Bell, MessageCircle, Bot, Trophy, UserCircle, BarChart3
} from 'lucide-react'

const NAV_ITEMS: { view: ViewName; icon: React.ElementType; label: string; badge?: number }[] = [
  { view: 'overview', icon: ChartPie, label: 'Overview' },
  { view: 'leads', icon: Users, label: 'Leads', badge: 5 },
  { view: 'pipeline', icon: Columns3, label: 'Pipeline' },
  { view: 'followup', icon: Bell, label: 'Follow-up', badge: 3 },
  { view: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', badge: 7 },
  { view: 'ai', icon: Bot, label: 'AI Features' },
  { view: 'team', icon: Trophy, label: 'Team' },
  { view: 'client360', icon: UserCircle, label: 'Client 360°' },
  { view: 'reports', icon: BarChart3, label: 'Reports' },
]

export function Sidebar() {
  const { currentView, setCurrentView, sidebarExpanded, setSidebarExpanded } = useCrmStore()

  return (
    <nav
      className="fixed right-0 top-0 h-screen bg-[#111520] border-l border-white/[0.06] flex flex-col items-center py-5 z-50 overflow-hidden"
      style={{
        width: sidebarExpanded ? 220 : 72,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={() => setSidebarExpanded(true)}
      onMouseLeave={() => setSidebarExpanded(false)}
    >
      {/* Logo */}
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-black text-lg mb-6 shrink-0 cursor-pointer select-none"
        style={{
          background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)',
          fontFamily: 'Cairo, sans-serif',
        }}
      >
        SP
      </div>

      {/* Nav Items */}
      <div className="flex flex-col gap-1 w-full px-2 flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.view
          const Icon = item.icon
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`
                relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                transition-colors duration-200 whitespace-nowrap overflow-hidden cursor-pointer
                ${isActive
                  ? 'bg-[#6c63ff]/15 text-[#a8a3ff]'
                  : 'text-[#8892b0] hover:bg-[#1c2234] hover:text-[#f0f2ff]'
                }
              `}
            >
              {/* Active accent bar on the left side */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-sm"
                  style={{ background: '#6c63ff' }}
                />
              )}
              {/* Icon */}
              <span className="shrink-0 w-5 flex justify-center">
                <Icon size={18} />
              </span>
              {/* Label - visible when expanded */}
              <span
                className="transition-opacity duration-200 truncate"
                style={{ opacity: sidebarExpanded ? 1 : 0 }}
              >
                {item.label}
              </span>
              {/* Badge */}
              {item.badge !== undefined && (
                <span
                  className="mr-auto bg-[#ff6b6b] text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full font-bold transition-opacity duration-200"
                  style={{ opacity: sidebarExpanded ? 1 : 0 }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* User Pill */}
      <div className="w-full px-2 mt-auto pt-4">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer overflow-hidden hover:bg-[#1c2234] transition-colors">
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)' }}
          >
            أح
          </div>
          {/* User info - visible when expanded */}
          <div
            className="transition-opacity duration-200 overflow-hidden"
            style={{ opacity: sidebarExpanded ? 1 : 0 }}
          >
            <div className="text-[12px] font-semibold text-[#f0f2ff] whitespace-nowrap">أحمد سالم</div>
            <div className="text-[11px] text-[#8892b0] whitespace-nowrap">Senior Sales</div>
          </div>
        </div>
      </div>
    </nav>
  )
}
