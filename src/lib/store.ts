import { create } from 'zustand'
import type { Lead } from './supabase'

// ===== Contact Results =====
export const CONTACT_RESULTS = [
  { key: 'none', label: '—', color: 'text-muted-foreground' },
  { key: 'replied', label: '✅ رد', color: 'text-emerald-400' },
  { key: 'no-reply', label: '📵 مردش', color: 'text-amber-400' },
  { key: 'whatsapp', label: '💬 واتس', color: 'text-green-400' },
  { key: 'busy', label: '🔴 مشغول', color: 'text-muted-foreground' },
  { key: 'wrong-number', label: '❌ رقم غلط', color: 'text-red-400' },
  { key: 'callback', label: '🔄 اعادة اتصال', color: 'text-amber-400' },
  { key: 'not-interested', label: '🚫 غير مهتم', color: 'text-red-400' },
]

// ===== Tele Sheet Statuses =====
export const STATUSES = [
  { key: 'new', label: '🆕 جديد', cls: 'status-new' },
  { key: 'no-reply', label: '📵 لم يرد', cls: 'status-noreply' },
  { key: 'whatsapp', label: '💬 واتس', cls: 'status-followup' },
  { key: 'followup', label: '🔄 متابعة', cls: 'status-followup' },
  { key: 'meeting-done', label: '✅ اجتماع تم', cls: 'status-done' },
  { key: 'objection-price', label: '💰 غالي', cls: 'status-objection' },
  { key: 'objection-other', label: '⚠️ اعتراض', cls: 'status-objection' },
  { key: 'proposal-sent', label: '📤 عرض سعر', cls: 'status-followup' },
  { key: 'negotiation', label: '🤝 تفاوض', cls: 'status-followup' },
  { key: 'closed-won', label: '🏆 تقفيل', cls: 'status-closed-win' },
  { key: 'closed-lost', label: '❌ خسارة', cls: 'status-closed-lost' },
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
  | 'meetings'
  | 'sales-sheet'
  | 'customers-status'
  | 'daily-report'
  | 'my-archive'
  | 'bulk-add'
  | 'admin'
  | 'employee-profile'

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
  loading: boolean
  setLeads: (leads: Lead[]) => void
  setArchivedLeads: (leads: Lead[]) => void
  setTeam: (team: { tele: string[]; sales: string[]; admin: string[] }) => void
  setDataLoaded: (loaded: boolean) => void
  setLoading: (loading: boolean) => void

  // Actions
  login: (user: string, role: 'tele' | 'sales' | 'admin') => void
  logout: () => void
  updateLeadInCache: (id: string, updates: Partial<Lead>) => void
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
  if (typeof window === 'undefined') return { currentUser: null, currentRole: null, isAuthenticated: false }
  try {
    const stored = localStorage.getItem('venom-auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.currentUser && parsed.currentRole) {
        return { currentUser: parsed.currentUser, currentRole: parsed.currentRole, isAuthenticated: true }
      }
    }
  } catch { /* ignore */ }
  return { currentUser: null, currentRole: null, isAuthenticated: false }
}

function persistAuth(user: string | null, role: 'tele' | 'sales' | 'admin' | null) {
  if (typeof window === 'undefined') return
  try {
    if (user && role) {
      localStorage.setItem('venom-auth', JSON.stringify({ currentUser: user, currentRole: role }))
    } else {
      localStorage.removeItem('venom-auth')
    }
  } catch { /* ignore */ }
}

// ===== Store Implementation =====
export const useCrmStore = create<CrmStore>((set, get) => ({
  // Auth (starts as logged out, will hydrate from localStorage on client)
  currentUser: null,
  currentRole: null,
  isAuthenticated: false,

  // Navigation
  currentView: 'login',
  setCurrentView: (view) => set({ currentView: view }),

  // Data
  leads: [],
  archivedLeads: [],
  leadsById: {},
  leadsVersion: 0,
  team: DEFAULT_TEAM,
  dataLoaded: false,
  loading: false,
  setLeads: (leads) => {
    const seen = new Set<string>()
    const deduped = leads.filter((l: Lead) => {
      if (seen.has(l.id)) return false
      seen.add(l.id)
      return true
    })
    // BUG FIX: Use compareIds instead of a.id - b.id for proper sorting
    deduped.sort((a, b) => compareIds(a.id, b.id))
    const leadsById: Record<string, Lead> = {}
    deduped.forEach((l: Lead) => { leadsById[l.id] = l })
    set({ leads: deduped, leadsById })
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
  setLoading: (loading) => set({ loading }),

  // Actions
  login: (user, role) => {
    persistAuth(user, role)
    set({ currentUser: user, currentRole: role, isAuthenticated: true, currentView: 'dashboard' })
  },
  logout: () => {
    persistAuth(null, null)
    set({
      currentUser: null,
      currentRole: null,
      isAuthenticated: false,
      currentView: 'login',
      leads: [],
      archivedLeads: [],
      leadsById: {},
      leadsVersion: 0,
      dataLoaded: false,
      activeFilter: {},
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

      const newLeadsById = { ...state.leadsById, [id]: { ...existing, ...updates } }
      let newLeads = state.leads
      let newArchivedLeads = state.archivedLeads

      if (!existing.isArchived) {
        newLeads = state.leads.map((l) => (l.id === id ? { ...l, ...updates } : l))
      } else {
        newArchivedLeads = state.archivedLeads.map((l) => (l.id === id ? { ...l, ...updates } : l))
      }

      return { leads: newLeads, archivedLeads: newArchivedLeads, leadsById: newLeadsById }
    })
  },
  addLeadToCache: (lead) => {
    if (!lead || lead.id == null) return
    set((state) => {
      if (lead.id in state.leadsById) return state

      // BUG FIX: Use compareIds for proper insertion sort
      const newLeads = [...state.leads, lead].sort((a, b) => compareIds(a.id, b.id))
      const newLeadsById = { ...state.leadsById, [lead.id]: lead }

      return { leads: newLeads, leadsById: newLeadsById, leadsVersion: state.leadsVersion + 1 }
    })
  },
  batchAddLeadsToCache: (newLeads) => {
    if (!Array.isArray(newLeads) || newLeads.length === 0) return
    set((state) => {
      let added = 0
      const updatedLeads = [...state.leads]
      let newLeadsById = { ...state.leadsById }
      for (const lead of newLeads) {
        if (!lead || lead.id == null) continue
        if (lead.id in state.leadsById) continue
        updatedLeads.push(lead)
        newLeadsById[lead.id] = lead
        added++
      }
      if (added === 0) return state
      // BUG FIX: Use compareIds for proper sorting
      updatedLeads.sort((a, b) => compareIds(a.id, b.id))
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
          if (compareIds(result[mid].id, lead.id) < 0) {
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
      newLeads.sort((a, b) => compareIds(a.id, b.id))
      newArchivedLeads.sort((a, b) => compareIds(a.id, b.id))

      set({ leads: newLeads, archivedLeads: newArchivedLeads, leadsById: newLeadsById })
    }

    return changedCount
  },
}))

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
    })
  }
}

// ===== Utility Functions =====
export function normalizePhone(input: string): string {
  if (!input) return ''
  let p = String(input).replace(/[\s\-()]/g, '')
  if (p.startsWith('+966')) return p
  if (p.startsWith('00966')) return '+' + p.substring(2)
  if (p.startsWith('966')) return '+' + p
  if (p.startsWith('05') && p.length >= 10) return '+966' + p.substring(1)
  if (p.startsWith('5') && p.length >= 9) return '+966' + p
  return p
}

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
  const now = new Date()
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
      from = new Date(today.getFullYear(), today.getMonth(), 1)
      to = new Date(today.getTime() + 86400000)
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
