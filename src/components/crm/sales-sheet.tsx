'use client'

import { useMemo, useState, useCallback } from 'react'
import { useCrmStore, SALES_STATUSES, ATTENDANCE_STATUSES, formatDate, getDateRange } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiUpdateLead, apiDeleteLead, apiArchiveLeads, apiDeleteLeadsBulk } from '@/lib/supabase'
import {
  Search, Plus, Trash2, Archive, Phone, Filter, X, Check,
  Calendar, Loader2, Clock, Video, MapPin,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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

/* ═══════════════════════════════════════════════════════
   PAGE SIZE for pagination
   ═══════════════════════════════════════════════════════ */
const PAGE_SIZE = 50

/* ═══════════════════════════════════════════════════════
   Inline Editable Cell
   ═══════════════════════════════════════════════════════ */
function EditableCell({
  value,
  onSave,
  type = 'text',
  placeholder = '—',
}: {
  value: string
  onSave: (val: string) => void
  type?: 'text' | 'date' | 'time'
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = useCallback(() => {
    if (draft !== value) onSave(draft)
    setEditing(false)
  }, [draft, value, onSave])

  if (editing) {
    return (
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[14px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]"
        autoFocus
      />
    )
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true) }}
      className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[14px] min-h-[28px] inline-flex items-center"
    >
      {value || <span className="text-[#4a5280]">{placeholder}</span>}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
   Lazy Select Cell — only renders Select when clicked
   ═══════════════════════════════════════════════════════ */
function LazySelectCell({
  value,
  options,
  onChange,
  displayMap,
  placeholder = '—',
  className = '',
}: {
  value: string
  options: Array<{ key: string; label: string }>
  onChange: (val: string) => void
  displayMap?: Record<string, string>
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    const displayLabel = displayMap?.[value] || options.find(o => o.key === value)?.label || value || placeholder
    return (
      <button
        onClick={() => setOpen(true)}
        className={`h-7 text-[13px] px-2 rounded border border-white/[0.06] bg-[#0a0d14] text-[#f0f2ff] hover:border-[#6c63ff]/30 transition-colors cursor-pointer text-right w-full ${className}`}
      >
        {displayLabel}
      </button>
    )
  }

  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => {
        onChange(v)
        setOpen(false)
      }}
      open={open}
      onOpenChange={(o) => {
        if (!o) setOpen(false)
      }}
    >
      <SelectTrigger className={`h-7 text-[13px] bg-[#0a0d14] border-[#6c63ff]/40 text-[#f0f2ff] ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-[#111520] border-white/[0.08]">
        {options.map((opt) => (
          <SelectItem key={opt.key} value={opt.key} className="text-[13px] text-[#f0f2ff]">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ═══════════════════════════════════════════════════════
   Sales Sheet Component — PERFORMANCE OPTIMIZED
   - Removed Framer Motion (was creating stagger timers per row)
   - Added pagination (50 rows per page)
   - Lazy Select cells (only mount portal when editing)
   ═══════════════════════════════════════════════════════ */
export function SalesSheet() {
  const leads = useCrmStore((s) => s.leads)
  const team = useCrmStore((s) => s.team)
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)
  const addToast = useCrmStore((s) => s.addToast)
  const selectedLeadIds = useCrmStore((s) => s.selectedLeadIds)
  const toggleLeadSelection = useCrmStore((s) => s.toggleLeadSelection)
  const clearSelectedLeadIds = useCrmStore((s) => s.clearSelectedLeadIds)
  const selectAllLeads = useCrmStore((s) => s.selectAllLeads)
  const searchQueries = useCrmStore((s) => s.searchQueries)
  const setSearchQuery = useCrmStore((s) => s.setSearchQuery)
  const dateRangeFilters = useCrmStore((s) => s.dateRangeFilters)
  const setDateRangeFilter = useCrmStore((s) => s.setDateRangeFilter)
  const updateLeadInCache = useCrmStore((s) => s.updateLeadInCache)
  const removeLeadFromCache = useCrmStore((s) => s.removeLeadFromCache)
  const batchRemoveLeadsFromCache = useCrmStore((s) => s.batchRemoveLeadsFromCache)
  const archiveLeadsInCache = useCrmStore((s) => s.archiveLeadsInCache)

  const viewKey = 'sales-sheet'
  const selected = selectedLeadIds[viewKey] || []
  const searchQuery = searchQueries[viewKey] || ''
  const dateFilter = dateRangeFilters[viewKey] || { preset: 'all' }

  // Sales users are locked to their own data; admin can see everyone
  const isLockedToSelf = currentRole === 'sales'
  const [selectedSales, setSelectedSales] = useState<string>(
    isLockedToSelf && currentUser ? currentUser : 'all'
  )
  const [currentPage, setCurrentPage] = useState(1)

  /* ─── Filtered leads ─── */
  const filteredLeads = useMemo(() => {
    let result = leads.filter((l) => !l.isArchived)

    // Sales users can ONLY see leads assigned to them
    if (isLockedToSelf) {
      result = result.filter((l) => l.sales === currentUser)
    } else if (selectedSales !== 'all') {
      result = result.filter((l) => l.sales === selectedSales)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (l) =>
          l.customerName?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.storeUrl?.toLowerCase().includes(q)
      )
    }

    if (dateFilter.preset !== 'all') {
      const { from, to } = getDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo)
      result = result.filter((l) => l.createdAt >= from && l.createdAt < to)
    }

    return result
  }, [leads, selectedSales, searchQuery, dateFilter, isLockedToSelf, currentUser])

  /* ─── Paginated leads ─── */
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE))
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredLeads.slice(start, start + PAGE_SIZE)
  }, [filteredLeads, currentPage])

  // Reset page when filters change
  const [prevFilterKey, setPrevFilterKey] = useState('')
  const filterKey = `${selectedSales}|${searchQuery}|${dateFilter.preset}`
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setCurrentPage(1)
  }

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const total = filteredLeads.length
    const meetingsToday = filteredLeads.filter((l) => {
      if (!l.meetingDate) return false
      const today = new Date().toISOString().split('T')[0]
      return l.meetingDate === today
    }).length
    const attended = filteredLeads.filter((l) => l.attended === 'attended').length
    const noShow = filteredLeads.filter((l) => l.attended === 'no-show').length
    const closedWon = filteredLeads.filter((l) => l.salesStatus === 'closed-won').length
    return { total, meetingsToday, attended, noShow, closedWon }
  }, [filteredLeads])

  /* ─── Update lead field ─── */
  const handleUpdateField = useCallback(async (id: string, field: string, value: string) => {
    const updates: Partial<Lead> = { [field]: value }
    updateLeadInCache(id, updates)
    try {
      await apiUpdateLead(id, updates)
    } catch {
      addToast('error', 'فشل التحديث')
    }
  }, [updateLeadInCache, addToast])

  /* ─── Delete single lead ─── */
  const handleDeleteLead = useCallback(async (id: string) => {
    removeLeadFromCache(id)
    try {
      await apiDeleteLead(id)
      addToast('success', 'تم حذف العميل')
    } catch {
      addToast('error', 'فشل الحذف')
    }
  }, [removeLeadFromCache, addToast])

  /* ─── Bulk actions ─── */
  const handleBulkArchive = useCallback(async () => {
    if (selected.length === 0) return
    const byName = currentUser || 'unknown'
    archiveLeadsInCache(selected, byName)
    try {
      await apiArchiveLeads(selected, byName)
      addToast('success', `تم أرشفة ${selected.length} عميل`)
    } catch {
      addToast('error', 'فشل الأرشفة')
    }
    clearSelectedLeadIds(viewKey)
  }, [selected, currentUser, archiveLeadsInCache, apiArchiveLeads, addToast, clearSelectedLeadIds])

  const handleBulkDelete = useCallback(async () => {
    if (selected.length === 0) return
    const ids = [...selected]
    batchRemoveLeadsFromCache(ids)
    try {
      await apiDeleteLeadsBulk(ids)
      addToast('success', `تم حذف ${ids.length} عميل`)
    } catch {
      addToast('error', 'فشل الحذف')
    }
    clearSelectedLeadIds(viewKey)
  }, [selected, batchRemoveLeadsFromCache, apiDeleteLeadsBulk, addToast, clearSelectedLeadIds])

  /* ─── Mark attendance ─── */
  const handleMarkAttendance = useCallback(async (id: string, value: string) => {
    const updates: Partial<Lead> = {
      attended: value,
      attendanceMarkedAt: Date.now(),
      attendanceMarkedBy: currentUser || '',
    }
    updateLeadInCache(id, updates)
    try {
      await apiUpdateLead(id, updates)
      addToast('success', value === 'attended' ? 'تم تأكيد الحضور' : 'تم تسجيل عدم الحضور')
    } catch {
      addToast('error', 'فشل تسجيل الحضور')
    }
  }, [updateLeadInCache, currentUser, addToast])

  /* ─── Display label maps for LazySelect ─── */
  const salesStatusLabels = useMemo(() => {
    const m: Record<string, string> = {}
    SALES_STATUSES.forEach(s => { m[s.key] = s.label })
    return m
  }, [])



  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            شيت السيلز
          </h2>
          <p className="text-[14px] text-[#8892b0] mt-0.5">إدارة اجتماعات ومتابعة العملاء</p>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'إجمالي العملاء', value: stats.total, color: '#6c63ff' },
          { label: 'اجتماعات اليوم', value: stats.meetingsToday, color: '#ffd166' },
          { label: 'حضر', value: stats.attended, color: '#00d4aa' },
          { label: 'لم يحضر', value: stats.noShow, color: '#ff6b6b' },
          { label: 'تم التقفيل', value: stats.closedWon, color: '#00d4aa' },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-[#111520] border border-white/[0.06] rounded-xl p-3"
          >
            <div className="text-[13px] text-[#8892b0]">{s.label}</div>
            <div className="text-[22px] font-bold mt-0.5" style={{ color: s.color, fontFamily: 'Cairo, sans-serif' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Filters Row ─── */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Sales filter — locked for sales users, selectable for admin */}
            {isLockedToSelf ? (
              <div className="h-8 px-3 rounded-md border border-white/[0.08] bg-[#0a0d14] flex items-center gap-2 text-[14px] text-[#f0f2ff] w-[140px]">
                <Filter size={12} className="text-[#6c63ff]" />
                <span>{currentUser}</span>
              </div>
            ) : (
              <Select value={selectedSales} onValueChange={setSelectedSales}>
                <SelectTrigger className="w-[140px] h-8 text-[14px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                  <Filter size={12} className="text-[#6c63ff]" />
                  <SelectValue placeholder="فلتر السيلز" />
                </SelectTrigger>
                <SelectContent className="bg-[#111520] border-white/[0.08]">
                  <SelectItem value="all" className="text-[14px] text-[#f0f2ff]">الكل</SelectItem>
                  {team.sales.map((name) => (
                    <SelectItem key={name} value={name} className="text-[14px] text-[#f0f2ff]">{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4a5280]" />
              <Input
                placeholder="بحث بالاسم أو الرقم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(viewKey, e.target.value)}
                className="h-8 text-[14px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] pr-8 placeholder:text-[#4a5280]"
              />
            </div>

            <Select value={dateFilter.preset} onValueChange={(v) => setDateRangeFilter(viewKey, { preset: v })}>
              <SelectTrigger className="w-[120px] h-8 text-[14px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                <Calendar size={12} className="text-[#6c63ff]" />
                <SelectValue placeholder="التاريخ" />
              </SelectTrigger>
              <SelectContent className="bg-[#111520] border-white/[0.08]">
                <SelectItem value="all" className="text-[14px] text-[#f0f2ff]">الكل</SelectItem>
                <SelectItem value="today" className="text-[14px] text-[#f0f2ff]">اليوم</SelectItem>
                <SelectItem value="yesterday" className="text-[14px] text-[#f0f2ff]">أمس</SelectItem>
                <SelectItem value="week" className="text-[14px] text-[#f0f2ff]">هذا الأسبوع</SelectItem>
                <SelectItem value="month" className="text-[14px] text-[#f0f2ff]">هذا الشهر</SelectItem>
              </SelectContent>
            </Select>

            {selected.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={handleBulkArchive}
                  size="sm"
                  className="h-8 text-[13px] bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-0 gap-1 cursor-pointer"
                >
                  <Archive size={12} />
                  أرشفة ({selected.length})
                </Button>
                <Button
                  onClick={handleBulkDelete}
                  size="sm"
                  className="h-8 text-[13px] bg-red-500/15 text-red-400 hover:bg-red-500/25 border-0 gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                  حذف ({selected.length})
                </Button>
                <Button
                  onClick={() => clearSelectedLeadIds(viewKey)}
                  size="sm"
                  className="h-8 text-[13px] bg-[#1c2234] text-[#8892b0] hover:text-[#f0f2ff] border-0 cursor-pointer"
                >
                  <X size={12} />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Main Table ─── */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="w-[40px] text-right text-[13px] text-[#4a5280]">
                    <Checkbox
                      checked={selected.length === paginatedLeads.length && paginatedLeads.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) selectAllLeads(viewKey, paginatedLeads.map((l) => l.id))
                        else clearSelectedLeadIds(viewKey)
                      }}
                      className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]"
                    />
                  </TableHead>
                  <TableHead className="text-right text-[13px] text-[#4a5280]">اسم العميل</TableHead>
                  <TableHead className="text-right text-[13px] text-[#4a5280]">رقم التليفون</TableHead>
                  <TableHead className="text-right text-[13px] text-[#4a5280]">حالة السيلز</TableHead>
                  <TableHead className="text-right text-[13px] text-[#4a5280]">تاريخ الاجتماع</TableHead>
                  <TableHead className="text-right text-[13px] text-[#4a5280]">الوقت</TableHead>
                  <TableHead className="text-right text-[13px] text-[#4a5280]">الحضور</TableHead>
                  <TableHead className="text-right text-[13px] text-[#4a5280] w-[50px]">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-[#4a5280]">
                      <div className="text-[34px] mb-2">📊</div>
                      <div className="text-[15px]">لا يوجد عملاء مسندين للسيلز</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead) => {
                    const isSelected = selected.includes(lead.id)
                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-white/[0.04] transition-colors ${
                          isSelected ? 'bg-[#6c63ff]/5' : 'hover:bg-[#1c2234]/50'
                        }`}
                      >
                        <TableCell className="w-[40px]">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleLeadSelection(viewKey, lead.id)}
                            className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]"
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <EditableCell
                              value={lead.customerName}
                              onSave={(v) => handleUpdateField(lead.id, 'customerName', v)}
                              placeholder="اسم العميل"
                            />
                            {lead.brief && (
                              <div className="text-[12px] text-[#4a5280] mt-0.5 truncate max-w-[140px]">
                                {lead.brief}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${lead.phone}`}
                              className="w-6 h-6 rounded-md bg-[#00d4aa]/10 flex items-center justify-center text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors shrink-0"
                            >
                              <Phone size={10} />
                            </a>
                            <EditableCell
                              value={lead.phone}
                              onSave={(v) => handleUpdateField(lead.id, 'phone', v)}
                              placeholder="الرقم"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <LazySelectCell
                            value={lead.salesStatus || 'new'}
                            options={SALES_STATUSES}
                            onChange={(v) => handleUpdateField(lead.id, 'salesStatus', v)}
                            displayMap={salesStatusLabels}
                            className="w-[120px]"
                          />
                        </TableCell>
                        <TableCell>
                          <EditableCell
                            value={lead.meetingDate}
                            onSave={(v) => handleUpdateField(lead.id, 'meetingDate', v)}
                            type="date"
                            placeholder="التاريخ"
                          />
                        </TableCell>
                        <TableCell>
                          <EditableCell
                            value={lead.meetingTime}
                            onSave={(v) => handleUpdateField(lead.id, 'meetingTime', v)}
                            type="time"
                            placeholder="الوقت"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleMarkAttendance(lead.id, 'attended')}
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[12px] transition-colors cursor-pointer ${
                                lead.attended === 'attended'
                                  ? 'bg-[#00d4aa]/25 text-[#00d4aa]'
                                  : 'bg-[#1c2234] text-[#4a5280] hover:bg-[#00d4aa]/10 hover:text-[#00d4aa]'
                              }`}
                              title="حضر"
                            >
                              ✅
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(lead.id, 'pending')}
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[12px] transition-colors cursor-pointer ${
                                lead.attended === 'pending'
                                  ? 'bg-[#ffd166]/25 text-[#ffd166]'
                                  : 'bg-[#1c2234] text-[#4a5280] hover:bg-[#ffd166]/10 hover:text-[#ffd166]'
                              }`}
                              title="فى الانتظار"
                            >
                              ⏳
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(lead.id, 'no-show')}
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[12px] transition-colors cursor-pointer ${
                                lead.attended === 'no-show'
                                  ? 'bg-red-500/25 text-red-400'
                                  : 'bg-[#1c2234] text-[#4a5280] hover:bg-red-500/10 hover:text-red-400'
                              }`}
                              title="لم يحضر"
                            >
                              ❌
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="w-7 h-7 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 size={12} />
                          </button>
                        </TableCell>
                      </tr>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {filteredLeads.length > 0 && (
            <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center justify-between text-[13px] text-[#4a5280]">
              <span>عرض {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLeads.length)} من {filteredLeads.length} عميل</span>
              <div className="flex items-center gap-2">
                {selected.length > 0 && (
                  <span className="text-[#6c63ff]">{selected.length} محدد</span>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-7 h-7 rounded-md bg-[#1c2234] text-[#8892b0] flex items-center justify-center hover:bg-[#2a3050] transition-colors cursor-pointer disabled:opacity-30"
                    >
                      <ChevronRight size={12} />
                    </button>
                    <span className="text-[#f0f2ff] font-medium px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="w-7 h-7 rounded-md bg-[#1c2234] text-[#8892b0] flex items-center justify-center hover:bg-[#2a3050] transition-colors cursor-pointer disabled:opacity-30"
                    >
                      <ChevronLeft size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
