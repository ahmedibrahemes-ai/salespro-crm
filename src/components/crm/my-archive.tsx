'use client'

import { useMemo, useState, useCallback } from 'react'
import { useCrmStore, STATUSES, SALES_STATUSES, formatDate } from '@/lib/store'
import { apiUnarchiveLeads } from '@/lib/supabase'
import { motion } from 'framer-motion'
import {
  Search, ArchiveRestore, Phone, Filter, ChevronLeft,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

/* ═══════════════════════════════════════════════════════
   Animation variants
   ═══════════════════════════════════════════════════════ */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

/* ═══════════════════════════════════════════════════════
   My Archive Component
   ═══════════════════════════════════════════════════════ */
export function MyArchive() {
  const { archivedLeads, currentUser, currentRole, addToast, unarchiveLeadsInCache } = useCrmStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<'all' | 'tele' | 'sales'>('all')

  /* ─── Filtered archived leads ─── */
  const filteredLeads = useMemo(() => {
    let result = archivedLeads

    // Filter by role
    if (currentRole === 'tele' && currentUser) {
      result = result.filter((l) => l.tele === currentUser)
    } else if (currentRole === 'sales' && currentUser) {
      result = result.filter((l) => l.sales === currentUser)
    } else {
      // Admin or no specific role filter
      if (filterRole === 'tele') {
        result = result.filter((l) => l.tele && l.tele.trim() !== '')
      } else if (filterRole === 'sales') {
        result = result.filter((l) => l.sales && l.sales !== null)
      }
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (l) =>
          l.customerName?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.storeUrl?.toLowerCase().includes(q)
      )
    }

    return result
  }, [archivedLeads, currentUser, currentRole, filterRole, searchQuery])

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    let base = archivedLeads
    if (currentRole === 'tele' && currentUser) {
      base = base.filter((l) => l.tele === currentUser)
    } else if (currentRole === 'sales' && currentUser) {
      base = base.filter((l) => l.sales === currentUser)
    }

    const total = base.length
    const fromTele = base.filter((l) => l.tele && l.tele.trim() !== '').length
    const fromSales = base.filter((l) => l.sales && l.sales !== null).length

    return { total, fromTele, fromSales }
  }, [archivedLeads, currentUser, currentRole])

  /* ─── Unarchive ─── */
  const handleUnarchive = useCallback(async (id: string) => {
    unarchiveLeadsInCache([id])
    try {
      await apiUnarchiveLeads([id])
      addToast('success', 'تم استرجاع العميل من الأرشيف')
    } catch {
      addToast('error', 'فشل استرجاع العميل')
    }
  }, [unarchiveLeadsInCache, addToast])

  /* ─── Bulk unarchive selected ─── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkUnarchive = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    unarchiveLeadsInCache(ids)
    try {
      await apiUnarchiveLeads(ids)
      addToast('success', `تم استرجاع ${ids.length} عميل`)
    } catch {
      addToast('error', 'فشل الاسترجاع')
    }
    setSelectedIds(new Set())
  }, [selectedIds, unarchiveLeadsInCache, addToast])

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            أرشيفي
          </h2>
          <p className="text-[12px] text-[#8892b0] mt-0.5">العملاء المؤرشفين — يمكنك استرجاعهم</p>
        </div>

        {selectedIds.size > 0 && (
          <Button
            onClick={handleBulkUnarchive}
            className="bg-[#00d4aa] hover:bg-[#00c09a] text-[#0a0d14] gap-1.5 text-[12px] h-9 cursor-pointer"
          >
            <ArchiveRestore size={14} />
            استرجاع ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'إجمالي المؤرشف', value: stats.total, color: '#8892b0' },
          { label: 'من التيز', value: stats.fromTele, color: '#6c63ff' },
          { label: 'من السيلز', value: stats.fromSales, color: '#00d4aa' },
        ].map((s, i) => (
          <motion.div key={i} variants={itemVariants} className="bg-[#111520] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] text-[#8892b0]">{s.label}</div>
            <div className="text-[20px] font-bold mt-0.5" style={{ color: s.color, fontFamily: 'Cairo, sans-serif' }}>
              {s.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {currentRole === 'admin' && (
              <Select value={filterRole} onValueChange={(v: 'all' | 'tele' | 'sales') => setFilterRole(v)}>
                <SelectTrigger className="w-[120px] h-8 text-[12px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                  <Filter size={12} className="text-[#6c63ff]" />
                  <SelectValue placeholder="فلتر" />
                </SelectTrigger>
                <SelectContent className="bg-[#111520] border-white/[0.08]">
                  <SelectItem value="all" className="text-[12px]">الكل</SelectItem>
                  <SelectItem value="tele" className="text-[12px]">التيز</SelectItem>
                  <SelectItem value="sales" className="text-[12px]">السيلز</SelectItem>
                </SelectContent>
              </Select>
            )}

            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4a5280]" />
              <Input
                placeholder="بحث في الأرشيف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-[12px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] pr-8 placeholder:text-[#4a5280]"
              />
            </div>

            <Badge className="bg-[#1c2234] text-[#8892b0] text-[11px] border-0">
              {filteredLeads.length} عميل
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="w-[40px] text-right text-[11px] text-[#4a5280]">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                      onChange={() => {
                        if (selectedIds.size === filteredLeads.length) {
                          setSelectedIds(new Set())
                        } else {
                          setSelectedIds(new Set(filteredLeads.map((l) => l.id)))
                        }
                      }}
                      className="rounded border-white/20 accent-[#6c63ff]"
                    />
                  </TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">العميل</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">الهاتف</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">التيز</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">السيلز</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">الحالة</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">أرشفته</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">تاريخ الأرشفة</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280] w-[80px]">استرجاع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-[#4a5280]">
                      <div className="text-[32px] mb-2">📦</div>
                      <div className="text-[13px]">لا يعملاء مؤرشفين</div>
                      <div className="text-[11px] mt-1">الأرشيف فارغ</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => {
                    const isSelected = selectedIds.has(lead.id)
                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-white/[0.04] transition-colors ${
                          isSelected ? 'bg-[#6c63ff]/5' : 'hover:bg-[#1c2234]/50'
                        }`}
                      >
                        <TableCell className="w-[40px]">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(lead.id)}
                            className="rounded border-white/20 accent-[#6c63ff]"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-[12px] text-[#f0f2ff] font-medium">{lead.customerName || '—'}</div>
                          {lead.storeUrl && (
                            <div className="text-[10px] text-[#4a5280] truncate max-w-[120px]">{lead.storeUrl}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${lead.phone}`}
                              className="w-6 h-6 rounded-md bg-[#00d4aa]/10 flex items-center justify-center text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors shrink-0"
                            >
                              <Phone size={10} />
                            </a>
                            <span className="text-[12px] text-[#8892b0]">{lead.phone || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[12px] text-[#a8a3ff]">{lead.tele || '—'}</TableCell>
                        <TableCell className="text-[12px] text-[#00d4aa]">{lead.sales || '—'}</TableCell>
                        <TableCell>
                          <Badge className="bg-[#1c2234] text-[#8892b0] text-[10px] border-0">
                            {STATUSES.find((s) => s.key === lead.status)?.label || lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[12px] text-[#4a5280]">{lead.archivedBy || '—'}</TableCell>
                        <TableCell className="text-[11px] text-[#4a5280]">{formatDate(lead.archivedAt)}</TableCell>
                        <TableCell>
                          <Button
                            onClick={() => handleUnarchive(lead.id)}
                            size="sm"
                            className="h-7 text-[11px] bg-[#00d4aa]/15 text-[#00d4aa] hover:bg-[#00d4aa]/25 border-0 gap-1 cursor-pointer"
                          >
                            <ChevronLeft size={12} />
                            استرجاع
                          </Button>
                        </TableCell>
                      </tr>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {filteredLeads.length > 0 && (
            <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center justify-between text-[11px] text-[#4a5280]">
              <span>عرض {filteredLeads.length} عميل مؤرشف</span>
              {selectedIds.size > 0 && (
                <span className="text-[#6c63ff]">{selectedIds.size} محدد</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
