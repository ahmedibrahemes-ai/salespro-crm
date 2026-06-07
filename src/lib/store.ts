import { create } from 'zustand'

// ===== Pipeline Stages =====
export const PIPELINE_STAGES = [
  { key: 'new', label: 'ليد جديد', labelEn: 'New Lead', color: '#6c9fff', bg: 'rgba(108,159,255,.12)' },
  { key: 'contacted', label: 'تم التواصل', labelEn: 'Contacted', color: '#6c63ff', bg: 'rgba(108,99,255,.12)' },
  { key: 'qualified', label: 'مؤهل', labelEn: 'Qualified', color: '#ffd166', bg: 'rgba(255,209,102,.12)' },
  { key: 'proposal', label: 'عرض سعر', labelEn: 'Proposal', color: '#00d4aa', bg: 'rgba(0,212,170,.1)' },
  { key: 'negotiation', label: 'تفاوض', labelEn: 'Negotiation', color: '#ff6b6b', bg: 'rgba(255,107,107,.12)' },
  { key: 'won', label: 'تم الإغلاق ✓', labelEn: 'Won', color: '#00d4aa', bg: 'rgba(0,212,170,.15)' },
  { key: 'lost', label: 'خسارة', labelEn: 'Lost', color: '#ff4d4d', bg: 'rgba(255,77,77,.12)' },
]

export const LEAD_SOURCES = [
  { key: 'meta-ads', label: 'Meta Ads' },
  { key: 'google-ads', label: 'Google Ads' },
  { key: 'website', label: 'Website' },
  { key: 'referral', label: 'Referral' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'cold-call', label: 'Cold Call' },
]

export const LOST_REASONS = [
  { key: 'price', label: 'السعر' },
  { key: 'slow-response', label: 'بطء الرد' },
  { key: 'competitor', label: 'منافس' },
  { key: 'no-budget', label: 'ميزانية غير كافية' },
  { key: 'no-response', label: 'عدم رد' },
]

// ===== View Types =====
export type ViewName =
  | 'overview'
  | 'leads'
  | 'pipeline'
  | 'followup'
  | 'whatsapp'
  | 'ai'
  | 'team'
  | 'client360'
  | 'reports'

// ===== Lead Interface =====
export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  source: string
  status: string
  value: number
  probability: number
  hot: boolean
  notes: string
  assignedTo: string
  company: string
  location: string
  isArchived: boolean
  lastContactAt: string
  nextFollowUp: string | null
  followUpType: string
  lostReason: string
  createdAt: string
  updatedAt: string
  activities?: Activity[]
  messages?: ChatMessage[]
}

export interface Activity {
  id: string
  leadId: string
  type: string
  text: string
  score: number
  duration: number
  createdAt: string
}

export interface TeamMember {
  id: string
  name: string
  nameAr: string
  role: string
  initials: string
  points: number
  deals: number
  revenue: number
  calls: number
  convRate: number
  avatar: string
  badges: string
}

export interface ChatMessage {
  id: string
  leadId: string
  fromMe: boolean
  text: string
  read: boolean
  createdAt: string
}

export interface Stats {
  totalLeads: number
  totalCalls: number
  closedDeals: number
  salesValue: number
  conversionRate: number
  leadsToday: number
  callsToday: number
  dealsToday: number
  pipelineValue: number
  avgDealValue: number
  avgCycleDays: number
  cac: number
  roi: number
  targetAmount: number
  achievedAmount: number
  hotCount: number
  warmCount: number
  coldCount: number
  overdueCount: number
  sourceBreakdown: Record<string, number>
  lostReasonBreakdown: Record<string, number>
  weeklyCalls: { day: string; count: number }[]
  callAnalytics: { totalMinutes: number; successCount: number; failCount: number; avgDuration: string }
  aiScore: number
}

// ===== Store Interface =====
interface CrmStore {
  // Navigation
  currentView: ViewName
  setCurrentView: (view: ViewName) => void

  // Data
  leads: Lead[]
  setLeads: (leads: Lead[]) => void
  team: TeamMember[]
  setTeam: (team: TeamMember[]) => void
  stats: Stats | null
  setStats: (stats: Stats) => void
  selectedLeadId: string | null
  setSelectedLeadId: (id: string | null) => void

  // UI
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void
  leadFilter: string
  setLeadFilter: (filter: string) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  addLeadDialogOpen: boolean
  setAddLeadDialogOpen: (open: boolean) => void

  // Loading
  loading: boolean
  setLoading: (loading: boolean) => void
  dataLoaded: boolean
  setDataLoaded: (loaded: boolean) => void

  // Actions
  addLead: (lead: Lead) => void
  updateLead: (id: string, updates: Partial<Lead>) => void
  removeLead: (id: string) => void
}

// ===== Store Implementation =====
export const useCrmStore = create<CrmStore>((set) => ({
  // Navigation
  currentView: 'overview',
  setCurrentView: (view) => set({ currentView: view }),

  // Data
  leads: [],
  setLeads: (leads) => set({ leads }),
  team: [],
  setTeam: (team) => set({ team }),
  stats: null,
  setStats: (stats) => set({ stats }),
  selectedLeadId: null,
  setSelectedLeadId: (id) => set({ selectedLeadId: id }),

  // UI
  sidebarExpanded: false,
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
  leadFilter: 'all',
  setLeadFilter: (filter) => set({ leadFilter: filter }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  addLeadDialogOpen: false,
  setAddLeadDialogOpen: (open) => set({ addLeadDialogOpen: open }),

  // Loading
  loading: false,
  setLoading: (loading) => set({ loading }),
  dataLoaded: false,
  setDataLoaded: (loaded) => set({ dataLoaded: loaded }),

  // Actions
  addLead: (lead) => set((s) => ({ leads: [...s.leads, lead] })),
  updateLead: (id, updates) => set((s) => ({
    leads: s.leads.map((l) => l.id === id ? { ...l, ...updates } : l),
  })),
  removeLead: (id) => set((s) => ({
    leads: s.leads.filter((l) => l.id !== id),
  })),
}))

// ===== Utility Functions =====
export function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`
  }
  return value.toLocaleString()
}

export function formatCurrencyFull(value: number): string {
  return value.toLocaleString('en-US')
}

export function getInitials(name: string): string {
  if (!name) return '؟'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    // Arabic: take first letter of each of first two words
    return parts[0][0] + parts[1][0]
  }
  return name.substring(0, 2)
}

export function getStatusColor(status: string): { color: string; bg: string } {
  const stage = PIPELINE_STAGES.find((s) => s.key === status)
  return stage ? { color: stage.color, bg: stage.bg } : { color: '#8892b0', bg: 'rgba(136,146,176,.12)' }
}

export function getSourceLabel(source: string): string {
  const s = LEAD_SOURCES.find((ls) => ls.key === source)
  return s ? s.label : source
}

export function getLostReasonLabel(reason: string): string {
  const r = LOST_REASONS.find((l) => l.key === reason)
  return r ? r.label : reason
}

export function getTemperatureLabel(lead: Lead): { label: string; color: string; bg: string } {
  if (lead.status === 'won') return { label: 'Won', color: '#00d4aa', bg: 'rgba(0,212,170,.15)' }
  if (lead.status === 'lost') return { label: 'Lost', color: '#ff4d4d', bg: 'rgba(255,77,77,.15)' }
  if (lead.hot) return { label: 'Hot 🔥', color: '#ff6b6b', bg: 'rgba(255,107,107,.15)' }
  if (lead.probability >= 50) return { label: 'Warm', color: '#ffd166', bg: 'rgba(255,209,102,.15)' }
  return { label: 'Cold', color: '#6c9fff', bg: 'rgba(108,159,255,.15)' }
}

export function isOverdue(lead: Lead): boolean {
  if (!lead.nextFollowUp) return false
  return new Date(lead.nextFollowUp) < new Date() && lead.status !== 'won' && lead.status !== 'lost'
}

export function isToday(date: string | null): boolean {
  if (!date) return false
  const d = new Date(date)
  const today = new Date()
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
}

export function getDaysSince(date: string): number {
  const d = new Date(date)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}
