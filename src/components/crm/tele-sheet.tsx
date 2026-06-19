'use client'

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useCrmStore, CONTACT_RESULTS, STATUSES, formatDate, getDateRange } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiCreateLead, apiUpdateLead, apiDeleteLead, apiArchiveLeads, apiDeleteLeadsBulk, apiBroadcastChange, apiBulkCreateLeads } from '@/lib/supabase'
import { normalizePhone } from '@/lib/crm-utils'
import {
  Search, Plus, Trash2, Archive, Phone, Filter, X, Check,
  UserPlus, Calendar, Loader2, ExternalLink,
  ChevronLeft, ChevronRight, ArrowLeftRight, Send, AlertCircle,
  RotateCcw, UserRound, ClipboardPaste, ArrowRight,
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

/* ═══════════════════════════════════════════════════════
   PAGE SIZE for pagination
   ═══════════════════════════════════════════════════════ */
const PAGE_SIZE = 50

/* ═══════════════════════════════════════════════════════
   Meeting type options
   ═══════════════════════════════════════════════════════ */
const MEETING_TYPES = [
  { key: 'google-meet', label: 'جوجل ميت' },
  { key: 'zoom', label: 'زووم' },
]

/* ═══════════════════════════════════════════════════════
   Paste Parsing Helpers (adapted from bulk-add.tsx)
   ═══════════════════════════════════════════════════════ */
function looksLikePhone(s: string): boolean {
  return /^(\+966|966|05|5)\d/.test(s) || /^\d{8,}$/.test(s)
}

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s) || /\.(com|sa|net|org|io|store|shop)/i.test(s)
}

function parsePastedLine(line: string): { phone: string; storeUrl: string } {
  const trimmed = line.trim()
  if (!trimmed) return { phone: '', storeUrl: '' }

  // Try splitting by common separators (tab, comma, multiple spaces)
  const parts = trimmed.split(/[\t,]+/).map((p) => p.trim()).filter(Boolean)

  if (parts.length >= 2) {
    const phonePart = parts.find((p) => looksLikePhone(p))
    const urlPart = parts.find((p) => looksLikeUrl(p))
    if (phonePart && urlPart) {
      return { phone: phonePart, storeUrl: urlPart }
    }
    if (phonePart) {
      const nonPhoneParts = parts.filter((p) => p !== phonePart)
      const maybeUrl = nonPhoneParts.find((p) => looksLikeUrl(p))
      return { phone: phonePart, storeUrl: maybeUrl || '' }
    }
    if (urlPart) {
      const nonUrlParts = parts.filter((p) => p !== urlPart)
      const maybePhone = nonUrlParts.find((p) => looksLikePhone(p))
      return { phone: maybePhone || '', storeUrl: urlPart }
    }
    return { phone: parts[0], storeUrl: parts.length > 1 ? parts[1] : '' }
  }

  // Single value
  if (looksLikePhone(trimmed)) {
    return { phone: trimmed, storeUrl: '' }
  }
  if (looksLikeUrl(trimmed)) {
    return { phone: '', storeUrl: trimmed }
  }

  // Default: treat as phone
  return { phone: trimmed, storeUrl: '' }
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
        className={`text-[13px] font-medium px-2 rounded border border-white/[0.06] bg-[#0a0d14] text-[#f0f2ff] hover:border-[#6c63ff]/30 transition-colors cursor-pointer text-right w-full min-h-[28px] flex items-center ${className}`}
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
   Attendance Badge — read-only for tele sheet
   Logic:
   - Not transferred (no sales) → empty (—)
   - Transferred but attended is null/pending → ⏳ في الانتظار
   - attended === 'attended' → ✅ حضر
   - attended === 'no-show' → ❌ لم يحضر
   ═══════════════════════════════════════════════════════ */
function AttendanceBadge({ value, isTransferred }: { value: string | null; isTransferred: boolean }) {
  // Not transferred → empty cell
  if (!isTransferred) {
    return <span className="text-[#4a5280] text-[13px]">—</span>
  }
  // Transferred but no attendance result yet → waiting
  if (!value || value === 'pending') {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 text-[11px] font-bold border-0">
        ⏳ في الانتظار
      </Badge>
    )
  }
  if (value === 'attended') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 text-[11px] font-bold border-0">
        ✅ حضر
      </Badge>
    )
  }
  if (value === 'no-show') {
    return (
      <Badge className="bg-red-500/15 text-red-400 text-[11px] font-bold border-0">
        ❌ لم يحضر
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-400 text-[11px] font-bold border-0">
      ⏳ في الانتظار
    </Badge>
  )
}

/* ═══════════════════════════════════════════════════════
   Transfer Modal — Dialog component
   ═══════════════════════════════════════════════════════ */
interface TransferModalProps {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onSubmit: (data: TransferData) => void
  salesTeam: string[]
  saving: boolean
}

interface TransferData {
  customerName: string
  phone: string
  storeUrl: string
  brief: string
  meetingType: string
  meetingDate: string
  meetingTime: string
  sales: string
}

function TransferModal({ lead, open, onClose, onSubmit, salesTeam, saving }: TransferModalProps) {
  const [form, setForm] = useState<TransferData>(() => ({
    customerName: lead?.customerName || '',
    phone: lead?.phone || '',
    storeUrl: lead?.storeUrl || '',
    brief: lead?.brief || '',
    meetingType: lead?.meetingType || '',
    meetingDate: lead?.meetingDate || new Date().toISOString().split('T')[0],
    meetingTime: lead?.meetingTime || '',
    sales: lead?.sales || '',
  }))
  const [briefError, setBriefError] = useState(false)

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      onClose()
    }
  }, [onClose])

  const handleSubmit = useCallback(() => {
    if (!form.brief.trim()) {
      setBriefError(true)
      return
    }
    setBriefError(false)
    onSubmit(form)
  }, [form, onSubmit])

  const statusLabel = useMemo(() => {
    if (!lead) return ''
    const s = STATUSES.find(st => st.key === lead.status)
    return s ? s.label : lead.status
  }, [lead])

  const updateField = useCallback((field: keyof TransferData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === 'brief' && value.trim()) {
      setBriefError(false)
    }
  }, [])

  if (!lead) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#111520] border-white/[0.08] text-[#f0f2ff] sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-[18px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            تحويل العميل للسيلز
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#8892b0]">
            املأ بيانات التحويل — البريف مطلوب
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Customer Name */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#8892b0]">اسم العميل</label>
            <Input
              value={form.customerName}
              onChange={(e) => updateField('customerName', e.target.value)}
              className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]"
              placeholder="اسم العميل"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#8892b0]">رقم الجوال</label>
            <Input
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]"
              placeholder="رقم الجوال"
            />
          </div>

          {/* Store URL */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#8892b0]">لينك المتجر</label>
            <Input
              value={form.storeUrl}
              onChange={(e) => updateField('storeUrl', e.target.value)}
              className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]"
              placeholder="لينك المتجر"
              dir="ltr"
            />
          </div>

          {/* Brief — MANDATORY */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#8892b0]">
              البريف <span className="text-red-400">*</span>
            </label>
            <Input
              value={form.brief}
              onChange={(e) => updateField('brief', e.target.value)}
              className={`h-8 text-[13px] bg-[#0a0d14] text-[#f0f2ff] ${briefError ? 'border-red-500 focus:border-red-400' : 'border-white/[0.08]'}`}
              placeholder="ملخص المكالمة (مطلوب)"
            />
            {briefError && (
              <div className="flex items-center gap-1 text-red-400 text-[11px] font-semibold">
                <AlertCircle size={10} />
                البريف مطلوب للتحويل
              </div>
            )}
          </div>

          {/* Client Status — display only */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#8892b0]">حالة العميل</label>
            <div className="h-8 px-3 rounded-md border border-white/[0.06] bg-[#0a0d14] flex items-center text-[13px] text-[#f0f2ff]">
              {statusLabel || '—'}
            </div>
          </div>

          {/* Meeting Type — conditional on status === 'meeting' */}
          {(lead.status === 'meeting' || form.meetingType) && (
            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-[#8892b0]">نوع الاجتماع</label>
              <Select value={form.meetingType} onValueChange={(v) => updateField('meetingType', v)}>
                <SelectTrigger className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                  <SelectValue placeholder="اختر نوع الاجتماع" />
                </SelectTrigger>
                <SelectContent className="bg-[#111520] border-white/[0.08]">
                  {MEETING_TYPES.map((mt) => (
                    <SelectItem key={mt.key} value={mt.key} className="text-[13px] text-[#f0f2ff]">
                      {mt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Meeting Date */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#8892b0]">تاريخ الاجتماع</label>
            <Input
              type="date"
              value={form.meetingDate}
              onChange={(e) => updateField('meetingDate', e.target.value)}
              className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]"
            />
          </div>

          {/* Meeting Time */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#8892b0]">ميعاد الاجتماع</label>
            <Input
              type="time"
              value={form.meetingTime}
              onChange={(e) => updateField('meetingTime', e.target.value)}
              className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]"
            />
          </div>

          {/* Sales Person */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#8892b0]">اسم السيلز</label>
            <Select value={form.sales} onValueChange={(v) => updateField('sales', v)}>
              <SelectTrigger className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                <SelectValue placeholder="اختر السيلز" />
              </SelectTrigger>
              <SelectContent className="bg-[#111520] border-white/[0.08]">
                {salesTeam.map((name) => (
                  <SelectItem key={name} value={name} className="text-[13px] text-[#f0f2ff]">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[#00d4aa] hover:bg-[#00c09a] text-[#0a0d14] gap-1.5 text-[13px] font-bold h-9 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            تحويل
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-[#8892b0] hover:text-[#f0f2ff] text-[13px] h-9 cursor-pointer"
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════
   Quick Paste Dialog — REDESIGNED: Table-first smart paste
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
  teleName: string
  onSaved: (created: Lead[]) => void
  addToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void
}

let pasteRowCounter = 0

function QuickPasteDialog({ open, onClose, leads, teleName, onSaved, addToast }: QuickPasteDialogProps) {
  const [rows, setRows] = useState<PasteRow[]>([])
  const [pasteSaving, setPasteSaving] = useState(false)
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; field: 'phone' | 'storeUrl' } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // Build set of existing normalized phone numbers for duplicate detection
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

  // Recompute duplicate status whenever rows or leads change
  const computeDuplicates = useCallback((currentRows: PasteRow[]) => {
    const seenInPaste = new Map<string, string[]>() // norm -> row ids
    return currentRows.map((row) => {
      const norm = row.phone ? normalizePhone(row.phone) : ''
      const isExisting = norm ? existingPhoneSet.has(norm) : false
      // Check intra-paste duplicates
      if (norm) {
        const existing = seenInPaste.get(norm) || []
        existing.push(row.id)
        seenInPaste.set(norm, existing)
      }
      return { ...row, isDuplicate: isExisting || false }
    })
  }, [existingPhoneSet])

  // After computing, mark intra-paste duplicates too
  const rowsWithDuplicates = useMemo(() => {
    const normToIds = new Map<string, string[]>()
    // First pass: collect all norms
    for (const row of rows) {
      if (!row.phone) continue
      const norm = normalizePhone(row.phone)
      if (!norm) continue
      const arr = normToIds.get(norm) || []
      arr.push(row.id)
      normToIds.set(norm, arr)
    }
    // Second pass: mark duplicates (existing + intra-paste)
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

  // Selected rows (included + valid)
  const selectedValidRows = useMemo(
    () => rowsWithDuplicates.filter((r) => r.included && (r.phone.trim() || r.storeUrl.trim())),
    [rowsWithDuplicates]
  )

  const duplicateCount = useMemo(
    () => rowsWithDuplicates.filter((r) => r.isDuplicate && r.included).length,
    [rowsWithDuplicates]
  )

  /* ─── Update a row's field ─── */
  const updateRow = useCallback((id: string, field: 'phone' | 'storeUrl' | 'included', value: string | boolean) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }, [])

  /* ─── Remove a single row ─── */
  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  /* ─── Add empty row ─── */
  const addEmptyRow = useCallback(() => {
    const newRow: PasteRow = {
      id: `new-${++pasteRowCounter}`,
      phone: '',
      storeUrl: '',
      included: true,
      isDuplicate: false,
    }
    setRows((prev) => [...prev, newRow])
    // Focus the phone cell of the new row
    setTimeout(() => setFocusedCell({ rowId: newRow.id, field: 'phone' }), 50)
  }, [])

  /* ─── Handle paste event on the table area ─── */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text.trim()) return

    // Check if it's multi-line data (bulk paste)
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

  /* ─── Remove all duplicate rows from table ─── */
  const removeDuplicateRows = useCallback(() => {
    setRows((prev) => prev.filter((r) => !r.isDuplicate))
  }, [])

  /* ─── Select/Deselect all ─── */
  const toggleAll = useCallback((checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, included: checked })))
  }, [])

  /* ─── Clear all rows ─── */
  const clearAll = useCallback(() => {
    setRows([])
  }, [])

  /* ─── Save selected rows to tele sheet ─── */
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
        tele: teleName,
        status: 'new',
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
  }, [selectedValidRows, teleName, onSaved, addToast, onClose])

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) onClose()
  }, [onClose])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setRows([])
      setFocusedCell(null)
    }
  }, [open])

  const allIncluded = rows.length > 0 && rows.every((r) => r.included)
  const someIncluded = rows.some((r) => r.included) && !allIncluded

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#111520] border-white/[0.08] text-[#f0f2ff] sm:max-w-3xl max-h-[90vh] flex flex-col" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-[18px] font-extrabold text-[#f0f2ff] flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <ClipboardPaste size={20} className="text-[#6c63ff]" />
            إضافة ليدز سريعة
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#8892b0]">
            الصق البيانات مباشرة (Ctrl+V) أو اكتب يدوياً — الأرقام تنزل في عمود الرقم واللينكات في عمود المتجر
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-3 min-h-0 py-2">
          {/* Duplicate warning bar */}
          {duplicateCount > 0 && (
            <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                <div>
                  <span className="text-[13px] font-bold text-amber-400">{duplicateCount} بيانات مكررة</span>
                  <span className="text-[12px] font-medium text-amber-400/70 mr-2">— موجودة مسبقاً</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={removeDuplicateRows}
                  className="h-7 px-2.5 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-bold hover:bg-red-500/25 transition-colors cursor-pointer"
                >
                  استبعاد المكرر
                </button>
              </div>
            </div>
          )}

          {/* Table area — paste target */}
          <div
            ref={tableRef}
            onPaste={handlePaste}
            tabIndex={0}
            className="flex-1 min-h-[200px] max-h-[50vh] overflow-y-auto rounded-xl border border-white/[0.06] bg-[#0a0d14] custom-scrollbar focus:border-[#6c63ff]/30 focus:outline-none transition-colors"
          >
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent sticky top-0 bg-[#0a0d14] z-10">
                  <TableHead className="w-[36px] text-center text-[12px] font-bold text-[#4a5280]">
                    <Checkbox
                      checked={allIncluded}
                      ref={(el) => {
                        if (el) (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someIncluded
                      }}
                      onCheckedChange={(checked) => toggleAll(!!checked)}
                      className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]"
                    />
                  </TableHead>
                  <TableHead className="w-[36px] text-center text-[12px] font-bold text-[#4a5280]">#</TableHead>
                  <TableHead className="text-right text-[12px] font-bold text-[#4a5280] w-[160px]">رقم الجوال</TableHead>
                  <TableHead className="text-right text-[12px] font-bold text-[#4a5280]">لينك المتجر</TableHead>
                  <TableHead className="w-[36px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsWithDuplicates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-[#4a5280] text-[14px] font-semibold">الصق البيانات هنا أو اضغط الزر بالأسفل</div>
                        <div className="text-[#4a5280]/60 text-[12px]">Ctrl+V للصق • كل سطر = صف جديد • الأرقام واللينكات تنزل تلقائياً في الأعمدة الصح</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rowsWithDuplicates.map((row, idx) => {
                    const isEmpty = !row.phone.trim() && !row.storeUrl.trim()
                    return (
                      <TableRow
                        key={row.id}
                        className={`border-b border-white/[0.04] transition-colors ${
                          !row.included
                            ? 'bg-red-500/[0.04] opacity-50'
                            : row.isDuplicate
                              ? 'bg-amber-500/[0.06]'
                              : isEmpty
                                ? 'bg-white/[0.01]'
                                : 'hover:bg-[#1c2234]/50'
                        }`}
                      >
                        {/* Include checkbox */}
                        <TableCell className="w-[36px] text-center">
                          <Checkbox
                            checked={row.included}
                            onCheckedChange={(checked) => updateRow(row.id, 'included', !!checked)}
                            className={`border-white/20 ${row.isDuplicate ? 'data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500' : 'data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]'}`}
                          />
                        </TableCell>

                        {/* Row number */}
                        <TableCell className="w-[36px] text-center text-[12px] font-bold text-[#4a5280]">
                          {idx + 1}
                        </TableCell>

                        {/* Phone number */}
                        <TableCell className="w-[160px]">
                          <div className="flex items-center gap-1">
                            {focusedCell?.rowId === row.id && focusedCell?.field === 'phone' ? (
                              <input
                                type="text"
                                value={row.phone}
                                onChange={(e) => updateRow(row.id, 'phone', e.target.value)}
                                onBlur={() => setFocusedCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') setFocusedCell(null)
                                  if (e.key === 'Tab') {
                                    e.preventDefault()
                                    setFocusedCell({ rowId: row.id, field: 'storeUrl' })
                                  }
                                }}
                                className="bg-[#111520] border border-[#6c63ff]/40 rounded px-2 py-1 text-[13px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]"
                                dir="ltr"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => setFocusedCell({ rowId: row.id, field: 'phone' })}
                                className={`cursor-pointer rounded px-1.5 py-0.5 text-[13px] font-medium min-h-[28px] inline-block truncate max-w-full transition-colors ${
                                  row.isDuplicate ? 'text-amber-400 hover:bg-amber-500/10' : row.phone ? 'text-[#f0f2ff] hover:bg-[#1c2234]' : 'text-[#4a5280] hover:bg-[#1c2234]'
                                }`}
                                dir="ltr"
                              >
                                {row.phone || 'رقم الجوال...'}
                              </span>
                            )}
                            {row.isDuplicate && row.phone && (
                              <Badge className="bg-amber-500/15 text-amber-400 text-[9px] font-bold border-0 shrink-0">مكرر</Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Store URL */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {focusedCell?.rowId === row.id && focusedCell?.field === 'storeUrl' ? (
                              <input
                                type="text"
                                value={row.storeUrl}
                                onChange={(e) => updateRow(row.id, 'storeUrl', e.target.value)}
                                onBlur={() => setFocusedCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') setFocusedCell(null)
                                  if (e.key === 'Tab' && !e.shiftKey) {
                                    e.preventDefault()
                                    // Focus phone of next row, or add new row
                                    const nextIdx = idx + 1
                                    if (nextIdx < rowsWithDuplicates.length) {
                                      setFocusedCell({ rowId: rowsWithDuplicates[nextIdx].id, field: 'phone' })
                                    } else {
                                      addEmptyRow()
                                    }
                                  }
                                }}
                                className="bg-[#111520] border border-[#6c63ff]/40 rounded px-2 py-1 text-[13px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]"
                                dir="ltr"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => setFocusedCell({ rowId: row.id, field: 'storeUrl' })}
                                className={`cursor-pointer rounded px-1.5 py-0.5 text-[13px] font-medium min-h-[28px] inline-block truncate max-w-full transition-colors ${
                                  row.storeUrl ? 'text-[#f0f2ff] hover:bg-[#1c2234]' : 'text-[#4a5280] hover:bg-[#1c2234]'
                                }`}
                                dir="ltr"
                              >
                                {row.storeUrl || 'لينك المتجر...'}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Delete row */}
                        <TableCell className="w-[36px]">
                          <button
                            onClick={() => removeRow(row.id)}
                            className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors cursor-pointer"
                            title="حذف الصف"
                          >
                            <X size={10} />
                          </button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Action bar below table */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={addEmptyRow}
                className="h-8 px-3 rounded-lg bg-[#6c63ff]/10 text-[#6c63ff] text-[12px] font-bold flex items-center gap-1.5 hover:bg-[#6c63ff]/20 transition-colors cursor-pointer"
              >
                <Plus size={12} />
                صف جديد
              </button>
              {rows.length > 0 && (
                <button
                  onClick={clearAll}
                  className="h-8 px-3 rounded-lg bg-red-500/10 text-red-400 text-[12px] font-bold flex items-center gap-1.5 hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} />
                  مسح الكل
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-[12px] font-medium">
              <span className="text-[#8892b0]">
                {rows.length > 0 ? (
                  <>
                    <span className="text-[#f0f2ff] font-bold">{selectedValidRows.length}</span> محدد من <span className="text-[#f0f2ff] font-bold">{rows.length}</span>
                  </>
                ) : (
                  'لا يوجد بيانات'
                )}
              </span>
              {duplicateCount > 0 && (
                <Badge className="bg-amber-500/15 text-amber-400 text-[11px] font-bold border-0">
                  {duplicateCount} مكرر
                </Badge>
              )}
              <div className="flex items-center gap-1 text-[#8892b0]">
                <UserRound size={12} className="text-[#6c63ff]" />
                {teleName}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            onClick={handleSave}
            disabled={pasteSaving || selectedValidRows.length === 0}
            className="bg-[#00d4aa] hover:bg-[#00c09a] text-[#0a0d14] gap-1.5 text-[13px] font-bold h-9 cursor-pointer disabled:opacity-50"
          >
            {pasteSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {pasteSaving ? 'جاري الإضافة...' : `إضافة المحدد (${selectedValidRows.length})`}
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-[#8892b0] hover:text-[#f0f2ff] text-[13px] h-9 cursor-pointer"
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════
   Tele Sheet Component — REWRITTEN
   ═══════════════════════════════════════════════════════ */
export function TeleSheet() {
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
  const addLeadToCache = useCrmStore((s) => s.addLeadToCache)
  const removeLeadFromCache = useCrmStore((s) => s.removeLeadFromCache)
  const batchRemoveLeadsFromCache = useCrmStore((s) => s.batchRemoveLeadsFromCache)
  const batchAddLeadsToCache = useCrmStore((s) => s.batchAddLeadsToCache)
  const archiveLeadsInCache = useCrmStore((s) => s.archiveLeadsInCache)
  const activeFilter = useCrmStore((s) => s.activeFilter)
  const setActiveFilter = useCrmStore((s) => s.setActiveFilter)
  const storeSelectedTele = useCrmStore((s) => s.selectedTeleMember)
  const setStoreSelectedTele = useCrmStore((s) => s.setSelectedTeleMember)

  const viewKey = 'tele-sheet'
  const selected = selectedLeadIds[viewKey] || []
  const searchQuery = searchQueries[viewKey] || ''
  const dateFilter = dateRangeFilters[viewKey] || { preset: 'all' }
  const currentFilter = activeFilter[viewKey] || ''

  const [showAddRow, setShowAddRow] = useState(false)
  const [newLead, setNewLead] = useState({
    customerName: '', phone: '', storeUrl: '', brief: '',
  })
  const [saving, setSaving] = useState(false)

  // Tele users are locked to their own data; admin can pick which tele to view.
  // Selection is persisted in the store so it survives navigation/refresh.
  const isLockedToSelf = currentRole === 'tele'

  // For admin/sales: find the first tele member who actually has leads,
  // so the sheet shows real data immediately instead of an empty list.
  const teleWithLeads = useMemo(() => {
    const names = new Set<string>()
    for (const l of leads) {
      if (l.tele && !l.isArchived) names.add(l.tele)
    }
    // Preserve team order, but only members with leads
    return team.tele.filter((name) => names.has(name))
  }, [leads, team.tele])

  // For tele users: always their own name.
  // For admin/sales: use persisted selection, or default to first tele WITH leads.
  const effectiveSelectedTele = isLockedToSelf
    ? (currentUser || 'all')
    : (storeSelectedTele !== 'all' && team.tele.includes(storeSelectedTele)
        ? storeSelectedTele
        : (teleWithLeads[0] || team.tele[0] || 'all'))
  const selectedTele = effectiveSelectedTele
  const setSelectedTele = (val: string) => {
    if (!isLockedToSelf) setStoreSelectedTele(val)
  }

  // Transfer modal state
  const [transferLeadId, setTransferLeadId] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferSaving, setTransferSaving] = useState(false)

  // Quick Paste dialog state
  const [showPasteDialog, setShowPasteDialog] = useState(false)

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const [currentPage, setCurrentPage] = useState(1)

  // Custom date range state
  const [fromDate, setFromDate] = useState<Date | undefined>(
    dateFilter.customFrom ? new Date(dateFilter.customFrom) : undefined
  )
  const [toDate, setToDate] = useState<Date | undefined>(
    dateFilter.customTo ? new Date(dateFilter.customTo) : undefined
  )
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)

  // Ctrl+V keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not currently focused on an input/textarea/select element
      const target = e.target as HTMLElement
      const isEditing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isEditing) {
        e.preventDefault()
        setShowPasteDialog(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  /* ─── Filtered leads ─── */
  // Single-pass filter + stats computation to avoid chained .filter() overhead
  const { filteredLeads, stats } = useMemo(() => {
    // Pre-compute date range only if needed
    const needsDateFilter = dateFilter.preset !== 'all'
    const dateRange = needsDateFilter ? getDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo) : null
    const q = searchQuery.trim().toLowerCase()

    let total = 0
    let contacted = 0
    let meetings = 0
    let transferred = 0

    const result: Lead[] = []

    for (const l of leads) {
      if (l.isArchived) continue
      if (isLockedToSelf && l.tele !== currentUser) continue
      if (!isLockedToSelf && selectedTele !== 'all' && l.tele !== selectedTele) continue
      if (currentFilter === 'uncontacted' && l.contactResult && l.contactResult !== 'none' && l.contactResult !== '') continue
      if (q && !(l.customerName?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q) || l.storeUrl?.toLowerCase().includes(q) || l.brief?.toLowerCase().includes(q))) continue
      if (dateRange && (l.createdAt < dateRange.from || l.createdAt >= dateRange.to)) continue

      result.push(l)
      total++
      if (l.contactResult && l.contactResult !== 'none' && l.contactResult !== '') contacted++
      if (l.status === 'meeting' || l.meetingDate) meetings++
      if (l.sales) transferred++
    }

    // Sort newest first
    result.sort((a, b) => {
      const timeDiff = (b.createdAt || 0) - (a.createdAt || 0)
      if (timeDiff !== 0) return timeDiff
      const numA = Number(a.id)
      const numB = Number(b.id)
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA
      return b.id.localeCompare(a.id)
    })

    return { filteredLeads: result, stats: { total, contacted, meetings, transferred } }
  }, [leads, selectedTele, searchQuery, dateFilter, isLockedToSelf, currentUser, currentFilter])

  /* ─── Paginated leads ─── */
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE))
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredLeads.slice(start, start + PAGE_SIZE)
  }, [filteredLeads, currentPage])

  // Reset page when filters change
  const [prevFilterKey, setPrevFilterKey] = useState('')
  const filterKey = `${selectedTele}|${searchQuery}|${dateFilter.preset}|${currentFilter}`
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setCurrentPage(1)
  }

  /* ─── Transfer lead reference ─── */
  const transferLead = useMemo(() => {
    if (!transferLeadId) return null
    return leads.find(l => l.id === transferLeadId) || null
  }, [transferLeadId, leads])

  /* ─── Add new lead ─── */
  const handleAddLead = useCallback(async () => {
    if (!newLead.customerName.trim() || !newLead.phone.trim()) {
      addToast('warning', 'اسم العميل ورقم الجوال مطلوبان')
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
    // Auto-set meetingDate when status changes to 'meeting'
    if (field === 'status' && value === 'meeting') {
      const lead = leads.find(l => l.id === id)
      if (lead && !lead.meetingDate) {
        updates.meetingDate = new Date().toISOString().split('T')[0]
      }
    }
    updateLeadInCache(id, updates)
    try {
      await apiUpdateLead(id, updates)
    } catch (err: unknown) {
      addToast('error', 'فشل التحديث')
    }
  }, [updateLeadInCache, addToast, leads])

  /* ─── Delete single lead — opens confirmation dialog ─── */
  const requestDeleteLead = useCallback((id: string, name: string) => {
    setDeleteTarget({ id, name })
    setDeleteConfirmOpen(true)
  }, [])

  /* ─── Confirm delete single lead ─── */
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setDeleteConfirmOpen(false)
    removeLeadFromCache(id)
    try {
      await apiDeleteLead(id)
      addToast('success', 'تم حذف العميل')
    } catch {
      addToast('error', 'فشل الحذف')
    }
    setDeleteTarget(null)
  }, [deleteTarget, removeLeadFromCache, addToast])

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
  }, [selected, currentUser, archiveLeadsInCache, addToast, clearSelectedLeadIds])

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
  }, [selected, batchRemoveLeadsFromCache, addToast, clearSelectedLeadIds])

  /* ─── Open transfer modal ─── */
  const openTransferModal = useCallback((leadId: string) => {
    setTransferLeadId(leadId)
    setTransferOpen(true)
  }, [])

  const closeTransferModal = useCallback(() => {
    setTransferOpen(false)
    setTransferLeadId(null)
  }, [])

  /* ─── Transfer lead to sales ─── */
  const handleTransferToSales = useCallback(async (formData: TransferData) => {
    if (!transferLeadId) return
    if (!formData.sales) {
      addToast('warning', 'اختر السيلز أولاً')
      return
    }
    if (!formData.brief.trim()) {
      addToast('warning', 'البريف مطلوب للتحويل')
      return
    }

    setTransferSaving(true)
    const updates: Partial<Lead> = {
      sales: formData.sales,
      meetingDate: formData.meetingDate || '',
      meetingTime: formData.meetingTime || '',
      assignedAt: Date.now(),
      salesStatus: 'new',
      brief: formData.brief,
      customerName: formData.customerName,
      phone: formData.phone,
      storeUrl: formData.storeUrl,
    }
    // Add meeting type if status is meeting or form has it
    if (formData.meetingType) {
      updates.meetingType = formData.meetingType
    }

    updateLeadInCache(transferLeadId, updates)
    try {
      await apiUpdateLead(transferLeadId, updates)
      addToast('success', `تم تحويل العميل إلى ${formData.sales} بنجاح ✅`)

      // Record the transfer in the transfers table (for history + statistics)
      // Non-blocking — failure here shouldn't undo the transfer
      try {
        const { apiCreateTransfer } = await import('@/lib/supabase')
        await apiCreateTransfer({
          lead_id: transferLeadId,
          from_name: currentUser || '',
          to_name: formData.sales,
          from_role: 'tele',
          to_role: 'sales',
        })
      } catch (transferLogErr) {
        console.error('[tele-sheet] Failed to log transfer:', transferLogErr)
        // Non-fatal — the lead was already updated successfully
      }

      // Broadcast the transfer to notify sales person instantly
      apiBroadcastChange({
        type: 'assignment',
        leadId: transferLeadId,
        data: {
          sales: formData.sales,
          meetingDate: formData.meetingDate || '',
          meetingTime: formData.meetingTime || '',
          customerName: formData.customerName,
          salesStatus: 'new',
          assignedAt: Date.now(),
        },
        by: currentUser || '',
        byRole: currentRole || 'tele',
        at: Date.now(),
      })
    } catch {
      addToast('error', 'فشل التحويل')
    }
    setTransferSaving(false)
    closeTransferModal()
  }, [transferLeadId, updateLeadInCache, addToast, closeTransferModal, currentUser, currentRole])

  /* ─── Display label maps for LazySelect ─── */
  const contactResultLabels = useMemo(() => {
    const m: Record<string, string> = {}
    CONTACT_RESULTS.forEach(cr => { m[cr.key] = cr.label })
    return m
  }, [])

  const statusLabels = useMemo(() => {
    const m: Record<string, string> = {}
    STATUSES.forEach(s => { m[s.key] = s.label })
    return m
  }, [])

  /* ─── Check if a lead is transferred ─── */
  const isTransferred = useCallback((lead: Lead) => {
    return !!(lead.sales && lead.assignedAt)
  }, [])

  /* ─── Cancel transfer ─── */
  const handleCancelTransfer = useCallback(async (leadId: string) => {
    const updates: Partial<Lead> = {
      sales: '',
      assignedAt: null as unknown as number,
      meetingDate: '',
      meetingTime: '',
      meetingType: '',
      salesStatus: null as unknown as string,
    }
    updateLeadInCache(leadId, updates)
    try {
      await apiUpdateLead(leadId, updates)
      addToast('success', 'تم إلغاء التحويل')
    } catch {
      addToast('error', 'فشل إلغاء التحويل')
    }
  }, [updateLeadInCache, addToast])

  /* ─── Change sales person (reopen modal) ─── */
  const handleChangeSales = useCallback((leadId: string) => {
    openTransferModal(leadId)
  }, [openTransferModal])

  /* ─── Handle paste saved — add created leads to cache ─── */
  const handlePasteSaved = useCallback((created: Lead[]) => {
    batchAddLeadsToCache(created)
  }, [batchAddLeadsToCache])

  /* ─── Compute tele name for paste dialog ─── */
  const pasteTeleName = useMemo(() => {
    if (isLockedToSelf) return currentUser || ''
    return selectedTele === 'all' ? (currentUser || '') : selectedTele
  }, [isLockedToSelf, currentUser, selectedTele])

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            شيت التيلي
          </h2>
          <p className="text-[13px] font-semibold text-[#8892b0] mt-0.5">إدارة العملاء المحُوَّلين للتلي ماركتنج</p>
        </div>
        <div className="flex items-center gap-2">
          {currentFilter === 'uncontacted' && (
            <Badge className="bg-[#ff6b6b]/15 text-[#ff6b6b] text-[12px] font-bold border border-[#ff6b6b]/20 gap-1 cursor-pointer hover:bg-[#ff6b6b]/25" onClick={() => setActiveFilter(viewKey, '')}>
              <Phone size={12} />
              عملاء لم يتم التواصل معهم
              <X size={10} className="mr-1" />
            </Badge>
          )}
          <Button
            onClick={() => setShowAddRow(true)}
            className="bg-[#6c63ff] hover:bg-[#5b54e6] text-white gap-1.5 text-[12px] h-9 cursor-pointer"
          >
            <Plus size={14} />
            إضافة عميل
          </Button>
          <Button
            onClick={() => setShowPasteDialog(true)}
            className="bg-[#1c2234] hover:bg-[#252d42] text-[#8892b0] hover:text-[#f0f2ff] gap-1.5 text-[12px] h-9 border border-white/[0.06] cursor-pointer"
          >
            <ClipboardPaste size={14} />
            لصق سريع
          </Button>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي العملاء', value: stats.total, color: '#6c63ff' },
          { label: 'تم التواصل', value: stats.contacted, color: '#00d4aa' },
          { label: 'اجتماعات', value: stats.meetings, color: '#ffd166' },
          { label: 'تم التحويل', value: stats.transferred, color: '#00d4aa' },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-[#111520] border border-white/[0.06] rounded-xl p-3"
          >
            <div className="text-[13px] font-semibold text-[#8892b0]">{s.label}</div>
            <div className="text-[19px] font-bold mt-0.5" style={{ color: s.color, fontFamily: 'Cairo, sans-serif' }}>
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
              <div className="h-8 px-3 rounded-md border border-white/[0.08] bg-[#0a0d14] flex items-center gap-2 text-[13px] font-medium text-[#f0f2ff] w-[140px]">
                <Filter size={12} className="text-[#6c63ff]" />
                <span>{currentUser}</span>
              </div>
            ) : (
              <Select value={selectedTele} onValueChange={setSelectedTele}>
                <SelectTrigger className="w-[140px] h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0]">
                  <Filter size={12} className="text-[#6c63ff]" />
                  <SelectValue placeholder="فلتر التيلي" />
                </SelectTrigger>
                <SelectContent className="bg-[#111520] border-white/[0.08]">
                  <SelectItem value="all" className="text-[13px] text-[#f0f2ff]">الكل</SelectItem>
                  {team.tele.map((name) => (
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
              if (v !== 'custom') {
                setFromDate(undefined)
                setToDate(undefined)
              }
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

            {/* Custom date range pickers — visible only when preset = 'custom' */}
            {dateFilter.preset === 'custom' && (
              <div className="flex items-center gap-1.5">
                {/* From date */}
                <Popover open={fromOpen} onOpenChange={setFromOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0] hover:text-[#f0f2ff] gap-1.5 px-2.5 cursor-pointer"
                    >
                      <Calendar size={12} className="text-[#6c63ff]" />
                      {fromDate ? fromDate.toLocaleDateString('ar-EG') : 'من'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#111520] border-white/[0.08]" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={fromDate}
                      onSelect={(date) => {
                        setFromDate(date)
                        if (date) {
                          const iso = date.toISOString().split('T')[0]
                          setDateRangeFilter(viewKey, { preset: 'custom', customFrom: iso, customTo: dateFilter.customTo })
                        }
                        setFromOpen(false)
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <ArrowRight size={12} className="text-[#4a5280]" />

                {/* To date */}
                <Popover open={toOpen} onOpenChange={setToOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#8892b0] hover:text-[#f0f2ff] gap-1.5 px-2.5 cursor-pointer"
                    >
                      <Calendar size={12} className="text-[#6c63ff]" />
                      {toDate ? toDate.toLocaleDateString('ar-EG') : 'إلى'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#111520] border-white/[0.08]" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={toDate}
                      onSelect={(date) => {
                        setToDate(date)
                        if (date) {
                          const iso = date.toISOString().split('T')[0]
                          setDateRangeFilter(viewKey, { preset: 'custom', customFrom: dateFilter.customFrom, customTo: iso })
                        }
                        setToOpen(false)
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Clear custom range */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-[#4a5280] hover:text-[#f0f2ff] cursor-pointer"
                  onClick={() => {
                    setFromDate(undefined)
                    setToDate(undefined)
                    setDateRangeFilter(viewKey, { preset: 'all' })
                  }}
                >
                  <X size={14} />
                </Button>
              </div>
            )}

            {/* Bulk actions */}
            {selected.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={handleBulkArchive}
                  size="sm"
                  className="h-8 text-[13px] font-bold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-0 gap-1 cursor-pointer"
                >
                  <Archive size={12} />
                  أرشفة ({selected.length})
                </Button>
                <Button
                  onClick={handleBulkDelete}
                  size="sm"
                  className="h-8 text-[13px] font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 border-0 gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                  حذف ({selected.length})
                </Button>
                <Button
                  onClick={() => clearSelectedLeadIds(viewKey)}
                  size="sm"
                  className="h-8 text-[13px] font-bold bg-[#1c2234] text-[#8892b0] hover:text-[#f0f2ff] border-0 cursor-pointer"
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
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="w-[36px] text-center text-[13px] font-bold text-[#4a5280]">#</TableHead>
                  <TableHead className="w-[40px] text-right text-[13px] font-bold text-[#4a5280]">
                    <Checkbox
                      checked={selected.length === paginatedLeads.length && paginatedLeads.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) selectAllLeads(viewKey, paginatedLeads.map((l) => l.id))
                        else clearSelectedLeadIds(viewKey)
                      }}
                      className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]"
                    />
                  </TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[160px] max-w-[160px]">لينك المتجر</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[130px] max-w-[130px]">رقم الجوال</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[150px] max-w-[150px]">اسم العميل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[180px] max-w-[180px]">البريف</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[110px]">حالة التواصل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[110px]">حالة العميل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[90px]">الحضور</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[120px]">تحويل</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[60px]">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* ─── Inline Add Row ─── */}
                {showAddRow && (
                  <tr className="border-b border-[#6c63ff]/20 bg-[#6c63ff]/5">
                    <TableCell className="w-[36px] text-center text-[12px] text-[#4a5280]">—</TableCell>
                    <TableCell className="w-[40px]">
                      <UserPlus size={14} className="text-[#6c63ff]" />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="لينك المتجر"
                        value={newLead.storeUrl}
                        onChange={(e) => setNewLead((p) => ({ ...p, storeUrl: e.target.value }))}
                        className="h-7 text-[13px] bg-[#0a0d14] border-[#6c63ff]/30 text-[#f0f2ff]"
                        dir="ltr"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="رقم الجوال"
                        value={newLead.phone}
                        onChange={(e) => setNewLead((p) => ({ ...p, phone: e.target.value }))}
                        className="h-7 text-[13px] bg-[#0a0d14] border-[#6c63ff]/30 text-[#f0f2ff]"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="اسم العميل"
                        value={newLead.customerName}
                        onChange={(e) => setNewLead((p) => ({ ...p, customerName: e.target.value }))}
                        className="h-7 text-[13px] bg-[#0a0d14] border-[#6c63ff]/30 text-[#f0f2ff]"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="البريف"
                        value={newLead.brief}
                        onChange={(e) => setNewLead((p) => ({ ...p, brief: e.target.value }))}
                        className="h-7 text-[13px] bg-[#0a0d14] border-[#6c63ff]/30 text-[#f0f2ff]"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-[#1c2234] text-[#4a5280] text-[11px] font-bold border-0">—</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-[#6c63ff]/15 text-[#a8a3ff] text-[11px] font-bold border-0">جديد</Badge>
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
                  </tr>
                )}

                {/* ─── Data Rows ─── */}
                {paginatedLeads.length === 0 && !showAddRow ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-[#4a5280]">
                      <div className="text-[30px] mb-2">📋</div>
                      <div className="text-[14px] font-semibold">لا يوجد عملاء</div>
                      <div className="text-[12px] font-medium mt-1">اضغط &quot;إضافة عميل&quot; لإضافة عميل جديد</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead, idx) => {
                    const isSelected = selected.includes(lead.id)
                    const transferred = isTransferred(lead)
                    const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1
                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-white/[0.04] transition-colors ${
                          transferred
                            ? 'bg-emerald-500/[0.08] border-r-2 border-r-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.15)]'
                            : isSelected
                              ? 'bg-[#6c63ff]/5'
                              : 'hover:bg-[#1c2234]/50'
                        }`}
                      >
                        {/* # Row Number */}
                        <TableCell className="w-[36px] text-center text-[12px] font-bold text-[#4a5280]">
                          {rowNum}
                        </TableCell>

                        {/* ☐ Checkbox */}
                        <TableCell className="w-[40px]">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleLeadSelection(viewKey, lead.id)}
                            className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]"
                          />
                        </TableCell>

                        {/* لينك المتجر — clickable link, editable */}
                        <TableCell className="max-w-[160px]">
                          <div className="flex items-center gap-1 max-w-[160px]">
                            <EditableCell
                              value={lead.storeUrl}
                              onSave={(v) => handleUpdateField(lead.id, 'storeUrl', v)}
                              placeholder="لينك المتجر"
                            />
                            {lead.storeUrl && (
                              <a
                                href={lead.storeUrl.startsWith('http') ? lead.storeUrl : `https://${lead.storeUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-8 h-8 rounded-lg bg-[#6c63ff]/10 flex items-center justify-center text-[#6c63ff] hover:bg-[#6c63ff]/20 hover:text-[#a8a3ff] transition-colors shrink-0"
                                title="فتح المتجر"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink size={16} />
                              </a>
                            )}
                          </div>
                        </TableCell>

                        {/* رقم الجوال — with tel: link, editable */}
                        <TableCell className="max-w-[130px]">
                          <div className="flex items-center gap-1.5 max-w-[130px]">
                            <a
                              href={`tel:${lead.phone}`}
                              className="w-6 h-6 rounded-md bg-[#00d4aa]/10 flex items-center justify-center text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors shrink-0"
                              onClick={(e) => e.stopPropagation()}
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

                        {/* اسم العميل — editable + AI score badge */}
                        <TableCell className="max-w-[150px]">
                          <div className="flex items-center gap-1.5">
                            <EditableCell
                              value={lead.customerName}
                              onSave={(v) => handleUpdateField(lead.id, 'customerName', v)}
                              placeholder="اسم العميل"
                            />
                            <AIScoreBadge
                              leadId={lead.id}
                              leadName={lead.customerName}
                              status={lead.status}
                              meetings={lead.meetingDate ? 1 : 0}
                              attended={lead.attended}
                              salesStatus={lead.salesStatus}
                              contactResult={lead.contactResult}
                            />
                          </div>
                        </TableCell>

                        {/* البريف — editable */}
                        <TableCell className="max-w-[180px]">
                          <EditableCell
                            value={lead.brief}
                            onSave={(v) => handleUpdateField(lead.id, 'brief', v)}
                            placeholder="البريف"
                          />
                        </TableCell>

                        {/* حالة التواصل — LazySelectCell */}
                        <TableCell>
                          <LazySelectCell
                            value={lead.contactResult || 'none'}
                            options={CONTACT_RESULTS}
                            onChange={(v) => handleUpdateField(lead.id, 'contactResult', v === 'none' ? '' : v)}
                            displayMap={contactResultLabels}
                            className="w-[110px]"
                          />
                        </TableCell>

                        {/* حالة العميل — LazySelectCell */}
                        <TableCell>
                          <LazySelectCell
                            value={lead.status || 'new'}
                            options={STATUSES}
                            onChange={(v) => handleUpdateField(lead.id, 'status', v)}
                            displayMap={statusLabels}
                            className="w-[110px]"
                          />
                        </TableCell>

                        {/* الحضور — READ-ONLY badge */}
                        <TableCell className="w-[90px]">
                          <AttendanceBadge value={lead.attended} isTransferred={transferred} />
                        </TableCell>

                        {/* تحويل — Transfer button / transferred info */}
                        <TableCell className="w-[120px]">
                          {lead.sales ? (
                            <div className="space-y-1.5">
                              <Badge className="bg-emerald-500/15 text-emerald-400 text-[11px] font-bold border-0 gap-1">
                                <Send size={8} />
                                {lead.sales}
                              </Badge>
                              {(lead.meetingDate || lead.meetingTime) && (
                                <div className="text-[11px] font-semibold text-emerald-300/80">
                                  ميعاد الاجتماع: {lead.meetingDate} {lead.meetingTime}
                                </div>
                              )}
                              <div className="flex gap-1 mt-1">
                                <button
                                  onClick={() => handleChangeSales(lead.id)}
                                  className="h-6 px-1.5 rounded bg-[#6c63ff]/10 text-[#6c63ff] flex items-center gap-0.5 hover:bg-[#6c63ff]/20 transition-colors cursor-pointer text-[10px] font-bold"
                                  title="تغيير السيلز"
                                >
                                  <UserRound size={9} />
                                  تغيير السيلز
                                </button>
                                <button
                                  onClick={() => handleCancelTransfer(lead.id)}
                                  className="h-6 px-1.5 rounded bg-red-500/10 text-red-400 flex items-center gap-0.5 hover:bg-red-500/20 transition-colors cursor-pointer text-[10px] font-bold"
                                  title="إلغاء التحويل"
                                >
                                  <RotateCcw size={9} />
                                  إلغاء التحويل
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openTransferModal(lead.id)}
                              className="w-7 h-7 rounded-md bg-[#6c63ff]/10 text-[#6c63ff] flex items-center justify-center hover:bg-[#6c63ff]/20 transition-colors cursor-pointer"
                              title="تحويل للسيلز"
                            >
                              <ArrowLeftRight size={12} />
                            </button>
                          )}
                        </TableCell>

                        {/* حذف — Delete with confirmation */}
                        <TableCell>
                          <button
                            onClick={() => requestDeleteLead(lead.id, lead.customerName)}
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

          {/* ─── Table Footer with Pagination ─── */}
          {filteredLeads.length > 0 && (
            <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center justify-between text-[12px] font-medium text-[#4a5280]">
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
                    <span className="text-[#f0f2ff] font-bold px-2">
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

      {/* ─── Transfer Modal ─── */}
      <TransferModal
        key={transferLeadId}
        lead={transferLead}
        open={transferOpen}
        onClose={closeTransferModal}
        onSubmit={handleTransferToSales}
        salesTeam={team.sales}
        saving={transferSaving}
      />

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => { if (!open) { setDeleteConfirmOpen(false); setDeleteTarget(null) } }}>
        <DialogContent className="bg-[#111520] border-white/[0.08] text-[#f0f2ff] sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-extrabold text-[#f0f2ff] flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
              <AlertCircle size={22} className="text-red-400" />
              تأكيد الحذف
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#8892b0]">
              هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3">
              <Trash2 size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[14px] font-bold text-red-400">{deleteTarget.name}</div>
                <div className="text-[12px] font-medium text-red-400/70 mt-0.5">سيتم حذف العميل نهائياً من النظام</div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white gap-1.5 text-[13px] font-bold h-9 cursor-pointer"
            >
              <Trash2 size={14} />
              نعم، احذف
            </Button>
            <Button
              onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null) }}
              variant="ghost"
              className="text-[#8892b0] hover:text-[#f0f2ff] text-[13px] h-9 cursor-pointer"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Quick Paste Dialog ─── */}
      <QuickPasteDialog
        open={showPasteDialog}
        onClose={() => setShowPasteDialog(false)}
        leads={leads}
        teleName={pasteTeleName}
        onSaved={handlePasteSaved}
        addToast={addToast}
      />
    </div>
  )
}
