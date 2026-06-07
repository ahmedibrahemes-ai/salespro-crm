'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  BarChart3,
  Users,
  Phone,
  Calendar,
  Trophy,
  Shield,
  Settings,
  Key,
  DollarSign,
  TrendingUp,
  Search,
  Download,
  Eye,
  UserPlus,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRightLeft,
  Archive,
  Clock,
  UserCheck,
  Upload,
  FileSpreadsheet,
  Star,
  Zap,
  RotateCcw,
  Database,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  RefreshCw,
  CheckSquare,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import {
  useCrmStore,
  CONTACT_RESULTS,
  SALES_STATUSES,
  STATUSES,
  ATTENDANCE_STATUSES,
  formatDate,
  formatRelativeTime,
  getDateRange,
  getAllLeadsForAnalytics,
  getRatingLabel,
  getRatingColor,
  DEFAULT_RATING_CONFIG,
  normalizePhone,
} from '@/lib/store'
import type { AdminTab } from '@/lib/store'
import {
  apiGetTeam,
  apiAddTeamMember,
  apiRemoveTeamMember,
  apiRenameTeamMember,
  apiGetSetting,
  apiSaveSetting,
  apiUpdateLead,
  apiDeleteLead,
  apiDeleteLeadsBulk,
  apiArchiveLeads,
  apiUnarchiveLeads,
  apiBulkCreateLeads,
  apiCreateLead,
  apiGetLeads,
  apiGetArchivedLeads,
  apiCheckDuplicatePhones,
} from '@/lib/supabase'
import type { Lead } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

// ===== Tab Config =====
const ADMIN_TABS: { key: AdminTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'نظرة عامة', icon: Shield },
  { key: 'reports', label: 'التقارير', icon: BarChart3 },
  { key: 'sheets-control', label: 'إدارة الشيتات', icon: FileSpreadsheet },
  { key: 'tele', label: 'التيلي سيلز', icon: Phone },
  { key: 'sales', label: 'السيلز', icon: TrendingUp },
  { key: 'all-leads', label: 'كل الـ Leads', icon: Users },
  { key: 'archive', label: 'الأرشيف', icon: Archive },
  { key: 'excel-sync', label: 'Excel', icon: FileSpreadsheet },
  { key: 'team', label: 'إدارة الفريق', icon: UserPlus },
  { key: 'permissions', label: 'الصلاحيات', icon: Key },
  { key: 'commissions', label: 'الكوميشن', icon: DollarSign },
  { key: 'rating', label: 'التقييم', icon: Star },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

// ===== Helpers =====
function isToday(ts: number | null): boolean {
  if (!ts) return false
  const d = new Date(ts)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isThisWeek(ts: number | null): boolean {
  if (!ts) return false
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  return ts >= weekAgo.getTime()
}

function isThisMonth(ts: number | null): boolean {
  if (!ts) return false
  const d = new Date(ts)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ===== Main Component =====
export function AdminPanel() {
  const {
    currentUser, currentRole, leads, archivedLeads, team,
    setLeads, setArchivedLeads, setTeam, addToast,
    adminTab, setAdminTab,
    teleAccess, salesAccess, setTeleAccess, setSalesAccess,
    ratingConfig, setRatingConfig,
    settings, setSetting,
    removeLeadFromCache, batchRemoveLeadsFromCache,
    unarchiveLeadsInCache, addLeadToCache, batchAddLeadsToCache,
  } = useCrmStore(useShallow((s) => ({
    currentUser: s.currentUser,
    currentRole: s.currentRole,
    leads: s.leads,
    archivedLeads: s.archivedLeads,
    team: s.team,
    setLeads: s.setLeads,
    setArchivedLeads: s.setArchivedLeads,
    setTeam: s.setTeam,
    addToast: s.addToast,
    adminTab: s.adminTab,
    setAdminTab: s.setAdminTab,
    teleAccess: s.teleAccess,
    salesAccess: s.salesAccess,
    setTeleAccess: s.setTeleAccess,
    setSalesAccess: s.setSalesAccess,
    ratingConfig: s.ratingConfig,
    setRatingConfig: s.setRatingConfig,
    settings: s.settings,
    setSetting: s.setSetting,
    removeLeadFromCache: s.removeLeadFromCache,
    batchRemoveLeadsFromCache: s.batchRemoveLeadsFromCache,
    unarchiveLeadsInCache: s.unarchiveLeadsInCache,
    addLeadToCache: s.addLeadToCache,
    batchAddLeadsToCache: s.batchAddLeadsToCache,
  })))

  const allLeads = useMemo(() => getAllLeadsForAnalytics(leads, archivedLeads), [leads, archivedLeads])

  // Reload data helper
  const reloadData = useCallback(async () => {
    try {
      const [active, archived] = await Promise.all([apiGetLeads(false), apiGetArchivedLeads().catch(() => [])])
      setLeads(active)
      setArchivedLeads(archived)
    } catch (e) {
      console.error('Failed to reload data', e)
    }
  }, [setLeads, setArchivedLeads])

  // Export JSON
  const handleExportJSON = useCallback(() => {
    const data = JSON.stringify({
      version: '2.0',
      exportedAt: new Date().toISOString(),
      leads,
      archivedLeads,
      team,
      teleAccess,
      salesAccess,
      ratingConfig,
      settings,
    }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `venom-crm-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    addToast('success', 'تم تصدير البيانات')
  }, [leads, archivedLeads, team, teleAccess, salesAccess, ratingConfig, settings, addToast])

  // Import JSON
  const handleImportJSON = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (!confirm('استعادة النسخة دي هتستبدل كل البيانات الحالية. متأكد؟')) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.leads) setLeads(data.leads)
        if (data.archivedLeads) setArchivedLeads(data.archivedLeads)
        if (data.team) setTeam(data.team)
        if (data.teleAccess) setTeleAccess(data.teleAccess)
        if (data.salesAccess) setSalesAccess(data.salesAccess)
        if (data.ratingConfig) setRatingConfig(data.ratingConfig)
        if (data.settings) Object.entries(data.settings).forEach(([k, v]) => setSetting(k, v))
        addToast('success', 'تم استيراد البيانات بنجاح')
      } catch {
        addToast('error', 'ملف غير صحيح')
      }
    }
    input.click()
  }, [setLeads, setArchivedLeads, setTeam, setTeleAccess, setSalesAccess, setRatingConfig, setSetting, addToast])

  // Reset all
  // ===== Destructive action protection: type-to-confirm dialog =====
  const [destructiveDialog, setDestructiveDialog] = useState<{
    open: boolean; title: string; confirmText: string; onConfirm: () => void
  }>({ open: false, title: '', confirmText: '', onConfirm: () => {} })
  const [destructiveInput, setDestructiveInput] = useState('')

  const requestDestructiveAction = useCallback((title: string, confirmText: string, onConfirm: () => void) => {
    setDestructiveInput('')
    setDestructiveDialog({ open: true, title, confirmText, onConfirm })
  }, [])

  const confirmDestructiveAction = useCallback(async () => {
    if (destructiveInput !== destructiveDialog.confirmText) return
    // Auto-backup before destructive action
    try {
      const data = JSON.stringify({
        version: '2.0',
        exportedAt: new Date().toISOString(),
        leads, archivedLeads, team,
        teleAccess, salesAccess, ratingConfig, settings,
      }, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `venom-crm-auto-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}

    setDestructiveDialog(prev => ({ ...prev, open: false }))
    destructiveDialog.onConfirm()
  }, [destructiveInput, destructiveDialog, leads, archivedLeads, team, teleAccess, salesAccess, ratingConfig, settings])

  const handleResetAll = useCallback(() => {
    requestDestructiveAction(
      '🚨 مسح كل البيانات',
      'مسح',
      async () => {
        try {
          await apiDeleteLeadsBulk(leads.map(l => l.id))
          await apiDeleteLeadsBulk(archivedLeads.map(l => l.id))
          setLeads([])
          setArchivedLeads([])
          addToast('success', 'تم مسح كل البيانات')
        } catch {
          addToast('error', 'فشل المسح')
        }
      }
    )
  }, [leads, archivedLeads, setLeads, setArchivedLeads, addToast, requestDestructiveAction])

  if (!currentUser || currentRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">صلاحية المدير مطلوبة</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header with action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-venom venom-text-glow">لوحة الإدارة</h1>
          <p className="text-xs text-muted-foreground mt-1">إدارة شاملة للنظام والفريق</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-border text-xs gap-1.5" onClick={handleExportJSON}>
            <Download className="w-3.5 h-3.5" /> تصدير JSON
          </Button>
          <Button size="sm" variant="outline" className="border-border text-xs gap-1.5" onClick={handleImportJSON}>
            <Upload className="w-3.5 h-3.5" /> استيراد
          </Button>
          <Button size="sm" variant="destructive" className="text-xs gap-1.5" onClick={handleResetAll}>
            <Trash2 className="w-3.5 h-3.5" /> مسح الكل
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-1.5">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = adminTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setAdminTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-venom text-venom-foreground border border-venom/40 shadow-sm'
                  : 'bg-card text-muted-foreground border border-border hover:border-venom/20 hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {adminTab === 'overview' && <OverviewTab leads={leads} archivedLeads={archivedLeads} allLeads={allLeads} team={team} setAdminTab={setAdminTab} />}
        {adminTab === 'reports' && <ReportsTab leads={leads} archivedLeads={archivedLeads} allLeads={allLeads} team={team} />}
        {adminTab === 'sheets-control' && <SheetsControlTab leads={leads} team={team} reloadData={reloadData} />}
        {adminTab === 'tele' && <TeleTab leads={leads} team={team} />}
        {adminTab === 'sales' && <SalesTab leads={leads} team={team} />}
        {adminTab === 'all-leads' && <AllLeadsTab leads={leads} allLeads={allLeads} />}
        {adminTab === 'archive' && <ArchiveTab archivedLeads={archivedLeads} reloadData={reloadData} />}
        {adminTab === 'excel-sync' && <ExcelSyncTab leads={leads} team={team} reloadData={reloadData} />}
        {adminTab === 'team' && <TeamTab leads={leads} team={team} setTeam={setTeam} setLeads={setLeads} setArchivedLeads={setArchivedLeads} />}
        {adminTab === 'permissions' && <PermissionsTab team={team} />}
        {adminTab === 'commissions' && <CommissionsTab leads={leads} team={team} />}
        {adminTab === 'rating' && <RatingTab />}
        {adminTab === 'settings' && <SettingsTab reloadData={reloadData} requestDestructiveAction={requestDestructiveAction} />}
      </div>

      {/* Destructive Action Confirmation Dialog */}
      <Dialog open={destructiveDialog.open} onOpenChange={(open) => { if (!open) setDestructiveDialog(prev => ({ ...prev, open: false })) }}>
        <DialogContent className="border-red-500/30">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {destructiveDialog.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              هذا الإجراء لا يمكن التراجع عنه! سيتم تنزيل نسخة احتياطية تلقائياً قبل التنفيذ.
            </p>
            <p className="text-sm font-medium">
              اكتب <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded">{destructiveDialog.confirmText}</span> للتأكيد:
            </p>
            <Input
              value={destructiveInput}
              onChange={(e) => setDestructiveInput(e.target.value)}
              placeholder={`اكتب "${destructiveDialog.confirmText}" هنا...`}
              className="bg-background border-red-500/30 focus:border-red-500"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDestructiveDialog(prev => ({ ...prev, open: false }))}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={confirmDestructiveAction}
              disabled={destructiveInput !== destructiveDialog.confirmText}
            >
              {destructiveInput === destructiveDialog.confirmText ? '⚠️ تنفيذ الإجراء' : `اكتب "${destructiveDialog.confirmText}" أولاً`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Overview Tab =====
function OverviewTab({ leads, archivedLeads, allLeads, team, setAdminTab }: {
  leads: Lead[]; archivedLeads: Lead[]; allLeads: Lead[]
  team: { tele: string[]; sales: string[]; admin: string[] }
  setAdminTab: (t: AdminTab) => void
}) {
  const total = allLeads.length
  const assigned = allLeads.filter(l => l.sales).length
  const attended = allLeads.filter(l => l.attended === 'attended').length
  const closed = allLeads.filter(l => l.salesStatus === 'closed-won').length
  const todayCount = allLeads.filter(l => isToday(l.createdAt)).length
  const weekCount = allLeads.filter(l => isThisWeek(l.createdAt)).length
  const inProgress = allLeads.filter(l => l.sales && l.salesStatus !== 'closed-won' && l.salesStatus !== 'closed-lost').length
  const pending = allLeads.filter(l => !l.sales).length
  const noShow = allLeads.filter(l => l.attended === 'no-show').length

  const quickActions = [
    { label: 'إدارة الفريق', icon: Users, tab: 'team' as AdminTab },
    { label: 'الصلاحيات', icon: Shield, tab: 'permissions' as AdminTab },
    { label: 'الكوميشن', icon: DollarSign, tab: 'commissions' as AdminTab },
    { label: 'الإعدادات', icon: Settings, tab: 'settings' as AdminTab },
    { label: 'تقارير', icon: BarChart3, tab: 'reports' as AdminTab },
    { label: 'تصدير Excel', icon: FileSpreadsheet, tab: 'excel-sync' as AdminTab },
  ]

  // Recent activity (last 10 leads)
  const recentLeads = useMemo(() => {
    return [...allLeads].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10)
  }, [allLeads])

  // Team summary
  const teleSummary = useMemo(() => {
    return team.tele.map(name => {
      const myLeads = allLeads.filter(l => l.tele === name)
      return { name, total: myLeads.length, assigned: myLeads.filter(l => l.sales).length, attended: myLeads.filter(l => l.attended === 'attended').length }
    })
  }, [team.tele, allLeads])

  const salesSummary = useMemo(() => {
    return team.sales.map(name => {
      const myLeads = allLeads.filter(l => l.sales === name)
      return { name, total: myLeads.length, attended: myLeads.filter(l => l.attended === 'attended').length, closed: myLeads.filter(l => l.salesStatus === 'closed-won').length }
    })
  }, [team.sales, allLeads])

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <h3 className="text-sm mb-3 text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> إجراءات سريعة
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {quickActions.map(qa => {
              const Icon = qa.icon
              return (
                <Button key={qa.tab} variant="outline" className="justify-start gap-2 text-xs h-10 border-border" onClick={() => setAdminTab(qa.tab)}>
                  <Icon className="w-3.5 h-3.5" /> {qa.label}
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="إجمالي Leads" value={total} color="#2a7d6e" />
        <StatBox label="تم التحويل" value={assigned} color="#8B5CF6" />
        <StatBox label="حضروا الاجتماع" value={attended} color="#10B981" />
        <StatBox label="تم التقفيل 🏆" value={closed} color="#2a7d6e" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="اليوم" value={todayCount} color="#06B6D4" />
        <StatBox label="آخر 7 أيام" value={weekCount} color="#06B6D4" />
        <StatBox label="نسبة الحضور" value={assigned ? Math.round((attended / assigned) * 100) : 0} suffix="%" color="#10B981" />
        <StatBox label="نسبة التقفيل" value={attended ? Math.round((closed / attended) * 100) : 0} suffix="%" color="#2a7d6e" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatBox label="قيد المتابعة" value={inProgress} color="#F59E0B" />
        <StatBox label="بدون سيلز" value={pending} color="#8B5CF6" />
        <StatBox label="لم يحضروا" value={noShow} color="#EF4444" />
      </div>

      {/* Team Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Phone className="w-4 h-4 text-venom" /> فريق التيلي ({team.tele.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {teleSummary.map(t => (
                <div key={t.name} className="flex items-center justify-between p-2 rounded bg-background text-xs">
                  <span className="font-medium">{t.name}</span>
                  <div className="flex gap-3 text-muted-foreground">
                    <span>{t.total} عميل</span>
                    <span className="text-emerald-400">{t.assigned} تحويل</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> فريق السيلز ({team.sales.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {salesSummary.map(s => (
                <div key={s.name} className="flex items-center justify-between p-2 rounded bg-background text-xs">
                  <span className="font-medium">{s.name}</span>
                  <div className="flex gap-3 text-muted-foreground">
                    <span>{s.total} عميل</span>
                    <span className="text-emerald-400">{s.closed} تقفيل</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-venom" /> آخر النشاطات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {recentLeads.map(l => (
              <div key={l.id} className="flex items-center justify-between p-2 rounded bg-background text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">#{l.id}</span>
                  <span className="font-medium truncate max-w-[120px]">{l.customerName || '—'}</span>
                  <span className="text-muted-foreground truncate max-w-[100px]">{l.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{l.tele}</Badge>
                  <span className="text-muted-foreground">{formatRelativeTime(l.createdAt)}</span>
                </div>
              </div>
            ))}
            {recentLeads.length === 0 && <p className="text-center text-muted-foreground text-xs py-6">مفيش بيانات</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Reports Tab =====
function ReportsTab({ leads, archivedLeads, allLeads, team }: {
  leads: Lead[]; archivedLeads: Lead[]; allLeads: Lead[]
  team: { tele: string[]; sales: string[]; admin: string[] }
}) {
  const [datePreset, setDatePreset] = useState('week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { from, to } = useMemo(() => getDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const isAllTime = datePreset === 'all'

  const checkInRange = useCallback((ts: number | null) => isAllTime || (ts && ts >= from && ts < to), [isAllTime, from, to])

  const leadsAdded = allLeads.filter(l => checkInRange(l.createdAt))
  const transfersInRange = allLeads.filter(l => l.sales && l.assignedAt && checkInRange(l.assignedAt))
  const attendanceInRange = allLeads.filter(l => l.attendanceMarkedAt && checkInRange(l.attendanceMarkedAt))
  const callsInRange = allLeads.filter(l => l.contactResult && l.contactResultAt && checkInRange(l.contactResultAt))
  const closedInRange = allLeads.filter(l => (l.salesStatus === 'closed-won') && checkInRange(l.assignedAt || l.createdAt))

  const total = leadsAdded.length
  const totalTransfers = transfersInRange.length
  const totalAttended = attendanceInRange.filter(l => l.attended === 'attended').length
  const totalNoShow = attendanceInRange.filter(l => l.attended === 'no-show').length
  const totalClosed = closedInRange.length
  const totalCalls = callsInRange.length
  const callsAnswered = callsInRange.filter(l => l.contactResult === 'replied' || l.contactResult === 'whatsapp').length
  const responseRate = totalCalls ? Math.round((callsAnswered / totalCalls) * 100) : 0
  // Conversion rate: of leads CREATED in the period, what % got transferred (at any time)
  const leadsConvertedFromCreated = leadsAdded.filter(l => l.sales).length
  const conversionRate = total ? Math.round((leadsConvertedFromCreated / total) * 100) : 0
  const attendanceRate = totalTransfers ? Math.round((totalAttended / totalTransfers) * 100) : 0

  // Tele detailed
  const teleDetailed = useMemo(() => team.tele.map(t => {
    const mine = allLeads.filter(l => l.tele === t)
    const myLeadsInRange = mine.filter(l => checkInRange(l.createdAt))
    const myTransfers = mine.filter(l => l.sales && l.assignedAt && checkInRange(l.assignedAt))
    const myCalls = mine.filter(l => l.contactResult && l.contactResultAt && checkInRange(l.contactResultAt))
    const myAttendance = mine.filter(l => l.attendanceMarkedAt && checkInRange(l.attendanceMarkedAt))
    const myAttended = myAttendance.filter(l => l.attended === 'attended').length
    const myNoShow = myAttendance.filter(l => l.attended === 'no-show').length
    const myPending = myTransfers.filter(l => !l.attended).length
    const myCallsAnswered = myCalls.filter(l => l.contactResult === 'replied' || l.contactResult === 'whatsapp').length
    const distributionMap: Record<string, number> = {}
    myTransfers.forEach(l => { if (l.sales) distributionMap[l.sales] = (distributionMap[l.sales] || 0) + 1 })
    // Conversion rate: of leads CREATED in the period, what % got transferred
    const myCreatedAndConverted = myLeadsInRange.filter(l => l.sales).length
    return {
      name: t, leads: myLeadsInRange.length, calls: myCalls.length, callsAnswered: myCallsAnswered,
      transfers: myTransfers.length, attended: myAttended, noShow: myNoShow, pending: myPending,
      closed: myTransfers.filter(l => l.salesStatus === 'closed-won').length,
      distribution: distributionMap,
      responseRate: myCalls.length ? Math.round((myCallsAnswered / myCalls.length) * 100) : 0,
      conversionRate: myLeadsInRange.length ? Math.round((myCreatedAndConverted / myLeadsInRange.length) * 100) : 0,
      attendanceRate: myTransfers.length ? Math.round((myAttended / myTransfers.length) * 100) : 0
    }
  }), [team.tele, allLeads, checkInRange])

  // Sales detailed
  const salesDetailed = useMemo(() => team.sales.map(s => {
    const mine = allLeads.filter(l => l.sales === s)
    const myInRange = mine.filter(l => checkInRange(l.assignedAt || l.createdAt))
    const myFromTele = myInRange.filter(l => l.tele)
    const myOwn = myInRange.filter(l => !l.tele)
    const myAttendance = mine.filter(l => l.attendanceMarkedAt && checkInRange(l.attendanceMarkedAt))
    const myAttended = myAttendance.filter(l => l.attended === 'attended').length
    const myNoShow = myAttendance.filter(l => l.attended === 'no-show').length
    const myPending = myFromTele.filter(l => !l.attended).length
    const myClosed = myInRange.filter(l => l.salesStatus === 'closed-won').length
    const myLost = myInRange.filter(l => l.salesStatus === 'closed-lost').length
    const sourceMap: Record<string, number> = {}
    myFromTele.forEach(l => { if (l.tele) sourceMap[l.tele] = (sourceMap[l.tele] || 0) + 1 })
    return {
      name: s, total: myInRange.length, fromTele: myFromTele.length, ownAdded: myOwn.length,
      attended: myAttended, noShow: myNoShow, pending: myPending, closed: myClosed, lost: myLost,
      source: sourceMap,
      attendanceRate: myFromTele.length ? Math.round((myAttended / myFromTele.length) * 100) : 0,
      closeRate: myAttended ? Math.round((myClosed / myAttended) * 100) : 0
    }
  }), [team.sales, allLeads, checkInRange])

  const rateColor = (rate: number) => rate >= 50 ? 'text-emerald-400' : rate >= 30 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="space-y-4">
      {/* Date Range Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        {(['all', 'today', 'yesterday', 'week', 'month', 'custom'] as const).map(p => (
          <Button key={p} size="sm" variant={datePreset === p ? 'default' : 'outline'}
            className={datePreset === p ? 'bg-venom text-venom-foreground border-venom/40 text-xs shadow-sm' : 'border-border text-xs'}
            onClick={() => setDatePreset(p)}>
            {{ all: 'الكل', today: 'اليوم', yesterday: 'أمس', week: 'الأسبوع', month: 'الشهر', custom: 'مخصص' }[p]}
          </Button>
        ))}
        {datePreset === 'custom' && (
          <div className="flex gap-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-32 h-8 text-xs bg-background border-border" />
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-32 h-8 text-xs bg-background border-border" />
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-venom/10 border border-venom/20 rounded-lg p-3 text-xs text-venom flex items-center gap-2">
        <Eye className="w-4 h-4 shrink-0" />
        <span>الفترة المختارة: <strong>{total}</strong> lead · <strong>{totalCalls}</strong> مكالمة · <strong>{totalTransfers}</strong> تحويل · <strong>{totalAttended}</strong> حضر</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox label="📝 Leads جديدة" value={total} color="#2a7d6e" />
        <StatBox label="📞 المكالمات" value={totalCalls} sub={`${responseRate}% استجابة`} color="#10B981" />
        <StatBox label="🔄 التحويلات" value={totalTransfers} sub={`${conversionRate}% من الـ Leads`} color="#8B5CF6" />
        <StatBox label="📅 حضروا" value={totalAttended} sub={`${attendanceRate}% من التحويلات`} color="#10B981" />
        <StatBox label="❌ لم يحضروا" value={totalNoShow} color="#EF4444" />
        <StatBox label="🏆 تم التقفيل" value={totalClosed} color="#8B5CF6" />
      </div>

      {/* Tele Performance Table */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="w-4 h-4 text-venom" /> أداء التيلي سيلز تفصيلي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]" dir="rtl">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="p-2 text-right font-semibold">التيلي</th>
                  <th className="p-2 text-center font-semibold">📝 Leads</th>
                  <th className="p-2 text-center font-semibold">📞 مكالمات</th>
                  <th className="p-2 text-center font-semibold">✅ ردوا</th>
                  <th className="p-2 text-center font-semibold">% استجابة</th>
                  <th className="p-2 text-center font-semibold">🔄 تحويلات</th>
                  <th className="p-2 text-center font-semibold">% تحويل</th>
                  <th className="p-2 text-center font-semibold">✅ حضر</th>
                  <th className="p-2 text-center font-semibold">⏳ منتظر</th>
                  <th className="p-2 text-center font-semibold">❌ لم يحضر</th>
                  <th className="p-2 text-center font-semibold">% حضور</th>
                  <th className="p-2 text-center font-semibold">🏆 قفل</th>
                </tr>
              </thead>
              <tbody>
                {teleDetailed.map(t => (
                  <tr key={t.name} className="border-b border-border/50 hover:bg-background/50">
                    <td className="p-2 font-semibold">{t.name}</td>
                    <td className="p-2 text-center">{t.leads}</td>
                    <td className="p-2 text-center text-emerald-400">{t.calls}</td>
                    <td className="p-2 text-center text-emerald-400">{t.callsAnswered}</td>
                    <td className={`p-2 text-center font-semibold ${rateColor(t.responseRate)}`}>{t.responseRate}%</td>
                    <td className="p-2 text-center text-purple-400">{t.transfers}</td>
                    <td className={`p-2 text-center font-semibold ${rateColor(t.conversionRate)}`}>{t.conversionRate}%</td>
                    <td className="p-2 text-center text-emerald-400 font-semibold">{t.attended}</td>
                    <td className="p-2 text-center text-amber-400">{t.pending}</td>
                    <td className="p-2 text-center text-red-400">{t.noShow}</td>
                    <td className={`p-2 text-center font-semibold ${rateColor(t.attendanceRate)}`}>{t.attendanceRate}%</td>
                    <td className="p-2 text-center text-purple-400">{t.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sales Performance Table */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> أداء السيلز تفصيلي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]" dir="rtl">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="p-2 text-right font-semibold">السيلز</th>
                  <th className="p-2 text-center font-semibold">إجمالي</th>
                  <th className="p-2 text-center font-semibold">من التيلي</th>
                  <th className="p-2 text-center font-semibold">إضافة ذاتية</th>
                  <th className="p-2 text-center font-semibold">✅ حضر</th>
                  <th className="p-2 text-center font-semibold">⏳ منتظر</th>
                  <th className="p-2 text-center font-semibold">❌ لم يحضر</th>
                  <th className="p-2 text-center font-semibold">% حضور</th>
                  <th className="p-2 text-center font-semibold">🏆 قفل</th>
                  <th className="p-2 text-center font-semibold">❌ خسارة</th>
                  <th className="p-2 text-center font-semibold">% تقفيل</th>
                </tr>
              </thead>
              <tbody>
                {salesDetailed.map(s => (
                  <tr key={s.name} className="border-b border-border/50 hover:bg-background/50">
                    <td className="p-2 font-semibold">{s.name}</td>
                    <td className="p-2 text-center">{s.total}</td>
                    <td className="p-2 text-center text-muted-foreground">{s.fromTele}</td>
                    <td className="p-2 text-center text-muted-foreground">{s.ownAdded}</td>
                    <td className="p-2 text-center text-emerald-400 font-semibold">{s.attended}</td>
                    <td className="p-2 text-center text-amber-400">{s.pending}</td>
                    <td className="p-2 text-center text-red-400">{s.noShow}</td>
                    <td className={`p-2 text-center font-semibold ${rateColor(s.attendanceRate)}`}>{s.attendanceRate}%</td>
                    <td className="p-2 text-center text-purple-400 font-semibold">{s.closed}</td>
                    <td className="p-2 text-center text-red-400">{s.lost}</td>
                    <td className={`p-2 text-center font-semibold ${rateColor(s.closeRate)}`}>{s.closeRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Flow Matrix */}
      {team.tele.length > 0 && team.sales.length > 0 && (
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-venom" /> مصفوفة التحويلات (مين اتحول لمين)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]" dir="rtl">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="p-2 text-right font-semibold">التيلي ↓ / السيلز →</th>
                    {team.sales.map(s => <th key={s} className="p-2 text-center font-semibold">{s}</th>)}
                    <th className="p-2 text-center font-semibold bg-venom/10 text-venom">إجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {team.tele.map(t => {
                    const td = teleDetailed.find(x => x.name === t)
                    return (
                      <tr key={t} className="border-b border-border/50">
                        <td className="p-2 font-semibold bg-background">{t}</td>
                        {team.sales.map(s => {
                          const count = td?.distribution[s] || 0
                          return <td key={s} className={`p-2 text-center ${count > 0 ? 'text-venom font-semibold' : 'text-muted-foreground'}`}>{count}</td>
                        })}
                        <td className="p-2 text-center font-bold bg-venom/10 text-venom">{td?.transfers || 0}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-venom/10 font-bold">
                    <td className="p-2 text-venom">إجمالي</td>
                    {team.sales.map(s => {
                      const sd = salesDetailed.find(x => x.name === s)
                      return <td key={s} className="p-2 text-center text-venom">{sd?.fromTele || 0}</td>
                    })}
                    <td className="p-2 text-center text-venom">{totalTransfers}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">💡 الأرقام بتوضح عدد العملاء اللي التيلي حولتهم لكل سيلز خلال الفترة المختارة</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ===== Sheets Control Tab =====
function SheetsControlTab({ leads, team, reloadData }: {
  leads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] }; reloadData: () => Promise<void>
}) {
  const { addToast } = useCrmStore()
  const [role, setRole] = useState<'tele' | 'sales'>('tele')
  const [target, setTarget] = useState(team.tele[0] || '')
  const [addRowOpen, setAddRowOpen] = useState(false)
  const [newRow, setNewRow] = useState({ storeUrl: '', phone: '', customerName: '', customerType: '', brief: '' })
  const [saving, setSaving] = useState(false)

  // Reset target when role changes or team changes
  const currentMembers = role === 'tele' ? team.tele : team.sales
  if (!currentMembers.includes(target)) {
    setTarget(currentMembers[0] || '')
  }

  const filtered = useMemo(() => {
    if (role === 'tele') return leads.filter(l => l.tele === target)
    return leads.filter(l => l.sales === target)
  }, [leads, role, target])

  const stats = useMemo(() => ({
    total: filtered.length,
    assigned: role === 'tele' ? filtered.filter(l => l.sales).length : filtered.filter(l => l.attended === 'attended').length,
    today: filtered.filter(l => isToday(l.createdAt)).length,
    month: filtered.filter(l => isThisMonth(l.createdAt)).length,
  }), [filtered, role])

  const handleAddRow = async () => {
    setSaving(true)
    try {
      const normalizedPhone = normalizePhone(newRow.phone)

      // Check for duplicate phone before creating (warning only)
      if (normalizedPhone) {
        try {
          const serverDups = await apiCheckDuplicatePhones([normalizedPhone])
          const dupInfo = serverDups[normalizedPhone]
          if (dupInfo) {
            addToast('warning', `⚠️ رقم الجوال مكرر! موجود عند ${dupInfo.existingOwner} (ID: ${dupInfo.existingId})`, 5000)
          }
        } catch {
          // Non-critical: proceed even if check fails
        }
      }

      const lead: Partial<Lead> = {
        ...newRow,
        phone: normalizedPhone,
        tele: role === 'tele' ? target : '',
        sales: role === 'sales' ? target : null,
        status: 'new',
      }
      const created = await apiCreateLead(lead)
      addLeadToCache(created)
      setAddRowOpen(false)
      setNewRow({ storeUrl: '', phone: '', customerName: '', customerType: '', brief: '' })
      addToast('success', 'تم إضافة الصف')
    } catch {
      addToast('error', 'فشل في الإضافة')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLead = async (id: string) => {
    if (!confirm('متأكد من حذف هذا العميل؟')) return
    try {
      removeLeadFromCache(id)
      apiDeleteLead(id).catch(() => addToast('error', 'فشل الحذف من السيرفر'))
      addToast('success', 'تم الحذف')
    } catch {
      addToast('error', 'فشل الحذف')
    }
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-venom/10 border border-venom/20 rounded-lg p-3 text-xs text-venom flex items-center gap-2">
        <Shield className="w-4 h-4 shrink-0" />
        <span>تحكم كامل في الشيتات — تقدر تعدل في شيت أي تيلي أو سيلز كأنك بالظبط هو</span>
      </div>

      {/* Selector */}
      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1.5">
              <Button size="sm" variant={role === 'tele' ? 'default' : 'outline'}
                className={role === 'tele' ? 'bg-venom text-venom-foreground border-venom/40 text-xs shadow-sm' : 'text-xs border-border'}
                onClick={() => setRole('tele')}>
                <Phone className="w-3.5 h-3.5 ml-1" /> شيت تيلي
              </Button>
              <Button size="sm" variant={role === 'sales' ? 'default' : 'outline'}
                className={role === 'sales' ? 'bg-venom text-venom-foreground border-venom/40 text-xs shadow-sm' : 'text-xs border-border'}
                onClick={() => setRole('sales')}>
                <TrendingUp className="w-3.5 h-3.5 ml-1" /> شيت سيلز
              </Button>
            </div>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="w-48 bg-background border-border text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(role === 'tele' ? team.tele : team.sales).map(n => (
                  <SelectItem key={n} value={n}>{n} ({leads.filter(l => role === 'tele' ? l.tele === n : l.sales === n).length} عميل)</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs" onClick={() => setAddRowOpen(true)}>
              <Plus className="w-3.5 h-3.5 ml-1" /> صف جديد لـ {target}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="الإجمالي" value={stats.total} color="#06B6D4" />
        <StatBox label={role === 'tele' ? 'تم التحويل' : 'حضروا'} value={stats.assigned} color="#10B981" />
        <StatBox label="اليوم" value={stats.today} color="#2a7d6e" />
        <StatBox label="هذا الشهر" value={stats.month} color="#F59E0B" />
      </div>

      {/* Table */}
      <Card className="bg-card border border-border">
        <CardContent className="p-2">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs min-w-[800px]" dir="rtl">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="p-2 text-right font-semibold">#</th>
                  <th className="p-2 text-right font-semibold">المتجر</th>
                  <th className="p-2 text-right font-semibold">الجوال</th>
                  <th className="p-2 text-right font-semibold">الاسم</th>
                  <th className="p-2 text-right font-semibold">النوع</th>
                  {role === 'tele' && <th className="p-2 text-right font-semibold">نتيجة التواصل</th>}
                  <th className="p-2 text-right font-semibold">البريف</th>
                  {role === 'tele' && <th className="p-2 text-right font-semibold">السيلز</th>}
                  {role === 'sales' && <th className="p-2 text-right font-semibold">الحالة</th>}
                  {role === 'sales' && <th className="p-2 text-right font-semibold">حضر؟</th>}
                  <th className="p-2 text-right font-semibold">تاريخ</th>
                  <th className="p-2 text-center font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((l, i) => (
                  <tr key={l.id} className="border-b border-border/30 hover:bg-background/50">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2 max-w-[120px] truncate">{l.storeUrl || '—'}</td>
                    <td className="p-2 font-mono">{l.phone || '—'}</td>
                    <td className="p-2">{l.customerName || '—'}</td>
                    <td className="p-2">{l.customerType || '—'}</td>
                    {role === 'tele' && <td className="p-2">{CONTACT_RESULTS.find(c => c.key === l.contactResult)?.label || '—'}</td>}
                    <td className="p-2 max-w-[150px] truncate">{l.brief || '—'}</td>
                    {role === 'tele' && <td className="p-2">{l.sales || '—'}</td>}
                    {role === 'sales' && <td className="p-2">{SALES_STATUSES.find(s => s.key === l.salesStatus)?.label || '—'}</td>}
                    {role === 'sales' && <td className="p-2">{ATTENDANCE_STATUSES.find(a => a.key === l.attended)?.label || '—'}</td>}
                    <td className="p-2 text-muted-foreground">{formatRelativeTime(l.createdAt)}</td>
                    <td className="p-2 text-center">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400" onClick={() => handleDeleteLead(l.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={role === 'tele' ? 10 : 10} className="p-8 text-center text-muted-foreground">مفيش بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Row Dialog */}
      <Dialog open={addRowOpen} onOpenChange={setAddRowOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>صف جديد لـ {target}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="رابط المتجر" value={newRow.storeUrl} onChange={e => setNewRow(p => ({ ...p, storeUrl: e.target.value }))} className="bg-background border-border" />
            <Input placeholder="الجوال" value={newRow.phone} onChange={e => setNewRow(p => ({ ...p, phone: e.target.value }))} className="bg-background border-border" />
            <Input placeholder="اسم العميل" value={newRow.customerName} onChange={e => setNewRow(p => ({ ...p, customerName: e.target.value }))} className="bg-background border-border" />
            <Input placeholder="نوع العميل" value={newRow.customerType} onChange={e => setNewRow(p => ({ ...p, customerType: e.target.value }))} className="bg-background border-border" />
            <Textarea placeholder="البريف" value={newRow.brief} onChange={e => setNewRow(p => ({ ...p, brief: e.target.value }))} className="bg-background border-border" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRowOpen(false)}>إلغاء</Button>
            <Button onClick={handleAddRow} disabled={saving} className="bg-venom/20 text-venom">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Tele Tab =====
function TeleTab({ leads, team }: { leads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedTele, setSelectedTele] = useState<string>('all')

  const { from, to } = useMemo(() => getDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])

  const teleLeads = useMemo(() => {
    let filtered = leads
    if (selectedTele !== 'all') filtered = filtered.filter(l => l.tele === selectedTele)
    return filtered.filter(l => l.createdAt >= from && l.createdAt < to)
  }, [leads, selectedTele, from, to])

  const resultBreakdown = useMemo(() => {
    const bd: Record<string, number> = {}
    teleLeads.forEach(l => { const key = l.contactResult || 'none'; bd[key] = (bd[key] || 0) + 1 })
    return bd
  }, [teleLeads])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={selectedTele} onValueChange={setSelectedTele}>
          <SelectTrigger className="w-40 bg-background border-border text-xs"><SelectValue placeholder="التلي" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {team.tele.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {(['all', 'today', 'week', 'month', 'custom'] as const).map(f => (
          <Button key={f} size="sm" variant={datePreset === f ? 'default' : 'outline'}
            className={datePreset === f ? 'bg-venom text-venom-foreground border-venom/40 text-xs shadow-sm' : 'border-border text-xs'}
            onClick={() => setDatePreset(f)}>
            {{ all: 'الكل', today: 'اليوم', week: 'الأسبوع', month: 'الشهر', custom: 'مخصص' }[f]}
          </Button>
        ))}
        {datePreset === 'custom' && (
          <div className="flex gap-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-32 h-8 text-xs bg-background border-border" />
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-32 h-8 text-xs bg-background border-border" />
          </div>
        )}
        <Badge variant="secondary" className="text-xs">{teleLeads.length} عميل</Badge>
      </div>

      {/* Contact Result Breakdown */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {CONTACT_RESULTS.filter(c => c.key !== 'none').map(cr => (
          <div key={cr.key} className="text-center p-2 rounded-lg border border-border">
            <p className={`text-lg font-bold ${(resultBreakdown[cr.key] || 0) > 0 ? cr.color : 'text-muted-foreground/30'}`}>{resultBreakdown[cr.key] || 0}</p>
            <p className="text-[9px] text-muted-foreground">{cr.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <LeadTable leads={teleLeads.slice(0, 100)} showTele={false} showSales />
    </div>
  )
}

// ===== Sales Tab =====
function SalesTab({ leads, team }: { leads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedSales, setSelectedSales] = useState<string>('all')

  const { from, to } = useMemo(() => getDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])

  const salesLeads = useMemo(() => {
    let filtered = leads.filter(l => l.sales)
    if (selectedSales !== 'all') filtered = filtered.filter(l => l.sales === selectedSales)
    return filtered.filter(l => l.createdAt >= from && l.createdAt < to)
  }, [leads, selectedSales, from, to])

  const attendanceBreakdown = useMemo(() => ({
    pending: salesLeads.filter(l => !l.attended).length,
    attended: salesLeads.filter(l => l.attended === 'attended').length,
    noShow: salesLeads.filter(l => l.attended === 'no-show').length,
  }), [salesLeads])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={selectedSales} onValueChange={setSelectedSales}>
          <SelectTrigger className="w-40 bg-background border-border text-xs"><SelectValue placeholder="السيلز" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {team.sales.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {(['all', 'today', 'week', 'month', 'custom'] as const).map(f => (
          <Button key={f} size="sm" variant={datePreset === f ? 'default' : 'outline'}
            className={datePreset === f ? 'bg-venom text-venom-foreground border-venom/40 text-xs shadow-sm' : 'border-border text-xs'}
            onClick={() => setDatePreset(f)}>
            {{ all: 'الكل', today: 'اليوم', week: 'الأسبوع', month: 'الشهر', custom: 'مخصص' }[f]}
          </Button>
        ))}
        {datePreset === 'custom' && (
          <div className="flex gap-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-32 h-8 text-xs bg-background border-border" />
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-32 h-8 text-xs bg-background border-border" />
          </div>
        )}
        <Badge variant="secondary" className="text-xs">{salesLeads.length} عميل</Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="في الانتظار" value={attendanceBreakdown.pending} color="#F59E0B" />
        <StatBox label="حضروا" value={attendanceBreakdown.attended} color="#10B981" />
        <StatBox label="لم يحضروا" value={attendanceBreakdown.noShow} color="#EF4444" />
      </div>

      <LeadTable leads={salesLeads.slice(0, 100)} showTele showSales={false} />
    </div>
  )
}

// ===== All Leads Tab =====
// ===== Grid column template for AllLeadsTab virtual scrolling =====
const ALL_LEADS_GRID_COLS = 'grid-cols-[40px_1fr_100px_1fr_80px_150px_80px_80px_80px_80px_100px]'

function AllLeadsTab({ leads, allLeads }: { leads: Lead[]; allLeads: Lead[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return leads
    const q = search.toLowerCase()
    return leads.filter(l =>
      (l.customerName || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q) ||
      (l.storeUrl || '').toLowerCase().includes(q) ||
      (l.tele || '').toLowerCase().includes(q) ||
      (l.sales || '').toLowerCase().includes(q)
    )
  }, [leads, search])

  // Virtualizer
  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم، الجوال، المتجر..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10 bg-background border-border" />
        </div>
        <Badge variant="secondary" className="text-xs">{filtered.length} نتيجة</Badge>
      </div>

      <Card className="bg-card border border-border">
        <CardContent className="p-2">
          <div className="overflow-auto max-h-[500px]" ref={parentRef}>
            <div className="min-w-[700px]">
              {/* Header Row */}
              <div
                className={`grid ${ALL_LEADS_GRID_COLS} border-b border-border sticky top-0 bg-card z-10`}
                dir="rtl"
              >
                <div className="p-2 text-right text-xs font-semibold">#</div>
                <div className="p-2 text-right text-xs font-semibold">المتجر</div>
                <div className="p-2 text-right text-xs font-semibold">الجوال</div>
                <div className="p-2 text-right text-xs font-semibold">الاسم</div>
                <div className="p-2 text-right text-xs font-semibold">النوع</div>
                <div className="p-2 text-right text-xs font-semibold">البريف</div>
                <div className="p-2 text-right text-xs font-semibold">التيلي</div>
                <div className="p-2 text-right text-xs font-semibold">السيلز</div>
                <div className="p-2 text-right text-xs font-semibold">حضر</div>
                <div className="p-2 text-right text-xs font-semibold">الحالة</div>
                <div className="p-2 text-right text-xs font-semibold">تاريخ</div>
              </div>

              {/* Virtual Rows */}
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">مفيش بيانات</div>
              ) : (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const l = filtered[virtualRow.index]
                    if (!l) return null
                    return (
                      <div
                        key={l.id}
                        className={`grid ${ALL_LEADS_GRID_COLS} border-b border-border/30 hover:bg-venom/5 transition-colors`}
                        dir="rtl"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="p-2 flex items-center text-muted-foreground text-xs">{virtualRow.index + 1}</div>
                        <div className="p-2 flex items-center max-w-[120px] truncate">{l.storeUrl || '—'}</div>
                        <div className="p-2 flex items-center font-mono text-xs">{l.phone || '—'}</div>
                        <div className="p-2 flex items-center">{l.customerName || '—'}</div>
                        <div className="p-2 flex items-center">{l.customerType || '—'}</div>
                        <div className="p-2 flex items-center max-w-[150px] truncate">{l.brief || '—'}</div>
                        <div className="p-2 flex items-center">{l.tele || '—'}</div>
                        <div className="p-2 flex items-center">{l.sales || '—'}</div>
                        <div className="p-2 flex items-center">{ATTENDANCE_STATUSES.find(a => a.key === l.attended)?.label || '—'}</div>
                        <div className="p-2 flex items-center">{SALES_STATUSES.find(s => s.key === l.salesStatus)?.label || STATUSES.find(s => s.key === l.status)?.label || '—'}</div>
                        <div className="p-2 flex items-center text-muted-foreground">{formatRelativeTime(l.createdAt)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Archive Tab =====
function ArchiveTab({ archivedLeads, reloadData }: { archivedLeads: Lead[]; reloadData: () => Promise<void> }) {
  const { addToast } = useCrmStore()
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return archivedLeads
    const q = search.toLowerCase()
    return archivedLeads.filter(l =>
      (l.customerName || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q) ||
      (l.storeUrl || '').toLowerCase().includes(q)
    )
  }, [archivedLeads, search])

  // Selection logic
  const allFilteredIds = useMemo(() => filtered.map(l => l.id), [filtered])
  const isAllSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id))
  const isSomeSelected = !isAllSelected && filtered.some(l => selectedIds.has(l.id))

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allFilteredIds))
    }
  }, [isAllSelected, allFilteredIds])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // Virtualizer for archive table
  const archiveTableRef = useRef<HTMLDivElement>(null)
  const archiveVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => archiveTableRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  const handleRestore = async (ids: string[]) => {
    setLoading(true)
    try {
      unarchiveLeadsInCache(ids)
      apiUnarchiveLeads(ids).catch(() => addToast('error', 'فشل الاستعادة من السيرفر'))
      addToast('success', `تم استعادة ${ids.length} عميل`)
      setSelectedIds(new Set())
    } catch {
      addToast('error', 'فشل الاستعادة')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('حذف نهائي؟ مفيش رجوع!')) return
    try {
      removeLeadFromCache(id)
      apiDeleteLead(id).catch(() => addToast('error', 'فشل الحذف من السيرفر'))
      addToast('success', 'تم الحذف نهائياً')
    } catch {
      addToast('error', 'فشل الحذف')
    }
  }

  const handleBulkRestore = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`متأكد عايز ترجع ${ids.length} عميل؟`)) return
    setBulkAction(true)
    try {
      unarchiveLeadsInCache(ids)
      apiUnarchiveLeads(ids).catch(() => addToast('error', 'فشل الاستعادة من السيرفر'))
      addToast('success', `✅ تم استعادة ${ids.length} عميل`)
      setSelectedIds(new Set())
    } catch {
      addToast('error', 'فشل الاستعادة')
    } finally {
      setBulkAction(false)
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`⚠️ حذف نهائي لـ ${ids.length} عميل؟ مفيش رجوع!`)) return
    setBulkAction(true)
    try {
      batchRemoveLeadsFromCache(ids)
      apiDeleteLeadsBulk(ids).catch(() => addToast('error', 'فشل الحذف من السيرفر'))
      addToast('success', `🗑️ تم حذف ${ids.length} عميل نهائياً`)
      setSelectedIds(new Set())
    } catch {
      addToast('error', 'فشل الحذف')
    } finally {
      setBulkAction(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث في الأرشيف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10 bg-background border-border" />
        </div>
        <Badge variant="secondary" className="text-xs">{filtered.length} مؤرشف</Badge>
        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={reloadData}>
          <RefreshCw className="w-3.5 h-3.5" /> تحديث
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-venom/10 border border-venom/30 rounded-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-venom text-sm font-medium">
            <CheckSquare className="w-4 h-4" />
            <span>تم اختيار <strong>{selectedIds.size}</strong> عميل</span>
          </div>
          <div className="flex-1" />
          <Button size="sm" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 h-8 text-xs gap-1.5" onClick={handleBulkRestore} disabled={bulkAction}>
            {bulkAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            إرجاع المحدد
          </Button>
          <Button size="sm" variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 h-8 text-xs gap-1.5" onClick={handleBulkDelete} disabled={bulkAction}>
            {bulkAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            مسح المحدد
          </Button>
          <button onClick={clearSelection} className="p-1.5 rounded-lg hover:bg-venom/10 text-muted-foreground hover:text-venom transition-colors cursor-pointer" title="إلغاء الاختيار">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Archive className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">الأرشيف فاضي</p>
        </div>
      ) : (
        <Card className="bg-card border border-border">
          <CardContent className="p-2">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto" ref={archiveTableRef}>
              <table className="w-full text-xs min-w-[750px]" dir="rtl">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    <th className="p-2 text-center w-10">
                      <Checkbox
                        checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        className="border-muted-foreground/40 data-[state=checked]:bg-venom data-[state=checked]:border-venom"
                      />
                    </th>
                    <th className="p-2 text-right font-semibold">#</th>
                    <th className="p-2 text-right font-semibold">المتجر</th>
                    <th className="p-2 text-right font-semibold">الجوال</th>
                    <th className="p-2 text-right font-semibold">اسم العميل</th>
                    <th className="p-2 text-right font-semibold">تاريخ الإضافة</th>
                    <th className="p-2 text-right font-semibold">أرشف في</th>
                    <th className="p-2 text-center font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {archiveVirtualizer.getVirtualItems().map((virtualRow) => {
                    const l = filtered[virtualRow.index]
                    if (!l) return null
                    const isSelected = selectedIds.has(l.id)
                    return (
                      <tr key={l.id} className={`border-b border-border/30 hover:bg-venom/5 transition-colors ${isSelected ? 'bg-venom/8 border-r-2 border-r-venom/40' : ''}`}>
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(l.id)}
                            className="border-muted-foreground/40 data-[state=checked]:bg-venom data-[state=checked]:border-venom"
                          />
                        </td>
                        <td className="p-2 text-muted-foreground">{virtualRow.index + 1}</td>
                        <td className="p-2 max-w-[120px] truncate">{l.storeUrl || '—'}</td>
                        <td className="p-2 font-mono">{l.phone || '—'}</td>
                        <td className="p-2">{l.customerName || '—'}</td>
                        <td className="p-2 text-muted-foreground">{formatDate(l.createdAt)}</td>
                        <td className="p-2 text-muted-foreground">{l.archivedAt ? formatDate(l.archivedAt) : '—'}</td>
                        <td className="p-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-emerald-400 text-xs" onClick={() => handleRestore([l.id])}>
                              <RotateCcw className="w-3 h-3 ml-0.5" /> إرجاع
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-red-400 text-xs" onClick={() => handleDelete(l.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ===== Excel Sync Tab =====
function ExcelSyncTab({ leads, team, reloadData }: {
  leads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] }; reloadData: () => Promise<void>
}) {
  const { addToast } = useCrmStore()
  const [importTarget, setImportTarget] = useState(team.tele[0] || '')
  const [preview, setPreview] = useState<Partial<Lead>[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // CSV parser
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return []
    const parseLine = (line: string) => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++ } else inQuotes = !inQuotes }
        else if (ch === ',' && !inQuotes) { result.push(current); current = '' }
        else current += ch
      }
      result.push(current)
      return result
    }
    const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase())
    const fieldMap: Record<string, string> = {
      'store_url': 'storeUrl', 'storeurl': 'storeUrl', 'متجر': 'storeUrl', 'الرابط': 'storeUrl',
      'phone': 'phone', 'الجوال': 'phone', 'الموبايل': 'phone', 'الهاتف': 'phone',
      'customer_name': 'customerName', 'name': 'customerName', 'الاسم': 'customerName',
      'customer_type': 'customerType', 'type': 'customerType', 'النوع': 'customerType',
      'brief': 'brief', 'notes': 'brief', 'البريف': 'brief', 'ملاحظات': 'brief'
    }
    const rows = lines.slice(1).map(parseLine)
    return rows.filter(r => r.some(c => c.trim())).map(r => {
      const lead: Record<string, string> = {}
      headers.forEach((h, i) => { const field = fieldMap[h]; if (field && r[i]) lead[field] = r[i].trim() })
      return lead
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!importTarget) { addToast('error', 'اختار التيلي الأول'); return }
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      if (parsed.length === 0) { addToast('error', 'الملف فاضي أو مش صحيح'); return }
      setPreview(parsed.map(p => ({ ...p, tele: importTarget } as Partial<Lead>)))
    } catch {
      addToast('error', 'فشل قراءة الملف')
    }
  }

  const handleConfirmImport = async () => {
    if (preview.length === 0) return
    setImporting(true)
    try {
      // Check for duplicate phones before import (warning only — still import all)
      const phonesToCheck = preview
        .map(p => (p as Record<string, unknown>).phone as string)
        .filter(p => p && p.trim())
      let dupCount = 0
      if (phonesToCheck.length > 0) {
        try {
          const serverDups = await apiCheckDuplicatePhones(phonesToCheck)
          dupCount = Object.keys(serverDups).length
        } catch {
          // Non-critical: proceed with import even if check fails
        }
      }

      addToast('info', `جاري استيراد ${preview.length} عميل...`)
      const created = await apiBulkCreateLeads(preview)
      batchAddLeadsToCache(created)

      // SAFETY NET: Verify all created leads are in the cache
      if (created.length > 0) {
        const store = useCrmStore.getState()
        const missing = created.filter((l) => l.id != null && !(l.id in store.leadsById))
        if (missing.length > 0) {
          console.warn(`[admin-import] ${missing.length} leads missing from cache, adding individually`)
          for (const lead of missing) {
            store.addLeadToCache(lead)
          }
        }
      }

      setPreview([])
      if (fileRef.current) fileRef.current.value = ''
      addToast('success', `تم استيراد ${created.length} عميل بنجاح`)
      if (dupCount > 0) {
        addToast('warning', `⚠️ تنبيه: ${dupCount} رقم مكرر في قاعدة البيانات — البيانات اتحفظت بس خلّي بالك`, 7000)
      }
    } catch {
      addToast('error', 'فشل الاستيراد')
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = () => {
    const headers = ['store_url', 'phone', 'customer_name', 'customer_type', 'brief']
    const sample = [
      ['https://salla.sa/example', '966500000000', 'محمد', 'عنده متجر', 'محتاج تسويق'],
      ['https://zid.sa/sample', '966511111111', 'أحمد', 'إنشاء متجر', 'مهتم بكورس']
    ]
    const csv = [headers, ...sample].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-import.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportTele = (name: string) => {
    const teleLeads = leads.filter(l => l.tele === name)
    const headers = ['#', 'المتجر', 'الجوال', 'الاسم', 'النوع', 'نتيجة التواصل', 'البريف', 'السيلز', 'حضر', 'تاريخ الإضافة']
    const rows = teleLeads.map((l, i) => [
      i + 1, l.storeUrl || '', l.phone || '', l.customerName || '', l.customerType || '',
      CONTACT_RESULTS.find(c => c.key === l.contactResult)?.label || '',
      l.brief || '', l.sales || '',
      l.attended === 'attended' ? 'نعم' : l.attended === 'no-show' ? 'لا' : '',
      l.createdAt ? new Date(l.createdAt).toLocaleString('ar-SA') : ''
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}-sheet-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    addToast('success', `تم تصدير شيت ${name}`)
  }

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="bg-venom/10 border border-venom/20 rounded-lg p-3 text-xs text-venom flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 shrink-0" />
        <span>ربط Excel/Google Sheets — تقدر تستورد بيانات من Excel أو CSV مباشرة لشيت التيلي</span>
      </div>

      {/* Import */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> استيراد من ملف</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center mb-3">
            <Select value={importTarget} onValueChange={setImportTarget}>
              <SelectTrigger className="w-48 bg-background border-border text-xs"><SelectValue placeholder="اختر التيلي..." /></SelectTrigger>
              <SelectContent>
                {team.tele.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-venom/30 bg-venom/10 text-venom text-xs cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> اختر ملف CSV
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
            </label>
            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleDownloadTemplate}>
              <Download className="w-3.5 h-3.5" /> تحميل قالب CSV
            </Button>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-background border border-border rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold mb-2">معاينة ({preview.length} عميل):</p>
              <div className="max-h-48 overflow-y-auto font-mono text-xs space-y-1">
                {preview.slice(0, 10).map((l, i) => (
                  <div key={i} className="py-1 border-b border-border/30">{i + 1}. {l.phone || '—'} | {l.customerName || '—'} | {l.storeUrl || '—'}</div>
                ))}
                {preview.length > 10 && <div className="py-1 text-muted-foreground">+ {preview.length - 10} عميل تاني...</div>}
              </div>
              <Button className="mt-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs" onClick={handleConfirmImport} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
                تأكيد الاستيراد لـ {importTarget}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="w-4 h-4" /> طريقة العمل من Google Sheets</CardTitle></CardHeader>
        <CardContent>
          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1.5" dir="rtl">
            <li>افتح Google Sheets وأنشئ ملف جديد بالأعمدة: <strong>store_url | phone | customer_name | brief</strong></li>
            <li>التيلي تدخل البيانات في Google Sheets زي ما هي معتادة</li>
            <li>من Google Sheets: File → Download → CSV</li>
            <li>ارفع الملف هنا واختار التيلي صاحبة الشيت</li>
            <li>النظام هيستورد كل الـ leads ويضيفهم لشيت التيلي تلقائياً</li>
          </ol>
        </CardContent>
      </Card>

      {/* Export */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Download className="w-4 h-4" /> تصدير بيانات الشيتات لـ Excel</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {team.tele.map(t => (
              <Button key={t} size="sm" variant="outline" className="text-xs gap-1.5 border-border" onClick={() => handleExportTele(t)}>
                <Download className="w-3.5 h-3.5" /> تصدير شيت {t}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Team Tab =====
function TeamTab({ leads, team, setTeam, setLeads, setArchivedLeads }: {
  leads: Lead[]
  team: { tele: string[]; sales: string[]; admin: string[] }
  setTeam: (t: { tele: string[]; sales: string[]; admin: string[] }) => void
  setLeads: (l: Lead[]) => void; setArchivedLeads: (l: Lead[]) => void
}) {
  const { addToast, teleAccess, salesAccess, setTeleAccess, setSalesAccess } = useCrmStore()
  const [newTeleName, setNewTeleName] = useState('')
  const [newSalesName, setNewSalesName] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameInfo, setRenameInfo] = useState<{ oldName: string; role: 'tele' | 'sales' } | null>(null)
  const [newNameValue, setNewNameValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [renameConfirmOpen, setRenameConfirmOpen] = useState(false)
  const [renameConfirmInput, setRenameConfirmInput] = useState('')
  const [renameAffectedCount, setRenameAffectedCount] = useState(0)

  const addTele = async () => {
    const name = newTeleName.trim()
    if (!name) { addToast('error', 'اكتب اسم الأول'); return }
    if (team.tele.includes(name) || team.sales.includes(name)) { addToast('error', 'الاسم موجود بالفعل'); return }
    setLoading(true)
    try {
      await apiAddTeamMember(name, 'tele')
      const updated = { ...team, tele: [...team.tele, name] }
      setTeam(updated)
      const newAccess = { ...teleAccess, [name]: [name] }
      setTeleAccess(newAccess)
      await apiSaveSetting('teleAccess', newAccess)
      setNewTeleName('')
      addToast('success', `تمت إضافة ${name} للتيلي سيلز`)
    } catch { addToast('error', 'فشل الإضافة') }
    finally { setLoading(false) }
  }

  const addSales = async () => {
    const name = newSalesName.trim()
    if (!name) { addToast('error', 'اكتب اسم الأول'); return }
    if (team.tele.includes(name) || team.sales.includes(name)) { addToast('error', 'الاسم موجود بالفعل'); return }
    setLoading(true)
    try {
      await apiAddTeamMember(name, 'sales')
      const updated = { ...team, sales: [...team.sales, name] }
      setTeam(updated)
      const newAccess = { ...salesAccess, [name]: [name] }
      setSalesAccess(newAccess)
      await apiSaveSetting('salesAccess', newAccess)
      setNewSalesName('')
      addToast('success', `تمت إضافة ${name} للسيلز`)
    } catch { addToast('error', 'فشل الإضافة') }
    finally { setLoading(false) }
  }

  const removeMember = async (name: string, role: 'tele' | 'sales') => {
    if (!confirm(`متأكد عايز تشيل ${name} من فريق ${role === 'tele' ? 'التيلي' : 'السيلز'}؟`)) return
    setLoading(true)
    try {
      await apiRemoveTeamMember(name)
      const updated = { ...team, [role]: team[role].filter(n => n !== name) }
      setTeam(updated)
      if (role === 'tele') {
        const newAccess = { ...teleAccess }
        delete newAccess[name]
        setTeleAccess(newAccess)
        await apiSaveSetting('teleAccess', newAccess)
      } else {
        const newAccess = { ...salesAccess }
        delete newAccess[name]
        setSalesAccess(newAccess)
        await apiSaveSetting('salesAccess', newAccess)
      }
      addToast('success', `تم حذف ${name}`)
    } catch { addToast('error', 'فشل الحذف') }
    finally { setLoading(false) }
  }

  const startRename = (oldName: string, role: 'tele' | 'sales') => {
    setRenameInfo({ oldName, role })
    setNewNameValue(oldName)
    setRenameOpen(true)
  }

  // Step 1: validate and show confirmation dialog
  const requestRename = () => {
    if (!renameInfo || !newNameValue.trim() || newNameValue === renameInfo.oldName) return
    if (team.tele.includes(newNameValue) || team.sales.includes(newNameValue)) { addToast('error', 'الاسم موجود'); return }
    // Count affected leads
    const affectedLeads = leads.filter(l => l.tele === renameInfo.oldName || l.sales === renameInfo.oldName)
    setRenameAffectedCount(affectedLeads.length)
    setRenameConfirmInput('')
    setRenameConfirmOpen(true)
  }

  // Step 2: actually execute the rename after confirmation
  const confirmRename = async () => {
    if (!renameInfo || !newNameValue.trim() || renameConfirmInput !== renameInfo.oldName) return
    setRenameConfirmOpen(false)
    setLoading(true)
    try {
      await apiRenameTeamMember(renameInfo.oldName, newNameValue.trim())
      const updated = { ...team, [renameInfo.role]: team[renameInfo.role].map(n => n === renameInfo!.oldName ? newNameValue.trim() : n) }
      setTeam(updated)
      // Reload leads to reflect name changes
      const [active, archived] = await Promise.all([apiGetLeads(false), apiGetArchivedLeads().catch(() => [])])
      setLeads(active)
      setArchivedLeads(archived)
      setRenameOpen(false)
      addToast('success', `${renameInfo.oldName} → ${newNameValue.trim()}`)
    } catch { addToast('error', 'فشل التعديل') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-background/50 border border-border rounded-lg p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Eye className="w-4 h-4 text-venom shrink-0" />
        <span>من هنا تقدر تضيف أو تشيل أعضاء من الفريق. لو شيلت عضو، البيانات اللي عنده هتفضل في النظام</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tele Team */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Phone className="w-4 h-4 text-venom" /> فريق التيلي سيلز ({team.tele.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="اسم تيلي جديد..." value={newTeleName} onChange={e => setNewTeleName(e.target.value)} className="bg-background border-border text-xs" />
              <Button size="sm" className="bg-venom/20 text-venom border-venom/30 text-xs shrink-0" onClick={addTele} disabled={loading}>
                <Plus className="w-3.5 h-3.5 ml-1" /> إضافة
              </Button>
            </div>
            {team.tele.map(name => (
              <div key={name} className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border/50">
                <div>
                  <span className="text-xs font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground mr-2">{leads.filter(l => l.tele === name).length} عميل</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-venom" onClick={() => startRename(name, 'tele')}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => removeMember(name, 'tele')}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sales Team */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> فريق السيلز ({team.sales.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="اسم سيلز جديد..." value={newSalesName} onChange={e => setNewSalesName(e.target.value)} className="bg-background border-border text-xs" />
              <Button size="sm" className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs shrink-0" onClick={addSales} disabled={loading}>
                <Plus className="w-3.5 h-3.5 ml-1" /> إضافة
              </Button>
            </div>
            {team.sales.map(name => (
              <div key={name} className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border/50">
                <div>
                  <span className="text-xs font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground mr-2">{leads.filter(l => l.sales === name).length} عميل</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-400" onClick={() => startRename(name, 'sales')}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => removeMember(name, 'sales')}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إعادة تسمية {renameInfo?.oldName}</DialogTitle></DialogHeader>
          <Input value={newNameValue} onChange={e => setNewNameValue(e.target.value)} className="bg-background border-border" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>إلغاء</Button>
            <Button onClick={requestRename} disabled={loading || !newNameValue.trim() || newNameValue === renameInfo?.oldName} className="bg-venom/20 text-venom">
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Confirmation Dialog */}
      <Dialog open={renameConfirmOpen} onOpenChange={setRenameConfirmOpen}>
        <DialogContent className="border-amber-500/30">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              تأكيد إعادة التسمية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
              <p className="font-medium text-amber-300">
                ⚠️ هذا الإجراء هيغيّر اسم «{renameInfo?.oldName}» في {renameAffectedCount} عميل
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                كل العملاء اللي اسمهم «{renameInfo?.oldName}» هيتم نقلهم للاسم الجديد «{newNameValue.trim()}»
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              هذا الإجراء هيأثر على كل الشيتات اللي فيها «{renameInfo?.oldName}» — البيانات هتتنقل للاسم الجديد.
            </p>
            <p className="text-sm font-medium">
              اكتب <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">{renameInfo?.oldName}</span> للتأكيد:
            </p>
            <Input
              value={renameConfirmInput}
              onChange={(e) => setRenameConfirmInput(e.target.value)}
              placeholder={`اكتب "${renameInfo?.oldName}" هنا...`}
              className="bg-background border-amber-500/30 focus:border-amber-500"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameConfirmOpen(false)}>إلغاء</Button>
            <Button
              onClick={confirmRename}
              disabled={renameConfirmInput !== renameInfo?.oldName}
              className="bg-amber-500/20 text-amber-400 border-amber-500/30"
            >
              {renameConfirmInput === renameInfo?.oldName ? '⚠️ تنفيذ إعادة التسمية' : `اكتب "${renameInfo?.oldName}" أولاً`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Permissions Tab =====
function PermissionsTab({ team }: { team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const { addToast, teleAccess, salesAccess, setTeleAccess, setSalesAccess } = useCrmStore()
  const [localTeleAccess, setLocalTeleAccess] = useState<Record<string, string[]>>(() => ({ ...teleAccess }))
  const [localSalesAccess, setLocalSalesAccess] = useState<Record<string, string[]>>(() => ({ ...salesAccess }))

  const toggleTeleAccess = (owner: string, target: string) => {
    setLocalTeleAccess(prev => {
      const current = prev[owner] || [owner]
      const updated = current.includes(target) ? current.filter(t => t !== target) : [...current, target]
      if (!updated.includes(owner)) updated.push(owner)
      return { ...prev, [owner]: updated }
    })
  }

  const toggleTeleAll = (owner: string, checked: boolean) => {
    setLocalTeleAccess(prev => ({
      ...prev,
      [owner]: checked ? ['*'] : [owner]
    }))
  }

  const toggleSalesAccess = (owner: string, target: string) => {
    setLocalSalesAccess(prev => {
      const current = prev[owner] || [owner]
      const updated = current.includes(target) ? current.filter(t => t !== target) : [...current, target]
      if (!updated.includes(owner)) updated.push(owner)
      return { ...prev, [owner]: updated }
    })
  }

  const toggleSalesAll = (owner: string, checked: boolean) => {
    setLocalSalesAccess(prev => ({
      ...prev,
      [owner]: checked ? ['*'] : [owner]
    }))
  }

  const save = async () => {
    try {
      setTeleAccess(localTeleAccess)
      setSalesAccess(localSalesAccess)
      await apiSaveSetting('teleAccess', localTeleAccess)
      await apiSaveSetting('salesAccess', localSalesAccess)
      addToast('success', 'تم حفظ الصلاحيات')
    } catch {
      addToast('error', 'فشل الحفظ')
    }
  }

  return (
    <div className="space-y-4">
      {/* Tele Permissions */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4 text-venom" /> صلاحيات التيلي سيلز</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">حدد كل تيلي تشوف شيت مين. الافتراضي: كل واحدة تشوف شيتها فقط.</p>
          <div className="space-y-3">
            {team.tele.map(t => {
              const access = localTeleAccess[t] || [t]
              const seeAll = access.includes('*')
              return (
                <div key={t} className="p-3 rounded-lg bg-background border border-border/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold">{t}</span>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={seeAll} onChange={e => toggleTeleAll(t, e.target.checked)} className="rounded" />
                      تشوف كل شيتات التيلي
                    </label>
                  </div>
                  {!seeAll && (
                    <div className="flex flex-wrap gap-1.5">
                      {team.tele.map(other => (
                        <label key={other} className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border cursor-pointer ${
                          access.includes(other) ? 'bg-venom/10 border-venom/30 text-venom' : 'bg-card border-border text-muted-foreground'
                        }`}>
                          <input type="checkbox" checked={access.includes(other)} onChange={() => toggleTeleAccess(t, other)} disabled={other === t} className="rounded" />
                          {other}{other === t ? ' (نفسها)' : ''}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sales Permissions */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4 text-emerald-400" /> صلاحيات السيلز</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">حدد كل سيلز يشوف اجتماعات مين. الافتراضي: كل واحد يشوف اجتماعاته فقط.</p>
          <div className="space-y-3">
            {team.sales.map(s => {
              const access = localSalesAccess[s] || [s]
              const seeAll = access.includes('*')
              return (
                <div key={s} className="p-3 rounded-lg bg-background border border-border/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold">{s}</span>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={seeAll} onChange={e => toggleSalesAll(s, e.target.checked)} className="rounded" />
                      يشوف اجتماعات كل السيلز
                    </label>
                  </div>
                  {!seeAll && (
                    <div className="flex flex-wrap gap-1.5">
                      {team.sales.map(other => (
                        <label key={other} className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border cursor-pointer ${
                          access.includes(other) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-card border-border text-muted-foreground'
                        }`}>
                          <input type="checkbox" checked={access.includes(other)} onChange={() => toggleSalesAccess(s, other)} disabled={other === s} className="rounded" />
                          {other}{other === s ? ' (نفسه)' : ''}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Button className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" onClick={save}>
        <CheckCircle2 className="w-4 h-4 ml-2" /> حفظ الصلاحيات
      </Button>
    </div>
  )
}

// ===== Commissions Tab =====
function CommissionsTab({ leads, team }: { leads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const { addToast } = useCrmStore()
  const [perAttendance, setPerAttendance] = useState(50)
  const [perClosedDeal, setPerClosedDeal] = useState(200)
  const [currency, setCurrency] = useState('ريال')

  // Load settings on mount
  useEffect(() => {
    apiGetSetting('commissionSettings').then(val => {
      if (val && typeof val === 'object') {
        const v = val as Record<string, unknown>
        if (typeof v.perAttendance === 'number') setPerAttendance(v.perAttendance)
        if (typeof v.perClosedDeal === 'number') setPerClosedDeal(v.perClosedDeal)
        if (typeof v.currency === 'string') setCurrency(v.currency)
      }
    }).catch(() => {})
  }, [])

  const teleCommissions = useMemo(() => team.tele.map(name => {
    const myLeads = leads.filter(l => l.tele === name)
    const attendedCount = myLeads.filter(l => l.attended === 'attended').length
    const closedCount = myLeads.filter(l => l.salesStatus === 'closed-won').length
    const total = (attendedCount * perAttendance) + (closedCount * perClosedDeal)
    return { name, attendedCount, closedCount, total }
  }), [leads, team.tele, perAttendance, perClosedDeal])

  const salesCommissions = useMemo(() => team.sales.map(name => {
    const myLeads = leads.filter(l => l.sales === name)
    const closedCount = myLeads.filter(l => l.salesStatus === 'closed-won').length
    const total = closedCount * perClosedDeal
    return { name, closedCount, total }
  }), [leads, team.sales, perClosedDeal])

  const totalTeleCommission = teleCommissions.reduce((s, c) => s + c.total, 0)
  const totalSalesCommission = salesCommissions.reduce((s, c) => s + c.total, 0)

  const saveSettings = async () => {
    try {
      await apiSaveSetting('commissionSettings', { perAttendance, perClosedDeal, currency })
      addToast('success', 'تم حفظ إعدادات الكوميشن')
    } catch {
      addToast('error', 'فشل الحفظ')
    }
  }

  return (
    <div className="space-y-4">
      {/* Settings */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-400" /> إعدادات الكوميشن</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">كوميشن / اجتماع حضر ({currency})</label>
              <Input type="number" value={perAttendance} onChange={e => setPerAttendance(Number(e.target.value))} className="bg-background border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">بونص / صفقة مقفولة ({currency})</label>
              <Input type="number" value={perClosedDeal} onChange={e => setPerClosedDeal(Number(e.target.value))} className="bg-background border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">العملة</label>
              <Input value={currency} onChange={e => setCurrency(e.target.value)} className="bg-background border-border" />
            </div>
          </div>
          <Button className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" onClick={saveSettings}>حفظ إعدادات الكوميشن</Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox label="إجمالي كوميشن التيلي" value={totalTeleCommission} suffix={` ${currency}`} color="#10B981" />
        <StatBox label="إجمالي كوميشن السيلز" value={totalSalesCommission} suffix={` ${currency}`} color="#8B5CF6" />
      </div>

      {/* Tele Table */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-venom" /> عمولات التلي</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" dir="rtl">
              <thead><tr className="border-b border-border">
                <th className="p-2 text-right font-semibold">الاسم</th>
                <th className="p-2 text-right font-semibold">حضور</th>
                <th className="p-2 text-right font-semibold">تقفيلات</th>
                <th className="p-2 text-right font-semibold">الإجمالي</th>
              </tr></thead>
              <tbody>
                {teleCommissions.map(c => (
                  <tr key={c.name} className="border-b border-border/50">
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2">{c.attendedCount} × {perAttendance} = <span className="text-emerald-400">{c.attendedCount * perAttendance}</span></td>
                    <td className="p-2">{c.closedCount} × {perClosedDeal} = <span className="text-venom">{c.closedCount * perClosedDeal}</span></td>
                    <td className="p-2 font-bold text-venom">{c.total} {currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-400" /> عمولات المبيعات</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" dir="rtl">
              <thead><tr className="border-b border-border">
                <th className="p-2 text-right font-semibold">الاسم</th>
                <th className="p-2 text-right font-semibold">تقفيلات</th>
                <th className="p-2 text-right font-semibold">الإجمالي</th>
              </tr></thead>
              <tbody>
                {salesCommissions.map(c => (
                  <tr key={c.name} className="border-b border-border/50">
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2">{c.closedCount} × {perClosedDeal} = <span className="text-purple-400">{c.closedCount * perClosedDeal}</span></td>
                    <td className="p-2 font-bold text-purple-400">{c.total} {currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Rating Tab =====
function RatingTab() {
  const { addToast, ratingConfig, setRatingConfig } = useCrmStore()
  const [weights, setWeights] = useState({
    total_count: ratingConfig.thresholds.excellent,
    conversion_rate: ratingConfig.thresholds.good,
    show_up_rate: ratingConfig.thresholds.average,
  })
  const [targets, setTargets] = useState({
    monthly_leads: 200,
    conversion_target: 30,
    show_up_target: 50,
  })
  const [levels, setLevels] = useState([
    { label: 'ممتاز', min: 80, icon: '🏆', color: 'text-emerald-400' },
    { label: 'جيد', min: 60, icon: '👍', color: 'text-venom' },
    { label: 'متوسط', min: 40, icon: '😐', color: 'text-amber-400' },
    { label: 'ضعيف', min: 0, icon: '⚠️', color: 'text-red-400' },
  ])

  useEffect(() => {
    apiGetSetting('ratingWeights').then(val => {
      if (val && typeof val === 'object') {
        const v = val as Record<string, number>
        if (v.total_count) setWeights(prev => ({ ...prev, ...v }))
      }
    }).catch(() => {})
    apiGetSetting('ratingTargets').then(val => {
      if (val && typeof val === 'object') {
        const v = val as Record<string, number>
        if (v.monthly_leads) setTargets(prev => ({ ...prev, ...v }))
      }
    }).catch(() => {})
    apiGetSetting('ratingLevels').then(val => {
      if (Array.isArray(val)) setLevels(val as typeof levels)
    }).catch(() => {})
  }, [])

  const weightsSum = weights.total_count + weights.conversion_rate + weights.show_up_rate

  const save = async () => {
    if (weightsSum !== 100) { addToast('error', 'مجموع الأوزان لازم يكون 100'); return }
    try {
      const newConfig = {
        thresholds: { excellent: levels[0]?.min || 80, good: levels[1]?.min || 60, average: levels[2]?.min || 40, poor: levels[3]?.min || 0 },
        labels: { excellent: levels[0]?.label || 'ممتاز', good: levels[1]?.label || 'جيد', average: levels[2]?.label || 'متوسط', poor: levels[3]?.label || 'ضعيف' },
      }
      setRatingConfig(newConfig)
      await apiSaveSetting('ratingConfig', newConfig)
      await apiSaveSetting('ratingWeights', weights)
      await apiSaveSetting('ratingTargets', targets)
      await apiSaveSetting('ratingLevels', levels)
      addToast('success', 'تم حفظ إعدادات التقييم')
    } catch {
      addToast('error', 'فشل الحفظ')
    }
  }

  const resetToDefault = () => {
    if (!confirm('متأكد عايز ترجع للإعدادات الافتراضية؟')) return
    setWeights({ total_count: 40, conversion_rate: 35, show_up_rate: 25 })
    setTargets({ monthly_leads: 200, conversion_target: 30, show_up_target: 50 })
    setLevels([
      { label: 'ممتاز', min: 80, icon: '🏆', color: 'text-emerald-400' },
      { label: 'جيد', min: 60, icon: '👍', color: 'text-venom' },
      { label: 'متوسط', min: 40, icon: '😐', color: 'text-amber-400' },
      { label: 'ضعيف', min: 0, icon: '⚠️', color: 'text-red-400' },
    ])
    setRatingConfig(DEFAULT_RATING_CONFIG)
    addToast('success', 'تم استعادة الإعدادات الافتراضية')
  }

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="bg-venom/10 border border-venom/20 rounded-lg p-3 text-xs text-venom flex items-center gap-2">
        <Star className="w-4 h-4 shrink-0" />
        <span>التقييم بيتحسب من مجموع 100. كل تيلي بياخد درجة بناءً على 3 معايير. عدّل الأوزان والأهداف اللي تناسب الفريق.</span>
      </div>

      {/* Weights */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">⚖️ أوزان التقييم (لازم مجموعها 100)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">عدد الإضافات الشهرية: <strong>{weights.total_count}%</strong></label>
            <input type="range" min={0} max={100} step={5} value={weights.total_count} onChange={e => setWeights(p => ({ ...p, total_count: +e.target.value }))} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">نسبة التحويل لسيلز: <strong>{weights.conversion_rate}%</strong></label>
            <input type="range" min={0} max={100} step={5} value={weights.conversion_rate} onChange={e => setWeights(p => ({ ...p, conversion_rate: +e.target.value }))} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">نسبة حضور العملاء: <strong>{weights.show_up_rate}%</strong></label>
            <input type="range" min={0} max={100} step={5} value={weights.show_up_rate} onChange={e => setWeights(p => ({ ...p, show_up_rate: +e.target.value }))} className="w-full" />
          </div>
          <div className={`text-xs p-2 rounded text-center ${weightsSum === 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {weightsSum === 100 ? `✅ المجموع = ${weightsSum} (تمام)` : `⚠️ المجموع = ${weightsSum} (محتاج يكون 100)`}
          </div>
        </CardContent>
      </Card>

      {/* Targets */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">🎯 الأهداف الشهرية</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">إضافات شهرية</label>
              <Input type="number" value={targets.monthly_leads} onChange={e => setTargets(p => ({ ...p, monthly_leads: +e.target.value }))} className="bg-background border-border text-xs" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">% تحويل مستهدف</label>
              <Input type="number" value={targets.conversion_target} onChange={e => setTargets(p => ({ ...p, conversion_target: +e.target.value }))} className="bg-background border-border text-xs" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">% حضور مستهدف</label>
              <Input type="number" value={targets.show_up_target} onChange={e => setTargets(p => ({ ...p, show_up_target: +e.target.value }))} className="bg-background border-border text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Levels */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">🏆 مستويات التقييم</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">كل مستوى بيبدأ من درجة معينة</p>
          {levels.map((lvl, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 bg-background rounded-lg">
              <span className="text-lg">{lvl.icon}</span>
              <div className="flex-1">
                <div className="text-xs font-semibold">{lvl.label}</div>
              </div>
              <Input type="number" value={lvl.min} min={0} max={100} step={5}
                onChange={e => setLevels(prev => prev.map((l, i) => i === idx ? { ...l, min: +e.target.value } : l))}
                className="w-16 text-center text-xs bg-card border-border h-8" />
              <span className="text-xs text-muted-foreground">+</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button className="flex-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" onClick={save}>
          <CheckCircle2 className="w-4 h-4 ml-2" /> حفظ التغييرات
        </Button>
        <Button variant="outline" className="border-border" onClick={resetToDefault}>
          <RotateCcw className="w-4 h-4 ml-2" /> رجع للافتراضي
        </Button>
      </div>
    </div>
  )
}

// ===== Settings Tab =====
function SettingsTab({ reloadData, requestDestructiveAction }: { reloadData: () => Promise<void>; requestDestructiveAction: (title: string, confirmText: string, onConfirm: () => void) => void }) {
  const { addToast, leads, archivedLeads, setLeads, setArchivedLeads, team, setTeam } = useCrmStore()

  const handleFullBackup = () => {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      leads, archivedLeads, team,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `venom-crm-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    addToast('success', 'تم حفظ النسخة الاحتياطية')
  }

  const handleRestore = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (!confirm('استعادة النسخة دي هتستبدل كل البيانات الحالية. متأكد؟')) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.leads) setLeads(data.leads)
        if (data.archivedLeads) setArchivedLeads(data.archivedLeads)
        if (data.team) setTeam(data.team)
        addToast('success', 'تم استعادة النسخة بنجاح')
      } catch {
        addToast('error', 'ملف غير صحيح')
      }
    }
    input.click()
  }

  const handleExportCSV = () => {
    const headers = ['اسم العميل', 'الجوال', 'المتجر', 'النوع', 'البريف', 'نتيجة التواصل', 'التيلي', 'السيلز', 'الحالة', 'حضر؟', 'تاريخ الإنشاء']
    const rows = leads.map(l => [
      l.customerName || '', l.phone || '', l.storeUrl || '', l.customerType || '',
      l.brief || '', l.contactResult || '', l.tele || '', l.sales || '',
      l.salesStatus || '',
      l.attended === 'attended' ? 'حضر' : l.attended === 'no-show' ? 'لم يحضر' : 'في الانتظار',
      l.createdAt ? new Date(l.createdAt).toLocaleString('ar-SA') : ''
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `venom-leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    addToast('success', 'تم التصدير CSV')
  }

  const handleClearLeads = () => {
    requestDestructiveAction(
      '🚨 مسح كل الـ Leads',
      'مسح',
      async () => {
        try {
          const count = leads.length
          await apiDeleteLeadsBulk(leads.map(l => l.id))
          setLeads([])
          addToast('success', `تم مسح ${count} عميل بنجاح`)
        } catch {
          addToast('error', 'فشل المسح')
        }
      }
    )
  }

  const handleResetTeam = () => {
    if (!confirm('استعادة الفريق الافتراضي؟')) return
    setTeam({ tele: ['Amira', 'Neveen', 'Sara', 'Esraa', 'Rahma'], sales: ['Rania', 'Alaa', 'Samar'], admin: ['Admin'] })
    addToast('success', 'تم استعادة الفريق الافتراضي')
  }

  return (
    <div className="space-y-4">
      {/* Backup & Restore */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="w-4 h-4 text-venom" /> النسخ الاحتياطي</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">احفظ نسخة من بيانات النظام كاملة أو استعد نسخة سابقة.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="text-xs gap-1.5 border-border" onClick={handleFullBackup}><Download className="w-3.5 h-3.5" /> نسخة احتياطية كاملة</Button>
            <Button variant="outline" className="text-xs gap-1.5 border-border" onClick={handleRestore}><Upload className="w-3.5 h-3.5" /> استعادة نسخة</Button>
            <Button variant="outline" className="text-xs gap-1.5 border-border" onClick={handleExportCSV}><FileSpreadsheet className="w-3.5 h-3.5" /> تصدير CSV</Button>
          </div>
        </CardContent>
      </Card>

      {/* Statuses */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="w-4 h-4 text-purple-400" /> حالات الصفائق الحالية</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">الحالات اللي السيلز بيختار منها.</p>
          <div className="flex flex-wrap gap-1.5">
            {SALES_STATUSES.map(s => (
              <Badge key={s.key} variant="secondary" className={`text-xs ${s.cls}`}>{s.label}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-red-500/5 border border-red-500/20">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> منطقة الخطر</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">الأزرار دي بتمسح بيانات نهائياً - مفيش رجوع!</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" size="sm" className="text-xs gap-1.5" onClick={handleClearLeads}><Trash2 className="w-3.5 h-3.5" /> مسح كل الـ Leads</Button>
            <Button variant="destructive" size="sm" className="text-xs gap-1.5" onClick={handleResetTeam}><RotateCcw className="w-3.5 h-3.5" /> استعادة الفريق الافتراضي</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Shared Components =====

function StatBox({ label, value, color, suffix = '', sub }: { label: string; value: number; color: string; suffix?: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 hover:border-opacity-50 transition-colors" style={{ borderColor: `${color}30` }}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>{value}{suffix}</div>
      {sub && <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

function LeadTable({ leads, showTele, showSales }: { leads: Lead[]; showTele: boolean; showSales: boolean }) {
  return (
    <Card className="bg-card border border-border">
      <CardContent className="p-2">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs min-w-[700px]" dir="rtl">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="p-2 text-right font-semibold">#</th>
                <th className="p-2 text-right font-semibold">المتجر</th>
                <th className="p-2 text-right font-semibold">الجوال</th>
                <th className="p-2 text-right font-semibold">الاسم</th>
                <th className="p-2 text-right font-semibold">النوع</th>
                <th className="p-2 text-right font-semibold">البريف</th>
                {showTele && <th className="p-2 text-right font-semibold">التيلي</th>}
                {showSales && <th className="p-2 text-right font-semibold">السيلز</th>}
                <th className="p-2 text-right font-semibold">حضر</th>
                <th className="p-2 text-right font-semibold">الحالة</th>
                <th className="p-2 text-right font-semibold">تاريخ</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l, i) => (
                <tr key={l.id} className="border-b border-border/30 hover:bg-background/50">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 max-w-[120px] truncate">{l.storeUrl || '—'}</td>
                  <td className="p-2 font-mono">{l.phone || '—'}</td>
                  <td className="p-2">{l.customerName || '—'}</td>
                  <td className="p-2">{l.customerType || '—'}</td>
                  <td className="p-2 max-w-[150px] truncate">{l.brief || '—'}</td>
                  {showTele && <td className="p-2">{l.tele || '—'}</td>}
                  {showSales && <td className="p-2">{l.sales || '—'}</td>}
                  <td className="p-2">{ATTENDANCE_STATUSES.find(a => a.key === l.attended)?.label || '—'}</td>
                  <td className="p-2">{SALES_STATUSES.find(s => s.key === l.salesStatus)?.label || STATUSES.find(s => s.key === l.status)?.label || '—'}</td>
                  <td className="p-2 text-muted-foreground">{formatRelativeTime(l.createdAt)}</td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={9 + (showTele ? 1 : 0) + (showSales ? 1 : 0)} className="p-8 text-center text-muted-foreground">مفيش بيانات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
