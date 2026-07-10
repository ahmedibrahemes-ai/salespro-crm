import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Lead } from './supabase'
import { normalizePhone } from '@/lib/crm-utils'

// ===== Contact Results =====
export const CONTACT_RESULTS = [
  { key: 'none', label: '—', color: 'text-muted-foreground' },
  { key: 'replied', label: '✅ رد', color: 'text-emerald-400' },
  { key: 'no-reply', label: '📵 لم يرد', color: 'text-amber-400' },
  { key: 'busy', label: '🔴 مشغول', color: 'text-amber-400' },
  { key: 'wrong-number', label: '❌ رقم غلط', color: 'text-red-400' },
  { key: 'customer-service', label: '🎧 خدمة عملاء', color: 'text-blue-400' },
]

// ===== Tele Sheet Statuses =====
export const STATUSES = [
  { key: 'meeting', label: '📅 اجتماع', cls: 'status-done' },
  { key: 'whatsapp', label: '💬 واتس', cls: 'status-followup' },
  { key: 'not-interested', label: '🚫 غير مهتم', cls: 'status-closed-lost' },
  { key: 'followup-1', label: '🔄 متابعة 1', cls: 'status-followup' },
  { key: 'followup-2', label: '🔄 متابعة 2', cls: 'status-followup' },
  { key: 'followup-3', label: '🔄 متابعة 3', cls: 'status-followup' },
]

// ===== Sales Statuses =====
export const SALES_STATUSES = [
  { key: 'new', label: '🆕 جديد', cls: 'bg-green-500/20 text-green-400' },
  { key: 'contacted', label: '📞 تم التواصل', cls: 'bg-green-500/20 text-green-400' },
  { key: 'followup', label: '🔄 متابعة', cls: 'bg-amber-500/20 text-amber-400' },
  { key: 'meeting-done', label: '✅ اجتماع تم', cls: 'bg-emerald-500/20 text-emerald-400' },
  { key: 'objection-price', label: '💰 اعتراض سعر', cls: 'bg-red-500/20 text-red-400' },
  { key: 'objection-other', label: '⚠️ اعتراض آخر', cls: 'bg-red-500/20 text-red-400' },
  { key: 'proposal-sent', label: '📤 عرض سعر', cls: 'bg-green-500/20 text-green-400' },
  { key: 'negotiation', label: '🤝 تفاوض', cls: 'bg-amber-500/20 text-amber-400' },
  { key: 'thinking', label: '🤔 يفكر', cls: 'bg-amber-500/20 text-amber-400' },
  { key: 'closed-won', label: '🏆 تم التقفيل', cls: 'bg-emerald-500/20 text-emerald-400' },
  { key: 'closed-lost', label: '❌ خسارة', cls: 'bg-red-500/20 text-red-400' },
]

// ===== Attendance Statuses =====
export const ATTENDANCE_STATUSES = [
  { key: 'pending', label: '⏳ انتظار', cls: 'bg-amber-500/20 text-amber-400' },
  { key: 'attended', label: '✅ حضر', cls: 'bg-emerald-500/20 text-emerald-400' },
  { key: 'no-show', label: '❌ لم يحضر', cls: 'bg-red-500/20 text-red-400' },
]

// ===== Default Team =====
export const DEFAULT_TEAM = {
  tele: ['Amira', 'Neveen', 'Sara', 'Esraa', 'Rahma'],
  sales: ['Rania', 'Alaa', 'Samar'],
  admin: ['Admin'],
}

// ===== View Name =====
export type ViewName =
  | 'login'
  | 'dashboard'
  | 'my-sheet'
  | 'my-meetings'
  | 'sales-sheet'
  | 'customers-status'
  | 'daily-report'
  | 'my-archive'
  | 'bulk-add'
  | 'follow-up'
  | 'admin'
  | 'employee-profile'
  | 'transfers'

// ===== View Access Control =====
export const VIEW_PERMISSIONS: Record<ViewName, Array<'tele' | 'sales' | 'admin'>> = {
  'login': ['tele', 'sales', 'admin'],
  'dashboard': ['tele', 'sales', 'admin'],
  'employee-profile': ['tele', 'sales', 'admin'],
  'my-sheet': ['tele', 'admin'],
  'sales-sheet': ['sales', 'admin'],
  'my-meetings': ['tele', 'sales', 'admin'],
  // 'meetings' removed — merged into 'my-meetings'
  'my-archive': ['tele', 'sales', 'admin'],
  'customers-status': ['tele', 'sales', 'admin'],
  'daily-report': ['tele', 'sales', 'admin'],
  'bulk-add': ['tele', 'sales', 'admin'],
  'follow-up': ['sales', 'admin'],
  'admin': ['admin'],
  'transfers': ['tele', 'admin'],
}

export function canAccessView(view: ViewName, role: 'tele' | 'sales' | 'admin' | null): boolean {
  if (!role) return false
  return VIEW_PERMISSIONS[view]?.includes(role) ?? false
}

export function getDefaultViewForRole(role: 'tele' | 'sales' | 'admin'): ViewName {
  return 'dashboard'
}

// ===== Notification =====
export interface Notification {
  id: string
  type: 'attendance' | 'transfer' | 'new-lead' | 'note' | 'system'
  message: string
  leadId?: string | null
  read: boolean
  readAt?: number | null
  createdAt: number
  // Optional: target user/role for server-side notifications
  targetUser?: string | null
  targetRole?: string | null
}

// ===== Toast =====
export interface CrmToast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
  createdAt: number
}

// ===== Date Range Filter =====
export interface DateRangeFilter {
  preset: string
  customFrom?: string
  customTo?: string
}

// ===== Admin Sub-tab =====
export type AdminTab =
  | 'overview'
  | 'tele'
  | 'sales'
  | 'all-leads'
  | 'archive'
  | 'team'
  | 'users'
  | 'monitoring'
  | 'settings'

// ===== Duplicate Cache Entry =====
export interface DuplicateInfo {
  originalId: string
  duplicateIds: string[]
}

// ===== Store Interface =====
interface CrmStore {
  // Auth
  currentUser: string | null
  currentRole: 'tele' | 'sales' | 'admin' | null
  isAuthenticated: boolean
  userId: string | null
  username: string | null
  hydrating: boolean
  setHydrating: (h: boolean) => void

  // Navigation
  currentView: ViewName
  setCurrentView: (view: ViewName) => void

  // Data
  leads: Lead[]
  archivedLeads: Lead[]
  leadsById: Record<string, Lead>
  leadsVersion: number
  team: { tele: string[]; sales: string[]; admin: string[] }
  dataLoaded: boolean
  archivedLoaded: boolean
  loading: boolean
  leadsLoaded: boolean
  dataError: string | null  // FIX: surface data-load errors to the UI (was silently returning [])
  setLeads: (leads: Lead[]) => void
  setArchivedLeads: (leads: Lead[]) => void
  setTeam: (team: { tele: string[]; sales: string[]; admin: string[] }) => void
  setDataLoaded: (loaded: boolean) => void
  setArchivedLoaded: (loaded: boolean) => void
  setLoading: (loading: boolean) => void
  setDataError: (error: string | null) => void

  // Actions
  login: (user: string, role: 'tele' | 'sales' | 'admin', userId?: string, username?: string, token?: string) => void
  logout: () => void
  updateLeadInCache: (id: string, updates: Partial<Lead>) => void
  revertLeadInCache: (id: string, oldLead: Lead) => void
  addLeadToCache: (lead: Lead) => void
  batchAddLeadsToCache: (leads: Lead[]) => void
  removeLeadFromCache: (id: string) => void
  batchRemoveLeadsFromCache: (ids: string[]) => void
  archiveLeadsInCache: (ids: string[], byName: string) => void
  unarchiveLeadsInCache: (ids: string[]) => void

  // UI State
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  theme: 'dark' | 'light'
  toggleTheme: () => void

  // Permissions
  teleAccess: Record<string, string[]>
  salesAccess: Record<string, string[]>
  setTeleAccess: (access: Record<string, string[]>) => void
  setSalesAccess: (access: Record<string, string[]>) => void
  canAccessTeleSheet: (viewer: string, target: string) => boolean
  canAccessSalesSheet: (viewer: string, target: string) => boolean
  getAccessibleTeleSheets: (viewer: string) => string[]
  getAccessibleSalesSheets: (viewer: string) => string[]

  // Toast Notifications
  toasts: CrmToast[]
  addToast: (type: CrmToast['type'], message: string, duration?: number) => void
  removeToast: (id: string) => void
  clearToasts: () => void

  // View-Specific State
  activeFilter: Record<string, string>
  setActiveFilter: (viewKey: string, filter: string) => void
  // Persistent member selection for admin (which tele/sales to view)
  selectedTeleMember: string
  setSelectedTeleMember: (member: string) => void
  selectedSalesMember: string
  setSelectedSalesMember: (member: string) => void
  // Session token (persisted via Zustand — fallback for localStorage)
  sessionToken: string | null
  setSessionToken: (token: string | null) => void
  selectedLeadIds: Record<string, string[]>
  toggleLeadSelection: (viewKey: string, id: string) => void
  setSelectedLeadIds: (viewKey: string, ids: string[]) => void
  clearSelectedLeadIds: (viewKey: string) => void
  selectAllLeads: (viewKey: string, ids: string[]) => void
  searchQueries: Record<string, string>
  setSearchQuery: (viewKey: string, query: string) => void
  dateRangeFilters: Record<string, DateRangeFilter>
  setDateRangeFilter: (viewKey: string, filter: DateRangeFilter) => void

  // Admin Sub-tab
  adminTab: AdminTab
  setAdminTab: (tab: AdminTab) => void

  // Duplicate Detection Cache
  duplicatesCache: Record<string, DuplicateInfo>
  duplicatesVersion: number
  setDuplicatesCache: (cache: Record<string, DuplicateInfo>) => void
  buildDuplicatesCache: (leads: Lead[]) => void
  getDuplicateInfo: (phone: string) => DuplicateInfo | undefined
  incrementDuplicatesVersion: () => void

  // Real-time Sync Status
  realtimeStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  setRealtimeStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
  lastSyncAt: number | null
  setLastSyncAt: (ts: number) => void
  syncChangesToCache: (freshLeads: Lead[], freshArchived: Lead[]) => number

  // Bell Notifications
  notifications: Notification[]
  addNotification: (type: Notification['type'], message: string, leadId?: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  setNotifications: (notifications: Notification[]) => void
  loadNotificationsFromServer: () => Promise<void>
  unreadNotificationsCount: number
  notificationsLoaded: boolean

  // Target Settings
  targetSettings: { type: 'meetings' | 'money' | 'closings'; value: number }
  setTargetSettings: (settings: { type: string; value: number }) => void
}

// ===== Toast auto-dismiss timers =====
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()
let toastCounter = 0

// ===== ID Comparison Helper (Bug Fix #2: proper string ID comparison) =====
// Compares lead IDs as numbers (since Supabase auto-increment produces numeric IDs)
// Falls back to localeCompare for non-numeric IDs
function compareIds(a: string, b: string): number {
  const numA = Number(a)
  const numB = Number(b)
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB
  return a.localeCompare(b)
}

// ===== Persisted Auth State =====
function getPersistedAuth() {
  if (typeof window === 'undefined') return { currentUser: null, currentRole: null, isAuthenticated: false, userId: null, username: null }
  try {
    const stored = localStorage.getItem('venom-auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.currentUser && parsed.currentRole) {
        return { currentUser: parsed.currentUser, currentRole: parsed.currentRole, isAuthenticated: true, userId: parsed.userId || null, username: parsed.username || null }
      }
    }
  } catch { /* ignore */ }
  return { currentUser: null, currentRole: null, isAuthenticated: false, userId: null, username: null }
}

function persistAuth(user: string | null, role: 'tele' | 'sales' | 'admin' | null, userId?: string | null, username?: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (user && role) {
      localStorage.setItem('venom-auth', JSON.stringify({ currentUser: user, currentRole: role, userId: userId || null, username: username || null }))
    } else {
      localStorage.removeItem('venom-auth')
    }
  } catch { /* ignore */ }
}

// ===== Store Implementation =====
export const useCrmStore = create<CrmStore>()(
  persist(
    (set, get) => ({
  // Auth (starts as logged out — will be hydrated from localStorage on first client mount)
  currentUser: null,
  currentRole: null,
  isAuthenticated: false,
  userId: null,
  username: null,
  // Hydrating flag — true until first client mount restores auth from localStorage
  // This prevents showing login screen during the brief moment before hydration
  hydrating: true,
  setHydrating: (h: boolean) => set({ hydrating: h }),

  // Navigation
  currentView: 'login' as ViewName,
  setCurrentView: (view) => set({ currentView: view }),

  // Data
  leads: [],
  archivedLeads: [],
  leadsById: {},
  leadsVersion: 0,
  team: DEFAULT_TEAM,
  dataLoaded: false,
  archivedLoaded: false,
  loading: false,
  leadsLoaded: false,
  dataError: null,
  setDataError: (dataError) => set({ dataError }),
  setLeads: (leads) => {
    const seen = new Set<string>()
    const deduped = leads.filter((l: Lead) => {
      if (seen.has(l.id)) return false
      seen.add(l.id)
      return true
    })
    // PRESERVE the order from the API (which sorts by created_at DESC).
    // We do NOT re-sort here — the API already returns newest first,
    // and re-sorting client-side with millisecond timestamps can cause
    // inconsistencies due to precision differences.
    const leadsById: Record<string, Lead> = {}
    deduped.forEach((l: Lead) => { leadsById[l.id] = l })
    set({ leads: deduped, leadsById, leadsLoaded: true })
  },
  setArchivedLeads: (archivedLeads) => {
    set((state) => {
      const newLeadsById = { ...state.leadsById }
      archivedLeads.forEach((l: Lead) => { newLeadsById[l.id] = l })
      return { archivedLeads, leadsById: newLeadsById }
    })
  },
  setTeam: (team) => set({ team }),
  setDataLoaded: (dataLoaded) => set({ dataLoaded }),
  setArchivedLoaded: (archivedLoaded) => set({ archivedLoaded }),
  setLoading: (loading) => set({ loading }),

  // Actions
  login: (user, role, userId?, username?, token?) => {
    persistAuth(user, role, userId, username)
    set({
      currentUser: user,
      currentRole: role,
      isAuthenticated: true,
      currentView: 'dashboard',
      userId: userId || null,
      username: username || null,
      sessionToken: token || null,
    })
  },
  logout: () => {
    persistAuth(null, null)
    // Clear the session token + leads cache on logout
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem('venom-session') } catch { /* ignore */ }
      try { sessionStorage.removeItem('venom-leads-cache') } catch { /* ignore */ }
    }
    set({
      currentUser: null,
      currentRole: null,
      isAuthenticated: false,
      userId: null,
      username: null,
      hydrating: false,
      currentView: 'login',
      leads: [],
      archivedLeads: [],
      leadsById: {},
      leadsVersion: 0,
      dataLoaded: false,
      archivedLoaded: false,
      dataError: null,
      leadsLoaded: false,
      notificationsLoaded: false,
      activeFilter: {},
      selectedTeleMember: 'all',
      selectedSalesMember: 'all',
      sessionToken: null,
      selectedLeadIds: {},
      searchQueries: {},
      dateRangeFilters: {},
      adminTab: 'overview',
      duplicatesCache: {},
      duplicatesVersion: 0,
      realtimeStatus: 'connecting',
      lastSyncAt: null,
    })
  },
  updateLeadInCache: (id, updates) => {
    set((state) => {
      const existing = state.leadsById[id]
      if (!existing) return state

      const newLeadsById = { ...state.leadsById, [id]: { ...existing, ...updates, notes: updates.notes !== undefined ? updates.notes : existing.notes } }
      let newLeads = state.leads
      let newArchivedLeads = state.archivedLeads

      if (!existing.isArchived) {
        newLeads = state.leads.map((l) => (l.id === id ? { ...l, ...updates, notes: updates.notes !== undefined ? updates.notes : l.notes } : l))
      } else {
        newArchivedLeads = state.archivedLeads.map((l) => (l.id === id ? { ...l, ...updates, notes: updates.notes !== undefined ? updates.notes : l.notes } : l))
      }

      return { leads: newLeads, archivedLeads: newArchivedLeads, leadsById: newLeadsById }
    })
  },
  revertLeadInCache: (id, oldLead) => {
    // Rollback an optimistic update — restore the lead to its pre-edit state.
    // Called when apiUpdateLead fails (e.g. 401 session expired) to prevent
    // the user from seeing data that wasn't actually saved to the server.
    set((state) => {
      const newLeadsById = { ...state.leadsById, [id]: oldLead }
      let newLeads = state.leads
      let newArchivedLeads = state.archivedLeads
      if (!oldLead.isArchived) {
        newLeads = state.leads.map((l) => (l.id === id ? oldLead : l))
      } else {
        newArchivedLeads = state.archivedLeads.map((l) => (l.id === id ? oldLead : l))
      }
      return { leads: newLeads, archivedLeads: newArchivedLeads, leadsById: newLeadsById }
    })
  },
  addLeadToCache: (lead) => {
    if (!lead || lead.id == null) return
    set((state) => {
      if (lead.id in state.leadsById) return state

      // Insert at the BEGINNING — new leads are always newest
      const newLeads = [lead, ...state.leads]
      const newLeadsById = { ...state.leadsById, [lead.id]: lead }

      return { leads: newLeads, leadsById: newLeadsById, leadsVersion: state.leadsVersion + 1 }
    })
  },
  batchAddLeadsToCache: (newLeads) => {
    if (!Array.isArray(newLeads) || newLeads.length === 0) return
    set((state) => {
      const leadsToAdd: Lead[] = []
      let newLeadsById = { ...state.leadsById }
      for (const lead of newLeads) {
        if (!lead || lead.id == null) continue
        if (lead.id in state.leadsById) continue
        leadsToAdd.push(lead)
        newLeadsById[lead.id] = lead
      }
      if (leadsToAdd.length === 0) return state
      // Prepend new leads (they're newest) — preserve their original order
      const updatedLeads = [...leadsToAdd, ...state.leads]
      return { leads: updatedLeads, leadsById: newLeadsById, leadsVersion: state.leadsVersion + 1 }
    })
  },
  removeLeadFromCache: (id) => {
    set((state) => {
      const existing = state.leadsById[id]
      if (!existing) return state

      const { [id]: _removed, ...restLeadsById } = state.leadsById
      let newLeads = state.leads
      let newArchivedLeads = state.archivedLeads

      if (!existing.isArchived) {
        newLeads = state.leads.filter((l) => l.id !== id)
      } else {
        newArchivedLeads = state.archivedLeads.filter((l) => l.id !== id)
      }

      return { leads: newLeads, archivedLeads: newArchivedLeads, leadsById: restLeadsById, leadsVersion: state.leadsVersion + 1 }
    })
  },
  batchRemoveLeadsFromCache: (ids) => {
    if (ids.length === 0) return
    set((state) => {
      const idsSet = new Set(ids)
      let newLeadsById = { ...state.leadsById }
      for (const id of ids) delete newLeadsById[id]
      const newLeads = state.leads.filter((l) => !idsSet.has(l.id))
      const newArchivedLeads = state.archivedLeads.filter((l) => !idsSet.has(l.id))
      return { leads: newLeads, archivedLeads: newArchivedLeads, leadsById: newLeadsById, leadsVersion: state.leadsVersion + 1 }
    })
  },
  archiveLeadsInCache: (ids, byName) => {
    if (ids.length === 0) return
    set((state) => {
      const idsSet = new Set(ids)
      const now = Date.now()
      const movedLeads: Lead[] = []
      const remainingLeads: Lead[] = []
      let newLeadsById = { ...state.leadsById }

      for (const l of state.leads) {
        if (idsSet.has(l.id)) {
          const archived: Lead = { ...l, isArchived: true, archivedAt: now, archivedBy: byName }
          movedLeads.push(archived)
          newLeadsById[l.id] = archived
        } else {
          remainingLeads.push(l)
        }
      }

      return {
        leads: remainingLeads,
        archivedLeads: [...state.archivedLeads, ...movedLeads],
        leadsById: newLeadsById,
        leadsVersion: state.leadsVersion + 1,
      }
    })
  },
  unarchiveLeadsInCache: (ids) => {
    if (ids.length === 0) return
    set((state) => {
      const idsSet = new Set(ids)
      const movedLeads: Lead[] = []
      const remainingArchived: Lead[] = []
      let newLeadsById = { ...state.leadsById }

      for (const l of state.archivedLeads) {
        if (idsSet.has(l.id)) {
          const unarchived: Lead = { ...l, isArchived: false, archivedAt: null, archivedBy: null }
          movedLeads.push(unarchived)
          newLeadsById[l.id] = unarchived
        } else {
          remainingArchived.push(l)
        }
      }

      // BUG FIX: Use compareIds for binary search insertion
      const result = [...state.leads]
      for (const lead of movedLeads) {
        let lo = 0
        let hi = result.length
        while (lo < hi) {
          const mid = (lo + hi) >>> 1
          if (compareIds(result[mid].id, lead.id) > 0) {
            lo = mid + 1
          } else {
            hi = mid
          }
        }
        result.splice(lo, 0, lead)
      }

      return {
        leads: result,
        archivedLeads: remainingArchived,
        leadsById: newLeadsById,
        leadsVersion: state.leadsVersion + 1,
      }
    })
  },

  // UI State
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  theme: 'dark',
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

  // Permissions
  teleAccess: {},
  salesAccess: {},
  setTeleAccess: (access) => set({ teleAccess: access }),
  setSalesAccess: (access) => set({ salesAccess: access }),
  canAccessTeleSheet: (viewer, target) => {
    const { teleAccess, currentRole } = get()
    if (currentRole === 'admin') return true
    if (viewer === target) return true
    const allowed = teleAccess[viewer]
    return allowed ? allowed.includes(target) : false
  },
  canAccessSalesSheet: (viewer, target) => {
    const { salesAccess, currentRole } = get()
    if (currentRole === 'admin') return true
    if (viewer === target) return true
    const allowed = salesAccess[viewer]
    return allowed ? allowed.includes(target) : false
  },
  getAccessibleTeleSheets: (viewer) => {
    const { teleAccess, currentRole, team } = get()
    if (currentRole === 'admin') return team.tele
    const own = viewer && team.tele.includes(viewer) ? [viewer] : []
    const allowed = teleAccess[viewer] || []
    return [...new Set([...own, ...allowed])]
  },
  getAccessibleSalesSheets: (viewer) => {
    const { salesAccess, currentRole, team } = get()
    if (currentRole === 'admin') return team.sales
    const own = viewer && team.sales.includes(viewer) ? [viewer] : []
    const allowed = salesAccess[viewer] || []
    return [...new Set([...own, ...allowed])]
  },

  // Toast Notifications
  toasts: [],
  addToast: (type, message, duration = 4000) => {
    const id = `toast-${++toastCounter}-${Date.now()}`
    const toast: CrmToast = { id, type, message, duration, createdAt: Date.now() }
    set((s) => ({ toasts: [...s.toasts, toast] }))
    if (duration > 0) {
      const timer = setTimeout(() => get().removeToast(id), duration)
      toastTimers.set(id, timer)
    }
  },
  removeToast: (id) => {
    const timer = toastTimers.get(id)
    if (timer) { clearTimeout(timer); toastTimers.delete(id) }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
  clearToasts: () => {
    toastTimers.forEach((timer) => clearTimeout(timer))
    toastTimers.clear()
    set({ toasts: [] })
  },

  // View-Specific State
  activeFilter: {},
  setActiveFilter: (viewKey, filter) =>
    set((s) => ({ activeFilter: { ...s.activeFilter, [viewKey]: filter } })),
  // Persistent member selection — admin picks which tele/sales to view.
  // Default 'all' shows everyone; persisted via Zustand persist middleware.
  selectedTeleMember: 'all',
  setSelectedTeleMember: (member) => set({ selectedTeleMember: member }),
  selectedSalesMember: 'all',
  setSelectedSalesMember: (member) => set({ selectedSalesMember: member }),
  sessionToken: null,
  setSessionToken: (token) => set({ sessionToken: token }),
  selectedLeadIds: {},
  toggleLeadSelection: (viewKey, id) =>
    set((s) => {
      const current = s.selectedLeadIds[viewKey] || []
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      return { selectedLeadIds: { ...s.selectedLeadIds, [viewKey]: next } }
    }),
  setSelectedLeadIds: (viewKey, ids) =>
    set((s) => ({ selectedLeadIds: { ...s.selectedLeadIds, [viewKey]: ids } })),
  clearSelectedLeadIds: (viewKey) =>
    set((s) => ({ selectedLeadIds: { ...s.selectedLeadIds, [viewKey]: [] } })),
  selectAllLeads: (viewKey, ids) =>
    set((s) => ({ selectedLeadIds: { ...s.selectedLeadIds, [viewKey]: [...ids] } })),
  searchQueries: {},
  setSearchQuery: (viewKey, query) =>
    set((s) => ({ searchQueries: { ...s.searchQueries, [viewKey]: query } })),
  dateRangeFilters: {},
  setDateRangeFilter: (viewKey, filter) =>
    set((s) => ({ dateRangeFilters: { ...s.dateRangeFilters, [viewKey]: filter } })),

  // Admin Sub-tab
  adminTab: 'overview',
  setAdminTab: (tab) => set({ adminTab: tab }),

  // Duplicate Detection Cache
  duplicatesCache: {},
  duplicatesVersion: 0,
  setDuplicatesCache: (cache) => set({ duplicatesCache: cache }),
  incrementDuplicatesVersion: () => set((s) => ({ duplicatesVersion: s.duplicatesVersion + 1 })),
  buildDuplicatesCache: (leads) => {
    const cache: Record<string, DuplicateInfo> = {}
    const phoneToLeads: Record<string, Lead[]> = {}

    leads.forEach((l) => {
      if (!l.phone) return
      const norm = normalizePhone(l.phone)
      if (!norm) return
      const arr = phoneToLeads[norm] || []
      arr.push(l)
      phoneToLeads[norm] = arr
    })

    for (const [norm, arr] of Object.entries(phoneToLeads)) {
      if (arr.length < 2) continue
      arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      cache[norm] = {
        originalId: arr[0].id,
        duplicateIds: arr.slice(1).map((l) => l.id),
      }
    }

    set({ duplicatesCache: cache })
  },
  getDuplicateInfo: (phone) => {
    const norm = normalizePhone(phone)
    if (!norm) return undefined
    return get().duplicatesCache[norm]
  },

  // Bell Notifications
  notifications: [],
  notificationsLoaded: false,
  addNotification: (type, message, leadId) => {
    set((s) => {
      const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const notif: Notification = { id, type, message, leadId, read: false, createdAt: Date.now() }
      const updated = [notif, ...s.notifications].slice(0, 50) // max 50
      const unreadCount = updated.filter((n) => !n.read).length
      return { notifications: updated, unreadNotificationsCount: unreadCount }
    })
  },
  setNotifications: (notifications) => {
    const unreadCount = notifications.filter((n) => !n.read).length
    set({ notifications, unreadNotificationsCount: unreadCount, notificationsLoaded: true })
  },
  markNotificationRead: (id) => {
    set((s) => {
      const updated = s.notifications.map((n) => (n.id === id ? { ...n, read: true, readAt: Date.now() } : n))
      const unreadCount = updated.filter((n) => !n.read).length
      return { notifications: updated, unreadNotificationsCount: unreadCount }
    })
  },
  markAllNotificationsRead: () => {
    set((s) => {
      const updated = s.notifications.map((n) => ({ ...n, read: true, readAt: Date.now() }))
      return { notifications: updated, unreadNotificationsCount: 0 }
    })
  },
  loadNotificationsFromServer: async () => {
    try {
      const { apiGetNotifications, apiMarkAllNotificationsRead } = await import('@/lib/supabase')
      const { data, unreadCount } = await apiGetNotifications(false)
      const mapped: Notification[] = data.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        leadId: n.leadId,
        read: n.read,
        readAt: n.readAt,
        createdAt: n.createdAt,
        targetUser: n.targetUser,
        targetRole: n.targetRole,
      }))
      set({ notifications: mapped, unreadNotificationsCount: unreadCount, notificationsLoaded: true })
    } catch (err) {
      console.error('[store] Failed to load notifications:', err)
      set({ notificationsLoaded: true })
    }
  },
  unreadNotificationsCount: 0,

  // Target Settings
  targetSettings: { type: 'meetings', value: 50 },
  setTargetSettings: (settings) => set({ targetSettings: settings as { type: 'meetings' | 'money' | 'closings'; value: number } }),

  // Real-time Sync Status
  realtimeStatus: 'connecting',
  setRealtimeStatus: (status) => set({ realtimeStatus: status }),
  lastSyncAt: null,
  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),
  syncChangesToCache: (freshLeads, freshArchived) => {
    const state = get()
    let changedCount = 0
    const newLeadsById = { ...state.leadsById }

    const freshMap = new Map<string, Lead>()
    for (const l of freshLeads) freshMap.set(l.id, l)
    for (const l of freshArchived) freshMap.set(l.id, l)

    for (const [id, freshLead] of freshMap) {
      const cached = state.leadsById[id]
      if (!cached) {
        newLeadsById[id] = freshLead
        changedCount++
        continue
      }

      const priorityFields: (keyof Lead)[] = [
        'attended', 'attendanceMarkedAt', 'attendanceMarkedBy',
        'sales', 'salesStatus', 'status', 'meetingDate', 'meetingTime',
        'isArchived', 'cancelledFrom', 'cancelledAt', 'assignedAt',
      ]
      let hasChange = false
      for (const field of priorityFields) {
        if (cached[field] !== freshLead[field]) { hasChange = true; break }
      }

      if (hasChange) {
        newLeadsById[id] = { ...cached, ...freshLead, notes: cached.notes }
        changedCount++
      }
    }

    if (changedCount > 0) {
      const existingLeadIds = new Set(state.leads.map((l) => l.id))
      const existingArchivedIds = new Set(state.archivedLeads.map((l) => l.id))

      const newLeads = state.leads.map((l) => newLeadsById[l.id] || l)
      const newArchivedLeads = state.archivedLeads.map((l) => newLeadsById[l.id] || l)

      for (const [id, lead] of Object.entries(newLeadsById)) {
        if (!existingLeadIds.has(id) && !existingArchivedIds.has(id) && !lead.isArchived) {
          newLeads.push(lead)
        }
      }

      // BUG FIX: Use compareIds for proper sorting
      newLeads.sort((a, b) => compareIds(b.id, a.id))
      newArchivedLeads.sort((a, b) => compareIds(b.id, a.id))

      set({ leads: newLeads, archivedLeads: newArchivedLeads, leadsById: newLeadsById })
    }

    return changedCount
  },
    }),
    {
      name: 'venom-crm-storage',
      // PERF: Do NOT persist leads/archivedLeads/leadsById or dataLoaded/archivedLoaded.
      // Leads are fetched from Supabase on every login — persisting them causes
      // multi-MB JSON.stringify on every state change → 1-2s UI freezes.
      // dataLoaded/archivedLoaded must also not be persisted, otherwise the app
      // would think data is loaded after refresh while leads array is empty.
      // We DO persist the auth + selected member (small, useful across refreshes).
      partialize: (s) => ({
        currentUser: s.currentUser,
        currentRole: s.currentRole,
        isAuthenticated: s.isAuthenticated,
        userId: s.userId,
        username: s.username,
        selectedTeleMember: s.selectedTeleMember,
        selectedSalesMember: s.selectedSalesMember,
        theme: s.theme,
        sessionToken: s.sessionToken,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<typeof current>
        return { ...current, ...p }
      },
    }
  )
)

// ===== Session Validation =====
// Returns: 'valid' | 'invalid' | 'error'
// 'valid' = server confirmed session is active
// 'invalid' = server confirmed session is NOT active (user disabled, etc.)
// 'error' = network/server error — do NOT logout on error (optimistic)
export async function validateSession(): Promise<'valid' | 'invalid' | 'error'> {
  if (typeof window === 'undefined') return 'error'
  try {
    const auth = getPersistedAuth()
    if (!auth.userId) return 'invalid'
    // Demo mode: if userId starts with "demo-", skip server validation
    if (auth.userId.startsWith('demo-')) return 'valid'
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validate-session', userId: auth.userId }),
    })
    if (!res.ok) return 'error' // Server error — don't logout
    const data = await res.json()
    return data.valid === true ? 'valid' : 'invalid'
  } catch {
    // Network error — don't logout, keep the session optimistically
    return 'error'
  }
}

// ===== Hydrate Auth from localStorage (call on client mount) =====
export function hydrateAuth() {
  if (typeof window === 'undefined') return
  const auth = getPersistedAuth()
  if (auth.currentUser && auth.currentRole) {
    useCrmStore.setState({
      currentUser: auth.currentUser,
      currentRole: auth.currentRole,
      isAuthenticated: true,
      currentView: 'dashboard',
      userId: auth.userId || null,
      username: auth.username || null,
      hydrating: false,
    })
    // Validate session in background — NON-BLOCKING.
    // Don't wait for this before loading data. If the session is invalid,
    // the loadLeads will fail with 401 and handleServerError will logout.
    // This saves 300-500ms on initial page load.
    validateSession().then((result) => {
      if (result === 'invalid') {
        useCrmStore.getState().logout()
      }
    })
  } else {
    // No saved session — mark hydration as complete
    useCrmStore.setState({ hydrating: false })
  }
}

// ===== Utility Functions =====
export function isValidSaudiPhone(p: string): boolean {
  return /^\+9665[0-9]{8}$/.test(p)
}

export function formatDate(ts: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatTime(ts: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}

export function formatRelativeTime(ts: number | null): string {
  if (!ts) return ''
  const now = Date.now()
  const diff = now - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  if (days < 7) return `منذ ${days} يوم`
  return formatDate(ts)
}

export function getDateRange(
  preset: string,
  customFrom?: string,
  customTo?: string
): { from: number; to: number } {
  // Use Egypt timezone (UTC+2) for consistent business-day boundaries
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let from: Date, to: Date

  switch (preset) {
    case 'today':
      from = today
      to = new Date(today.getTime() + 86400000)
      break
    case 'yesterday':
      from = new Date(today.getTime() - 86400000)
      to = today
      break
    case 'week': {
      const dayOfWeek = today.getDay()
      const daysSinceSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1
      from = new Date(today.getTime() - daysSinceSaturday * 86400000)
      to = new Date(today.getTime() + 86400000)
      break
    }
    case 'month': {
      // Month starts from day 1 to end of month
      from = new Date(today.getFullYear(), today.getMonth(), 1)
      to = new Date(today.getFullYear(), today.getMonth() + 1, 1) // first day of next month
      break
    }
    case '3months': {
      // 3 months: from 2 months ago day 1 to end of current month
      from = new Date(today.getFullYear(), today.getMonth() - 2, 1)
      to = new Date(today.getFullYear(), today.getMonth() + 1, 1) // first day of next month
      break
    }
    case 'custom':
      from = customFrom ? new Date(customFrom) : new Date(today.getFullYear(), today.getMonth(), 1)
      to = customTo ? new Date(new Date(customTo).getTime() + 86400000) : new Date(today.getTime() + 86400000)
      break
    default:
      from = new Date(0)
      to = new Date(now.getTime() + 86400000)
  }

  return { from: from.getTime(), to: to.getTime() }
}
