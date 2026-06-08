'use client'

import { useMemo, useState, useCallback } from 'react'
import { useCrmStore, ATTENDANCE_STATUSES, SALES_STATUSES, formatDate, getDateRange } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import {
  Search, Filter, Calendar, ChevronLeft, ChevronRight, Phone, ExternalLink, ArrowRightLeft,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
   Attendance Badge Component
   ═══════════════════════════════════════════════════════ */
function AttendanceBadge({ value }: { value: string | null }) {
  if (value === 'attended') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 text-[13px] font-bold border-0">
        ✅ حضر
      </Badge>
    )
  }
  if (value === 'no-show') {
    return (
      <Badge className="bg-red-500/15 text-red-400 text-[13px] font-bold border-0">
        ❌ لم يحضر
      </Badge>
    )
  }
  // pending or null
  return (
    <Badge className="bg-amber-500/15 text-amber-400 text-[13px] font-bold border-0">
      ⏳ انتظار
    </Badge>
  )
}

/* ═══════════════════════════════════════════════════════
   Sales Status Badge Component
   ═══════════════════════════════════════════════════════ */
function SalesStatusBadge({ value }: { value: string | null }) {
  const status = SALES_STATUSES.find((s) => s.key === value)
  if (!status) {
    return (
      <Badge className="bg-[#1c2234] text-[#4a5280] text-[13px] font-bold border-0">
        —
      </Badge>
    )
  }
  return (
    <Badge className={`${status.cls} text-[13px] font-bold border-0`}>
      {status.label}
    </Badge>
  )
}

/* ═══════════════════════════════════════════════════════
   Transfers Page Component
   ═══════════════════════════════════════════════════════ */
export function TransfersPage() {
  const leads = useCrmStore((s) => s.leads)
  const team = useCrmStore((s) => s.team)
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)
  const searchQueries = useCrmStore((s) => s.searchQueries)
  const setSearchQuery = useCrmStore((s) => s.setSearchQuery)
  const dateRangeFilters = useCrmStore((s) => s.dateRangeFilters)
  const setDateRangeFilter = useCrmStore((s) => s.setDateRangeFilter)

  const viewKey = 'transfers'
  const searchQuery = searchQueries[viewKey] || ''
  const dateFilter = dateRangeFilters[viewKey] || { preset: 'all' }

  // Tele users are locked to their own transfers; admin can filter by tele member
  const isLockedToSelf = currentRole === 'tele'
  const [selectedTele, setSelectedTele] = useState<string>(
    isLockedToSelf && currentUser ? currentUser : 'all'
  )

  const [currentPage, setCurrentPage] = useState(1)

  /* ─── Filtered leads: only transferred (sales is set AND status === 'meeting-done') ─── */
  const filteredLeads = useMemo(() => {
    // Start with leads that have been transferred
    let result = leads.filter(
      (l) => !l.isArchived && l.sales && l.status === 'meeting-done'
    )

    // Filter by tele member
    if (isLockedToSelf) {
      result = result.filter((l) => l.tele === currentUser)
    } else if (selectedTele !== 'all') {
      result = result.filter((l) => l.tele === selectedTele)
    }

    // Search by name/phone
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (l) =>
          l.customerName?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q)
      )
    }

    // Date range filter (based on assignedAt)
    if (dateFilter.preset !== 'all') {
      const { from, to } = getDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo)
      result = result.filter((l) => {
        const ts = l.assignedAt || l.createdAt
        return ts >= from && ts < to
      })
    }

    // Sort by assignedAt descending (newest first)
    result.sort((a, b) => {
      const aTime = a.assignedAt || a.createdAt || 0
      const bTime = b.assignedAt || b.createdAt || 0
      return bTime - aTime
    })

    return result
  }, [leads, selectedTele, searchQuery, dateFilter, isLockedToSelf, currentUser])

  /* ─── Paginated leads ─── */
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE))
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredLeads.slice(start, start + PAGE_SIZE)
  }, [filteredLeads, currentPage])

  // Reset page when filters change
  const [prevFilterKey, setPrevFilterKey] = useState('')
  const filterKey = `${selectedTele}|${searchQuery}|${dateFilter.preset}`
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setCurrentPage(1)
  }

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const total = filteredLeads.length
    const attended = filteredLeads.filter((l) => l.attended === 'attended').length
    const noShow = filteredLeads.filter((l) => l.attended === 'no-show').length
    const pending = filteredLeads.filter(
      (l) => !l.attended || l.attended === 'pending'
    ).length
    const closedWon = filteredLeads.filter(
      (l) => l.salesStatus === 'closed-won'
    ).length
    return { total, attended, noShow, pending, closedWon }
  }, [filteredLeads])

  /* ─── Date range presets for custom date ─── */
  const [customFrom, setCustomFrom] = useState(dateFilter.customFrom || '')
  const [customTo, setCustomTo] = useState(dateFilter.customTo || '')

  const handleDatePresetChange = useCallback((preset: string) => {
    if (preset === 'custom') {
      setDateRangeFilter(viewKey, { preset, customFrom, customTo })
    } else {
      setDateRangeFilter(viewKey, { preset })
      setCustomFrom('')
      setCustomTo('')
    }
  }, [customFrom, customTo, setDateRangeFilter])

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2
            className="text-[22px] font-extrabold text-[#f0f2ff]"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            التحويلات
          </h2>
          <p className="text-[15px] font-semibold text-[#8892b0] mt-0.5">
            العملاء المحوَّلين للسيلز — متابعة الحضور والتقفيل
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#6c63ff]/15 text-[#a8a3ff] text-[13px] font-bold border-0 gap-1.5">
            <ArrowRightLeft size={13} />
            {stats.total} تحويل
          </Badge>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'إجمالي التحويلات', value: stats.total, color: '#6c63ff' },
          { label: 'حضروا', value: stats.attended, color: '#10b981' },
          { label: 'لم يحضروا', value: stats.noShow, color: '#ef4444' },
          { label: 'في الانتظار', value: stats.pending, color: '#f59e0b' },
          { label: 'تم التقفيل', value: stats.closedWon, color: '#00d4aa' },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-[#111520] border border-white/[0.06] rounded-xl p-3"
          >
            <div className="text-[15px] font-semibold text-[#8892b0]">{s.label}</div>
            <div
              className="text-[22px] font-bold mt-0.5"
              style={{ color: s.color, fontFamily: 'Cairo, sans-serif' }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Filters Row ─── */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tele filter — locked for tele users, selectable for admin */}
            {isLockedToSelf ? (
              <div className="h-8 px-3 rounded-md border border-white/[0.08] bg-[#0a0d14] flex items-center gap-2 text-[15px] font-medium text-[#f0f2ff] w-[140px]">
                <Filter size={12} className="text-[#6c63ff]" />
                <span>{currentUser}</span>
              </div>
            ) : (
              <Select value={selectedTele} onValueChange={setSelectedTele}>
                <SelectTrigger className="w-[140px] h-8 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                  <Filter size={12} className="text-[#6c63ff]" />
                  <SelectValue placeholder="فلتر التيلي" />
                </SelectTrigger>
                <SelectContent className="bg-[#111520] border-white/[0.08]">
                  <SelectItem value="all" className="text-[15px] text-[#f0f2ff]">الكل</SelectItem>
                  {team.tele.map((name) => (
                    <SelectItem key={name} value={name} className="text-[15px] text-[#f0f2ff]">{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4a5280]" />
              <Input
                placeholder="بحث بالاسم أو الرقم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(viewKey, e.target.value)}
                className="h-8 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] pr-8 placeholder:text-[#4a5280]"
              />
            </div>

            {/* Date filter */}
            <Select value={dateFilter.preset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="w-[120px] h-8 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                <Calendar size={12} className="text-[#6c63ff]" />
                <SelectValue placeholder="التاريخ" />
              </SelectTrigger>
              <SelectContent className="bg-[#111520] border-white/[0.08]">
                <SelectItem value="all" className="text-[15px] text-[#f0f2ff]">الكل</SelectItem>
                <SelectItem value="today" className="text-[15px] text-[#f0f2ff]">اليوم</SelectItem>
                <SelectItem value="yesterday" className="text-[15px] text-[#f0f2ff]">أمس</SelectItem>
                <SelectItem value="week" className="text-[15px] text-[#f0f2ff]">هذا الأسبوع</SelectItem>
                <SelectItem value="month" className="text-[15px] text-[#f0f2ff]">هذا الشهر</SelectItem>
                <SelectItem value="custom" className="text-[15px] text-[#f0f2ff]">مخصص</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom date range inputs */}
            {dateFilter.preset === 'custom' && (
              <>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value)
                    setDateRangeFilter(viewKey, { preset: 'custom', customFrom: e.target.value, customTo })
                  }}
                  className="h-8 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[140px]"
                />
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value)
                    setDateRangeFilter(viewKey, { preset: 'custom', customFrom, customTo: e.target.value })
                  }}
                  className="h-8 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[140px]"
                />
              </>
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
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">اسم العميل</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">رقم الجوال</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">لينك المتجر</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">البريف</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">السيلز المحول له</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">تاريخ الاجتماع</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">وقت الاجتماع</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">حالة الحضور</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">حالة السيلز</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-[#4a5280]">
                      <div className="text-[30px] mb-2">🔄</div>
                      <div className="text-[16px] font-semibold">لا يوجد تحويلات</div>
                      <div className="text-[14px] font-medium mt-1">العملاء المحولين سيظهرون هنا</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-white/[0.04] transition-colors hover:bg-[#1c2234]/50"
                    >
                      {/* اسم العميل */}
                      <TableCell>
                        <div className="text-[15px] font-bold text-[#f0f2ff]">
                          {lead.customerName || '—'}
                        </div>
                      </TableCell>

                      {/* رقم الجوال */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${lead.phone}`}
                            className="w-6 h-6 rounded-md bg-[#00d4aa]/10 flex items-center justify-center text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors shrink-0"
                          >
                            <Phone size={10} />
                          </a>
                          <span className="text-[15px] font-medium text-[#8892b0]">
                            {lead.phone || '—'}
                          </span>
                        </div>
                      </TableCell>

                      {/* لينك المتجر */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-[15px] font-medium text-[#8892b0] truncate max-w-[120px]">
                            {lead.storeUrl || '—'}
                          </span>
                          {lead.storeUrl && (
                            <a
                              href={lead.storeUrl.startsWith('http') ? lead.storeUrl : `https://${lead.storeUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-5 h-5 rounded flex items-center justify-center text-[#6c63ff] hover:text-[#a8a3ff] transition-colors shrink-0"
                              title="فتح المتجر"
                            >
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </TableCell>

                      {/* البريف */}
                      <TableCell>
                        <div className="text-[14px] font-medium text-[#8892b0] max-w-[150px] truncate">
                          {lead.brief || '—'}
                        </div>
                      </TableCell>

                      {/* السيلز المحول له */}
                      <TableCell>
                        <Badge className="bg-[#00d4aa]/15 text-[#00d4aa] text-[13px] font-bold border-0">
                          {lead.sales || '—'}
                        </Badge>
                      </TableCell>

                      {/* تاريخ الاجتماع */}
                      <TableCell>
                        <div className="text-[15px] font-medium text-[#8892b0]">
                          {lead.meetingDate || '—'}
                        </div>
                      </TableCell>

                      {/* وقت الاجتماع */}
                      <TableCell>
                        <div className="text-[15px] font-medium text-[#8892b0]">
                          {lead.meetingTime || '—'}
                        </div>
                      </TableCell>

                      {/* حالة الحضور */}
                      <TableCell>
                        <AttendanceBadge value={lead.attended} />
                      </TableCell>

                      {/* حالة السيلز */}
                      <TableCell>
                        <SalesStatusBadge value={lead.salesStatus} />
                      </TableCell>
                    </tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* ─── Pagination ─── */}
          {filteredLeads.length > PAGE_SIZE && (
            <div className="border-t border-white/[0.06] px-4 py-3 flex items-center justify-between">
              <div className="text-[14px] font-medium text-[#4a5280]">
                عرض {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLeads.length)} من {filteredLeads.length}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-md bg-[#0a0d14] border border-white/[0.06] flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] hover:border-[#6c63ff]/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-[14px] font-bold transition-colors cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-[#6c63ff] text-white'
                          : 'bg-[#0a0d14] border border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:border-[#6c63ff]/30'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 rounded-md bg-[#0a0d14] border border-white/[0.06] flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] hover:border-[#6c63ff]/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ─── Footer info when no pagination needed ─── */}
          {filteredLeads.length > 0 && filteredLeads.length <= PAGE_SIZE && (
            <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center justify-between text-[14px] font-medium text-[#4a5280]">
              <span>عرض {filteredLeads.length} تحويل</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
