'use client'

import { useMemo, useState, useCallback } from 'react'
import { useCrmStore, CONTACT_RESULTS, STATUSES, ATTENDANCE_STATUSES, formatDate, getDateRange } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiCreateLead, apiUpdateLead, apiDeleteLead, apiArchiveLeads, apiDeleteLeadsBulk } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Trash2, Archive, Phone, Filter, X, Check, ChevronDown,
  UserPlus, Calendar, MoreHorizontal, Loader2, AlertTriangle,
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

/* ═══════════════════════════════════════════════════════
   Animation variants
   ═══════════════════════════════════════════════════════ */
const rowVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, x: 40, transition: { duration: 0.2 } },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
}

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
        className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[12px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]"
        autoFocus
      />
    )
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true) }}
      className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[12px] min-h-[28px] inline-flex items-center"
    >
      {value || <span className="text-[#4a5280]">{placeholder}</span>}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
   Tele Sheet Component
   ═══════════════════════════════════════════════════════ */
export function TeleSheet() {
  const {
    leads, team, currentUser, currentRole, addToast,
    selectedLeadIds, toggleLeadSelection, clearSelectedLeadIds, selectAllLeads,
    searchQueries, setSearchQuery, dateRangeFilters, setDateRangeFilter,
    updateLeadInCache, addLeadToCache, removeLeadFromCache, batchRemoveLeadsFromCache, archiveLeadsInCache,
  } = useCrmStore()

  const viewKey = 'tele-sheet'
  const selected = selectedLeadIds[viewKey] || []
  const searchQuery = searchQueries[viewKey] || ''
  const dateFilter = dateRangeFilters[viewKey] || { preset: 'all' }

  const [showAddRow, setShowAddRow] = useState(false)
  const [newLead, setNewLead] = useState({
    customerName: '', phone: '', storeUrl: '', brief: '',
  })
  const [saving, setSaving] = useState(false)
  const [bulkAction, setBulkAction] = useState<string | null>(null)
  const [selectedTele, setSelectedTele] = useState<string>(
    currentRole === 'tele' && currentUser ? currentUser : 'all'
  )

  /* ─── Filtered leads ─── */
  const filteredLeads = useMemo(() => {
    let result = leads.filter((l) => !l.isArchived)

    // Filter by tele
    if (selectedTele !== 'all') {
      result = result.filter((l) => l.tele === selectedTele)
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (l) =>
          l.customerName?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.storeUrl?.toLowerCase().includes(q) ||
          l.brief?.toLowerCase().includes(q)
      )
    }

    // Date range
    if (dateFilter.preset !== 'all') {
      const { from, to } = getDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo)
      result = result.filter((l) => l.createdAt >= from && l.createdAt < to)
    }

    return result
  }, [leads, selectedTele, searchQuery, dateFilter])

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const total = filteredLeads.length
    const contacted = filteredLeads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length
    const meetings = filteredLeads.filter((l) => l.meetingDate).length
    const closedWon = filteredLeads.filter((l) => l.status === 'closed-won').length
    return { total, contacted, meetings, closedWon }
  }, [filteredLeads])

  /* ─── Add new lead ─── */
  const handleAddLead = useCallback(async () => {
    if (!newLead.customerName.trim() || !newLead.phone.trim()) {
      addToast('warning', 'اسم العميل ورقم التليفون مطلوبان')
      return
    }
    setSaving(true)
    try {
      const teleName = selectedTele === 'all'
        ? (currentUser || '')
        : selectedTele
      const created = await apiCreateLead({
        customerName: newLead.customerName,
        phone: newLead.phone,
        storeUrl: newLead.storeUrl,
        brief: newLead.brief,
        tele: teleName,
        status: 'new',
        contactResult: '',
      })
      addLeadToCache(created)
      addToast('success', `تم إضافة ${newLead.customerName} بنجاح`)
      setNewLead({ customerName: '', phone: '', storeUrl: '', brief: '' })
      setShowAddRow(false)
    } catch (err: unknown) {
      addToast('error', `فشل في إضافة العميل: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`)
    } finally {
      setSaving(false)
    }
  }, [newLead, selectedTele, currentUser, addLeadToCache, addToast])

  /* ─── Update lead field ─── */
  const handleUpdateField = useCallback(async (id: string, field: string, value: string) => {
    const updates: Partial<Lead> = { [field]: value }
    if (field === 'contactResult') {
      updates.contactResultAt = value ? Date.now() : null
    }
    updateLeadInCache(id, updates)
    try {
      await apiUpdateLead(id, updates)
    } catch (err: unknown) {
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
    setBulkAction(null)
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
    setBulkAction(null)
  }, [selected, batchRemoveLeadsFromCache, apiDeleteLeadsBulk, addToast, clearSelectedLeadIds])

  /* ─── Get status badge color ─── */
  const getStatusBadge = (statusKey: string) => {
    const s = STATUSES.find((s) => s.key === statusKey)
    if (!s) return 'bg-[#1c2234] text-[#8892b0]'
    const clsMap: Record<string, string> = {
      'status-new': 'bg-[#6c63ff]/15 text-[#a8a3ff]',
      'status-noreply': 'bg-amber-500/15 text-amber-400',
      'status-followup': 'bg-[#6c63ff]/15 text-[#a8a3ff]',
      'status-done': 'bg-emerald-500/15 text-emerald-400',
      'status-objection': 'bg-red-500/15 text-red-400',
      'status-closed-win': 'bg-[#00d4aa]/15 text-[#00d4aa]',
      'status-closed-lost': 'bg-red-500/15 text-red-400',
    }
    return clsMap[s.cls] || 'bg-[#1c2234] text-[#8892b0]'
  }

  /* ─── Get attendance badge ─── */
  const getAttendanceBadge = (attended: string | null) => {
    const a = ATTENDANCE_STATUSES.find((s) => s.key === attended)
    if (!a) return 'bg-[#1c2234] text-[#8892b0]'
    return a.cls
  }

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            شيت التيز
          </h2>
          <p className="text-[12px] text-[#8892b0] mt-0.5">إدارة العملاء المحُوَّلين للتلي ماركتنج</p>
        </div>
        <Button
          onClick={() => setShowAddRow(true)}
          className="bg-[#6c63ff] hover:bg-[#5b54e6] text-white gap-1.5 text-[12px] h-9 cursor-pointer"
        >
          <Plus size={14} />
          إضافة عميل
        </Button>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي العملاء', value: stats.total, color: '#6c63ff' },
          { label: 'تم التواصل', value: stats.contacted, color: '#00d4aa' },
          { label: 'اجتماعات', value: stats.meetings, color: '#ffd166' },
          { label: 'تم التقفيل', value: stats.closedWon, color: '#00d4aa' },
        ].map((s, i) => (
          <motion.div
            key={i}
            variants={rowVariants}
            className="bg-[#111520] border border-white/[0.06] rounded-xl p-3"
          >
            <div className="text-[11px] text-[#8892b0]">{s.label}</div>
            <div className="text-[20px] font-bold mt-0.5" style={{ color: s.color, fontFamily: 'Cairo, sans-serif' }}>
              {s.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Filters Row ─── */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tele filter */}
            <Select value={selectedTele} onValueChange={setSelectedTele}>
              <SelectTrigger className="w-[140px] h-8 text-[12px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                <Filter size={12} className="text-[#6c63ff]" />
                <SelectValue placeholder="فلتر التيز" />
              </SelectTrigger>
              <SelectContent className="bg-[#111520] border-white/[0.08]">
                <SelectItem value="all" className="text-[12px] text-[#f0f2ff]">الكل</SelectItem>
                {team.tele.map((name) => (
                  <SelectItem key={name} value={name} className="text-[12px] text-[#f0f2ff]">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4a5280]" />
              <Input
                placeholder="بحث بالاسم أو الرقم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(viewKey, e.target.value)}
                className="h-8 text-[12px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] pr-8 placeholder:text-[#4a5280]"
              />
            </div>

            {/* Date filter */}
            <Select value={dateFilter.preset} onValueChange={(v) => setDateRangeFilter(viewKey, { preset: v })}>
              <SelectTrigger className="w-[120px] h-8 text-[12px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                <Calendar size={12} className="text-[#6c63ff]" />
                <SelectValue placeholder="التاريخ" />
              </SelectTrigger>
              <SelectContent className="bg-[#111520] border-white/[0.08]">
                <SelectItem value="all" className="text-[12px] text-[#f0f2ff]">الكل</SelectItem>
                <SelectItem value="today" className="text-[12px] text-[#f0f2ff]">اليوم</SelectItem>
                <SelectItem value="yesterday" className="text-[12px] text-[#f0f2ff]">أمس</SelectItem>
                <SelectItem value="week" className="text-[12px] text-[#f0f2ff]">هذا الأسبوع</SelectItem>
                <SelectItem value="month" className="text-[12px] text-[#f0f2ff]">هذا الشهر</SelectItem>
              </SelectContent>
            </Select>

            {/* Bulk actions */}
            {selected.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={handleBulkArchive}
                  size="sm"
                  className="h-8 text-[11px] bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-0 gap-1 cursor-pointer"
                >
                  <Archive size={12} />
                  أرشفة ({selected.length})
                </Button>
                <Button
                  onClick={handleBulkDelete}
                  size="sm"
                  className="h-8 text-[11px] bg-red-500/15 text-red-400 hover:bg-red-500/25 border-0 gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                  حذف ({selected.length})
                </Button>
                <Button
                  onClick={() => clearSelectedLeadIds(viewKey)}
                  size="sm"
                  className="h-8 text-[11px] bg-[#1c2234] text-[#8892b0] hover:text-[#f0f2ff] border-0 cursor-pointer"
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
                  <TableHead className="w-[40px] text-right text-[11px] text-[#4a5280]">
                    <Checkbox
                      checked={selected.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) selectAllLeads(viewKey, filteredLeads.map((l) => l.id))
                        else clearSelectedLeadIds(viewKey)
                      }}
                      className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]"
                    />
                  </TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">اسم العميل</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">رقم التليفون</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">حالة التواصل</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">حالة العميل</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">الحضور</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280]">التاريخ</TableHead>
                  <TableHead className="text-right text-[11px] text-[#4a5280] w-[60px]">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* ─── Inline Add Row ─── */}
                <AnimatePresence>
                  {showAddRow && (
                    <motion.tr
                      variants={rowVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="border-b border-[#6c63ff]/20 bg-[#6c63ff]/5"
                    >
                      <TableCell className="w-[40px]">
                        <UserPlus size={14} className="text-[#6c63ff]" />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="اسم العميل"
                          value={newLead.customerName}
                          onChange={(e) => setNewLead((p) => ({ ...p, customerName: e.target.value }))}
                          className="h-7 text-[11px] bg-[#0a0d14] border-[#6c63ff]/30 text-[#f0f2ff]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="رقم التليفون"
                          value={newLead.phone}
                          onChange={(e) => setNewLead((p) => ({ ...p, phone: e.target.value }))}
                          className="h-7 text-[11px] bg-[#0a0d14] border-[#6c63ff]/30 text-[#f0f2ff]"
                        />
                      </TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>
                        <Badge className="bg-[#6c63ff]/15 text-[#a8a3ff] text-[10px] border-0">جديد</Badge>
                      </TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button
                            onClick={handleAddLead}
                            disabled={saving}
                            className="w-7 h-7 rounded-md bg-[#00d4aa]/15 text-[#00d4aa] flex items-center justify-center hover:bg-[#00d4aa]/25 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                          <button
                            onClick={() => setShowAddRow(false)}
                            className="w-7 h-7 rounded-md bg-red-500/15 text-red-400 flex items-center justify-center hover:bg-red-500/25 transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  )}
                </AnimatePresence>

                {/* ─── Data Rows ─── */}
                {filteredLeads.length === 0 && !showAddRow ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-[#4a5280]">
                      <div className="text-[32px] mb-2">📋</div>
                      <div className="text-[13px]">لا يوجد عملاء</div>
                      <div className="text-[11px] mt-1">اضغط &quot;إضافة عميل&quot; لإضافة عميل جديد</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => {
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
                            {lead.storeUrl && (
                              <div className="text-[10px] text-[#4a5280] mt-0.5 truncate max-w-[140px]">
                                {lead.storeUrl}
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
                          <Select
                            value={lead.contactResult || 'none'}
                            onValueChange={(v) => handleUpdateField(lead.id, 'contactResult', v === 'none' ? '' : v)}
                          >
                            <SelectTrigger className="h-7 text-[11px] w-[110px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#111520] border-white/[0.08]">
                              {CONTACT_RESULTS.map((cr) => (
                                <SelectItem key={cr.key} value={cr.key} className="text-[11px] text-[#f0f2ff]">
                                  {cr.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={lead.status || 'new'}
                            onValueChange={(v) => handleUpdateField(lead.id, 'status', v)}
                          >
                            <SelectTrigger className="h-7 text-[11px] w-[110px] bg-[#0a0d14] border-white/[0.08]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#111520] border-white/[0.08]">
                              {STATUSES.map((st) => (
                                <SelectItem key={st.key} value={st.key} className="text-[11px] text-[#f0f2ff]">
                                  {st.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={lead.attended || 'pending'}
                            onValueChange={(v) => {
                              const val = v === 'pending' ? null : v
                              handleUpdateField(lead.id, 'attended', val || '')
                              if (val) {
                                handleUpdateField(lead.id, 'attendanceMarkedAt', String(Date.now()))
                                handleUpdateField(lead.id, 'attendanceMarkedBy', currentUser || '')
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 text-[11px] w-[90px] bg-[#0a0d14] border-white/[0.08]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#111520] border-white/[0.08]">
                              {ATTENDANCE_STATUSES.map((a) => (
                                <SelectItem key={a.key} value={a.key} className="text-[11px] text-[#f0f2ff]">
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <span className="text-[11px] text-[#8892b0]">
                            {formatDate(lead.createdAt)}
                          </span>
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

          {/* ─── Table Footer ─── */}
          {filteredLeads.length > 0 && (
            <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center justify-between text-[11px] text-[#4a5280]">
              <span>عرض {filteredLeads.length} عميل</span>
              {selected.length > 0 && (
                <span className="text-[#6c63ff]">{selected.length} محدد</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
