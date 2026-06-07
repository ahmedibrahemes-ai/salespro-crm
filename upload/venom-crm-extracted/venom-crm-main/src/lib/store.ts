import { create } from 'zustand'
import type { Lead } from './supabase'

// ===== Contact Results =====
export const CONTACT_RESULTS = [
  { key: 'none', label: '—', color: 'text-muted-foreground' },
  { key: 'replied', label: '✅ رد', color: 'text-emerald-400' },
  { key: 'no-reply', label: '📵 مردش', color: 'text-amber-400' },
  { key: 'whatsapp', label: '💬 واتس', color: 'text-venom' },
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
  { key: 'new', label: '🆕 جديد', cls: 'bg-venom/20 text-venom' },
  { key: 'contacted', label: '📞 تم التواصل', cls: 'bg-venom/20 text-venom' },
  { key: 'followup', label: '🔄 متابعة', cls: 'bg-amber-500/20 text-amber-400' },
  { key: 'meeting-done', label: '✅ اجتماع تم', cls: 'bg-emerald-500/20 text-emerald-400' },
  { key: 'objection-price', label: '💰 اعتراض سعر', cls: 'bg-red-500/20 text-red-400' },
  { key: 'objection-other', label: '⚠️ اعتراض آخر', cls: 'bg-red-500/20 text-red-400' },
  { key: 'proposal-sent', label: '📤 عرض سعر', cls: 'bg-venom/20 text-venom' },
  { key: 'negotiation', label: '🤝 تفاوض', cls: 'bg-amber-500/20 text-amber-400' },
  { key: 'thinking', label: '🤔 يفكر', cls: 'bg-amber-500/20 text-amber-400' },
  { key: 'closed-won', label: '🏆 تم التقفيل', cls: 'bg-emerald-500/20 text-emerald-400' },
  { key: 'closed-lost', label: '❌ خسارة', cls: 'bg-red-500/20 text-red-400' },
]

// ===== Attendance Statuses =====
export const ATTENDANCE_STATUSES = [
  { key: 'pending', label: '⏳ انتظار', cls: 'bg-venom/20 text-venom' },
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
  | 'telegram'

// ===== Telegram Config =====
export interface TelegramConfig {
  botToken: string
  groupChatId: string
  salesChats: Record<string, string> // salesName → chatId
}

// ===== Rating Config =====
export interface RatingConfig {
  thresholds: {
    excellent: number
    good: number
    average: number
    poor: number
  }
  labels: {
    excellent: string
    good: string
    average: string
    poor: string
  }
}

export const DEFAULT_RATING_CONFIG: RatingConfig = {
  thresholds: { excellent: 80, good: 60, average: 40, poor: 20 },
  labels: { excellent: 'ممتاز', good: 'جيد', average: 'متوسط', poor: 'ضعيف' },
}

// ===== Toast =====
export interface CrmToast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
  createdAt: number
}

// ===== Bulk Entry Row =====
export interface BulkEntryRow {
  id: string
  storeUrl: string
  phone: string
  customerName: string
  customerType: string
  brief: string
  contactResult: string
  tele: string
  sales: string
  status: string
}

// ===== Date Range Filter =====
export interface DateRangeFilter {
  preset: string // 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'
  customFrom?: string
  customTo?: string
}

const DEFAULT_DATE_RANGE: DateRangeFilter = { preset: 'all' }

// ===== Admin Sub-tab =====
export type AdminTab =
  | 'overview'
  | 'reports'
  | 'sheets-control'
  | 'tele'
  | 'sales'
  | 'all-leads'
  | 'archive'
  | 'excel-sync'
  | 'team'
  | 'permissions'
  | 'commissions'
  | 'rating'
  | 'settings'

// ===== Duplicate Cache Entry =====
export interface DuplicateInfo {
  originalId: string
  duplicateIds: string[]
}

// ===== Store Interface =====
// NOTE: Using plain objects/arrays instead of Map/Set to avoid Immer compatibility issues.
// Immer's MapSet plugin is not enabled by default, and Zustand's shallow comparison
// can trigger Immer internally, causing "[Immer] minified error nr: 0" errors.
interface CrmStore {
  // Auth
  currentUser: string | null
  currentRole: 'tele' | 'sales' | 'admin' | null
  isAuthenticated: boolean

  // Navigation
  currentView: ViewName
  setCurrentView: (view: ViewName) => void

  // Data — using Record instead of Map for Immer compatibility
  leads: Lead[]
  archivedLeads: Lead[]
  leadsById: Record<string, Lead>
  leadsVersion: number // Incremented only on add/remove, not on update
  team: { tele: string[]; sales: string[]; admin: string[] }
  dataLoaded: boolean
  setLeads: (leads: Lead[]) => void
  setArchivedLeads: (leads: Lead[]) => void
  setTeam: (team: { tele: string[]; sales: string[]; admin: string[] }) => void
  setDataLoaded: (loaded: boolean) => void

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

  // ===== Permissions =====
  teleAccess: Record<string, string[]> // username → list of tele usernames they can view
  salesAccess: Record<string, string[]> // username → list of sales usernames they can view
  setTeleAccess: (access: Record<string, string[]>) => void
  setSalesAccess: (access: Record<string, string[]>) => void
  canAccessTeleSheet: (viewer: string, target: string) => boolean
  canAccessSalesSheet: (viewer: string, target: string) => boolean
  getAccessibleTeleSheets: (viewer: string) => string[]
  getAccessibleSalesSheets: (viewer: string) => string[]

  // ===== Telegram Config =====
  telegramConfig: TelegramConfig
  setTelegramConfig: (config: TelegramConfig) => void

  // ===== Rating Config =====
  ratingConfig: RatingConfig
  setRatingConfig: (config: RatingConfig) => void

  // ===== Settings =====
  settings: Record<string, unknown>
  setSetting: (key: string, value: unknown) => void
  getSetting: (key: string) => unknown

  // ===== Toast Notifications =====
  toasts: CrmToast[]
  addToast: (type: CrmToast['type'], message: string, duration?: number) => void
  removeToast: (id: string) => void
  clearToasts: () => void

  // ===== View-Specific State =====
  // Active filter per view
  activeFilter: Record<string, string>
  setActiveFilter: (viewKey: string, filter: string) => void

  // Selected lead IDs per view — using number[] instead of Set<number> for Immer compatibility
  selectedLeadIds: Record<string, string[]>
  toggleLeadSelection: (viewKey: string, id: string) => void
  setSelectedLeadIds: (viewKey: string, ids: string[]) => void
  clearSelectedLeadIds: (viewKey: string) => void
  selectAllLeads: (viewKey: string, ids: string[]) => void

  // Search queries per view
  searchQueries: Record<string, string>
  setSearchQuery: (viewKey: string, query: string) => void

  // Date range filters per view
  dateRangeFilters: Record<string, DateRangeFilter>
  setDateRangeFilter: (viewKey: string, filter: DateRangeFilter) => void

  // ===== Admin Sub-tab =====
  adminTab: AdminTab
  setAdminTab: (tab: AdminTab) => void

  // ===== Bulk Entry Rows =====
  bulkEntryRows: BulkEntryRow[]
  setBulkEntryRows: (rows: BulkEntryRow[]) => void
  addBulkEntryRow: (row: BulkEntryRow) => void
  removeBulkEntryRow: (id: string) => void
  updateBulkEntryRow: (id: string, updates: Partial<BulkEntryRow>) => void
  clearBulkEntryRows: () => void

  // ===== Duplicate Detection Cache — using Record instead of Map for Immer compatibility
  duplicatesCache: Record<string, DuplicateInfo>
  duplicatesVersion: number // Incremented when phone-related changes need cache rebuild
  setDuplicatesCache: (cache: Record<string, DuplicateInfo>) => void
  buildDuplicatesCache: (leads: Lead[]) => void
  getDuplicateInfo: (phone: string) => DuplicateInfo | undefined
  incrementDuplicatesVersion: () => void

  // ===== Real-time Sync Status =====
  realtimeStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  setRealtimeStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
  lastSyncAt: number | null
  setLastSyncAt: (ts: number) => void
  syncChangesToCache: (freshLeads: Lead[], freshArchived: Lead[]) => number // returns count of changed leads
}

// ===== Toast auto-dismiss timers =====
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()
let toastCounter = 0

// ===== Store Implementation =====
export const useCrmStore = create<CrmStore>((set, get) => ({
  // Auth
  currentUser: null,
  currentRole: null,
  isAuthenticated: false,

  // Navigation
  currentView: 'login',
  setCurrentView: (view) => set({ currentView: view }),

  // Data — plain objects instead of Map
  leads: [],
  archivedLeads: [],
  leadsById: {},
  leadsVersion: 0,
  team: DEFAULT_TEAM,
  dataLoaded: false,
  setLeads: (leads) => {
    // Deduplicate by ID (safety net: prevents duplicate entries from realtime race conditions)
    const seen = new Set<string>()
    const deduped = leads.filter((l: Lead) => {
      if (seen.has(l.id)) return false
      seen.add(l.id)
      return true
    })
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

  // Actions
  login: (user, role) => {
    set({ currentUser: user, currentRole: role, isAuthenticated: true, currentView: 'dashboard' })
  },
  logout: () => {
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
      bulkEntryRows: [],
      duplicatesCache: {},
      duplicatesVersion: 0,
      realtimeStatus: 'connecting',
      lastSyncAt: null,
    })
  },
  updateLeadInCache: (id, updates) => {
    set((state) => {
      // O(1) lookup using leadsById instead of O(n) .some() scans
      const existing = state.leadsById[id]
      if (!existing) return state // Lead not in cache, nothing to update

      const newLeadsById = { ...state.leadsById, [id]: { ...existing, ...updates } }

      // Only .map() the array that actually contains the lead
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
    if (!lead || lead.id == null) {
      console.warn('[addLeadToCache] Skipping lead with null/undefined id:', lead)
      return
    }
    set((state) => {
      // Skip if lead already exists in cache (e.g., from real-time subscription)
      if (lead.id in state.leadsById) return state // Return same state = no re-render

      // Insert in id-sorted position to maintain stable order
      const newLeads = [...state.leads, lead].sort((a, b) => a.id - b.id)
      const newLeadsById = { ...state.leadsById, [lead.id]: lead }

      return { leads: newLeads, leadsById: newLeadsById, leadsVersion: state.leadsVersion + 1 }
    })
  },
  batchAddLeadsToCache: (newLeads) => {
    if (!Array.isArray(newLeads) || newLeads.length === 0) return
    set((state) => {
      let added = 0
      let skipped = 0
      const updatedLeads = [...state.leads]
      let newLeadsById = { ...state.leadsById }
      for (const lead of newLeads) {
        if (!lead || lead.id == null) {
          console.warn('[batchAddLeadsToCache] Skipping lead with null/undefined id:', lead)
          skipped++
          continue
        }
        if (lead.id in state.leadsById) {
          skipped++
          continue // Skip duplicates
        }
        updatedLeads.push(lead)
        newLeadsById[lead.id] = lead
        added++
      }
      console.log(`[batchAddLeadsToCache] Input: ${newLeads.length}, Added: ${added}, Skipped: ${skipped}, Cache total: ${updatedLeads.length}`)
      if (added === 0) return state
      // Sort by id ASC to maintain stable order
      updatedLeads.sort((a, b) => a.id - b.id)
      return { leads: updatedLeads, leadsById: newLeadsById, leadsVersion: state.leadsVersion + 1 }
    })
  },
  removeLeadFromCache: (id) => {
    set((state) => {
      // O(1) check using leadsById to determine which array the lead is in
      const existing = state.leadsById[id]
      if (!existing) return state

      const { [id]: _removed, ...restLeadsById } = state.leadsById

      // Only filter the array that actually contains the lead
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
      for (const id of ids) {
        delete newLeadsById[id]
      }
      // Filter both arrays in a single pass each
      const newLeads = state.leads.filter((l) => !idsSet.has(l.id))
      const newArchivedLeads = state.archivedLeads.filter((l) => !idsSet.has(l.id))
      return {
        leads: newLeads,
        archivedLeads: newArchivedLeads,
        leadsById: newLeadsById,
        leadsVersion: state.leadsVersion + 1,
      }
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

      // Partition active leads: move matching ones to archived
      for (const l of state.leads) {
        if (idsSet.has(l.id)) {
          const archived: Lead = {
            ...l,
            isArchived: true,
            archivedAt: now,
            archivedBy: byName,
          }
          movedLeads.push(archived)
          newLeadsById[l.id] = archived
        } else {
          remainingLeads.push(l)
        }
      }

      const newArchivedLeads = [...state.archivedLeads, ...movedLeads]

      return {
        leads: remainingLeads,
        archivedLeads: newArchivedLeads,
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

      // Partition archived leads: move matching ones to active
      for (const l of state.archivedLeads) {
        if (idsSet.has(l.id)) {
          const unarchived: Lead = {
            ...l,
            isArchived: false,
            archivedAt: null,
            archivedBy: null,
          }
          movedLeads.push(unarchived)
          newLeadsById[l.id] = unarchived
        } else {
          remainingArchived.push(l)
        }
      }

      // Insert each moved lead at the correct position using binary search on id.
      // id is auto-incrementing so it preserves the exact insertion order.
      // This keeps existing leads in place and puts unarchived leads back where they belong.
      const result = [...state.leads]
      for (const lead of movedLeads) {
        // Binary search: find the insertion index where result[i].id > lead.id
        let lo = 0
        let hi = result.length
        while (lo < hi) {
          const mid = (lo + hi) >>> 1
          if (result[mid].id < lead.id) {
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

  // ===== Permissions =====
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

  // ===== Telegram Config =====
  telegramConfig: { botToken: '', groupChatId: '', salesChats: {} },
  setTelegramConfig: (config) => set({ telegramConfig: config }),

  // ===== Rating Config =====
  ratingConfig: DEFAULT_RATING_CONFIG,
  setRatingConfig: (config) => set({ ratingConfig: config }),

  // ===== Settings =====
  settings: {},
  setSetting: (key, value) =>
    set((s) => ({ settings: { ...s.settings, [key]: value } })),
  getSetting: (key) => get().settings[key],

  // ===== Toast Notifications =====
  toasts: [],
  addToast: (type, message, duration = 4000) => {
    const id = `toast-${++toastCounter}-${Date.now()}`
    const toast: CrmToast = {
      id,
      type,
      message,
      duration,
      createdAt: Date.now(),
    }
    set((s) => ({ toasts: [...s.toasts, toast] }))

    // Auto-dismiss
    if (duration > 0) {
      const timer = setTimeout(() => {
        get().removeToast(id)
      }, duration)
      toastTimers.set(id, timer)
    }
  },
  removeToast: (id) => {
    const timer = toastTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      toastTimers.delete(id)
    }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
  clearToasts: () => {
    toastTimers.forEach((timer) => clearTimeout(timer))
    toastTimers.clear()
    set({ toasts: [] })
  },

  // ===== View-Specific State =====
  activeFilter: {},
  setActiveFilter: (viewKey, filter) =>
    set((s) => ({ activeFilter: { ...s.activeFilter, [viewKey]: filter } })),

  selectedLeadIds: {},
  toggleLeadSelection: (viewKey, id) =>
    set((s) => {
      const current = s.selectedLeadIds[viewKey] || []
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
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

  // ===== Admin Sub-tab =====
  adminTab: 'overview',
  setAdminTab: (tab) => set({ adminTab: tab }),

  // ===== Bulk Entry Rows =====
  bulkEntryRows: [],
  setBulkEntryRows: (rows) => set({ bulkEntryRows: rows }),
  addBulkEntryRow: (row) => set((s) => ({ bulkEntryRows: [...s.bulkEntryRows, row] })),
  removeBulkEntryRow: (id) =>
    set((s) => ({ bulkEntryRows: s.bulkEntryRows.filter((r) => r.id !== id) })),
  updateBulkEntryRow: (id, updates) =>
    set((s) => ({
      bulkEntryRows: s.bulkEntryRows.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),
  clearBulkEntryRows: () => set({ bulkEntryRows: [] }),

  // ===== Duplicate Detection Cache — plain object instead of Map
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

  // ===== Real-time Sync Status =====
  realtimeStatus: 'connecting',
  setRealtimeStatus: (status) => set({ realtimeStatus: status }),
  lastSyncAt: null,
  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),
  syncChangesToCache: (freshLeads, freshArchived) => {
    const state = get()
    let changedCount = 0
    const newLeadsById = { ...state.leadsById }

    // Build a map of fresh leads for O(1) lookup
    const freshMap = new Map<number, Lead>()
    for (const l of freshLeads) freshMap.set(l.id, l)
    for (const l of freshArchived) freshMap.set(l.id, l)

    // Compare each fresh lead with the cached version
    for (const [id, freshLead] of freshMap) {
      const cached = state.leadsById[id]
      if (!cached) {
        // New lead not in cache — add it
        newLeadsById[id] = freshLead
        changedCount++
        continue
      }

      // Check if any field changed (quick comparison)
      const priorityFields: (keyof Lead)[] = [
        'attended', 'attendanceMarkedAt', 'attendanceMarkedBy',
        'sales', 'salesStatus', 'status', 'meetingDate', 'meetingTime',
        'isArchived', 'cancelledFrom', 'cancelledAt', 'assignedAt',
      ]
      let hasChange = false
      for (const field of priorityFields) {
        if (cached[field] !== freshLead[field]) {
          hasChange = true
          break
        }
      }

      if (hasChange) {
        newLeadsById[id] = { ...cached, ...freshLead, notes: cached.notes } // preserve notes from cache
        changedCount++
      }
    }

    if (changedCount > 0) {
      // Rebuild leads and archivedLeads arrays.
      const existingLeadIds = new Set(state.leads.map((l) => l.id))
      const existingArchivedIds = new Set(state.archivedLeads.map((l) => l.id))

      const newLeads = state.leads.map((l) => newLeadsById[l.id] || l)
      const newArchivedLeads = state.archivedLeads.map((l) => newLeadsById[l.id] || l)

      // Append new leads that aren't in the existing arrays
      for (const [id, lead] of Object.entries(newLeadsById)) {
        const numId = Number(id)
        if (!existingLeadIds.has(numId) && !existingArchivedIds.has(numId) && !lead.isArchived) {
          newLeads.push(lead)
        }
      }

      // Sort by id ASC to guarantee stable order — new leads appended above
      // may have ids that should be in the middle of the array, not at the end.
      newLeads.sort((a, b) => a.id - b.id)
      newArchivedLeads.sort((a, b) => a.id - b.id)

      set({
        leads: newLeads,
        archivedLeads: newArchivedLeads,
        leadsById: newLeadsById,
      })
    }

    return changedCount
  },
}))

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
      // Current calendar week (Saturday to Friday for Saudi/Egypt calendar)
      // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
      // In Saudi/Egypt calendar, week starts Saturday (6)
      const dayOfWeek = today.getDay()
      // Days since Saturday: Sat=0, Sun=1, Mon=2, ..., Fri=6
      const daysSinceSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1
      from = new Date(today.getTime() - daysSinceSaturday * 86400000)
      to = new Date(today.getTime() + 86400000)
      break
    }
    case 'month': {
      // Current calendar month: 1st of month to end of today
      from = new Date(today.getFullYear(), today.getMonth(), 1)
      to = new Date(today.getTime() + 86400000)
      break
    }
    case 'custom':
      from = customFrom ? new Date(customFrom) : new Date(today.getFullYear(), today.getMonth(), 1)
      to = customTo ? new Date(new Date(customTo).getTime() + 86400000) : new Date(today.getTime() + 86400000)
      break
    default: // 'all'
      from = new Date(0)
      to = new Date(now.getTime() + 86400000)
  }

  return { from: from.getTime(), to: to.getTime() }
}

export function getCommissionSettings() {
  return {
    perAttendance: 50,
    perClosedDeal: 200,
    currency: 'ريال',
  }
}

export function getAllLeadsForAnalytics(leads: Lead[], archivedLeads: Lead[]): Lead[] {
  return [...leads, ...archivedLeads]
}

// ===== Rating Helper =====
export function getRatingLabel(score: number, config?: RatingConfig): string {
  const c = config || DEFAULT_RATING_CONFIG
  if (score >= c.thresholds.excellent) return c.labels.excellent
  if (score >= c.thresholds.good) return c.labels.good
  if (score >= c.thresholds.average) return c.labels.average
  return c.labels.poor
}

export function getRatingColor(score: number, config?: RatingConfig): string {
  const c = config || DEFAULT_RATING_CONFIG
  if (score >= c.thresholds.excellent) return 'text-emerald-400'
  if (score >= c.thresholds.good) return 'text-venom'
  if (score >= c.thresholds.average) return 'text-amber-400'
  return 'text-red-400'
}
