'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import {
  useCrmStore, CONTACT_RESULTS, STATUSES, SALES_STATUSES, ATTENDANCE_STATUSES,
  formatDate, getDateRange, type AdminTab,
} from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import {
  apiUpdateLead, apiDeleteLead, apiArchiveLeads, apiDeleteLeadsBulk, apiUnarchiveLeads,
  apiAddTeamMember, apiRemoveTeamMember, apiRenameTeamMember,
} from '@/lib/supabase'
// Framer Motion removed for performance
import {
  BarChart3, Phone, Users, Archive, Settings, UserCog, ChevronLeft,
  Search, Trash2, PhoneCall, Trophy, UserPlus, UserMinus, Pencil,
  Check, X, Plus, ArrowUpDown, LayoutGrid, Shield, KeyRound,
  Loader2, Eye, EyeOff, ToggleLeft, ToggleRight, Link2, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'

// Animation variants removed - using CSS transitions for better performance

/* ═══════════════════════════════════════════════════════
   Tab Config
   ═══════════════════════════════════════════════════════ */
const ADMIN_TABS: { key: AdminTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'نظرة عامة', icon: BarChart3 },
  { key: 'tele', label: 'التيلي', icon: Phone },
  { key: 'sales', label: 'السيلز', icon: Users },
  { key: 'all-leads', label: 'كل العملاء', icon: LayoutGrid },
  { key: 'archive', label: 'الأرشيف', icon: Archive },
  { key: 'team', label: 'الفريق', icon: UserCog },
  { key: 'users', label: 'المستخدمين', icon: Shield },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

/* ═══════════════════════════════════════════════════════
   Overview Tab
   ═══════════════════════════════════════════════════════ */
function OverviewTab() {
  const leads = useCrmStore((s) => s.leads)
  const archivedLeads = useCrmStore((s) => s.archivedLeads)
  const team = useCrmStore((s) => s.team)
  const activeLeads = useMemo(() => leads.filter((l) => !l.isArchived), [leads])

  const teamStats = useMemo(() => {
    const stats: Record<string, { total: number; contacted: number; meetings: number; closed: number }> = {}

    // Tele stats
    for (const name of team.tele) {
      const tLeads = activeLeads.filter((l) => l.tele === name)
      stats[name] = {
        total: tLeads.length,
        contacted: tLeads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length,
        meetings: tLeads.filter((l) => l.meetingDate).length,
        closed: tLeads.filter((l) => l.status === 'closed-won').length,
      }
    }

    // Sales stats
    for (const name of team.sales) {
      const sLeads = activeLeads.filter((l) => l.sales === name)
      stats[name] = {
        total: sLeads.length,
        contacted: sLeads.filter((l) => l.attended === 'attended').length,
        meetings: sLeads.filter((l) => l.meetingDate).length,
        closed: sLeads.filter((l) => l.salesStatus === 'closed-won').length,
      }
    }

    return stats
  }, [activeLeads, team])

  const { totalLeads, totalClosed, totalMeetings, conversionRate } = useMemo(() => {
    const total = activeLeads.length
    const closed = activeLeads.filter((l) => l.status === 'closed-won' || l.salesStatus === 'closed-won').length
    const meetings = activeLeads.filter((l) => l.meetingDate).length
    const rate = total > 0 ? Math.round((closed / total) * 100) : 0
    return { totalLeads: total, totalClosed: closed, totalMeetings: meetings, conversionRate: rate }
  }, [activeLeads])

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي العملاء', value: totalLeads, color: '#6c63ff' },
          { label: 'اجتماعات محجوزة', value: totalMeetings, color: '#ffd166' },
          { label: 'تم التقفيل', value: totalClosed, color: '#00d4aa' },
          { label: 'نسبة التحويل', value: `${conversionRate}%`, color: '#ff6b6b' },
        ].map((k, i) => (
          <div key={i} className="bg-[#111520] border border-white/[0.06] rounded-xl p-4 animate-in fade-in duration-300">
            <div className="text-[13px] font-semibold text-[#8892b0]">{k.label}</div>
            <div className="text-[22px] font-bold mt-1" style={{ color: k.color, fontFamily: 'Cairo, sans-serif' }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Team Performance Table */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-bold text-[#f0f2ff] flex items-center gap-2">
            <Trophy size={16} className="text-[#ffd166]" />
            أداء الفريق
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">الاسم</TableHead>
                <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">الدور</TableHead>
                <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">عملاء</TableHead>
                <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">تواصل</TableHead>
                <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">اجتماعات</TableHead>
                <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">تقفيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.tele.map((name) => {
                const s = teamStats[name] || { total: 0, contacted: 0, meetings: 0, closed: 0 }
                return (
                  <TableRow key={name} className="border-b border-white/[0.04] hover:bg-[#1c2234]/50">
                    <TableCell className="text-[13px] font-semibold text-[#f0f2ff]">{name}</TableCell>
                    <TableCell>
                      <Badge className="bg-[#6c63ff]/15 text-[#a8a3ff] text-[11px] font-bold border-0">تيلي</Badge>
                    </TableCell>
                    <TableCell className="text-[13px] font-semibold text-[#8892b0]">{s.total}</TableCell>
                    <TableCell className="text-[13px] font-semibold text-[#00d4aa]">{s.contacted}</TableCell>
                    <TableCell className="text-[13px] font-semibold text-[#ffd166]">{s.meetings}</TableCell>
                    <TableCell className="text-[13px] font-semibold text-[#00d4aa]">{s.closed}</TableCell>
                  </TableRow>
                )
              })}
              {team.sales.map((name) => {
                const s = teamStats[name] || { total: 0, contacted: 0, meetings: 0, closed: 0 }
                return (
                  <TableRow key={name} className="border-b border-white/[0.04] hover:bg-[#1c2234]/50">
                    <TableCell className="text-[13px] font-semibold text-[#f0f2ff]">{name}</TableCell>
                    <TableCell>
                      <Badge className="bg-[#00d4aa]/15 text-[#00d4aa] text-[11px] font-bold border-0">سيلز</Badge>
                    </TableCell>
                    <TableCell className="text-[13px] font-semibold text-[#8892b0]">{s.total}</TableCell>
                    <TableCell className="text-[13px] font-semibold text-[#00d4aa]">{s.contacted}</TableCell>
                    <TableCell className="text-[13px] font-semibold text-[#ffd166]">{s.meetings}</TableCell>
                    <TableCell className="text-[13px] font-semibold text-[#00d4aa]">{s.closed}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   All Leads Tab
   ═══════════════════════════════════════════════════════ */
function AllLeadsTab() {
  const leads = useCrmStore((s) => s.leads)
  const team = useCrmStore((s) => s.team)
  const currentUser = useCrmStore((s) => s.currentUser)
  const addToast = useCrmStore((s) => s.addToast)
  const selectedLeadIds = useCrmStore((s) => s.selectedLeadIds)
  const toggleLeadSelection = useCrmStore((s) => s.toggleLeadSelection)
  const clearSelectedLeadIds = useCrmStore((s) => s.clearSelectedLeadIds)
  const selectAllLeads = useCrmStore((s) => s.selectAllLeads)
  const searchQueries = useCrmStore((s) => s.searchQueries)
  const setSearchQuery = useCrmStore((s) => s.setSearchQuery)
  const updateLeadInCache = useCrmStore((s) => s.updateLeadInCache)
  const removeLeadFromCache = useCrmStore((s) => s.removeLeadFromCache)
  const batchRemoveLeadsFromCache = useCrmStore((s) => s.batchRemoveLeadsFromCache)
  const archiveLeadsInCache = useCrmStore((s) => s.archiveLeadsInCache)

  const viewKey = 'admin-all-leads'
  const selected = selectedLeadIds[viewKey] || []
  const searchQuery = searchQueries[viewKey] || ''
  const [filterTele, setFilterTele] = useState('all')
  const [filterSales, setFilterSales] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const filteredLeads = useMemo(() => {
    let result = leads.filter((l) => !l.isArchived)
    if (filterTele !== 'all') result = result.filter((l) => l.tele === filterTele)
    if (filterSales !== 'all') result = result.filter((l) => l.sales === filterSales)
    if (filterStatus !== 'all') result = result.filter((l) => l.status === filterStatus || l.salesStatus === filterStatus)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (l) => l.customerName?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q)
      )
    }
    return result
  }, [leads, filterTele, filterSales, filterStatus, searchQuery])

  const handleBulkArchive = useCallback(async () => {
    if (selected.length === 0) return
    archiveLeadsInCache(selected, currentUser || 'admin')
    try { await apiArchiveLeads(selected, currentUser || 'admin') } catch { /* */ }
    addToast('success', `تم أرشفة ${selected.length} عميل`)
    clearSelectedLeadIds(viewKey)
  }, [selected, currentUser, archiveLeadsInCache, addToast, clearSelectedLeadIds])

  const handleBulkDelete = useCallback(async () => {
    if (selected.length === 0) return
    const ids = [...selected]
    batchRemoveLeadsFromCache(ids)
    try { await apiDeleteLeadsBulk(ids) } catch { /* */ }
    addToast('success', `تم حذف ${ids.length} عميل`)
    clearSelectedLeadIds(viewKey)
  }, [selected, batchRemoveLeadsFromCache, addToast, clearSelectedLeadIds])

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterTele} onValueChange={setFilterTele}>
          <SelectTrigger className="w-[120px] h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
            <SelectValue placeholder="التيلي" />
          </SelectTrigger>
          <SelectContent className="bg-[#111520] border-white/[0.08]">
            <SelectItem value="all" className="text-[13px]">الكل</SelectItem>
            {team.tele.map((n) => <SelectItem key={n} value={n} className="text-[13px]">{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSales} onValueChange={setFilterSales}>
          <SelectTrigger className="w-[120px] h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
            <SelectValue placeholder="السيلز" />
          </SelectTrigger>
          <SelectContent className="bg-[#111520] border-white/[0.08]">
            <SelectItem value="all" className="text-[13px]">الكل</SelectItem>
            {team.sales.map((n) => <SelectItem key={n} value={n} className="text-[13px]">{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[120px] h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent className="bg-[#111520] border-white/[0.08]">
            <SelectItem value="all" className="text-[13px]">الكل</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.key} value={s.key} className="text-[13px]">{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4a5280]" />
          <Input
            placeholder="بحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(viewKey, e.target.value)}
            className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] pr-8"
          />
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Button onClick={handleBulkArchive} size="sm" className="h-8 text-[13px] font-bold bg-amber-500/15 text-amber-400 border-0 gap-1 cursor-pointer">
              <Archive size={12} /> أرشفة ({selected.length})
            </Button>
            <Button onClick={handleBulkDelete} size="sm" className="h-8 text-[13px] font-bold bg-red-500/15 text-red-400 border-0 gap-1 cursor-pointer">
              <Trash2 size={12} /> حذف ({selected.length})
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="w-[40px] text-right text-[13px] font-bold text-[#4a5280]">
                    <Checkbox
                      checked={selected.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) selectAllLeads(viewKey, filteredLeads.map((l) => l.id))
                        else clearSelectedLeadIds(viewKey)
                      }}
                      className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]"
                    />
                  </TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">العميل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">الهاتف</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">التيلي</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">السيلز</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">الحالة</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">حالة السيلز</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-[#4a5280] text-[13px] font-semibold">لا يوجد عملاء</TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className={`border-b border-white/[0.04] ${selected.includes(lead.id) ? 'bg-[#6c63ff]/5' : 'hover:bg-[#1c2234]/50'}`}>
                      <TableCell className="w-[40px]">
                        <Checkbox
                          checked={selected.includes(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(viewKey, lead.id)}
                          className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]"
                        />
                      </TableCell>
                      <TableCell className="text-[13px] font-semibold text-[#f0f2ff]">{lead.customerName || '—'}</TableCell>
                      <TableCell className="text-[13px] font-semibold text-[#8892b0]">{lead.phone || '—'}</TableCell>
                      <TableCell className="text-[13px] font-semibold text-[#a8a3ff]">{lead.tele || '—'}</TableCell>
                      <TableCell className="text-[13px] font-semibold text-[#00d4aa]">{lead.sales || '—'}</TableCell>
                      <TableCell>
                        <Badge className="bg-[#6c63ff]/15 text-[#a8a3ff] text-[11px] font-bold border-0">
                          {STATUSES.find((s) => s.key === lead.status)?.label || lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-[#00d4aa]/15 text-[#00d4aa] text-[11px] font-bold border-0">
                          {SALES_STATUSES.find((s) => s.key === lead.salesStatus)?.label || lead.salesStatus || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[12px] text-[#4a5280]">{formatDate(lead.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredLeads.length > 0 && (
            <div className="border-t border-white/[0.06] px-4 py-2 text-[12px] font-medium text-[#4a5280]">
              عرض {filteredLeads.length} عميل
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Archive Tab
   ═══════════════════════════════════════════════════════ */
function ArchiveTab() {
  const archivedLeads = useCrmStore((s) => s.archivedLeads)
  const addToast = useCrmStore((s) => s.addToast)
  const unarchiveLeadsInCache = useCrmStore((s) => s.unarchiveLeadsInCache)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return archivedLeads
    const q = searchQuery.toLowerCase()
    return archivedLeads.filter(
      (l) => l.customerName?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q)
    )
  }, [archivedLeads, searchQuery])

  const handleUnarchive = useCallback(async (ids: string[]) => {
    unarchiveLeadsInCache(ids)
    try {
      await apiUnarchiveLeads(ids)
      addToast('success', `تم إلغاء أرشفة ${ids.length} عميل`)
    } catch {
      addToast('error', 'فشل إلغاء الأرشفة')
    }
  }, [unarchiveLeadsInCache, addToast])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4a5280]" />
          <Input
            placeholder="بحث في الأرشيف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] pr-8"
          />
        </div>
        <Badge className="bg-[#1c2234] text-[#8892b0] text-[11px] font-bold border-0">{filtered.length} مؤرشف</Badge>
      </div>

      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">العميل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">الهاتف</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">التيلي</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">السيلز</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">أرشفته</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">التاريخ</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[80px]">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-[#4a5280] text-[13px] font-semibold">لا يوجد عملاء مؤرشفين</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((lead) => (
                    <TableRow key={lead.id} className="border-b border-white/[0.04] hover:bg-[#1c2234]/50">
                      <TableCell className="text-[13px] font-semibold text-[#f0f2ff]">{lead.customerName || '—'}</TableCell>
                      <TableCell className="text-[13px] font-semibold text-[#8892b0]">{lead.phone || '—'}</TableCell>
                      <TableCell className="text-[13px] font-semibold text-[#a8a3ff]">{lead.tele || '—'}</TableCell>
                      <TableCell className="text-[13px] font-semibold text-[#00d4aa]">{lead.sales || '—'}</TableCell>
                      <TableCell className="text-[13px] font-semibold text-[#4a5280]">{lead.archivedBy || '—'}</TableCell>
                      <TableCell className="text-[12px] text-[#4a5280]">{formatDate(lead.archivedAt)}</TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleUnarchive([lead.id])}
                          size="sm"
                          className="h-7 text-[13px] font-bold bg-[#00d4aa]/15 text-[#00d4aa] hover:bg-[#00d4aa]/25 border-0 gap-1 cursor-pointer"
                        >
                          <ChevronLeft size={12} />
                          استرجاع
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Team Tab
   ═══════════════════════════════════════════════════════ */
function TeamTab() {
  const team = useCrmStore((s) => s.team)
  const addToast = useCrmStore((s) => s.addToast)
  const setTeam = useCrmStore((s) => s.setTeam)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'tele' | 'sales'>('tele')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return
    try {
      await apiAddTeamMember(newName.trim(), newRole)
      const updated = { ...team }
      updated[newRole] = [...updated[newRole], newName.trim()]
      setTeam(updated)
      addToast('success', `تم إضافة ${newName}`)
      setNewName('')
    } catch (err: unknown) {
      addToast('error', `فشل الإضافة: ${err instanceof Error ? err.message : 'خطأ'}`)
    }
  }, [newName, newRole, team, setTeam, addToast])

  const handleRemove = useCallback(async (name: string, role: 'tele' | 'sales') => {
    try {
      await apiRemoveTeamMember(name)
      const updated = { ...team }
      updated[role] = updated[role].filter((n) => n !== name)
      setTeam(updated)
      addToast('success', `تم إزالة ${name}`)
    } catch {
      addToast('error', 'فشل الإزالة')
    }
  }, [team, setTeam, addToast])

  const handleRename = useCallback(async (oldName: string) => {
    if (!editDraft.trim() || editDraft.trim() === oldName) {
      setEditingName(null)
      return
    }
    try {
      await apiRenameTeamMember(oldName, editDraft.trim())
      const updated = { ...team }
      const role = team.tele.includes(oldName) ? 'tele' : 'sales'
      updated[role] = updated[role].map((n) => (n === oldName ? editDraft.trim() : n))
      setTeam(updated)
      addToast('success', `تم إعادة تسمية ${oldName} إلى ${editDraft.trim()}`)
      setEditingName(null)
      setEditDraft('')
    } catch {
      addToast('error', 'فشل إعادة التسمية')
    }
  }, [editDraft, team, setTeam, addToast])

  return (
    <div className="space-y-4">
      {/* Add member */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-bold text-[#f0f2ff] flex items-center gap-2">
            <UserPlus size={16} className="text-[#6c63ff]" />
            إضافة عضو جديد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              placeholder="الاسم"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] max-w-[200px]"
            />
            <Select value={newRole} onValueChange={(v: 'tele' | 'sales') => setNewRole(v)}>
              <SelectTrigger className="w-[100px] h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#111520] border-white/[0.08]">
                <SelectItem value="tele" className="text-[13px]">تيلي</SelectItem>
                <SelectItem value="sales" className="text-[13px]">سيلز</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleAdd}
              className="h-8 text-[13px] font-bold bg-[#6c63ff] hover:bg-[#5b54e6] text-white gap-1 cursor-pointer"
            >
              <Plus size={12} />
              إضافة
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tele Team */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] text-[#f0f2ff] flex items-center gap-2">
            <Phone size={14} className="text-[#6c63ff]" />
            فريق التيلي ({team.tele.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {team.tele.map((name) => (
              <div key={name} className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-[#1c2234]/50 transition-colors">
                {editingName === name ? (
                  <>
                    <Input
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="h-7 text-[13px] bg-[#0a0d14] border-[#6c63ff]/30 text-[#f0f2ff] max-w-[150px]"
                      autoFocus
                    />
                    <button onClick={() => handleRename(name)} className="w-6 h-6 rounded-md bg-[#00d4aa]/15 text-[#00d4aa] flex items-center justify-center cursor-pointer">
                      <Check size={12} />
                    </button>
                    <button onClick={() => setEditingName(null)} className="w-6 h-6 rounded-md bg-red-500/15 text-red-400 flex items-center justify-center cursor-pointer">
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-full bg-[#6c63ff]/15 flex items-center justify-center text-[12px] text-[#a8a3ff] font-bold shrink-0">
                      {name.slice(0, 2)}
                    </div>
                    <span className="text-[13px] font-bold text-[#f0f2ff] flex-1">{name}</span>
                    <button
                      onClick={() => { setEditingName(name); setEditDraft(name) }}
                      className="w-6 h-6 rounded-md bg-[#1c2234] text-[#4a5280] flex items-center justify-center hover:text-[#6c63ff] cursor-pointer"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={() => handleRemove(name, 'tele')}
                      className="w-6 h-6 rounded-md bg-red-500/10 text-red-400/60 flex items-center justify-center hover:text-red-400 cursor-pointer"
                    >
                      <UserMinus size={10} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sales Team */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] text-[#f0f2ff] flex items-center gap-2">
            <Users size={14} className="text-[#00d4aa]" />
            فريق السيلز ({team.sales.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {team.sales.map((name) => (
              <div key={name} className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-[#1c2234]/50 transition-colors">
                {editingName === name ? (
                  <>
                    <Input
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="h-7 text-[13px] bg-[#0a0d14] border-[#6c63ff]/30 text-[#f0f2ff] max-w-[150px]"
                      autoFocus
                    />
                    <button onClick={() => handleRename(name)} className="w-6 h-6 rounded-md bg-[#00d4aa]/15 text-[#00d4aa] flex items-center justify-center cursor-pointer">
                      <Check size={12} />
                    </button>
                    <button onClick={() => setEditingName(null)} className="w-6 h-6 rounded-md bg-red-500/15 text-red-400 flex items-center justify-center cursor-pointer">
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-full bg-[#00d4aa]/15 flex items-center justify-center text-[12px] text-[#00d4aa] font-bold shrink-0">
                      {name.slice(0, 2)}
                    </div>
                    <span className="text-[13px] font-bold text-[#f0f2ff] flex-1">{name}</span>
                    <button
                      onClick={() => { setEditingName(name); setEditDraft(name) }}
                      className="w-6 h-6 rounded-md bg-[#1c2234] text-[#4a5280] flex items-center justify-center hover:text-[#6c63ff] cursor-pointer"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={() => handleRemove(name, 'sales')}
                      className="w-6 h-6 rounded-md bg-red-500/10 text-red-400/60 flex items-center justify-center hover:text-red-400 cursor-pointer"
                    >
                      <UserMinus size={10} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Users Management Tab
   Admin can create, list, toggle, reset passwords
   ═══════════════════════════════════════════════════════ */
interface AppUser {
  id: string
  username: string
  display_name: string
  role: string
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

function UsersTab() {
  const addToast = useCrmStore((s) => s.addToast)
  const team = useCrmStore((s) => s.team)
  const setTeam = useCrmStore((s) => s.setTeam)
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', displayName: '', role: 'tele' as 'tele' | 'sales' | 'admin' })
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [linkingUser, setLinkingUser] = useState<AppUser | null>(null)
  const [linkTargetName, setLinkTargetName] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)

  /* ─── Fetch users ─── */
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-users' }),
      })
      const data = await res.json()
      if (data.users) setUsers(data.users as AppUser[])
    } catch {
      addToast('error', 'فشل في تحميل المستخدمين')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  /* ─── Create user + auto-add to team ─── */
  const handleCreateUser = useCallback(async () => {
    if (!newUser.username.trim() || !newUser.password || !newUser.displayName.trim()) {
      addToast('warning', 'جميع الحقول مطلوبة')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-user',
          username: newUser.username.trim(),
          password: newUser.password,
          displayName: newUser.displayName.trim(),
          role: newUser.role,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        addToast('error', data.error || 'فشل في إنشاء المستخدم')
        return
      }

      // Auto-add to team_members if role is tele or sales
      const memberRole = newUser.role as 'tele' | 'sales'
      if (memberRole === 'tele' || memberRole === 'sales') {
        try {
          // Check if a team member with this name already exists
          const existingMembers = team[memberRole] || []
          if (!existingMembers.includes(newUser.displayName.trim())) {
            await apiAddTeamMember(newUser.displayName.trim(), memberRole)
            // Update local team state
            const updated = { ...team }
            updated[memberRole] = [...updated[memberRole], newUser.displayName.trim()]
            setTeam(updated)
          }
        } catch {
          // Team member creation failed but user was created — non-critical
          console.warn('[UsersTab] Failed to auto-add team member')
        }
      }

      addToast('success', `تم إنشاء المستخدم ${newUser.displayName} بنجاح ✅`)
      setNewUser({ username: '', password: '', displayName: '', role: 'tele' })
      setShowAddForm(false)
      fetchUsers()
    } catch {
      addToast('error', 'فشل في إنشاء المستخدم')
    } finally {
      setSaving(false)
    }
  }, [newUser, addToast, fetchUsers, team, setTeam])

  /* ─── Toggle user active ─── */
  const handleToggleUser = useCallback(async (userId: string, isActive: boolean) => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-user', userId, isActive: !isActive }),
      })
      addToast('success', isActive ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم')
      fetchUsers()
    } catch {
      addToast('error', 'فشل في تحديث حالة المستخدم')
    }
  }, [addToast, fetchUsers])

  /* ─── Reset password ─── */
  const handleResetPassword = useCallback(async () => {
    if (!resetUserId || !resetPassword) {
      addToast('warning', 'كلمة المرور الجديدة مطلوبة')
      return
    }
    setResetSaving(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', userId: resetUserId, newPassword: resetPassword }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        addToast('error', data.error || 'فشل في إعادة تعيين كلمة المرور')
        return
      }
      addToast('success', 'تم إعادة تعيين كلمة المرور بنجاح ✅')
      setResetUserId(null)
      setResetPassword('')
    } catch {
      addToast('error', 'فشل في إعادة تعيين كلمة المرور')
    } finally {
      setResetSaving(false)
    }
  }, [resetUserId, resetPassword, addToast])

  /* ─── Delete user ─── */
  const handleDeleteUser = useCallback(async () => {
    if (!deleteUserId) return
    setDeleteSaving(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-user', userId: deleteUserId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        addToast('error', data.error || 'فشل في حذف المستخدم')
        return
      }
      addToast('success', 'تم حذف المستخدم بنجاح')
      setDeleteUserId(null)
      fetchUsers()
    } catch {
      addToast('error', 'فشل في حذف المستخدم')
    } finally {
      setDeleteSaving(false)
    }
  }, [deleteUserId, addToast, fetchUsers])

  /* ─── Link user display name to existing team member ─── */
  // This renames all leads from the old name (team member) to the user's display_name
  // So that when the user logs in, their dashboard shows all their leads
  const handleLinkName = useCallback(async () => {
    if (!linkingUser || !linkTargetName) return
    setLinkSaving(true)
    try {
      await apiRenameTeamMember(linkTargetName, linkingUser.display_name)
      addToast('success', `تم ربط "${linkTargetName}" بـ "${linkingUser.display_name}" — تم تحديث البيانات ✅`)
      setLinkingUser(null)
      setLinkTargetName('')
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'فشل في ربط الاسم')
    } finally {
      setLinkSaving(false)
    }
  }, [linkingUser, linkTargetName, addToast])

  // Check if a user's display_name matches their team member list
  const isNameMismatched = useCallback((user: AppUser) => {
    if (user.role === 'admin') return false
    const members = team[user.role as 'tele' | 'sales'] || []
    // Name doesn't match any team member → potential mismatch
    return !members.includes(user.display_name)
  }, [team])

  const roleLabels: Record<string, string> = { tele: 'تيلي', sales: 'سيلز', admin: 'أدمن' }
  const roleColors: Record<string, string> = { tele: 'bg-[#6c63ff]/15 text-[#a8a3ff]', sales: 'bg-[#00d4aa]/15 text-[#00d4aa]', admin: 'bg-amber-500/15 text-amber-400' }

  return (
    <div className="space-y-4">
      {/* Add User Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-[#1c2234] text-[#8892b0] text-[11px] font-bold border-0">
            {users.length} مستخدم
          </Badge>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[#6c63ff] hover:bg-[#5b54e6] text-white gap-1.5 text-[13px] font-bold h-9 cursor-pointer"
        >
          <UserPlus size={14} />
          إنشاء مستخدم
        </Button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <Card className="bg-[#111520] border-[#6c63ff]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-bold text-[#f0f2ff] flex items-center gap-2">
              <Shield size={16} className="text-[#6c63ff]" />
              إنشاء مستخدم جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-semibold text-[#8892b0] mb-1 block">اسم المستخدم (للدخول)</label>
                <Input
                  placeholder="مثال: amira2024"
                  value={newUser.username}
                  onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                  className="h-9 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#8892b0] mb-1 block">كلمة المرور</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="كلمة المرور"
                    value={newUser.password}
                    onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                    className="h-9 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] pr-3 pl-9"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a5280] hover:text-[#8892b0] cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#8892b0] mb-1 block">الاسم المعروض</label>
                <Input
                  placeholder="مثال: أميرة"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser((p) => ({ ...p, displayName: e.target.value }))}
                  className="h-9 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]"
                />
                {/* Show existing team members as clickable suggestions */}
                {(newUser.role === 'tele' || newUser.role === 'sales') && (
                  <div className="mt-1.5">
                    <span className="text-[11px] text-[#4a5280]">أعضاء التيم الموجودين ({newUser.role === 'tele' ? 'تيلي' : 'سيلز'}):</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(team[newUser.role] || []).map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setNewUser((p) => ({ ...p, displayName: name }))}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                            newUser.displayName === name
                              ? 'bg-[#6c63ff]/20 border-[#6c63ff]/40 text-[#a8a3ff]'
                              : 'bg-[#1c2234] border-white/[0.06] text-[#8892b0] hover:border-[#6c63ff]/30 hover:text-[#a8a3ff]'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                      {(team[newUser.role] || []).length === 0 && (
                        <span className="text-[11px] text-[#4a5280]">لا يوجد أعضاء</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#8892b0] mb-1 block">الدور</label>
                <Select value={newUser.role} onValueChange={(v: 'tele' | 'sales' | 'admin') => setNewUser((p) => ({ ...p, role: v }))}>
                  <SelectTrigger className="h-9 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111520] border-white/[0.08]">
                    <SelectItem value="tele" className="text-[13px]">تيلي</SelectItem>
                    <SelectItem value="sales" className="text-[13px]">سيلز</SelectItem>
                    <SelectItem value="admin" className="text-[13px]">أدمن</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button
                onClick={handleCreateUser}
                disabled={saving}
                className="bg-[#00d4aa] hover:bg-[#00b894] text-[#0a0d14] gap-1.5 text-[13px] font-bold h-9 cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                إنشاء المستخدم
              </Button>
              <Button
                onClick={() => { setShowAddForm(false); setNewUser({ username: '', password: '', displayName: '', role: 'tele' }) }}
                className="bg-[#1c2234] text-[#8892b0] hover:text-[#f0f2ff] text-[13px] font-bold h-9 border-0 cursor-pointer"
              >
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset Password Form */}
      {resetUserId && (
        <Card className="bg-[#111520] border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound size={16} className="text-amber-400" />
              <span className="text-[13px] text-[#f0f2ff] font-semibold">إعادة تعيين كلمة المرور</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="كلمة المرور الجديدة"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="h-9 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] max-w-[250px]"
                dir="ltr"
              />
              <Button
                onClick={handleResetPassword}
                disabled={resetSaving}
                className="bg-amber-500 hover:bg-amber-600 text-[#0a0d14] gap-1.5 text-[13px] font-bold h-9 cursor-pointer"
              >
                {resetSaving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                تحديث
              </Button>
              <Button
                onClick={() => { setResetUserId(null); setResetPassword('') }}
                className="bg-[#1c2234] text-[#8892b0] hover:text-[#f0f2ff] text-[13px] font-bold h-9 border-0 cursor-pointer"
              >
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#6c63ff]" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-[#4a5280]">
              <div className="text-[30px] mb-2">👤</div>
              <div className="text-[13px]">لا يوجد مستخدمين</div>
              <div className="text-[12px] font-medium mt-1">اضغط &quot;إنشاء مستخدم&quot; لإضافة مستخدم جديد</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">المستخدم</TableHead>
                    <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">اسم الدخول</TableHead>
                    <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">الدور</TableHead>
                    <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">الحالة</TableHead>
                    <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">آخر دخول</TableHead>
                    <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[120px]">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className={`border-b border-white/[0.04] ${!user.is_active ? 'opacity-50' : ''}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 ${user.role === 'admin' ? 'bg-amber-500/15 text-amber-400' : user.role === 'tele' ? 'bg-[#6c63ff]/15 text-[#a8a3ff]' : 'bg-[#00d4aa]/15 text-[#00d4aa]'}`}>
                            {(user.display_name || user.username).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-[#f0f2ff] flex items-center gap-1.5">
                              {user.display_name || '—'}
                              {isNameMismatched(user) && (
                                <button
                                  onClick={() => { setLinkingUser(user); setLinkTargetName('') }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold hover:bg-amber-500/25 transition-colors cursor-pointer"
                                  title="الاسم لا يطابق أعضاء التيم — اضغط لربط البيانات"
                                >
                                  <AlertTriangle size={10} />
                                  غير مرتبط
                                </button>
                              )}
                            </div>
                            <div className="text-[11px] text-[#4a5280]">{user.created_at ? new Date(user.created_at).toLocaleDateString('ar-EG') : '—'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] font-semibold text-[#8892b0] font-mono" dir="ltr">{user.username}</TableCell>
                      <TableCell>
                        <Badge className={`text-[11px] font-bold border-0 ${roleColors[user.role] || 'bg-[#1c2234] text-[#8892b0]'}`}>
                          {roleLabels[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[11px] font-bold border-0 ${user.is_active ? 'bg-[#00d4aa]/15 text-[#00d4aa]' : 'bg-red-500/15 text-red-400'}`}>
                          {user.is_active ? 'مفعّل' : 'معطّل'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[12px] text-[#4a5280]">
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'لم يسجل دخول'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {isNameMismatched(user) && (
                            <button
                              onClick={() => { setLinkingUser(user); setLinkTargetName('') }}
                              className="w-7 h-7 rounded-md bg-[#6c63ff]/10 text-[#6c63ff]/70 flex items-center justify-center hover:bg-[#6c63ff]/20 hover:text-[#6c63ff] transition-colors cursor-pointer"
                              title="ربط بالبيانات — نقل ليدز الاسم القديم للحساب ده"
                            >
                              <Link2 size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => setResetUserId(user.id)}
                            className="w-7 h-7 rounded-md bg-amber-500/10 text-amber-400/70 flex items-center justify-center hover:bg-amber-500/20 hover:text-amber-400 transition-colors cursor-pointer"
                            title="تغيير كلمة المرور"
                          >
                            <KeyRound size={12} />
                          </button>
                          <button
                            onClick={() => handleToggleUser(user.id, user.is_active)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer"
                            title={user.is_active ? 'تعطيل' : 'تفعيل'}
                          >
                            {user.is_active ? (
                              <ToggleRight size={16} className="text-[#00d4aa]" />
                            ) : (
                              <ToggleLeft size={16} className="text-red-400" />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteUserId(user.id)}
                            className="w-7 h-7 rounded-md bg-red-500/10 text-red-400/60 flex items-center justify-center hover:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                            title="حذف المستخدم"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete User Confirmation */}
      {deleteUserId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#111520] border border-red-500/20 rounded-xl p-6 max-w-sm w-full" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <h3 className="text-[15px] font-bold text-[#f0f2ff] mb-2">⚠️ حذف مستخدم</h3>
            <p className="text-[13px] text-[#8892b0] mb-4">هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteUser}
                disabled={deleteSaving}
                className="flex-1 h-9 rounded-lg bg-red-500/15 text-red-400 text-[13px] font-bold hover:bg-red-500/25 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {deleteSaving ? 'جاري الحذف...' : 'حذف'}
              </button>
              <button
                onClick={() => setDeleteUserId(null)}
                className="flex-1 h-9 rounded-lg bg-[#1c2234] text-[#8892b0] text-[13px] font-bold hover:bg-[#252b3d] transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Name Dialog */}
      {linkingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#111520] border border-[#6c63ff]/20 rounded-xl p-6 max-w-md w-full" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <h3 className="text-[15px] font-bold text-[#f0f2ff] mb-1 flex items-center gap-2">
              <Link2 size={16} className="text-[#6c63ff]" />
              ربط البيانات بالحساب
            </h3>
            <p className="text-[12px] text-[#8892b0] mb-4">
              اسم المستخدم <span className="text-[#f0f2ff] font-bold">&quot;{linkingUser.display_name}&quot;</span> لا يطابق أي اسم في قائمة التيم.
              اختر اسم التيم القديم عشان ننقل البيانات للحساب ده.
            </p>
            <div className="bg-[#0a0d14] rounded-lg p-3 mb-4 border border-white/[0.06]">
              <div className="text-[11px] text-[#4a5280] mb-2">أسماء التيم الموجودة ({linkingUser.role === 'tele' ? 'تيلي' : 'سيلز'}):</div>
              <div className="flex flex-wrap gap-1.5">
                {(team[linkingUser.role as 'tele' | 'sales'] || []).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setLinkTargetName(name)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border cursor-pointer transition-colors ${
                      linkTargetName === name
                        ? 'bg-[#6c63ff]/20 border-[#6c63ff]/40 text-[#a8a3ff]'
                        : 'bg-[#1c2234] border-white/[0.06] text-[#8892b0] hover:border-[#6c63ff]/30 hover:text-[#a8a3ff]'
                    }`}
                  >
                    {name}
                  </button>
                ))}
                {(team[linkingUser.role as 'tele' | 'sales'] || []).length === 0 && (
                  <span className="text-[12px] text-[#4a5280]">لا يوجد أسماء في التيم</span>
                )}
              </div>
            </div>
            {linkTargetName && (
              <div className="bg-[#6c63ff]/5 rounded-lg p-3 mb-4 border border-[#6c63ff]/10">
                <div className="text-[12px] text-[#8892b0]">
                  سيتم تحويل كل الليدز من <span className="text-amber-400 font-bold">&quot;{linkTargetName}&quot;</span> إلى <span className="text-[#00d4aa] font-bold">&quot;{linkingUser.display_name}&quot;</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleLinkName}
                disabled={linkSaving || !linkTargetName}
                className="flex-1 h-9 rounded-lg bg-[#6c63ff]/15 text-[#a8a3ff] text-[13px] font-bold hover:bg-[#6c63ff]/25 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {linkSaving ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                {linkSaving ? 'جاري الربط...' : 'ربط وتحديث البيانات'}
              </button>
              <button
                onClick={() => { setLinkingUser(null); setLinkTargetName('') }}
                className="flex-1 h-9 rounded-lg bg-[#1c2234] text-[#8892b0] text-[13px] font-bold hover:bg-[#252b3d] transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Settings Tab (Placeholder)
   ═══════════════════════════════════════════════════════ */
function SettingsTab() {
  const theme = useCrmStore((s) => s.theme)
  const toggleTheme = useCrmStore((s) => s.toggleTheme)

  return (
    <div className="space-y-4">
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardHeader>
          <CardTitle className="text-[15px] font-bold text-[#f0f2ff] flex items-center gap-2">
            <Settings size={16} className="text-[#6c63ff]" />
            إعدادات التطبيق
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <span className="text-[13px] font-semibold text-[#8892b0]">الوضع الداكن</span>
            <button
              onClick={toggleTheme}
              className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${theme === 'dark' ? 'bg-[#6c63ff]' : 'bg-[#1c2234]'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-1' : 'translate-x-5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[13px] font-semibold text-[#8892b0]">الإشعارات</span>
            <Badge className="bg-[#00d4aa]/15 text-[#00d4aa] text-[11px] font-bold border-0">مفعّلة</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[13px] font-semibold text-[#8892b0]">المزامنة الفورية</span>
            <Badge className="bg-[#00d4aa]/15 text-[#00d4aa] text-[11px] font-bold border-0">مفعّلة</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Admin Panel Component
   ═══════════════════════════════════════════════════════ */
export function AdminPanel() {
  const adminTab = useCrmStore((s) => s.adminTab)
  const setAdminTab = useCrmStore((s) => s.setAdminTab)

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-[19px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
          لوحة التحكم
        </h2>
        <p className="text-[13px] font-semibold text-[#8892b0] mt-0.5">إدارة شاملة للنظام والفريق والعملاء</p>
      </div>

      {/* Tabs */}
      <Tabs value={adminTab} onValueChange={(v) => setAdminTab(v as AdminTab)}>
        <TabsList className="bg-[#111520] border border-white/[0.06] h-auto p-1 flex-wrap gap-1">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="text-[13px] font-bold data-[state=active]:bg-[#6c63ff]/15 data-[state=active]:text-[#a8a3ff] text-[#8892b0] gap-1 px-3 py-1.5"
              >
                <Icon size={12} />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="tele" className="mt-4">
          <Card className="bg-[#111520] border-white/[0.06] p-4">
            <p className="text-[13px] text-[#8892b0] text-center py-8">
              شيت التيلي — استخدم &quot;شيت التيلي&quot; من القائمة الجانبية للعرض الكامل
            </p>
          </Card>
        </TabsContent>
        <TabsContent value="sales" className="mt-4">
          <Card className="bg-[#111520] border-white/[0.06] p-4">
            <p className="text-[13px] text-[#8892b0] text-center py-8">
              شيت السيلز — استخدم &quot;شيت السيلز&quot; من القائمة الجانبية للعرض الكامل
            </p>
          </Card>
        </TabsContent>
        <TabsContent value="all-leads" className="mt-4">
          <AllLeadsTab />
        </TabsContent>
        <TabsContent value="archive" className="mt-4">
          <ArchiveTab />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <TeamTab />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
