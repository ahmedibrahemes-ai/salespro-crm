'use client'

import { useMemo, useState, useCallback } from 'react'
import { useCrmStore, getDateRange, ATTENDANCE_STATUSES } from '@/lib/store'
import { normalizePhone, isClosedWon, CLOSED_WON_KEY } from '@/lib/crm-utils'
import type { Lead } from '@/lib/supabase'
import { apiUpdateLead, handleServerError } from '@/lib/supabase'
import {
  Search, Phone, Filter, X, Calendar,
  ChevronLeft, ChevronRight, ExternalLink, CalendarCheck,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

/* Same helpers as sales-sheet */
function EditableCell({ value, onSave, type = 'text', placeholder = '—' }: {
  value: string; onSave: (val: string) => void; type?: 'text' | 'date' | 'time'; placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = useCallback(() => { if (draft !== value) onSave(draft); setEditing(false) }, [draft, value, onSave])
  if (editing) {
    return <input type={type} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[13px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]" autoFocus />
  }
  return <span onClick={() => { setDraft(value); setEditing(true) }} className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[13px] font-medium min-h-[28px] inline-block truncate max-w-full">{value || <span className="text-[#4a5280]">{placeholder}</span>}</span>
}

function BriefCell({ value, onSave, placeholder = '—' }: { value: string; onSave: (val: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)
  const commit = useCallback(() => { if (draft !== value) onSave(draft); setEditing(false); setOpen(false) }, [draft, value, onSave])
  if (editing) {
    return <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } if (e.key === 'Escape') { setDraft(value); setEditing(false) } }} className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[13px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff] resize-none" rows={3} autoFocus />
  }
  const isEmpty = !value || value.trim() === ''
  if (isEmpty) return <span onClick={() => { setDraft(value); setEditing(true) }} className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[13px] text-[#4a5280] min-h-[28px] inline-block truncate max-w-full">{placeholder}</span>
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span onClick={() => { setDraft(value); setEditing(true) }} className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[13px] font-medium min-h-[28px] inline-block truncate max-w-full block">
        {value}
      </span>
      {open && (
        <div className="absolute bottom-full right-0 mb-1 w-[400px] max-w-[400px] p-3 rounded-lg bg-[#1a1f2e] border border-white/[0.08] shadow-xl text-[13px] leading-relaxed whitespace-pre-wrap break-words text-[#f0f2ff] z-50" style={{ fontFamily: 'Cairo, sans-serif' }} dir="rtl">
          {value}
          <div className="mt-2 pt-2 border-t border-white/[0.06] text-[10px] text-[#4a5280]">اضغط للتعديل</div>
        </div>
      )}
    </div>
  )
}

function NotesCell({ value, onSave, placeholder = 'ملاحظات' }: { value: string; onSave: (val: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)
  const commit = useCallback(() => { if (draft !== value) onSave(draft); setEditing(false); setOpen(false) }, [draft, value, onSave])
  if (editing) {
    return <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }} className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[13px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]" placeholder="اكتب ملاحظة..." autoFocus />
  }
  const isEmpty = !value || value.trim() === ''
  if (isEmpty) {
    return <span onClick={() => { setDraft(value); setEditing(true) }} className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[13px] text-[#4a5280] min-h-[28px] inline-block truncate max-w-full not-italic">{placeholder}</span>
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span onClick={() => { setDraft(value); setEditing(true) }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[13px] text-[#8892b0] min-h-[28px] inline-block truncate max-w-full italic block" title="">
          {value}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="bg-[#1a1f2e] border-white/[0.08] text-[#f0f2ff] max-w-[400px] w-[400px] p-3 z-50" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ fontFamily: 'Cairo, sans-serif' }} dir="rtl">{value}</div>
        <div className="mt-2 pt-2 border-t border-white/[0.06] text-[10px] text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>اضغط للتعديل</div>
      </PopoverContent>
    </Popover>
  )
}

/* Lazy-select dropdown for the "حالة العميل" column — same pattern as sales-sheet */
function LazySelectCell({
  value,
  options,
  onChange,
  placeholder = '—',
  allowClear = false,
}: {
  value: string | null | undefined
  options: Array<{ key: string; label: string }>
  onChange: (val: string) => void
  placeholder?: string
  allowClear?: boolean
}) {
  const [open, setOpen] = useState(false)
  const matchingOption = options.find(o => o.key === value)
  const displayLabel = matchingOption?.label || placeholder

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-7 text-[13px] font-medium px-2 rounded border border-white/[0.06] bg-[#0a0d14] text-[#f0f2ff] hover:border-[#6c63ff]/30 transition-colors cursor-pointer text-right w-full"
      >
        {displayLabel}
      </button>
    )
  }
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => {
        if (v === '__clear__') onChange('')
        else onChange(v)
      }}
      onOpenChange={(o) => { if (!o) setOpen(false) }}
      defaultOpen
    >
      <SelectTrigger className="h-7 text-[13px] bg-[#0a0d14] border-[#6c63ff]/40 text-[#f0f2ff]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-[#111520] border-white/[0.08]">
        {allowClear && value && (
          <SelectItem value="__clear__" className="text-[13px] text-amber-400 border-b border-white/[0.04]">
            ✕ مسح الحالة
          </SelectItem>
        )}
        {options.map((opt) => (
          <SelectItem key={opt.key} value={opt.key} className="text-[13px] text-[#f0f2ff]">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const SALES_CONTACT_RESULTS = [
  { key: 'none', label: '—' }, { key: 'replied', label: '✅ رد' }, { key: 'no-reply', label: '📵 لم يرد' },
  { key: 'busy', label: '🔴 مشغول' }, { key: 'wrong-number', label: '❌ رقم غلط' },
  { key: 'customer-service', label: '🎧 خدمة عملاء' }, { key: 'call', label: '📞 كول' },
  { key: 'whatsapp', label: '💬 واتس' }, { key: 'call-whatsapp', label: '📞💬 كول + واتس' },
]
const SALES_STATUSES = [
  { key: 'meeting', label: '📅 اجتماع' }, { key: 'not-interested', label: '🚫 غير مهتم' },
  { key: 'followup-1', label: '🔄 متابعة 1' }, { key: 'followup-2', label: '🔄 متابعة 2' },
  { key: 'followup-3', label: '🔄 متابعة 3' },
  { key: CLOSED_WON_KEY, label: '🏆 تم التقفيل' },
]

const PAGE_SIZE = 50

export function FollowUpSection() {
  const leads = useCrmStore((s) => s.leads)
  const team = useCrmStore((s) => s.team)
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)
  const addToast = useCrmStore((s) => s.addToast)
  const searchQueries = useCrmStore((s) => s.searchQueries)
  const setSearchQuery = useCrmStore((s) => s.setSearchQuery)
  const dateRangeFilters = useCrmStore((s) => s.dateRangeFilters)
  const setDateRangeFilter = useCrmStore((s) => s.setDateRangeFilter)
  const updateLeadInCache = useCrmStore((s) => s.updateLeadInCache)
  const revertLeadInCache = useCrmStore((s) => s.revertLeadInCache)
  const storeSelectedSales = useCrmStore((s) => s.selectedSalesMember)
  const setStoreSelectedSales = useCrmStore((s) => s.setSelectedSalesMember)

  const viewKey = 'follow-up'
  const searchQuery = searchQueries[viewKey] || ''
  const dateFilter = dateRangeFilters[viewKey] || { preset: 'all' }
  const isLockedToSelf = currentRole === 'sales'

  const [currentPage, setCurrentPage] = useState(1)
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined)
  const [toDate, setToDate] = useState<Date | undefined>(undefined)
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)

  const effectiveSelectedSales = isLockedToSelf ? (currentUser || 'all')
    : (storeSelectedSales !== 'all' && team.sales.includes(storeSelectedSales) ? storeSelectedSales : 'all')
  const selectedSales = effectiveSelectedSales
  const setSelectedSales = (val: string) => { if (!isLockedToSelf) setStoreSelectedSales(val) }

  /* Filter: leads in meeting/followup status, PLUS closed-won (تم التقفيل),
     PLUS old tele-transferred meetings (status=null legacy data).
     - Shows: meeting, followup-1/2/3, closed-won
     - ALSO shows: status=null leads that are tele-transferred meetings
       (l.tele set + l.meetingDate set). These are OLD meetings created before
       the status system was implemented — they need follow-up too.
     - Hides: not-interested, closed-lost, and status=null leads that are NOT
       tele-transferred meetings (sales-originated leads without status stay out).
     closed-won leads stay visible (with a dark highlight) so sales don't
     re-contact a customer whose deal is already closed. */
  const VALID_FOLLOWUP_STATUSES = new Set(['meeting', 'followup-1', 'followup-2', 'followup-3', CLOSED_WON_KEY])

  const { filteredLeads, stats } = useMemo(() => {
    const needsDateFilter = dateFilter.preset !== 'all'
    const dateRange = needsDateFilter ? getDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo) : null
    const q = searchQuery.trim().toLowerCase()
    let total = 0, attended = 0, noShow = 0, closedWon = 0
    const result: Lead[] = []

    for (const l of leads) {
      if (l.isArchived) continue

      // Determine if this lead should appear in follow-up
      const hasValidStatus = l.status && VALID_FOLLOWUP_STATUSES.has(l.status)
      // OLD tele-transferred meetings: status is null but it's a meeting
      // transferred from tele (has tele set + has meetingDate). These are
      // legacy leads created before the status system — include them so sales
      // can follow up on old meetings.
      const isOldTeleMeeting = !l.status
        && !!l.tele && l.tele.trim() !== ''
        && !!l.meetingDate && l.meetingDate.trim() !== ''

      if (!hasValidStatus && !isOldTeleMeeting) continue

      if (isLockedToSelf && l.sales !== currentUser) continue
      if (!isLockedToSelf && selectedSales !== 'all' && l.sales !== selectedSales) continue
      if (q && !(l.customerName?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q) || l.storeUrl?.toLowerCase().includes(q))) continue
      if (dateRange && l.createdAt && (l.createdAt < dateRange.from || l.createdAt >= dateRange.to)) continue

      result.push(l)
      total++
      if (l.attended === 'attended') attended++
      if (l.attended === 'no-show') noShow++
      if (isClosedWon(l)) closedWon++
    }

    // Sort by assignedAt (tele transfer time) DESC, then by createdAt DESC as fallback
    // This keeps the order stable based on when the lead was FIRST assigned to sales
    // (not when status was last changed — so changing to followup-1 doesn't reshuffle)
    result.sort((a, b) => {
      const aTime = a.assignedAt || a.createdAt || 0
      const bTime = b.assignedAt || b.createdAt || 0
      return bTime - aTime
    })

    return { filteredLeads: result, stats: { total, attended, noShow, closedWon } }
  }, [leads, selectedSales, searchQuery, dateFilter, isLockedToSelf, currentUser])

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE))
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredLeads.slice(start, start + PAGE_SIZE)
  }, [filteredLeads, currentPage])

  const [prevFilterKey, setPrevFilterKey] = useState('')
  const filterKey = `${selectedSales}|${searchQuery}|${dateFilter.preset}`
  if (filterKey !== prevFilterKey) { setPrevFilterKey(filterKey); setCurrentPage(1) }

  const handleUpdateField = useCallback(async (id: string, field: string, value: string) => {
    // Capture the OLD lead state BEFORE the optimistic update — for rollback
    const oldLead = leads.find(l => l.id === id)
    if (!oldLead) return

    const updates: Partial<Lead> = { [field]: value || null }
    if (field === 'contactResult') {
      updates.contactResultAt = value ? Date.now() : null
    }
    if (field === 'status') {
      if (value === 'meeting') {
        if (!oldLead.assignedAt) {
          updates.assignedAt = Date.now()
        }
      } else if (value === CLOSED_WON_KEY) {
        updates.salesStatus = CLOSED_WON_KEY
      } else {
        if (oldLead.salesStatus === CLOSED_WON_KEY) {
          updates.salesStatus = null
        }
        if (!oldLead.tele || oldLead.tele.trim() === '') {
          updates.assignedAt = null as unknown as number
        }
      }
    }
    updateLeadInCache(id, updates)
    try {
      await apiUpdateLead(id, updates)
    } catch (err) {
      // If session expired, handleServerError will rollback + toast + logout.
      // For other errors, rollback + show generic error.
      if (!handleServerError(err, { id, oldLead })) {
        revertLeadInCache(id, oldLead)
        addToast('error', 'فشل التحديث — حاول مرة أخرى')
      }
    }
  }, [updateLeadInCache, revertLeadInCache, addToast, leads])

  return (
    <div className="space-y-4" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-3">
          <p className="text-[11px] text-[#8892b0]">إجمالي الاجتماعات</p>
          <p className="text-[20px] font-extrabold text-[#f0f2ff]">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-3">
          <p className="text-[11px] text-[#8892b0]">حضروا</p>
          <p className="text-[20px] font-extrabold text-emerald-400">{stats.attended}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-3">
          <p className="text-[11px] text-[#8892b0]">لم يحضروا</p>
          <p className="text-[20px] font-extrabold text-red-400">{stats.noShow}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-3">
          <p className="text-[11px] text-[#8892b0]">تم التقفيل</p>
          <p className="text-[20px] font-extrabold text-amber-400">{stats.closedWon}</p>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {isLockedToSelf ? (
              <div className="h-8 px-3 rounded-md border border-white/[0.08] bg-[#0a0d14] flex items-center gap-2 text-[13px] font-medium text-[#f0f2ff] w-[140px]">
                <Filter size={12} className="text-[#6c63ff]" /><span>{currentUser}</span>
              </div>
            ) : (
              <Select value={selectedSales} onValueChange={setSelectedSales}>
                <SelectTrigger className="w-[140px] h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                  <Filter size={12} className="text-[#6c63ff]" /><SelectValue placeholder="فلتر السيلز" />
                </SelectTrigger>
                <SelectContent className="bg-[#111520] border-white/[0.08]">
                  <SelectItem value="all" className="text-[13px] text-[#f0f2ff]">الكل</SelectItem>
                  {team.sales.map((name) => <SelectItem key={name} value={name} className="text-[13px] text-[#f0f2ff]">{name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4a5280]" />
              <Input placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(viewKey, e.target.value)} className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] pr-8 placeholder:text-[#4a5280]" />
            </div>
            <Select value={dateFilter.preset} onValueChange={(v) => { setDateRangeFilter(viewKey, { preset: v, customFrom: undefined, customTo: undefined }); if (v !== 'custom') { setFromDate(undefined); setToDate(undefined) } }}>
              <SelectTrigger className="w-[130px] h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]"><Calendar size={12} className="text-[#6c63ff]" /><SelectValue placeholder="التاريخ" /></SelectTrigger>
              <SelectContent className="bg-[#111520] border-white/[0.08]">
                <SelectItem value="all" className="text-[13px] text-[#f0f2ff]">الكل</SelectItem>
                <SelectItem value="today" className="text-[13px] text-[#f0f2ff]">اليوم</SelectItem>
                <SelectItem value="week" className="text-[13px] text-[#f0f2ff]">هذا الأسبوع</SelectItem>
                <SelectItem value="month" className="text-[13px] text-[#f0f2ff]">هذا الشهر</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="w-[36px] text-center text-[13px] font-bold text-[#4a5280]">#</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[160px] max-w-[160px]">لينك المتجر</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[130px] max-w-[130px]">رقم الجوال</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[150px] max-w-[150px]">اسم العميل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[180px] max-w-[180px]">البريف</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[110px]">تاريخ الاجتماع</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[110px]">حالة العميل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[110px]">الحضور</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[180px]">ملاحظات Follow-Up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-[#4a5280]">
                      <div className="text-[30px] mb-2"><CalendarCheck size={30} className="mx-auto text-[#4a5280]" /></div>
                      <div className="text-[14px] font-semibold">لا يوجد اجتماعات للمتابعة</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead, idx) => {
                    const isTeleTransfer = !!(lead.tele && lead.tele.trim() !== '')
                    const closedWon = isClosedWon(lead)
                    return (
                    <TableRow
                      key={lead.id}
                      className={`border-b border-white/[0.04] transition-colors ${
                        closedWon
                          ? 'bg-emerald-500/[0.10] hover:bg-emerald-500/[0.14] ring-1 ring-inset ring-emerald-500/30'
                          : isTeleTransfer
                            ? 'bg-[#6c63ff]/[0.03] hover:bg-[#1c2234]/50'
                            : 'hover:bg-[#1c2234]/50'
                      }`}
                    >
                      <TableCell className="w-[36px] text-center text-[13px] text-[#4a5280]">
                        {idx + 1}
                        {closedWon && <div className="text-[9px] font-bold text-emerald-400 mt-0.5">مقفّل</div>}
                      </TableCell>
                      {/* لينك المتجر */}
                      <TableCell className="max-w-[160px]">
                        <div className="flex items-center gap-1.5 max-w-[160px]">
                          {lead.storeUrl && <a href={lead.storeUrl} target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded-md bg-[#6c63ff]/10 flex items-center justify-center text-[#6c63ff] hover:bg-[#6c63ff]/20 transition-colors shrink-0" onClick={(e) => e.stopPropagation()}><ExternalLink size={10} /></a>}
                          <EditableCell value={lead.storeUrl} onSave={(v) => handleUpdateField(lead.id, 'storeUrl', v)} placeholder="المتجر" />
                        </div>
                      </TableCell>
                      {/* رقم الجوال */}
                      <TableCell className="max-w-[130px]">
                        <div className="flex items-center gap-1.5 max-w-[130px]">
                          <a href={`tel:${lead.phone}`} className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors shrink-0 ${isTeleTransfer ? 'bg-[#6c63ff]/10 text-[#6c63ff] hover:bg-[#6c63ff]/20' : 'bg-[#00d4aa]/10 text-[#00d4aa] hover:bg-[#00d4aa]/20'}`} onClick={(e) => e.stopPropagation()}><Phone size={10} /></a>
                          <EditableCell value={lead.phone} onSave={(v) => handleUpdateField(lead.id, 'phone', v)} placeholder="الرقم" />
                        </div>
                      </TableCell>
                      {/* اسم العميل + badge للتحويلات */}
                      <TableCell className="max-w-[150px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <EditableCell value={lead.customerName} onSave={(v) => handleUpdateField(lead.id, 'customerName', v)} placeholder="اسم العميل" />
                          {isTeleTransfer && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#6c63ff]/15 text-[#6c63ff] whitespace-nowrap shrink-0" title={`تحويل من: ${lead.tele}`}>
                              ↻ {lead.tele}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {/* البريف */}
                      <TableCell className="max-w-[180px]">
                        <BriefCell value={lead.brief || ''} onSave={(v) => handleUpdateField(lead.id, 'brief', v)} placeholder="البريف" />
                      </TableCell>
                      {/* تاريخ الاجتماع */}
                      <TableCell>
                        <EditableCell value={lead.meetingDate} onSave={(v) => handleUpdateField(lead.id, 'meetingDate', v)} type="date" placeholder="التاريخ" />
                      </TableCell>
                      {/* حالة العميل — editable (same LazySelectCell as sales-sheet) */}
                      <TableCell>
                        <LazySelectCell
                          value={lead.status || ''}
                          options={SALES_STATUSES}
                          onChange={(v) => handleUpdateField(lead.id, 'status', v)}
                          placeholder="—"
                          allowClear
                        />
                      </TableCell>
                      {/* الحضور — attendance indicator.
                          Per business rule: attendance tracking applies ONLY to
                          tele-transferred meetings. Sales-originated meetings
                          don't have the attendance system → show '—'. */}
                      <TableCell>
                        {isTeleTransfer ? (
                          (() => {
                            const attObj = ATTENDANCE_STATUSES.find((a) => a.key === lead.attended)
                            const colorClass = lead.attended === 'attended'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                              : lead.attended === 'no-show'
                                ? 'bg-red-500/15 text-red-400 border-red-500/20'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${colorClass}`}>
                                {attObj?.label || '⏳ انتظار'}
                              </span>
                            )
                          })()
                        ) : (
                          <span className="text-[11px] text-[#4a5280]">—</span>
                        )}
                      </TableCell>
                      {/* ملاحظات Follow-Up — مفتوحة للتعديل المباشر */}
                      <TableCell className="max-w-[180px]">
                        <NotesCell value={lead.salesStatus || ''} onSave={(v) => handleUpdateField(lead.id, 'salesStatus', v)} placeholder="ملاحظات" />
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filteredLeads.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
              <span className="text-[12px] text-[#4a5280]">عرض {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLeads.length)} من {filteredLeads.length} اجتماع</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-md bg-[#0a0d14] border border-white/[0.06] flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] disabled:opacity-30 cursor-pointer"><ChevronRight size={14} /></button>
                <span className="text-[13px] font-bold text-[#f0f2ff]">{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-8 h-8 rounded-md bg-[#0a0d14] border border-white/[0.06] flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] disabled:opacity-30 cursor-pointer"><ChevronLeft size={14} /></button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
