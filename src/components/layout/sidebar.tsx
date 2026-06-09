'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  LayoutDashboard,
  Phone,
  Briefcase,
  Calendar,
  Users,
  Archive,
  ArrowRightLeft,
  FileText,
  PlusCircle,
  Settings,
  LogOut,
  Menu,
  X,
  UserCircle,
} from 'lucide-react'
import { useCrmStore, type ViewName } from '@/lib/store'

/* ------------------------------------------------------------------ */
/*  Nav Item Definition                                                */
/* ------------------------------------------------------------------ */
interface NavItem {
  view: ViewName
  icon: React.ElementType
  label: string
  roles: Array<'tele' | 'sales' | 'admin'>
  showBadge?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', icon: LayoutDashboard, label: 'الرئيسية', roles: ['tele', 'sales', 'admin'] },
  { view: 'employee-profile', icon: UserCircle, label: 'صفحتي', roles: ['tele', 'sales', 'admin'] },
  { view: 'my-sheet', icon: Phone, label: 'شيت التيلي', roles: ['tele', 'admin'], showBadge: true },
  { view: 'sales-sheet', icon: Briefcase, label: 'شيت السيلز', roles: ['sales', 'admin'], showBadge: true },
  { view: 'my-meetings', icon: Calendar, label: 'اجتماعاتي', roles: ['tele', 'sales', 'admin'], showBadge: true },
  { view: 'transfers', icon: ArrowRightLeft, label: 'التحويلات', roles: ['tele', 'admin'], showBadge: true },
  { view: 'meetings', icon: Users, label: 'الاجتماعات', roles: ['sales', 'admin'] },
  { view: 'my-archive', icon: Archive, label: 'أرشيفي', roles: ['tele', 'sales', 'admin'] },
  { view: 'daily-report', icon: FileText, label: 'تقرير يومي', roles: ['tele', 'sales', 'admin'] },
  { view: 'bulk-add', icon: PlusCircle, label: 'إضافة ليدز', roles: ['tele', 'sales', 'admin'] },
  { view: 'admin', icon: Settings, label: 'لوحة التحكم', roles: ['admin'] },
]

/* ------------------------------------------------------------------ */
/*  Role Label Map                                                     */
/* ------------------------------------------------------------------ */
const ROLE_LABELS: Record<string, string> = {
  tele: 'تيلي',
  sales: 'سيلز',
  admin: 'أدمن',
}

/* ------------------------------------------------------------------ */
/*  Meeting Badge Count Hook                                           */
/* ------------------------------------------------------------------ */
function useMeetingBadgeCount() {
  const leads = useCrmStore((s) => s.leads)
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)

  return useMemo(() => {
    if (!currentUser) return 0
    let count = 0
    for (const lead of leads) {
      if (!lead.meetingDate) continue
      if (currentRole === 'tele' && lead.tele === currentUser) count++
      else if (currentRole === 'sales' && lead.sales === currentUser) count++
      else if (currentRole === 'admin') count++
    }
    return count
  }, [leads, currentUser, currentRole])
}

/* ------------------------------------------------------------------ */
/*  User initials helper                                               */
/* ------------------------------------------------------------------ */
function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/* ------------------------------------------------------------------ */
/*  Sidebar Component                                                  */
/* ------------------------------------------------------------------ */
export function Sidebar() {
  const {
    currentView,
    setCurrentView,
    currentUser,
    currentRole,
    logout,
  } = useCrmStore()

  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const meetingBadge = useMeetingBadgeCount()

  const handleMouseEnter = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
    if (!mobileOpen) setExpanded(true)
  }, [mobileOpen])

  const handleMouseLeave = useCallback(() => {
    // Small delay before collapsing to prevent flicker
    collapseTimer.current = setTimeout(() => {
      setExpanded(false)
    }, 150)
  }, [])

  // Filter nav items by current role
  const filteredItems = useMemo(
    () => NAV_ITEMS.filter((item) => currentRole && item.roles.includes(currentRole)),
    [currentRole]
  )

  const handleNav = (view: ViewName) => {
    setCurrentView(view)
    setMobileOpen(false)
  }

  const handleLogout = () => {
    logout()
    setMobileOpen(false)
  }

  // Close mobile menu on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Close role dropdown when clicking outside
  useEffect(() => {
    if (!mobileOpen) return
    const handler = () => setMobileOpen(false)
    // Delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('click', handler)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handler)
    }
  }, [mobileOpen])

  const showLabel = expanded || mobileOpen

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setMobileOpen(true)
        }}
        className="fixed top-4 right-4 z-[60] md:hidden w-10 h-10 rounded-lg bg-[#111520] border border-white/[0.06] flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] transition-colors cursor-pointer"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`
          fixed right-0 top-0 h-screen bg-[#111520] border-l border-white/[0.06]
          flex flex-col items-center py-5 z-[80] overflow-hidden
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${mobileOpen ? 'w-[220px]' : expanded ? 'w-[220px]' : 'w-0 md:w-[72px]'}
          ${expanded && !mobileOpen ? 'shadow-[-4px_0_24px_rgba(0,0,0,0.4)]' : ''}
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Close button on mobile */}
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 left-4 w-8 h-8 rounded-lg flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] cursor-pointer z-10 transition-colors"
          >
            <X size={18} />
          </button>
        )}

        {/* Logo */}
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-black text-lg mb-6 shrink-0 cursor-pointer select-none"
          style={{
            background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)',
            fontFamily: 'Cairo, sans-serif',
          }}
        >
          VN
        </div>

        {/* Separator */}
        <div className="w-full px-3 mb-3">
          <div
            className="h-px w-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(108,99,255,0.2), rgba(0,212,170,0.2), transparent)',
            }}
          />
        </div>

        {/* Nav Items */}
        <div className="flex flex-col gap-1 w-full px-2 flex-1 overflow-y-auto">
          {filteredItems.map((item) => {
            const isActive = currentView === item.view
            const Icon = item.icon
            const badgeCount = item.showBadge ? meetingBadge : 0

            return (
              <button
                key={item.view}
                onClick={() => handleNav(item.view)}
                className={`
                  relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-bold
                  transition-all duration-200 whitespace-nowrap overflow-hidden cursor-pointer
                  ${isActive
                    ? 'bg-[#6c63ff]/15 text-[#a8a3ff]'
                    : 'text-[#8892b0] hover:bg-[#1c2234] hover:text-[#f0f2ff]'
                  }
                `}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {/* Active indicator bar — on the left side in RTL (which is visually the start) */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-sm"
                    style={{ background: '#6c63ff' }}
                  />
                )}
                <span className="shrink-0 w-5 flex justify-center">
                  <Icon size={18} />
                </span>
                <span
                  className="transition-opacity duration-200 truncate"
                  style={{ opacity: showLabel ? 1 : 0 }}
                >
                  {item.label}
                </span>
                {item.showBadge && badgeCount > 0 && (
                  <span
                    className="mr-auto bg-[#6c63ff] text-white text-[11px] min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full font-bold transition-opacity duration-200"
                    style={{ opacity: showLabel ? 1 : 0 }}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Bottom separator */}
        <div className="w-full px-3 mb-2">
          <div
            className="h-px w-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(108,99,255,0.2), rgba(0,212,170,0.2), transparent)',
            }}
          />
        </div>

        {/* Logout button */}
        <div className="w-full px-2 mb-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-bold text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer whitespace-nowrap overflow-hidden"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <span className="shrink-0 w-5 flex justify-center">
              <LogOut size={18} />
            </span>
            <span
              className="transition-opacity duration-200 truncate"
              style={{ opacity: showLabel ? 1 : 0 }}
            >
              خروج
            </span>
          </button>
        </div>

        {/* User Pill */}
        <div className="w-full px-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer overflow-hidden hover:bg-[#1c2234] transition-colors">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)' }}
            >
              {currentUser ? getInitials(currentUser) : '?'}
            </div>
            <div
              className="transition-opacity duration-200 overflow-hidden"
              style={{ opacity: showLabel ? 1 : 0 }}
            >
              <div
                className="text-[12px] font-bold text-[#f0f2ff] whitespace-nowrap"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {currentUser || '—'}
              </div>
              <div
                className="text-[11px] font-semibold text-[#6c63ff] whitespace-nowrap"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {currentRole ? ROLE_LABELS[currentRole] : '—'}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
