'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Table,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  BarChart3,
  Archive,
  CloudUpload,
  Settings,
  Send,
  LogOut,
  X,
} from 'lucide-react'
import { useCrmStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import type { ViewName } from '@/lib/store'
import { apiLogout } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIsMobile } from '@/hooks/use-mobile'

// ===== Nav Item Definition =====
interface NavItem {
  label: string
  icon: React.ElementType
  view: ViewName
  roles: Array<'tele' | 'sales' | 'admin'>
  showBadge?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'الرئيسية', icon: Home, view: 'dashboard', roles: ['tele', 'sales', 'admin'] },
  { label: 'شيتي', icon: Table, view: 'my-sheet', roles: ['tele'] },
  { label: 'اجتماعاتي', icon: CalendarCheck, view: 'my-meetings', roles: ['tele'], showBadge: true },
  { label: 'الاجتماعات', icon: CalendarDays, view: 'meetings', roles: ['sales'], showBadge: true },
  { label: 'شيتي', icon: Table, view: 'sales-sheet', roles: ['sales'] },
  { label: 'موقف العملاء', icon: ClipboardList, view: 'customers-status', roles: ['sales'] },
  { label: 'تقرير يومي', icon: BarChart3, view: 'daily-report', roles: ['tele', 'sales'] },
  { label: 'الأرشيف', icon: Archive, view: 'my-archive', roles: ['tele', 'sales'] },
  { label: 'إضافة بيانات', icon: CloudUpload, view: 'bulk-add', roles: ['tele', 'sales'] },
  { label: 'الإدارة', icon: Settings, view: 'admin', roles: ['admin'] },
  { label: 'إعداد التليجرام', icon: Send, view: 'telegram', roles: ['admin'] },
]

// ===== Role Label Map =====
const ROLE_LABELS: Record<string, string> = {
  tele: 'تيلي سيلز',
  sales: 'سيلز',
  admin: 'مدير',
}

// ===== Meeting Badge Count =====
function useMeetingBadgeCount() {
  const { leads, currentUser, currentRole } = useCrmStore(useShallow((s) => ({
    leads: s.leads,
    currentUser: s.currentUser,
    currentRole: s.currentRole,
  })))

  return useMemo(() => {
    if (!currentUser) return 0
    let count = 0
    for (const lead of leads) {
      if (!lead.meetingDate) continue
      if (currentRole === 'tele' && lead.tele === currentUser) count++
      else if (currentRole === 'sales' && lead.sales === currentUser) count++
    }
    return count
  }, [leads, currentUser, currentRole])
}

// ===== Animated Logo =====
function VenomLogo() {
  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-5"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <motion.span
        className="text-3xl"
        animate={{ rotate: [0, -10, 10, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
      >
        🐍
      </motion.span>
      <h1 className="text-xl font-bold tracking-tight venom-text-glow text-venom">
        Venom CRM
      </h1>
    </motion.div>
  )
}

// ===== User Avatar =====
function UserAvatar({ name }: { name: string }) {
  const initials = useMemo(() => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }, [name])

  return (
    <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-venom/10 ring-2 ring-venom/40 shrink-0">
      <span className="text-sm font-bold text-venom">{initials}</span>
      <motion.div
        className="absolute inset-0 rounded-full ring-2 ring-venom/20"
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.2, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

// ===== Nav Item Component =====
function SidebarNavItem({
  item,
  isActive,
  badgeCount,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  badgeCount: number
  onClick: () => void
}) {
  const Icon = item.icon

  return (
    <motion.button
      onClick={onClick}
      className={`
        relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
        text-sm font-medium transition-colors duration-200
        group cursor-pointer
        ${
          isActive
            ? 'bg-venom/10 text-venom'
            : 'text-muted-foreground hover:bg-venom/5 hover:text-foreground'
        }
      `}
      whileHover={{ scale: 1.02, x: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Active indicator bar on the right (RTL) */}
      {isActive && (
        <motion.div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-full bg-venom"
          layoutId="activeIndicator"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}

      <Icon
        className={`size-5 shrink-0 transition-colors duration-200 ${
          isActive ? 'text-venom' : 'text-muted-foreground group-hover:text-venom/70'
        }`}
      />

      <span className="flex-1 text-right">{item.label}</span>

      {item.showBadge && badgeCount > 0 && (
        <Badge
          variant="default"
          className="bg-venom text-venom-foreground border-venom/40 text-xs px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center shadow-sm"
        >
          {badgeCount}
        </Badge>
      )}
    </motion.button>
  )
}

// ===== Sidebar Content (shared between desktop & mobile) =====
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const {
    currentUser,
    currentRole,
    currentView,
    setCurrentView,
    logout,
    setSidebarOpen,
  } = useCrmStore()

  const meetingBadge = useMeetingBadgeCount()

  const filteredItems = useMemo(
    () => NAV_ITEMS.filter((item) => currentRole && item.roles.includes(currentRole)),
    [currentRole]
  )

  const handleNav = (view: ViewName) => {
    setCurrentView(view)
    onNavigate?.()
  }

  const handleLogout = async () => {
    try {
      await apiLogout()
    } catch {
      // Ignore Supabase logout errors
    }
    logout()
    onNavigate?.()
  }

  return (
    <div className="flex flex-col h-full dir-rtl">
      {/* Logo */}
      <VenomLogo />

      {/* Separator */}
      <div className="mx-4 h-px bg-gradient-to-l from-transparent via-venom/20 to-transparent" />

      {/* User Info */}
      {currentUser && currentRole && (
        <motion.div
          className="flex items-center gap-3 px-4 py-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <UserAvatar name={currentUser} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {currentUser}
            </span>
            <span className="text-xs text-venom/80">
              {ROLE_LABELS[currentRole] || currentRole}
            </span>
          </div>
        </motion.div>
      )}

      {/* Separator */}
      <div className="mx-4 h-px bg-gradient-to-l from-transparent via-venom/20 to-transparent" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3 px-2">
        <nav className="flex flex-col gap-1">
          {filteredItems.map((item, idx) => (
            <motion.div
              key={`${item.view}-${item.label}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * idx, duration: 0.3 }}
            >
              <SidebarNavItem
                item={item}
                isActive={currentView === item.view}
                badgeCount={item.showBadge ? meetingBadge : 0}
                onClick={() => handleNav(item.view)}
              />
            </motion.div>
          ))}
        </nav>
      </ScrollArea>

      {/* Separator */}
      <div className="mx-4 h-px bg-gradient-to-l from-transparent via-venom/20 to-transparent" />

      {/* Logout Button */}
      <div className="p-3">
        <motion.button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
            text-sm font-medium text-red-400/80
            hover:bg-red-500/10 hover:text-red-400
            transition-colors duration-200 cursor-pointer group"
          whileHover={{ scale: 1.02, x: -4 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <LogOut className="size-5 shrink-0 text-red-400/60 group-hover:text-red-400 transition-colors" />
          <span className="flex-1 text-right">خروج</span>
        </motion.button>
      </div>
    </div>
  )
}

// ===== Main Sidebar Export =====
export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useCrmStore()
  const isMobile = useIsMobile()

  // Mobile: Drawer from right
  if (isMobile) {
    return (
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Overlay */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setSidebarOpen(false)}
            />

            {/* Drawer */}
            <motion.aside
              className="fixed top-0 right-0 z-50 h-full w-72
                border-l border-venom/10
                venom-gradient-strong snake-pattern"
              style={{
                background: 'linear-gradient(180deg, #070e0b 0%, #0a1410 40%, #080d0a 100%)',
              }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Close button */}
              <motion.button
                className="absolute top-4 left-4 z-10 p-1.5 rounded-lg
                  bg-venom/10 text-venom hover:bg-venom/20
                  transition-colors cursor-pointer"
                onClick={() => setSidebarOpen(false)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="size-4" />
              </motion.button>

              <SidebarContent onNavigate={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    )
  }

  // Desktop: Fixed sidebar
  return (
    <motion.aside
      className="h-screen w-64 border-l border-venom/10
        venom-gradient-strong snake-pattern shrink-0"
      style={{
        background: 'linear-gradient(180deg, #070e0b 0%, #0a1410 40%, #080d0a 100%)',
      }}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <SidebarContent />
    </motion.aside>
  )
}
