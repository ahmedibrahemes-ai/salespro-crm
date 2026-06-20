'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useCrmStore, getDateRange } from '@/lib/store'
import { normalizePhone } from '@/lib/crm-utils'

/* ═══════════════════════════════════════════════════════
   Sales-specific Contact Results (adds call + whatsapp options)
   ═══════════════════════════════════════════════════════ */
const SALES_CONTACT_RESULTS = [
  { key: 'none', label: '—', color: 'text-muted-foreground' },
  { key: 'replied', label: '✅ رد', color: 'text-emerald-400' },
  { key: 'no-reply', label: '📵 لم يرد', color: 'text-amber-400' },
  { key: 'busy', label: '🔴 مشغول', color: 'text-amber-400' },
  { key: 'wrong-number', label: '❌ رقم غلط', color: 'text-red-400' },
  { key: 'customer-service', label: '🎧 خدمة عملاء', color: 'text-blue-400' },
  { key: 'call', label: '📞 كول', color: 'text-purple-400' },
  { key: 'whatsapp', label: '💬 واتس', color: 'text-green-400' },
  { key: 'call-whatsapp', label: '📞💬 كول + واتس', color: 'text-cyan-400' },
]

/* ═══════════════════════════════════════════════════════
   Sales-specific Statuses (removed 'whatsapp' — it's in contact results)
   ═══════════════════════════════════════════════════════ */
const SALES_STATUSES = [
  { key: 'meeting', label: '📅 اجتماع', cls: 'status-done' },
  { key: 'not-interested', label: '🚫 غير مهتم', cls: 'status-closed-lost' },
  { key: 'followup-1', label: '🔄 متابعة 1', cls: 'status-followup' },
  { key: 'followup-2', label: '🔄 متابعة 2', cls: 'status-followup' },
  { key: 'followup-3', label: '🔄 متابعة 3', cls: 'status-followup' },
]
import type { Lead } from '@/lib/supabase'
import { apiCreateLead, apiUpdateLead, apiDeleteLead, apiArchiveLeads, apiDeleteLeadsBulk, apiBulkCreateLeads } from '@/lib/supabase'
import {
  Search, Plus, Trash2, Archive, Phone, Filter, X, Check,
  Calendar, Loader2, ClipboardPaste, AlertCircle, ExternalLink,
  ChevronLeft, ChevronRight, UserPlus,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { AIScoreBadge } from '@/components/crm/ai/ai-score-badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'

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
        className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[13px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]"
        autoFocus
      />
    )
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true) }}
      className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[13px] font-medium min-h-[28px] inline-block truncate max-w-full"
    >
      {value || <span className="text-[#4a5280]">{placeholder}</span>}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
   Brief Cell — editable with popover for long text
   ═══════════════════════════════════════════════════════ */
function BriefCell({
  value,
  onSave,
  placeholder = '—',
}: {
  value: string
  onSave: (val: string) => void
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)

  const commit = useCallback(() => {
    if (draft !== value) onSave(draft)
    setEditing(false)
    setOpen(false)
  }, [draft, value, onSave])

  if (editing) {
    return (
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[13px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff] resize-none"
        rows={3}
        autoFocus
      />
    )
  }

  const isEmpty = !value || value.trim() === ''

  if (isEmpty) {
    return (
      <span
        onClick={() => { setDraft(value); setEditing(true) }}
        className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[13px] text-[#4a5280] min-h-[28px] inline-block truncate max-w-full"
      >
        {placeholder}
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          onClick={() => { setDraft(value); setEditing(true) }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[13px] font-medium min-h-[28px] inline-block truncate max-w-full block"
          title=""
        >
          {value}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="bg-[#1a1f2e] border-white/[0.08] text-[#f0f2ff] max-w-[400px] w-[400px] p-3 z-50"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ fontFamily: 'Cairo, sans-serif' }} dir="rtl">
          {value}
        </div>
        <div className="mt-2 pt-2 border-t border-white/[0.06] text-[10px] text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
          اضغط للتعديل
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ═══════════════════════════════════════════════════════
   Notes Cell — editable text for sales notes (replaces salesStatus)
   ═══════════════════════════════════════════════════════ */
function NotesCell({
  value,
  onSave,
  placeholder = 'ملاحظات',
}: {
  value: string
  onSave: (val: string) => void
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
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[13px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]"
        placeholder="اكتب ملاحظة..."
        autoFocus
      />
    )
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true) }}
      className="cursor-pointer hover:bg-[#1c2234] rounded px-1.5 py-0.5 transition-colors text-[13px] text-[#8892b0] min-h-[28px] inline-block truncate max-w-full italic"
    >
      {value || <span className="text-[#4a5280] not-italic">{placeholder}</span>}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
   Lazy Select Cell
   ═══════════════════════════════════════════════════════ */
function LazySelectCell({
  value,
  options,
  onChange,
  displayMap,
  placeholder = '—',
  className = '',
  allowClear = false,
}: {
  value: string | null | undefined
  options: Array<{ key: string; label: string }>
  onChange: (val: string) => void
  displayMap?: Record<string, string>
  placeholder?: string
  className?: string
  allowClear?: boolean
}) {
  const [open, setOpen] = useState(false)

  const matchingOption = options.find(o => o.key === value)
  const displayLabel = matchingOption?.label || (displayMap?.[value || ''] && value ? displayMap[value] : '') || placeholder

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`h-7 text-[13px] font-medium px-2 rounded border border-white/[0.06] bg-[#0a0d14] text-[#f0f2ff] hover:border-[#6c63ff]/30 transition-colors cursor-pointer text-right w-full ${className}`}
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
      <SelectTrigger className={`h-7 text-[13px] bg-[#0a0d14] border-[#6c63ff]/40 text-[#f0f2ff] ${className}`}>
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

/* ═══════════════════════════════════════════════════════
   Quick Paste Dialog — same as tele-sheet
   ═══════════════════════════════════════════════════════ */
interface PasteRow {
  id: string
  phone: string
  storeUrl: string
  customerName?: string
  included: boolean
  isDuplicate: boolean
}

interface QuickPasteDialogProps {
  open: boolean
  onClose: () => void
  leads: Lead[]
  salesName: string
  onSaved: (created: Lead[]) => void
  addToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void
}

let pasteRowCounter = 0

function looksLikePhone(s: string): boolean {
  return /[\d\s+()-]{6,}/.test(s)
}
function looksLikeUrl(s: string): boolean {
  return /https?:\/\/|www\.|\.com|\.sa|salla/i.test(s)
}
function parsePastedLine(line: string): { phone: string; storeUrl: string } {
  const trimmed = line.trim()
  if (!trimmed) return { phone: '', storeUrl: '' }
  const parts = trimmed.split(/[\t,]+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const phonePart = parts.find((p) => looksLikePhone(p))
    const urlPart = parts.find((p) => looksLikeUrl(p))
    if (phonePart && urlPart) return { phone: phonePart, storeUrl: urlPart }
    if (phonePart) return { phone: phonePart, storeUrl: '' }
    if (urlPart) return { phone: '', storeUrl: urlPart }
    return { phone: parts[0], storeUrl: parts.length > 1 ? parts[1] : '' }
  }
  if (looksLikePhone(trimmed)) return { phone: trimmed, storeUrl: '' }
  if (looksLikeUrl(trimmed)) return { phone: '', storeUrl: trimmed }
  return { phone: trimmed, storeUrl: '' }
}

function QuickPasteDialog({ open, onClose, leads, salesName, onSaved, addToast }: QuickPasteDialogProps) {
  const [rows, setRows] = useState<PasteRow[]>([])
  const [pasteSaving, setPasteSaving] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  const existingPhoneSet = useMemo(() => {
    const s = new Set<string>()
    for (const l of leads) {
      if (l.phone) {
        const norm = normalizePhone(l.phone)
        if (norm) s.add(norm)
      }
    }
    return s
  }, [leads])

  const rowsWithDuplicates = useMemo(() => {
    const normToIds = new Map<string, string[]>()
    for (const row of rows) {
      if (!row.phone) continue
      const norm = normalizePhone(row.phone)
      if (!norm) continue
      const arr = normToIds.get(norm) || []
      arr.push(row.id)
      normToIds.set(norm, arr)
    }
    return rows.map((row) => {
      if (!row.phone) return row
      const norm = normalizePhone(row.phone)
      if (!norm) return row
      const isExisting = existingPhoneSet.has(norm)
      const idsWithSameNorm = normToIds.get(norm) || []
      const isIntraDupe = idsWithSameNorm.length > 1
      return { ...row, isDuplicate: isExisting || isIntraDupe }
    })
  }, [rows, existingPhoneSet])

  const selectedValidRows = useMemo(
    () => rowsWithDuplicates.filter((r) => r.included && (r.phone.trim() || r.storeUrl.trim())),
    [rowsWithDuplicates]
  )

  const duplicateCount = useMemo(
    () => rowsWithDuplicates.filter((r) => r.isDuplicate && r.included).length,
    [rowsWithDuplicates]
  )

  const allIncluded = rows.length > 0 && rows.every((r) => r.included)
  const someIncluded = rows.some((r) => r.included) && !allIncluded

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text.trim()) return
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    e.preventDefault()
    const newRows: PasteRow[] = lines.map((line) => {
      const parsed = parsePastedLine(line)
      return {
        id: `paste-${++pasteRowCounter}`,
        phone: parsed.phone,
        storeUrl: parsed.storeUrl,
        included: true,
        isDuplicate: false,
      }
    })
    setRows((prev) => [...prev, ...newRows])
  }, [])

  const removeDuplicateRows = useCallback(() => {
    const duplicateIds = new Set(
      rowsWithDuplicates.filter((r) => r.isDuplicate).map((r) => r.id)
    )
    setRows((prev) => prev.filter((r) => !duplicateIds.has(r.id)))
  }, [rowsWithDuplicates])

  const toggleAll = useCallback((checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, included: checked })))
  }, [])

  const clearAll = useCallback(() => { setRows([]) }, [])

  const handleSave = useCallback(async () => {
    if (selectedValidRows.length === 0) {
      addToast('warning', 'لا يوجد صفوف محددة للحفظ')
      return
    }
    setPasteSaving(true)
    try {
      const leadsToCreate: Partial<Lead>[] = selectedValidRows.map((r) => ({
        phone: r.phone || undefined,
        storeUrl: r.storeUrl || undefined,
        customerName: r.customerName || undefined,
        sales: salesName,
        status: null,
        contactResult: '',
      }))
      const created = await apiBulkCreateLeads(leadsToCreate)
      if (Array.isArray(created) && created.length > 0) {
        onSaved(created)
      }
      addToast('success', `تم إضافة ${selectedValidRows.length} عميل بنجاح 🎉`)
      setRows([])
      onClose()
    } catch (err: unknown) {
      addToast('error', `فشل في إضافة العملاء: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`)
    } finally {
      setPasteSaving(false)
    }
  }, [selectedValidRows, salesName, onSaved, addToast, onClose])

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setRows([])
      onClose()
    }
  }, [onClose])

  const contactResultLabels = useMemo(() => {
    const m: Record<string, string> = {}
    SALES_CONTACT_RESULTS.forEach(cr => { m[cr.key] = cr.label })
    return m
  }, [])

  const statusLabels = useMemo(() => {
    const m: Record<string, string> = {}
    SALES_STATUSES.forEach(s => { m[s.key] = s.label })
    return m
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="bg-[#111520] border-white/[0.08] text-[#f0f2ff] sm:max-w-3xl max-h-[90vh] flex flex-col"
        showCloseButton
        onPaste={handlePaste}
      >
        <DialogHeader>
          <DialogTitle className="text-[18px] font-extrabold text-[#f0f2ff] flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <ClipboardPaste size={20} className="text-[#6c63ff]" />
            إضافة ليدز سريعة
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#8892b0]">
            الصق البيانات مباشرة (Ctrl+V) أو اكتب يدوياً
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-3 min-h-0 py-2">
          {duplicateCount > 0 && (
            <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                <div>
                  <span className="text-[13px] font-bold text-amber-400">{duplicateCount} بيانات مكررة</span>
                  <span className="text-[12px] font-medium text-amber-400/70 mr-2">— موجودة مسبقاً</span>
                </div>
              </div>
              <button
                onClick={removeDuplicateRows}
                className="h-7 px-2.5 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-bold hover:bg-red-500/25 transition-colors cursor-pointer"
              >
                استبعاد المكرر
              </button>
            </div>
          )}

          <div
            ref={(el) => {
              tableRef.current = el
              if (el && open) setTimeout(() => el.focus(), 100)
            }}
            onPaste={handlePaste}
            tabIndex={0}
            className="flex-1 min-h-[200px] max-h-[50vh] overflow-y-auto rounded-xl border border-dashed border-white/[0.12] bg-[#0a0d14] custom-scrollbar focus:border-[#6c63ff]/50 focus:outline-none transition-colors cursor-text"
          >
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent sticky top-0 bg-[#0a0d14] z-10">
                  <TableHead className="w-[36px] text-center text-[12px] font-bold text-[#4a5280]">
                    <Checkbox
                      checked={allIncluded}
                      ref={(el) => { if (el) (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someIncluded }}
                      onCheckedChange={(checked) => toggleAll(!!checked)}
                      className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]"
                    />
                  </TableHead>
                  <TableHead className="w-[36px] text-center text-[12px] font-bold text-[#4a5280]">#</TableHead>
                  <TableHead className="text-right text-[12px] font-bold text-[#4a5280] w-[160px]">رقم الجوال</TableHead>
                  <TableHead className="text-right text-[12px] font-bold text-[#4a5280]">لينك المتجر</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-[#4a5280]">
                      <div className="text-[30px] mb-2">📋</div>
                      <div className="text-[14px] font-semibold">الصق بياناتك هنا (Ctrl+V)</div>
                      <div className="text-[12px] mt-1">أو اكتب يدوياً</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rowsWithDuplicates.map((row, idx) => (
                    <TableRow key={row.id} className={`border-b border-white/[0.04] ${row.isDuplicate ? 'bg-amber-500/5' : ''}`}>
                      <TableCell className="w-[36px] text-center">
                        <Checkbox
                          checked={row.included}
                          onCheckedChange={() => setRows(prev => prev.map(r => r.id === row.id ? { ...r, included: !r.included } : r))}
                          className={`border-white/20 ${row.isDuplicate ? 'data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500' : 'data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]'}`}
                        />
                      </TableCell>
                      <TableCell className="w-[36px] text-center text-[12px] text-[#4a5280]">{idx + 1}</TableCell>
                      <TableCell className="w-[160px]">
                        <input
                          type="text"
                          value={row.phone}
                          onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, phone: e.target.value } : r))}
                          className={`bg-transparent border-none outline-none text-[13px] w-full ${row.isDuplicate ? 'text-amber-400' : row.phone ? 'text-[#f0f2ff]' : 'text-[#4a5280]'}`}
                          placeholder="رقم الجوال..."
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="text"
                          value={row.storeUrl}
                          onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, storeUrl: e.target.value } : r))}
                          className="bg-transparent border-none outline-none text-[13px] text-[#f0f2ff] w-full"
                          placeholder="لينك المتجر..."
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {rows.length > 0 && (
                <button onClick={clearAll} className="text-[12px] font-semibold text-[#8892b0] hover:text-red-400 transition-colors cursor-pointer">
                  مسح الكل
                </button>
              )}
              <span className="text-[12px] text-[#4a5280]">
                {selectedValidRows.length} صف جاهز للحفظ
              </span>
            </div>
            <button
              onClick={handleSave}
              disabled={pasteSaving || selectedValidRows.length === 0}
              className="px-4 py-2 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-50 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)', fontFamily: 'Cairo, sans-serif' }}
            >
              {pasteSaving ? <Loader2 size={14} className="animate-spin" /> : `حفظ ${selectedValidRows.length} عميل`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════
   Sales Sheet Component
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
  const addLeadToCache = useCrmStore((s) => s.addLeadToCache)
  const batchAddLeadsToCache = useCrmStore((s) => s.batchAddLeadsToCache)
  const storeSelectedSales = useCrmStore((s) => s.selectedSalesMember)
  const setStoreSelectedSales = useCrmStore((s) => s.setSelectedSalesMember)

  const viewKey = 'sales-sheet'
  const selected = selectedLeadIds[viewKey] || []
  const searchQuery = searchQueries[viewKey] || ''
  const dateFilter = dateRangeFilters[viewKey] || { preset: 'all' }

  const isLockedToSelf = currentRole === 'sales'

  const salesWithLeads = useMemo(() => {
    const names = new Set<string>()
    for (const l of leads) {
      if (l.sales && !l.isArchived) names.add(l.sales)
    }
    return team.sales.filter((name) => names.has(name))
  }, [leads, team.sales])

  const effectiveSelectedSales = isLockedToSelf
    ? (currentUser || 'all')
    : (storeSelectedSales !== 'all' && team.sales.includes(storeSelectedSales)
        ? storeSelectedSales
        : (salesWithLeads[0] || team.sales[0] || 'all'))

  const selectedSales = effectiveSelectedSales
  const setSelectedSales = (val: string) => {
    if (!isLockedToSelf) setStoreSelectedSales(val)
  }
  const [currentPage, setCurrentPage] = useState(1)
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined)
  const [toDate, setToDate] = useState<Date | undefined>(undefined)
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)

  const [showAddRow, setShowAddRow] = useState(false)
  const [newLead, setNewLead] = useState({ customerName: '', phone: '', storeUrl: '', brief: '' })
  const [saving, setSaving] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  /* ─── Duplicate phone detection ─── */
  const duplicatePhoneMap = useMemo(() => {
    const map = new Map<string, { count: number; firstTele: string; firstLeadId: string; firstCreatedAt: number; teles: Set<string> }>()
    for (const l of leads) {
      if (!l.phone || !l.phone.trim()) continue
      const norm = normalizePhone(l.phone)
      if (!norm) continue
      const tele = l.tele || '—'
      const createdAt = l.createdAt || 0
      const existing = map.get(norm)
      if (existing) {
        existing.count++
        existing.teles.add(tele)
        if (createdAt < existing.firstCreatedAt) {
          existing.firstCreatedAt = createdAt
          existing.firstLeadId = l.id
          existing.firstTele = tele
        }
      } else {
        map.set(norm, { count: 1, firstTele: tele, firstLeadId: l.id, firstCreatedAt: createdAt, teles: new Set([tele]) })
      }
    }
    return map
  }, [leads])

  /* ─── Filtered leads ─── */
  const { filteredLeads, stats } = useMemo(() => {
    const needsDateFilter = dateFilter.preset !== 'all'
    const dateRange = needsDateFilter ? getDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo) : null
    const q = searchQuery.trim().toLowerCase()

    let total = 0
    let meetingsToday = 0
    let closedWon = 0

    const result: Lead[] = []
    const todayStr = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })).toISOString().split('T')[0]

    for (const l of leads) {
      if (l.isArchived) continue
      if (isLockedToSelf && l.sales !== currentUser) continue
      if (!isLockedToSelf && selectedSales !== 'all' && l.sales !== selectedSales) continue
      if (q && !(l.customerName?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q) || l.storeUrl?.toLowerCase().includes(q))) continue
      if (dateRange && (l.createdAt < dateRange.from || l.createdAt >= dateRange.to)) continue

      // Leads with meeting dates STAY in the sales sheet (don't move to meetings page)
      result.push(l)
      total++
      if (l.meetingDate === todayStr) meetingsToday++
      if (l.salesStatus === 'closed-won') closedWon++
    }

    return { filteredLeads: result, stats: { total, meetingsToday, closedWon } }
  }, [leads, selectedSales, searchQuery, dateFilter, isLockedToSelf, currentUser])

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE))
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredLeads.slice(start, start + PAGE_SIZE)
  }, [filteredLeads, currentPage])

  const [prevFilterKey, setPrevFilterKey] = useState('')
  const filterKey = `${selectedSales}|${searchQuery}|${dateFilter.preset}`
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setCurrentPage(1)
  }

  /* ─── Update lead field ─── */
  const handleUpdateField = useCallback(async (id: string, field: string, value: string) => {
    const updates: Partial<Lead> = { [field]: value || null }
    if (field === 'contactResult') {
      updates.contactResultAt = value ? Date.now() : null
    }
    if (field === 'status' && value === 'meeting') {
      const lead = leads.find(l => l.id === id)
      if (lead && !lead.meetingDate) {
        updates.meetingDate = new Date().toISOString().split('T')[0]
      }
    } else if (field === 'status') {
      updates.meetingDate = ''
      updates.meetingTime = ''
      updates.meetingType = ''
      updates.meetingLink = ''
    }
    updateLeadInCache(id, updates)
    try { await apiUpdateLead(id, updates) } catch { addToast('error', 'فشل التحديث') }
  }, [updateLeadInCache, addToast, leads])

  /* ─── Delete single lead ─── */
  const handleDeleteLead = useCallback(async (id: string) => {
    removeLeadFromCache(id)
    try { await apiDeleteLead(id); addToast('success', 'تم حذف العميل') } catch { addToast('error', 'فشل الحذف') }
  }, [removeLeadFromCache, addToast])

  /* ─── Bulk actions ─── */
  const handleBulkArchive = useCallback(async () => {
    if (selected.length === 0) return
    const byName = currentUser || 'unknown'
    archiveLeadsInCache(selected, byName)
    try { await apiArchiveLeads(selected, byName); addToast('success', `تم أرشفة ${selected.length} عميل`) } catch { addToast('error', 'فشل الأرشفة') }
    clearSelectedLeadIds(viewKey)
  }, [selected, currentUser, archiveLeadsInCache, addToast, clearSelectedLeadIds])

  const handleBulkDelete = useCallback(async () => {
    if (selected.length === 0) return
    const ids = [...selected]
    batchRemoveLeadsFromCache(ids)
    try { await apiDeleteLeadsBulk(ids); addToast('success', `تم حذف ${ids.length} عميل`) } catch { addToast('error', 'فشل الحذف') }
    clearSelectedLeadIds(viewKey)
  }, [selected, batchRemoveLeadsFromCache, addToast, clearSelectedLeadIds])

  /* ─── Add new lead ─── */
  const handleAddLead = useCallback(async () => {
    if (!newLead.customerName.trim() || !newLead.phone.trim()) {
      addToast('warning', 'اسم العميل ورقم الجوال مطلوبان')
      return
    }
    setSaving(true)
    try {
      const salesName = selectedSales === 'all' ? (currentUser || '') : selectedSales
      const created = await apiCreateLead({
        customerName: newLead.customerName,
        phone: newLead.phone,
        storeUrl: newLead.storeUrl,
        brief: newLead.brief,
        sales: salesName,
        status: null,
        contactResult: '',
      })
      addLeadToCache(created)
      addToast('success', `تم إضافة ${newLead.customerName} بنجاح`)
      setNewLead({ customerName: '', phone: '', storeUrl: '', brief: '' })
      setShowAddRow(false)
    } catch (err: unknown) {
      addToast('error', `فشل في إضافة العميل: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`)
    } finally { setSaving(false) }
  }, [newLead, selectedSales, currentUser, addLeadToCache, addToast])

  /* ─── Quick Paste saved ─── */
  const handlePasteSaved = useCallback((created: Lead[]) => {
    batchAddLeadsToCache(created)
  }, [batchAddLeadsToCache])

  const contactResultLabels = useMemo(() => {
    const m: Record<string, string> = {}
    SALES_CONTACT_RESULTS.forEach(cr => { m[cr.key] = cr.label })
    return m
  }, [])

  const statusLabels = useMemo(() => {
    const m: Record<string, string> = {}
    SALES_STATUSES.forEach(s => { m[s.key] = s.label })
    return m
  }, [])

  const pasteSalesName = useMemo(() => {
    if (isLockedToSelf) return currentUser || ''
    return selectedSales === 'all' ? (currentUser || '') : selectedSales
  }, [isLockedToSelf, currentUser, selectedSales])

  return (
    <div className="space-y-4" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-3">
          <p className="text-[11px] text-[#8892b0]">إجمالي العملاء</p>
          <p className="text-[20px] font-extrabold text-[#f0f2ff]">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-3">
          <p className="text-[11px] text-[#8892b0]">اجتماعات اليوم</p>
          <p className="text-[20px] font-extrabold text-[#6c63ff]">{stats.meetingsToday}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#111520] p-3">
          <p className="text-[11px] text-[#8892b0]">تم التقفيل</p>
          <p className="text-[20px] font-extrabold text-emerald-400">{stats.closedWon}</p>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Sales filter */}
            {isLockedToSelf ? (
              <div className="h-8 px-3 rounded-md border border-white/[0.08] bg-[#0a0d14] flex items-center gap-2 text-[13px] font-medium text-[#f0f2ff] w-[140px]">
                <Filter size={12} className="text-[#6c63ff]" />
                <span>{currentUser}</span>
              </div>
            ) : (
              <Select value={selectedSales} onValueChange={setSelectedSales}>
                <SelectTrigger className="w-[140px] h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                  <Filter size={12} className="text-[#6c63ff]" />
                  <SelectValue placeholder="فلتر السيلز" />
                </SelectTrigger>
                <SelectContent className="bg-[#111520] border-white/[0.08]">
                  <SelectItem value="all" className="text-[13px] text-[#f0f2ff]">الكل</SelectItem>
                  {team.sales.map((name) => (
                    <SelectItem key={name} value={name} className="text-[13px] text-[#f0f2ff]">{name}</SelectItem>
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
                className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] pr-8 placeholder:text-[#4a5280]"
              />
            </div>

            {/* Date filter */}
            <Select value={dateFilter.preset} onValueChange={(v) => {
              setDateRangeFilter(viewKey, { preset: v, customFrom: undefined, customTo: undefined })
              if (v !== 'custom') { setFromDate(undefined); setToDate(undefined) }
            }}>
              <SelectTrigger className="w-[130px] h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                <Calendar size={12} className="text-[#6c63ff]" />
                <SelectValue placeholder="التاريخ" />
              </SelectTrigger>
              <SelectContent className="bg-[#111520] border-white/[0.08]">
                <SelectItem value="all" className="text-[13px] text-[#f0f2ff]">الكل</SelectItem>
                <SelectItem value="today" className="text-[13px] text-[#f0f2ff]">اليوم</SelectItem>
                <SelectItem value="yesterday" className="text-[13px] text-[#f0f2ff]">أمس</SelectItem>
                <SelectItem value="week" className="text-[13px] text-[#f0f2ff]">هذا الأسبوع</SelectItem>
                <SelectItem value="month" className="text-[13px] text-[#f0f2ff]">هذا الشهر</SelectItem>
                <SelectItem value="custom" className="text-[13px] text-[#f0f2ff]">فترة محددة</SelectItem>
              </SelectContent>
            </Select>

            {dateFilter.preset === 'custom' && (
              <div className="flex items-center gap-1.5">
                <Popover open={fromOpen} onOpenChange={setFromOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0] hover:text-[#f0f2ff] gap-1.5 px-2.5 cursor-pointer">
                      <Calendar size={12} className="text-[#6c63ff]" />
                      {fromDate ? fromDate.toLocaleDateString('ar-EG') : 'من'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#111520] border-white/[0.08]" align="start">
                    <CalendarPicker mode="single" selected={fromDate} onSelect={(date) => {
                      setFromDate(date)
                      if (date) { const iso = date.toISOString().split('T')[0]; setDateRangeFilter(viewKey, { preset: 'custom', customFrom: iso, customTo: dateFilter.customTo }) }
                      setFromOpen(false)
                    }} initialFocus />
                  </PopoverContent>
                </Popover>
                <Popover open={toOpen} onOpenChange={setToOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0] hover:text-[#f0f2ff] gap-1.5 px-2.5 cursor-pointer">
                      <Calendar size={12} className="text-[#6c63ff]" />
                      {toDate ? toDate.toLocaleDateString('ar-EG') : 'إلى'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#111520] border-white/[0.08]" align="start">
                    <CalendarPicker mode="single" selected={toDate} onSelect={(date) => {
                      setToDate(date)
                      if (date) { const iso = date.toISOString().split('T')[0]; setDateRangeFilter(viewKey, { preset: 'custom', customFrom: dateFilter.customFrom, customTo: iso }) }
                      setToOpen(false)
                    }} initialFocus />
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#4a5280] hover:text-[#f0f2ff] cursor-pointer" onClick={() => { setFromDate(undefined); setToDate(undefined); setDateRangeFilter(viewKey, { preset: 'all' }) }}>
                  <X size={14} />
                </Button>
              </div>
            )}

            {/* Add + Paste buttons */}
            <button onClick={() => setShowAddRow(!showAddRow)} className="h-8 px-3 rounded-lg bg-[#6c63ff]/15 text-[#6c63ff] text-[13px] font-bold hover:bg-[#6c63ff]/25 transition-colors cursor-pointer flex items-center gap-1.5">
              <Plus size={14} /> إضافة عميل
            </button>
            <button onClick={() => setPasteOpen(true)} className="h-8 px-3 rounded-lg bg-[#00d4aa]/15 text-[#00d4aa] text-[13px] font-bold hover:bg-[#00d4aa]/25 transition-colors cursor-pointer flex items-center gap-1.5">
              <ClipboardPaste size={14} /> لصق سريع
            </button>

            {selected.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Button onClick={handleBulkArchive} size="sm" className="h-8 text-[13px] font-bold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-0 gap-1 cursor-pointer">
                  <Archive size={12} /> أرشفة ({selected.length})
                </Button>
                <Button onClick={handleBulkDelete} size="sm" className="h-8 text-[13px] font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 border-0 gap-1 cursor-pointer">
                  <Trash2 size={12} /> حذف ({selected.length})
                </Button>
                <Button onClick={() => clearSelectedLeadIds(viewKey)} size="sm" className="h-8 text-[13px] font-bold bg-[#1c2234] text-[#8892b0] hover:text-[#f0f2ff] border-0 cursor-pointer">
                  <X size={12} />
                </Button>
              </div>
            )}
          </div>

          {/* Add new row */}
          {showAddRow && (
            <div className="mt-3 flex flex-wrap items-center gap-2 bg-[#0a0d14] rounded-lg p-3 border border-white/[0.06]">
              <input type="text" placeholder="اسم العميل" value={newLead.customerName} onChange={(e) => setNewLead({ ...newLead, customerName: e.target.value })} className="h-8 px-2 rounded bg-[#111520] border border-white/[0.06] text-[13px] text-[#f0f2ff] w-[140px]" />
              <input type="text" placeholder="رقم الجوال" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} className="h-8 px-2 rounded bg-[#111520] border border-white/[0.06] text-[13px] text-[#f0f2ff] w-[140px]" />
              <input type="text" placeholder="لينك المتجر" value={newLead.storeUrl} onChange={(e) => setNewLead({ ...newLead, storeUrl: e.target.value })} className="h-8 px-2 rounded bg-[#111520] border border-white/[0.06] text-[13px] text-[#f0f2ff] w-[180px]" />
              <input type="text" placeholder="البريف" value={newLead.brief} onChange={(e) => setNewLead({ ...newLead, brief: e.target.value })} className="h-8 px-2 rounded bg-[#111520] border border-white/[0.06] text-[13px] text-[#f0f2ff] flex-1 min-w-[120px]" />
              <button onClick={handleAddLead} disabled={saving} className="h-8 px-4 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-50 cursor-pointer" style={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'حفظ'}
              </button>
              <button onClick={() => setShowAddRow(false)} className="h-8 px-3 rounded-lg text-[13px] font-bold text-[#8892b0] hover:text-[#f0f2ff] cursor-pointer">
                إلغاء
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="w-[36px] text-center text-[13px] font-bold text-[#4a5280]">#</TableHead>
                  <TableHead className="w-[40px] text-right text-[13px] font-bold text-[#4a5280]">
                    <Checkbox checked={selected.length === paginatedLeads.length && paginatedLeads.length > 0} onCheckedChange={(checked) => { if (checked) selectAllLeads(viewKey, paginatedLeads.map((l) => l.id)); else clearSelectedLeadIds(viewKey) }} className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]" />
                  </TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[160px] max-w-[160px]">لينك المتجر</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[130px] max-w-[130px]">رقم الجوال</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[150px] max-w-[150px]">اسم العميل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[180px] max-w-[180px]">البريف</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[110px]">حالة التواصل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[110px]">حالة العميل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[150px]">ملاحظات السيلز</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[60px]">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-[#4a5280]">
                      <div className="text-[30px] mb-2">📊</div>
                      <div className="text-[14px] font-semibold">لا يوجد عملاء</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead, idx) => {
                    const isSelected = selected.includes(lead.id)
                    return (
                      <TableRow key={lead.id} className={`border-b border-white/[0.04] transition-colors ${isSelected ? 'bg-[#6c63ff]/5' : 'hover:bg-[#1c2234]/50'}`}>
                        {/* # */}
                        <TableCell className="w-[36px] text-center text-[13px] text-[#4a5280]">
                          {idx + 1}
                        </TableCell>
                        {/* Checkbox */}
                        <TableCell className="w-[40px]">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleLeadSelection(viewKey, lead.id)} className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]" />
                        </TableCell>
                        {/* 1. لينك المتجر */}
                        <TableCell className="max-w-[160px]">
                          <div className="flex items-center gap-1.5 max-w-[160px]">
                            {lead.storeUrl && (
                              <a href={lead.storeUrl} target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded-md bg-[#6c63ff]/10 flex items-center justify-center text-[#6c63ff] hover:bg-[#6c63ff]/20 transition-colors shrink-0" onClick={(e) => e.stopPropagation()}>
                                <ExternalLink size={10} />
                              </a>
                            )}
                            <EditableCell value={lead.storeUrl} onSave={(v) => handleUpdateField(lead.id, 'storeUrl', v)} placeholder="المتجر" />
                          </div>
                        </TableCell>
                        {/* 2. رقم الجوال + duplicate highlight */}
                        <TableCell className="max-w-[130px]">
                          {(() => {
                            const norm = lead.phone ? normalizePhone(lead.phone) : ''
                            const dupInfo = norm ? duplicatePhoneMap.get(norm) : undefined
                            const shouldHighlight = !!(dupInfo && dupInfo.count > 1)
                            const highlightTele = shouldHighlight ? dupInfo!.firstTele : ''
                            return (
                              <div className={`flex items-center gap-1.5 max-w-[130px] rounded px-1 ${shouldHighlight ? 'bg-red-500/10' : ''}`} title={shouldHighlight ? `مكرر (${dupInfo!.count} مرات) — أول تسجيل: ${highlightTele}` : ''}>
                                <a href={`tel:${lead.phone}`} className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors shrink-0 ${shouldHighlight ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-[#00d4aa]/10 text-[#00d4aa] hover:bg-[#00d4aa]/20'}`} onClick={(e) => e.stopPropagation()}>
                                  <Phone size={10} />
                                </a>
                                <div className="flex flex-col min-w-0">
                                  <EditableCell value={lead.phone} onSave={(v) => handleUpdateField(lead.id, 'phone', v)} placeholder="الرقم" />
                                  {shouldHighlight && (
                                    <span className="text-[10px] text-red-400/80 leading-tight truncate font-medium" style={{ fontFamily: 'Cairo, sans-serif' }}>
                                      ↻ {highlightTele}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                        </TableCell>
                        {/* 3. اسم العميل + AI badge */}
                        <TableCell className="max-w-[150px]">
                          <div className="flex items-center gap-1.5">
                            <EditableCell value={lead.customerName} onSave={(v) => handleUpdateField(lead.id, 'customerName', v)} placeholder="اسم العميل" />
                            <AIScoreBadge leadId={lead.id} leadName={lead.customerName} status={lead.status} meetings={lead.meetingDate ? 1 : 0} attended={lead.attended} salesStatus={lead.salesStatus} contactResult={lead.contactResult} />
                          </div>
                        </TableCell>
                        {/* 4. البريف */}
                        <TableCell className="max-w-[180px]">
                          <BriefCell value={lead.brief || ''} onSave={(v) => handleUpdateField(lead.id, 'brief', v)} placeholder="البريف" />
                        </TableCell>
                        {/* حالة التواصل */}
                        <TableCell>
                          <LazySelectCell
                            value={lead.contactResult || 'none'}
                            options={SALES_CONTACT_RESULTS}
                            onChange={(v) => handleUpdateField(lead.id, 'contactResult', v === 'none' ? '' : v)}
                            displayMap={contactResultLabels}
                            className="w-[120px]"
                            allowClear
                          />
                        </TableCell>
                        {/* حالة العميل */}
                        <TableCell>
                          <LazySelectCell
                            value={lead.status || ''}
                            options={SALES_STATUSES}
                            onChange={(v) => handleUpdateField(lead.id, 'status', v)}
                            displayMap={statusLabels}
                            className="w-[110px]"
                            allowClear
                          />
                        </TableCell>
                        {/* ملاحظات السيلز (replaces salesStatus) */}
                        <TableCell className="max-w-[150px]">
                          <NotesCell
                            value={lead.salesStatus || ''}
                            onSave={(v) => handleUpdateField(lead.id, 'salesStatus', v)}
                            placeholder="ملاحظات"
                          />
                        </TableCell>
                        {/* حذف */}
                        <TableCell className="w-[50px]">
                          <button
                            onClick={() => { setDeleteTarget({ id: lead.id, name: lead.customerName || 'عميل' }); setDeleteConfirmOpen(true) }}
                            className="w-7 h-7 rounded-md bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
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
              <span className="text-[12px] text-[#4a5280]">
                عرض {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLeads.length)} من {filteredLeads.length} عميل
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-md bg-[#0a0d14] border border-white/[0.06] flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] disabled:opacity-30 cursor-pointer transition-colors">
                  <ChevronRight size={14} />
                </button>
                <span className="text-[13px] font-bold text-[#f0f2ff]">{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-8 h-8 rounded-md bg-[#0a0d14] border border-white/[0.06] flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] disabled:opacity-30 cursor-pointer transition-colors">
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Paste Dialog */}
      <QuickPasteDialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        leads={leads}
        salesName={pasteSalesName}
        onSaved={handlePasteSaved}
        addToast={addToast}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-[#111520] border-white/[0.08] text-[#f0f2ff]" showCloseButton>
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
              تأكيد الحذف
            </DialogTitle>
          </DialogHeader>
          <p className="text-[14px] text-[#8892b0]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            هل أنت متأكد من حذف "{deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-lg text-[14px] font-bold bg-white/[0.04] text-[#8892b0] hover:bg-white/[0.08] cursor-pointer">إلغاء</button>
            </DialogClose>
            <button
              onClick={() => { if (deleteTarget) handleDeleteLead(deleteTarget.id); setDeleteConfirmOpen(false) }}
              className="px-4 py-2 rounded-lg text-[14px] font-bold bg-red-500 text-white hover:bg-red-600 cursor-pointer"
            >
              حذف
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
