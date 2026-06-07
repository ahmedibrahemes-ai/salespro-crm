'use client'

import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  ExternalLink,
  Trash2,
  Archive,
  StickyNote,
  Loader2,
  X,
  Upload,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Info,
  FileUp,
  FolderOpen,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import {
  useCrmStore,
  CONTACT_RESULTS,
  SALES_STATUSES,
  normalizePhone,
  formatRelativeTime,
  getDateRange,
} from '@/lib/store'
import type { DateRangeFilter } from '@/lib/store'
import {
  apiUpdateLead,
  apiCreateLead,
  apiArchiveLeads,
  apiDeleteLead,
  apiDeleteLeadsBulk,
  apiBulkCreateLeads,
  apiAddNote,
  apiGetLeadNotes,
  apiGetDuplicates,
  apiCheckDuplicatePhones,
} from '@/lib/supabase'
import type { Lead, LeadNote } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

// ===== Debounce hook =====
function useDebounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      cancel()
      timerRef.current = setTimeout(() => fnRef.current(...args), ms)
    },
    [ms, cancel]
  )

  return { debounced, cancel }
}

// ===== Filter pill types =====
type FilterKey = 'all' | 'new' | 'contacted' | 'negotiation' | 'won' | 'lost' | 'today' | 'duplicates' | 'replied' | 'no-reply' | 'whatsapp' | 'callback' | 'no-contact'

interface FilterPillDef {
  key: FilterKey
  label: string
  separatorBefore?: boolean
}

const FILTER_PILLS: FilterPillDef[] = [
  { key: 'all', label: 'الكل' },
  { key: 'new', label: '🆕 جديد' },
  { key: 'contacted', label: '📞 تواصلت' },
  { key: 'negotiation', label: '🤝 تفاوض' },
  { key: 'won', label: '🏆 تم التقفيل' },
  { key: 'lost', label: '❌ خسارة' },
  { key: 'today', label: '📅 اليوم' },
  { key: 'duplicates', label: '⚠️ مكررات' },
  { key: 'replied', label: '✅ رد', separatorBefore: true },
  { key: 'no-reply', label: '📵 مردش' },
  { key: 'whatsapp', label: '💬 واتس' },
  { key: 'callback', label: '🔄 لاحقاً' },
  { key: 'no-contact', label: '⏳ لسة' },
]

// ===== Grid column template (matches old HTML exactly) =====
// Columns: # | ☐ | المتجر | الجوال | اسم العميل | النوع | نتيجة التواصل | البريف | الحالة | ⚡
const GRID_COLS = 'grid-cols-[36px_32px_1.2fr_1.2fr_0.9fr_0.7fr_0.95fr_1.1fr_1.1fr_40px]'

// ===== Statuses where "نقل" button appears =====
const MOVE_STATUSES = ['contacted', 'negotiation', 'proposal-sent', 'followup']

// ===== Date range filter presets =====
const DATE_PRESETS = [
  { key: 'all', label: 'الكل' },
  { key: 'today', label: 'اليوم' },
  { key: 'yesterday', label: 'أمس' },
  { key: 'week', label: 'الأسبوع الحالي' },
  { key: 'month', label: 'الشهر الحالي' },
  { key: 'custom', label: 'مخصص' },
]

// ===== Delete Confirm Input (type-to-confirm) =====
function SalesDeleteConfirmInput({
  confirmText,
  onConfirm,
  onCancel,
  buttonText,
}: {
  confirmText: string
  onConfirm: () => void
  onCancel: () => void
  buttonText: string
}) {
  const [input, setInput] = useState('')
  const isConfirmed = input === confirmText

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          اكتب <strong className="text-red-400">{confirmText}</strong> للتأكيد:
        </label>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={confirmText}
          dir="rtl"
          className="h-9 text-sm bg-background border-border focus:border-red-400"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={!isConfirmed}
        >
          <Trash2 className="w-4 h-4 ml-1" />
          {buttonText}
        </Button>
      </div>
    </div>
  )
}

// ===== Inline Text Cell =====
const CellInput = memo(function CellInput({
  value,
  onSave,
  placeholder,
  mono,
  dir,
  className,
  danger,
  warning,
}: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  mono?: boolean
  dir?: string
  className?: string
  danger?: boolean
  warning?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const { debounced, cancel } = useDebounce((v: string) => onSave(v), 600)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setDraft(v)
    debounced(v)
  }

  const handleBlur = () => {
    cancel()
    if (draft !== value) onSave(draft)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      cancel()
      if (draft !== value) onSave(draft)
      ;(e.target as HTMLInputElement).blur()
    }
    if (e.key === 'Escape') {
      cancel()
      setDraft(value)
    }
  }

  return (
    <input
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      dir={dir}
      className={`w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 outline-none focus:bg-venom/5 rounded transition-colors placeholder:text-muted-foreground/30 ${
        danger ? 'text-red-400 font-semibold' : warning ? 'text-amber-400' : ''
      } ${mono ? 'font-mono' : ''} ${className || ''}`}
    />
  )
})

// ===== Inline Select Cell =====
const CellSelect = memo(function CellSelect({
  value,
  options,
  onSave,
  className,
}: {
  value: string
  options: { key: string; label: string; color?: string }[]
  onSave: (v: string) => void
  className?: string
}) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onSave(e.target.value === '__none__' ? '' : e.target.value)
  }, [onSave])

  return (
    <select
      value={value || '__none__'}
      onChange={handleChange}
      dir="rtl"
      className={`w-full h-full text-xs bg-transparent border-0 hover:bg-venom/5 focus:bg-venom/5 p-0 px-1.5 cursor-pointer rounded min-h-[32px] outline-none appearance-none ${className || ''}`}
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  )
})

// ===== Notes Dialog =====
function NotesDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [notes, setNotes] = useState<LeadNote[]>([])
  const [loading, setLoading] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const { currentUser, updateLeadInCache } = useCrmStore(useShallow((s) => ({
    currentUser: s.currentUser,
    updateLeadInCache: s.updateLeadInCache,
  })))

  useEffect(() => {
    if (lead && open) {
      if (lead.notes && lead.notes.length > 0) {
        setNotes(lead.notes)
      } else {
        setLoading(true)
        apiGetLeadNotes(lead.id).then(fetchedNotes => {
          setNotes(fetchedNotes)
          // Also update the lead in cache so we don't re-fetch
          updateLeadInCache(lead.id, { notes: fetchedNotes })
        }).catch(console.error).finally(() => setLoading(false))
      }
    }
  }, [lead, open, updateLeadInCache])

  const handleAddNote = useCallback(async () => {
    if (!lead || !noteText.trim()) return
    setSaving(true)
    try {
      await apiAddNote(lead.id, currentUser || '', 'note', noteText.trim())
      const newNote = {
        id: Date.now(),
        by: currentUser || '',
        cat: 'note' as const,
        text: noteText.trim(),
        at: Date.now(),
      }
      const updatedNotes = [...notes, newNote]
      setNotes(updatedNotes)
      updateLeadInCache(lead.id, { notes: updatedNotes })
      setNoteText('')
      toast.success('تم إضافة الملاحظة')
    } catch {
      toast.error('فشل في إضافة الملاحظة')
    } finally {
      setSaving(false)
    }
  }, [lead, notes, noteText, currentUser, updateLeadInCache])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-venom">
            <StickyNote className="w-5 h-5" />
            ملاحظات — {lead?.customerName || lead?.phone || '—'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length > 0 ? (
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="bg-muted/30 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-venom">{n.by}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(n.at)}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed">{n.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد ملاحظات</p>
          )}
          <div className="flex gap-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="اكتب ملاحظة جديدة..."
              className="bg-background border-border min-h-[50px] resize-none text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAddNote()
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={saving || !noteText.trim()}
              className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30 self-end"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ===== Move to Customers Dialog =====
function MoveToCustomersDialog({
  open,
  onOpenChange,
  lead,
  onMoved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  lead: Lead | null
  onMoved: () => void
}) {
  const { currentUser, updateLeadInCache } = useCrmStore(useShallow((s) => ({
    currentUser: s.currentUser,
    updateLeadInCache: s.updateLeadInCache,
  })))
  const [status, setStatus] = useState('negotiation')
  const [note, setNote] = useState('')
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    if (lead) {
      setStatus(lead.salesStatus || 'negotiation')
      setNote('')
    }
  }, [lead])

  const handleMove = useCallback(async () => {
    if (!lead) return
    if (!lead.phone) {
      toast.error('لازم تضيف رقم الجوال الأول')
      return
    }
    setMoving(true)
    try {
      const statusObj = SALES_STATUSES.find((s) => s.key === status)
      const notes = [...(lead.notes || [])]
      notes.push({
        id: Date.now(),
        by: currentUser || '',
        cat: 'note',
        text: `📋 نُقل لتاب موقف العملاء - الحالة: ${statusObj ? statusObj.label : status}${note ? '\n' + note : ''}`,
        at: Date.now(),
      })

      await apiUpdateLead(lead.id, {
        salesStatus: status,
        assignedAt: lead.assignedAt || Date.now(),
        notes,
      } as Partial<Lead>)
      updateLeadInCache(lead.id, {
        salesStatus: status,
        assignedAt: lead.assignedAt || Date.now(),
        notes,
      } as Partial<Lead>)
      toast.success('تم النقل - شوفه في تاب "موقف العملاء"')
      onOpenChange(false)
      onMoved()
    } catch {
      toast.error('فشل في نقل العميل')
    } finally {
      setMoving(false)
    }
  }, [lead, status, note, currentUser, updateLeadInCache, onOpenChange, onMoved])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-400">
            <ArrowRight className="w-5 h-5" />
            نقل لتاب موقف العملاء
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          العميل {lead?.customerName || lead?.phone} هينتقل لتاب &quot;موقف العملاء&quot; مع الاجتماعات والمتابعات.
        </p>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium mb-1 block">اختار الحالة الحالية:</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="contacted">📞 تم التواصل - مهتم</SelectItem>
                <SelectItem value="followup">🔄 يحتاج متابعة</SelectItem>
                <SelectItem value="negotiation">🤝 في التفاوض</SelectItem>
                <SelectItem value="proposal-sent">📤 تم إرسال عرض السعر</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">ملاحظة سريعة (اختياري):</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="عميل مهتم..."
              className="bg-background border-border min-h-[50px] resize-none text-xs"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            إلغاء
          </Button>
          <Button
            onClick={handleMove}
            disabled={moving || !lead?.phone}
            className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
          >
            {moving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <ArrowRight className="w-4 h-4 ml-1" />}
            نقل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Bulk Upload Dialog =====
function BulkUploadDialog({
  open,
  onOpenChange,
  onUploaded,
  salesOwner,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onUploaded: (leads: Lead[]) => void
  salesOwner: string
}) {
  const { leads } = useCrmStore(useShallow((s) => ({ leads: s.leads })))
  const [pasteText, setPasteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [previewData, setPreviewData] = useState<Partial<Lead>[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dupDialogOpen, setDupDialogOpen] = useState(false)
  const [dupPhones, setDupPhones] = useState<Array<{ phone: string; owner: string }>>([])
  const [pendingLeads, setPendingLeads] = useState<Partial<Lead>[] | null>(null)

  // Parse the input text into leads
  const parseInput = useCallback(() => {
    if (!pasteText.trim()) {
      setPreviewData(null)
      return
    }
    const lines = pasteText.trim().split(/\r?\n/).filter((l) => l.trim())
    if (lines.length === 0) {
      setPreviewData(null)
      return
    }

    // Detect if CSV (has comma in first line) or plain phones
    const isCSV = lines[0].includes(',')
    const leadsArr: Partial<Lead>[] = []

    if (isCSV) {
      // Parse CSV
      const parseCSVLine = (line: string) => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"'
              i++
            } else {
              inQuotes = !inQuotes
            }
          } else if (ch === ',' && !inQuotes) {
            result.push(current)
            current = ''
          } else {
            current += ch
          }
        }
        result.push(current)
        return result
      }

      const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())
      const fieldMap: Record<string, string> = {
        store_url: 'storeUrl',
        storeurl: 'storeUrl',
        'متجر': 'storeUrl',
        'الرابط': 'storeUrl',
        phone: 'phone',
        'الجوال': 'phone',
        'الموبايل': 'phone',
        'الهاتف': 'phone',
        customer_name: 'customerName',
        name: 'customerName',
        'الاسم': 'customerName',
        brief: 'brief',
        notes: 'brief',
        'البريف': 'brief',
        'ملاحظات': 'brief',
      }

      for (let i = 1; i < lines.length; i++) {
        const r = parseCSVLine(lines[i])
        if (!r.some((c) => c.trim())) continue
        const lead: Record<string, string> = { sales: salesOwner, tele: '', salesStatus: 'new' }
        headers.forEach((h, idx) => {
          const field = fieldMap[h]
          if (field && r[idx]) lead[field] = r[idx].trim()
        })
        leadsArr.push(lead as unknown as Partial<Lead>)
      }
    } else {
      // Plain phone numbers
      for (const p of lines) {
        leadsArr.push({
          sales: salesOwner,
          tele: '',
          phone: normalizePhone(p.trim()),
          salesStatus: 'new',
          storeUrl: '',
          customerName: '',
          customerType: '',
          brief: '',
          contactResult: '',
        })
      }
    }

    setPreviewData(leadsArr.length > 0 ? leadsArr : null)
  }, [pasteText, salesOwner])

  // Auto-parse on text change
  useEffect(() => {
    const timer = setTimeout(parseInput, 300)
    return () => clearTimeout(timer)
  }, [parseInput])

  // Handle CSV file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setPasteText(text)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!pasteText.trim() || !salesOwner) return
    setSubmitting(true)
    try {
      const leadsArr = previewData
      if (!leadsArr || leadsArr.length === 0) {
        toast.error('لم يتم العثور على بيانات صالحة')
        setSubmitting(false)
        return
      }

      // Check for duplicate phones before saving
      const phonesToCheck = leadsArr
        .map(l => l.phone as string)
        .filter(p => p && p.trim())

      const phoneSet = new Map<string, string>() // normalized → owner

      // Server-side check (fast, targeted)
      if (phonesToCheck.length > 0) {
        try {
          const serverDups = await apiCheckDuplicatePhones(phonesToCheck)
          for (const [norm, info] of Object.entries(serverDups)) {
            phoneSet.set(norm, info.existingOwner)
          }
        } catch {
          // Fallback: check client-side data
        }
      }

      // Also check against client-side store (covers any that server missed)
      leads.forEach((l) => {
        if (l.phone) {
          const norm = normalizePhone(l.phone)
          if (!phoneSet.has(norm)) {
            phoneSet.set(norm, l.tele || l.sales || '—')
          }
        }
      })

      // Also check within the batch itself
      const batchPhones = new Map<string, string>() // normalized → first owner (or "—")
      const duplicates: Array<{ phone: string; owner: string }> = []
      const freshLeads: Partial<Lead>[] = []

      for (const lead of leadsArr) {
        const phone = lead.phone ? normalizePhone(lead.phone as string) : ''
        if (!phone) {
          freshLeads.push(lead)
          continue
        }

        // Check against existing leads
        const existingOwner = phoneSet.get(phone)
        if (existingOwner) {
          duplicates.push({ phone, owner: existingOwner })
          continue
        }

        // Check against other items in the same batch
        const batchOwner = batchPhones.get(phone)
        if (batchOwner) {
          duplicates.push({ phone, owner: 'داخل المجموعة نفسها' })
          continue
        }

        // Not a duplicate — add to fresh and track in batch
        freshLeads.push(lead)
        batchPhones.set(phone, '—')
      }

      if (duplicates.length > 0) {
        // Show duplicate dialog and wait for user decision
        setDupPhones(duplicates)
        setPendingLeads(freshLeads)
        setDupDialogOpen(true)
        setSubmitting(false)
        return
      }

      // No duplicates — save directly
      const created = await apiBulkCreateLeads(leadsArr)
      onUploaded(created)
      toast.success(`تم إضافة ${created.length} عميل لشيتك 🎉`)
      setPasteText('')
      setPreviewData(null)
      onOpenChange(false)
    } catch {
      toast.error('فشل في رفع البيانات')
    } finally {
      setSubmitting(false)
    }
  }, [pasteText, previewData, salesOwner, onUploaded, onOpenChange, leads])

  // Save only fresh leads (duplicates excluded)
  const handleExcludeDuplicates = useCallback(async () => {
    setDupDialogOpen(false)
    if (!pendingLeads || pendingLeads.length === 0) {
      toast.info('مفيش بيانات جديدة للحفظ')
      return
    }
    setSubmitting(true)
    try {
      const created = await apiBulkCreateLeads(pendingLeads)
      onUploaded(created)
      toast.success(`تم إضافة ${created.length} عميل (بدون المكرر) 🎉`)
      setPasteText('')
      setPreviewData(null)
      setPendingLeads(null)
      onOpenChange(false)
    } catch {
      toast.error('فشل في رفع البيانات')
    } finally {
      setSubmitting(false)
    }
  }, [pendingLeads, onUploaded, onOpenChange])

  // Save all leads (including duplicates)
  const handleIncludeDuplicates = useCallback(async () => {
    setDupDialogOpen(false)
    if (!previewData || previewData.length === 0) return
    setSubmitting(true)
    try {
      const created = await apiBulkCreateLeads(previewData)
      onUploaded(created)
      toast.success(`تم إضافة ${created.length} عميل (منهم ${dupPhones.length} مكرر) 🎉`)
      setPasteText('')
      setPreviewData(null)
      setPendingLeads(null)
      onOpenChange(false)
    } catch {
      toast.error('فشل في رفع البيانات')
    } finally {
      setSubmitting(false)
    }
  }, [previewData, dupPhones.length, onUploaded, onOpenChange])

  // When dialog is dismissed without clicking a button, default to saving ALL data
  const handleDupDialogClose = useCallback((open: boolean) => {
    if (!open && dupDialogOpen) {
      // Dialog is being closed (X, outside click, Escape) — save all by default
      setDupDialogOpen(false)
      if (previewData && previewData.length > 0) {
        setSubmitting(true)
        apiBulkCreateLeads(previewData).then((created) => {
          onUploaded(created)
          toast.success(`تم إضافة ${created.length} عميل لشيتك 🎉`)
          setPasteText('')
          setPreviewData(null)
          setPendingLeads(null)
          onOpenChange(false)
        }).catch(() => {
          toast.error('فشل في رفع البيانات')
        }).finally(() => {
          setSubmitting(false)
        })
      }
    }
  }, [dupDialogOpen, previewData, onUploaded, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-venom">
            <Upload className="w-5 h-5" />
            رفع جماعي لشيت {salesOwner}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          الصق الأرقام أو ارفع ملف CSV - الأرقام دي هتتسجل في شيت {salesOwner} مباشرة
        </p>
        <div className="space-y-3">
          {/* Method 1: Paste phones */}
          <div>
            <label className="text-xs font-medium mb-1.5 block">
              الطريقة 1: الصق الأرقام (سطر لكل رقم)
            </label>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'0501234567\n0509876543\n0501112222'}
              className="bg-background border-border min-h-[140px] font-mono text-sm"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">
              الجوال فقط، رقم في كل سطر. تقدر تستخدم Excel وتنسخ عمود.
            </p>
          </div>

          {/* OR separator */}
          <div className="text-center text-xs text-muted-foreground">— أو —</div>

          {/* Method 2: CSV file */}
          <div>
            <label className="text-xs font-medium mb-1.5 block">
              الطريقة 2: ملف CSV
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="w-full p-2 bg-background border border-border rounded-lg text-xs text-foreground file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-venom/15 file:text-venom cursor-pointer"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">
              الأعمدة: <code className="bg-muted px-1 rounded">phone</code>,{' '}
              <code className="bg-muted px-1 rounded">store_url</code>,{' '}
              <code className="bg-muted px-1 rounded">customer_name</code>,{' '}
              <code className="bg-muted px-1 rounded">brief</code>
            </p>
          </div>

          {/* Preview */}
          {previewData && previewData.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1 max-h-32 overflow-auto">
              <p className="font-medium text-venom">معاينة: {previewData.length} عميل</p>
              {previewData.slice(0, 5).map((l, i) => (
                <div key={i} className="flex gap-2 text-muted-foreground">
                  <span>{(l as Record<string, unknown>).phone || '—'}</span>
                  <span>{(l as Record<string, unknown>).customerName || ''}</span>
                  <span>{(l as Record<string, unknown>).storeUrl || ''}</span>
                </div>
              ))}
              {previewData.length > 5 && (
                <p className="text-muted-foreground/60">+{previewData.length - 5} المزيد...</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !pasteText.trim()}
            className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin ml-1" />
            ) : (
              <Upload className="w-4 h-4 ml-1" />
            )}
            إضافة
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Duplicate Confirmation Dialog */}
      <Dialog open={dupDialogOpen} onOpenChange={handleDupDialogClose}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              أرقام مكررة
            </DialogTitle>
            <DialogDescription className="text-right">
              لقيت {dupPhones.length} رقم مكرر في قاعدة البيانات — عايزة تعملي إيه؟
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-48 overflow-y-auto space-y-1.5 my-2">
            {dupPhones.slice(0, 5).map((d, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                <span className="font-mono text-amber-400" dir="ltr">{d.phone}</span>
                <span className="text-muted-foreground">(موجود عند {d.owner})</span>
              </div>
            ))}
            {dupPhones.length > 5 && (
              <p className="text-xs text-muted-foreground/60 text-center">
                ... و {dupPhones.length - 5} رقم تاني
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={handleExcludeDuplicates}
            >
              <X className="w-4 h-4 ml-1" />
              تجاهل المكرر
            </Button>
            <Button
              className="flex-1 bg-venom text-[#050a08] hover:bg-venom/80"
              onClick={handleIncludeDuplicates}
            >
              <CheckCircle className="w-4 h-4 ml-1" />
              أضفهم كمان
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

// ===== Main Sales Sheet =====
export function SalesSheet() {
  const {
    currentUser,
    currentRole,
    leads,
    leadsById,
    leadsVersion,
    team,
    updateLeadInCache,
    addLeadToCache,
    batchAddLeadsToCache,
    removeLeadFromCache,
    batchRemoveLeadsFromCache,
    archiveLeadsInCache,
    getAccessibleSalesSheets,
  } = useCrmStore(useShallow((s) => ({
    currentUser: s.currentUser,
    currentRole: s.currentRole,
    leads: s.leads,
    leadsById: s.leadsById,
    leadsVersion: s.leadsVersion,
    team: s.team,
    updateLeadInCache: s.updateLeadInCache,
    addLeadToCache: s.addLeadToCache,
    batchAddLeadsToCache: s.batchAddLeadsToCache,
    removeLeadFromCache: s.removeLeadFromCache,
    batchRemoveLeadsFromCache: s.batchRemoveLeadsFromCache,
    archiveLeadsInCache: s.archiveLeadsInCache,
    getAccessibleSalesSheets: s.getAccessibleSalesSheets,
  })))

  const [search, setSearch] = useState('')
  // Debounced search — don't trigger re-filter on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [notesLead, setNotesLead] = useState<Lead | null>(null)
  const [moveLead, setMoveLead] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [addingRow, setAddingRow] = useState(false)
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)
  const [archivingAll, setArchivingAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [deleteLeadConfirm, setDeleteLeadConfirm] = useState<Lead | null>(null)
  const [viewingSheet, setViewingSheet] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({ preset: 'all' })
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Pre-compute sheet counts for dropdown (single pass instead of N*leads.length)
  const salesSheetCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of leads) {
      if (l.isArchived) continue
      const sales = (l.sales || '').toLowerCase()
      if (sales) counts[sales] = (counts[sales] || 0) + 1
    }
    return counts
  }, [leads])

  // Accessible sheets
  const accessibleSheets = useMemo(() => {
    if (!currentUser) return []
    return getAccessibleSalesSheets(currentUser)
  }, [currentUser, getAccessibleSalesSheets])

  // Set default viewing sheet
  useEffect(() => {
    if (!viewingSheet && currentUser) {
      setViewingSheet(currentUser)
    }
  }, [currentUser, viewingSheet])

  const isViewingOwn = viewingSheet === currentUser

  // Filter leads for the selected sales sheet (non-archived)
  // EXCLUDE leads transferred from telesales (l.tele exists) — those appear in Meetings & Customers Status pages only
  // Only show leads the sales person added themselves (no tele field)
  // ALWAYS sort by id ASC to guarantee stable row order.
  const myLeadsAll = useMemo(() => {
    if (!viewingSheet) return []
    const sheetLower = viewingSheet.toLowerCase()
    return leads
      .filter((l) => l.sales && String(l.sales).trim().toLowerCase() === sheetLower && !l.isArchived && !l.tele)
      .sort((a, b) => a.id - b.id)
  }, [leads, viewingSheet])

  // Active leads on top (id ASC), closed-won/closed-lost sink to bottom (id ASC).
  // Rows NEVER move after editing any field.
  const myLeads = useMemo(() => {
    if (!viewingSheet) return []
    const active = myLeadsAll.filter((l) => l.salesStatus !== 'closed-won' && l.salesStatus !== 'closed-lost')
    const closed = myLeadsAll.filter((l) => l.salesStatus === 'closed-won' || l.salesStatus === 'closed-lost')
    return [...active, ...closed]
  }, [myLeadsAll, viewingSheet])

  // Apply date range filter
  // Include leads where ANY activity happened in the period:
  // - Lead was created (createdAt)
  // - Call was made (contactResultAt)
  // - Lead was assigned to this sales (assignedAt)
  // This way, filtering "yesterday" shows all relevant activity
  const myLeadsDateFiltered = useMemo(() => {
    if (dateFilter.preset === 'all') return myLeads
    const { from, to } = getDateRange(dateFilter.preset, customFrom, customTo)
    return myLeads.filter((l) => {
      // A lead is "in range" if any of its activity timestamps fall within the range
      const inRange = (ts: number | null) => ts !== null && ts >= from && ts < to
      return inRange(l.createdAt) || inRange(l.contactResultAt) || inRange(l.assignedAt)
    })
  }, [myLeads, dateFilter, customFrom, customTo])

  // ===== HYBRID duplicate detection =====
  // Primary: server-side API (bypasses RLS, sees ALL leads across ALL sheets)
  // Fallback: client-side duplicatesCache from store (pre-built on data load)

  // Server-side duplicates data (deferred — fetch after initial render so it doesn't block the sheet)
  const [serverDuplicates, setServerDuplicates] = useState<Record<string, import('@/lib/supabase').DuplicateInfo>>({})

  useEffect(() => {
    // Delay duplicate fetch by 1.5s so the sheet renders first without waiting for this API call
    let cancelled = false
    const timer = setTimeout(() => {
      apiGetDuplicates().then((data) => {
        if (!cancelled && data.duplicates && Object.keys(data.duplicates).length > 0) {
          setServerDuplicates(data.duplicates)
        }
      }).catch(() => {})
    }, 1500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [leadsVersion])

  // Use store's pre-built duplicatesCache instead of building globalPhoneMap from scratch.
  // This avoids an O(N) loop over all 4000+ leads on every render cycle.
  const { duplicatesCache } = useCrmStore(useShallow((s) => ({ duplicatesCache: s.duplicatesCache })))

  // For each lead in this sheet: is it a duplicate? If so, where's the original?
  // Uses server-side data when available, falls back to store's duplicatesCache
  const duplicateInfoMap = useMemo(() => {
    const map = new Map<string, {
      isDuplicate: boolean
      originalSheetName: string | null
    }>()

    const hasServerData = Object.keys(serverDuplicates).length > 0

    for (const lead of myLeadsDateFiltered) {
      if (!lead.phone) {
        map.set(lead.id, { isDuplicate: false, originalSheetName: null })
        continue
      }
      const norm = normalizePhone(lead.phone)
      if (!norm) {
        map.set(lead.id, { isDuplicate: false, originalSheetName: null })
        continue
      }

      if (hasServerData) {
        // Use server-side data (reliable, bypasses RLS)
        const serverInfo = serverDuplicates[norm]
        if (!serverInfo) {
          map.set(lead.id, { isDuplicate: false, originalSheetName: null })
          continue
        }
        const isDuplicate = lead.id !== serverInfo.originalId
        let originalSheetName: string | null = null
        if (isDuplicate) {
          originalSheetName = serverInfo.originalTele
            ? `شيت ${serverInfo.originalTele}`
            : serverInfo.originalSales
              ? `شيت ${serverInfo.originalSales}`
              : null
        }
        map.set(lead.id, { isDuplicate, originalSheetName })
      } else {
        // Fallback: use store's duplicatesCache (pre-built, O(1) lookup)
        const cacheInfo = duplicatesCache[norm]
        if (!cacheInfo || cacheInfo.duplicateIds.length === 0) {
          map.set(lead.id, { isDuplicate: false, originalSheetName: null })
          continue
        }
        const isDuplicate = lead.id !== cacheInfo.originalId
        // For the fallback, we look up the original lead from leadsById to get the sheet name
        let originalSheetName: string | null = null
        if (isDuplicate) {
          const originalLead = leadsById[cacheInfo.originalId]
          if (originalLead) {
            originalSheetName = originalLead.tele
              ? `شيت ${originalLead.tele}`
              : originalLead.sales
                ? `شيت ${originalLead.sales}`
                : null
          }
        }
        map.set(lead.id, { isDuplicate, originalSheetName })
      }
    }
    return map
  }, [myLeadsDateFiltered, serverDuplicates, duplicatesCache, leadsById])

  // Count duplicates in current sheet
  const myDuplicates = useMemo(() => {
    return myLeadsDateFiltered.filter((l) => {
      const info = duplicateInfoMap.get(l.id)
      return info?.isDuplicate === true
    })
  }, [myLeadsDateFiltered, duplicateInfoMap])

  // Apply search + filter
  const filtered = useMemo(() => {
    let result = myLeadsDateFiltered

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(
        (l) =>
          (l.customerName || '').toLowerCase().includes(q) ||
          (l.phone || '').toLowerCase().includes(q) ||
          (l.storeUrl || '').toLowerCase().includes(q) ||
          (l.brief || '').toLowerCase().includes(q)
      )
    }

    // Filter pills
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    switch (filter) {
      case 'new':
        result = result.filter((l) => !l.salesStatus || l.salesStatus === 'new')
        break
      case 'contacted':
        result = result.filter((l) => l.salesStatus === 'contacted')
        break
      case 'negotiation':
        result = result.filter((l) => ['negotiation', 'proposal-sent', 'followup'].includes(l.salesStatus || ''))
        break
      case 'won':
        result = result.filter((l) => l.salesStatus === 'closed-won')
        break
      case 'lost':
        result = result.filter((l) => l.salesStatus === 'closed-lost')
        break
      case 'today':
        result = result.filter((l) => {
          // Any activity today: created, called, or assigned
          return (l.createdAt >= todayStart) ||
                 (l.contactResultAt !== null && l.contactResultAt >= todayStart) ||
                 (l.assignedAt !== null && l.assignedAt >= todayStart)
        })
        break
      case 'duplicates':
        result = myDuplicates
        break
      case 'replied':
        result = result.filter((l) => l.contactResult === 'replied')
        break
      case 'no-reply':
        result = result.filter((l) => l.contactResult === 'no-reply')
        break
      case 'whatsapp':
        result = result.filter((l) => l.contactResult === 'whatsapp')
        break
      case 'callback':
        result = result.filter((l) => l.contactResult === 'callback')
        break
      case 'no-contact':
        result = result.filter((l) => !l.contactResult)
        break
    }

    return result
  }, [myLeadsDateFiltered, debouncedSearch, filter, myDuplicates])

  // ===== Virtualizer setup =====
  const gridRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => gridRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  // ===== Debounced cell save =====
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const handleCellSave = useCallback(
    async (leadId: string, field: string, value: string | number | null) => {
      const existing = saveTimers.current.get(leadId)
      if (existing) clearTimeout(existing)

      // Normalize phone on save
      let finalValue = value
      if (field === 'phone' && typeof value === 'string') {
        finalValue = normalizePhone(value) || value
      }

      // Optimistic update
      const updates: Record<string, unknown> = { [field]: finalValue }
      if (field === 'contactResult' && finalValue) {
        updates.contactResultAt = Date.now()
      }
      if (field === 'salesStatus' && finalValue) {
        updates.status = finalValue
      }
      updateLeadInCache(leadId, updates as Partial<Lead>)

      // Duplicate phone check: warn if the phone already exists in another lead
      if (field === 'phone' && finalValue) {
        const norm = normalizePhone(finalValue as string)
        if (norm) {
          const existingLead = leads.find(l => l.id !== leadId && l.phone && normalizePhone(l.phone) === norm)
          if (existingLead) {
            toast.warning(`⚠️ رقم مكرر! موجود عند ${existingLead.tele || existingLead.sales || '—'}`, { duration: 5000 })
          }
          // Also check server-side for cross-sheet duplicates
          if (!existingLead) {
            try {
              const serverDups = await apiCheckDuplicatePhones([finalValue as string])
              const dupInfo = serverDups[norm]
              if (dupInfo) {
                toast.warning(`⚠️ رقم مكرر في شيت تاني (ID: ${dupInfo.existingId}, ${dupInfo.existingOwner})`, { duration: 5000 })
              }
            } catch {
              // Non-critical: server check failed, local check is still valid
            }
          }
        }
      }

      // Set new timer for API call
      const timer = setTimeout(async () => {
        try {
          const apiUpdates: Record<string, unknown> = { [field]: finalValue }
          if (field === 'contactResult' && finalValue) {
            apiUpdates.contactResultAt = Date.now()
          }
          if (field === 'salesStatus' && finalValue) {
            apiUpdates.status = finalValue
          }
          await apiUpdateLead(leadId, apiUpdates as Partial<Lead>)
          // Add note on salesStatus change (non-blocking)
          if (field === 'salesStatus' && finalValue) {
            const statusObj = SALES_STATUSES.find((s) => s.key === finalValue)
            if (statusObj && currentUser) {
              apiAddNote(leadId, currentUser, 'status-change', `تم تغيير الحالة إلى: ${statusObj.label}`).catch(() => {})
            }
          }
          saveTimers.current.delete(leadId)
        } catch {
          toast.error('فشل في الحفظ')
        }
      }, 600)

      saveTimers.current.set(leadId, timer)
    },
    [updateLeadInCache, currentUser, leads]
  )

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      saveTimers.current.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  // ===== Add new empty row =====
  const handleAddRow = useCallback(async () => {
    if (!viewingSheet) return
    setAddingRow(true)
    try {
      const lead = await apiCreateLead({
        customerName: '',
        phone: '',
        storeUrl: '',
        customerType: '',
        brief: '',
        contactResult: '',
        tele: '',
        sales: isViewingOwn ? currentUser : viewingSheet,
        status: 'new',
        salesStatus: 'new',
        meetingDate: '',
        meetingTime: '',
        meetingType: '',
        meetingLink: '',
        attended: null,
        isArchived: false,
      } as Partial<Lead>)
      // Only add to cache if not already added by real-time subscription
      if (!(lead.id in useCrmStore.getState().leadsById)) {
        addLeadToCache(lead)
      }
      toast.success('تم إضافة صف جديد')
    } catch (err) {
      console.error('[sales-sheet] Add row error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`فشل في إضافة الصف: ${msg}`)
    } finally {
      setAddingRow(false)
    }
  }, [viewingSheet, isViewingOwn, currentUser, addLeadToCache])

  // ===== Delete single row (with confirmation) =====
  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(id)
      try {
        await apiDeleteLead(id)
        removeLeadFromCache(id)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        toast.success('تم الحذف')
        setDeleteLeadConfirm(null)
      } catch {
        toast.error('فشل في الحذف')
      } finally {
        setDeleting(null)
      }
    },
    [removeLeadFromCache]
  )

  // ===== Bulk actions =====
  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return
    try {
      const ids = Array.from(selectedIds)
      // Optimistic: update cache immediately, no server refresh needed
      archiveLeadsInCache(ids, currentUser || '')
      apiArchiveLeads(ids, currentUser || '').catch((err) => {
        console.error('[sales-sheet] Bulk archive error (background):', err)
      })
      setSelectedIds(new Set())
      toast.success(`تم أرشفة ${ids.length} عميل`)
    } catch {
      toast.error('فشل في الأرشفة')
    }
  }, [selectedIds, currentUser, archiveLeadsInCache])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    try {
      const ids = Array.from(selectedIds)
      // Optimistic: update cache immediately, no server refresh needed
      batchRemoveLeadsFromCache(ids)
      apiDeleteLeadsBulk(ids).catch((err) => {
        console.error('[sales-sheet] Bulk delete error (background):', err)
      })
      setSelectedIds(new Set())
      toast.success(`تم حذف ${ids.length} عميل`)
      setBulkDeleteConfirm(false)
    } catch (err) {
      console.error('[sales-sheet] Bulk delete error:', err)
      toast.error('فشل في الحذف')
    }
  }, [selectedIds, batchRemoveLeadsFromCache])

  // ===== Archive All =====
  const handleArchiveAll = useCallback(async () => {
    if (myLeads.length === 0) return
    setArchivingAll(true)
    try {
      const ids = myLeads.map((l) => l.id)
      // Optimistic: update cache immediately, no server refresh needed
      archiveLeadsInCache(ids, currentUser || '')
      apiArchiveLeads(ids, currentUser || '').catch((err) => {
        console.error('[sales-sheet] Archive all error (background):', err)
      })
      setSelectedIds(new Set())
      toast.success(`تم أرشفة ${ids.length} عميل`)
    } catch {
      toast.error('فشل في الأرشفة')
    } finally {
      setArchivingAll(false)
    }
  }, [myLeads, currentUser, archiveLeadsInCache])

  // ===== Delete All (with type-to-confirm) =====
  const handleDeleteAll = useCallback(async () => {
    if (myLeads.length === 0) return
    setDeletingAll(true)
    try {
      const ids = myLeads.map((l) => l.id)
      // Optimistic: update cache immediately, no server refresh needed
      batchRemoveLeadsFromCache(ids)
      apiDeleteLeadsBulk(ids).catch((err) => {
        console.error('[sales-sheet] Delete all error (background):', err)
      })
      setSelectedIds(new Set())
      toast.success(`تم حذف ${ids.length} عميل`)
      setDeleteAllConfirm(false)
    } catch (err) {
      console.error('[sales-sheet] Delete all error:', err)
      toast.error('فشل في الحذف')
    } finally {
      setDeletingAll(false)
    }
  }, [myLeads, batchRemoveLeadsFromCache])

  // ===== Checkbox handling =====
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)))
    }
  }, [selectedIds.size, filtered])

  // ===== Open store URL =====
  const openStoreUrl = useCallback((url: string) => {
    if (!url) return
    let href = url
    if (!/^https?:\/\//i.test(href)) {
      href = 'https://' + href
    }
    window.open(href, '_blank', 'noopener')
  }, [])

  // ===== Bulk upload handler =====
  const handleBulkUploaded = useCallback(
    (created: Lead[]) => {
      batchAddLeadsToCache(created)

      // SAFETY NET: Verify all created leads are in the cache
      if (created.length > 0) {
        const store = useCrmStore.getState()
        const missing = created.filter((l) => l.id != null && !(l.id in store.leadsById))
        if (missing.length > 0) {
          console.warn(`[sales-bulk] ${missing.length} leads missing from cache, adding individually`)
          for (const lead of missing) {
            store.addLeadToCache(lead)
          }
        }
      }
    },
    [batchAddLeadsToCache]
  )

  // ===== Contact result options =====
  const contactOptions = useMemo(
    () => [
      { key: '__none__', label: '—', color: 'text-muted-foreground' },
      ...CONTACT_RESULTS.map((c) => ({ key: c.key, label: c.label, color: c.color })),
    ],
    []
  )

  // ===== Customer type options =====
  const customerTypeOptions = useMemo(
    () => [
      { key: '__none__', label: '—', color: 'text-muted-foreground' },
      { key: 'عنده متجر', label: 'عنده متجر', color: 'text-venom' },
      { key: 'إنشاء متجر', label: 'إنشاء متجر', color: 'text-amber-400' },
    ],
    []
  )

  // ===== Sales status options =====
  const salesStatusOptions = useMemo(
    () => [
      { key: '__none__', label: '—', color: 'text-muted-foreground' },
      ...SALES_STATUSES.map((s) => {
        // Extract text color from cls string (e.g., "bg-venom/20 text-venom" → "text-venom")
        const textColor = s.cls.split(' ').find((c: string) => c.startsWith('text-')) || 'text-foreground'
        return {
          key: s.key,
          label: s.label,
          color: textColor,
        }
      }),
    ],
    []
  )

  // Single-pass filter counts instead of 13+ .filter() calls
  const filterCounts = useMemo(() => {
    let newCount = 0, contacted = 0, negotiation = 0, won = 0, lost = 0, today = 0
    let replied = 0, noReply = 0, whatsapp = 0, callback = 0, noContact = 0, dupes = 0
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    for (const l of myLeadsDateFiltered) {
      // Status counts
      if (!l.salesStatus || l.salesStatus === 'new') newCount++
      if (l.salesStatus === 'contacted') contacted++
      if (['negotiation', 'proposal-sent', 'followup'].includes(l.salesStatus || '')) negotiation++
      if (l.salesStatus === 'closed-won') won++
      if (l.salesStatus === 'closed-lost') lost++
      if ((l.createdAt >= todayStart) || (l.contactResultAt && l.contactResultAt >= todayStart) || (l.assignedAt && l.assignedAt >= todayStart)) today++

      // Contact result counts
      if (l.contactResult === 'replied') replied++
      else if (l.contactResult === 'no-reply') noReply++
      else if (l.contactResult === 'whatsapp') whatsapp++
      else if (l.contactResult === 'callback') callback++
      else if (!l.contactResult) noContact++

      // Duplicate check
      if (l.phone) {
        const info = duplicateInfoMap.get(l.id)
        if (info?.isDuplicate) dupes++
      }
    }

    return { new: newCount, contacted, negotiation, won, lost, today, replied, noReply, whatsapp, callback, noContact, duplicates: dupes }
  }, [myLeadsDateFiltered, duplicateInfoMap])

  if (!currentUser || currentRole !== 'sales') return null

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length
  const hasSelection = selectedIds.size > 0

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold venom-text-glow text-venom">شيتي</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            إدارة عملاء المبيعات ({myLeadsDateFiltered.length})
            {dateFilter.preset !== 'all' && myLeads.length !== myLeadsDateFiltered.length && (
              <span className="text-muted-foreground/60"> من {myLeads.length}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleAddRow}
            disabled={addingRow}
            className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30"
          >
            {addingRow ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 ml-2" />
            )}
            صف جديد
          </Button>
          <Button
            onClick={() => setBulkUploadOpen(true)}
            variant="outline"
            className="border-venom/30 text-venom hover:bg-venom/10"
          >
            <FileUp className="w-4 h-4 ml-2" />
            رفع جماعي
          </Button>
          <Button
            onClick={handleArchiveAll}
            disabled={archivingAll || myLeads.length === 0}
            variant="outline"
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            {archivingAll ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Archive className="w-4 h-4 ml-2" />
            )}
            أرشف الكل
          </Button>
          <Button
            onClick={() => setDeleteAllConfirm(true)}
            disabled={deletingAll || myLeads.length === 0}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            {deletingAll ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 ml-2" />
            )}
            امسح الكل
          </Button>
        </div>
      </motion.div>

      {/* Sheet selector dropdown */}
      {accessibleSheets.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl flex-wrap"
        >
          <FolderOpen className="w-5 h-5 text-venom shrink-0" />
          <span className="text-xs font-medium text-muted-foreground">اختار الشيت:</span>
          <Select
            value={viewingSheet || currentUser}
            onValueChange={(v) => {
              setViewingSheet(v)
              setFilter('all')
              setSearch('')
              setSelectedIds(new Set())
            }}
          >
            <SelectTrigger className="flex-1 min-w-[200px] max-w-xs bg-background border-border h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {accessibleSheets.map((name) => {
                const isOwn = name === currentUser
                const count = salesSheetCounts[name.toLowerCase()] || 0
                return (
                  <SelectItem key={name} value={name} className="text-xs">
                    {isOwn ? '👤 شيتي - ' : '👁️ شيت '}{name} ({count} عميل)
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {!isViewingOwn && viewingSheet && (
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
              👁️ بتشوف شيت {viewingSheet}
            </Badge>
          )}
        </motion.div>
      )}

      {/* Access notice banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-venom/5 border border-venom/20 rounded-lg p-2.5 flex items-center gap-2"
      >
        {!isViewingOwn && viewingSheet ? (
          <>
            <ShieldCheck className="w-4 h-4 text-venom shrink-0" />
            <span className="text-xs text-venom">
              أنت بتعدل في شيت <strong>{viewingSheet}</strong>
            </span>
          </>
        ) : (
          <>
            <Info className="w-4 h-4 text-venom shrink-0" />
            <span className="text-xs text-venom">
              <strong>شيتك الخاص:</strong> الأرقام اللي بتشتغل عليها بنفسك مباشرة. عدد العملاء: <strong>{myLeads.length}</strong>
            </span>
          </>
        )}
      </motion.div>

      {/* Date range filter */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="flex items-center gap-2 flex-wrap"
      >
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.key}
            onClick={() => {
              setDateFilter({ preset: preset.key, customFrom: '', customTo: '' })
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              dateFilter.preset === preset.key
                ? 'bg-venom text-venom-foreground border border-venom/40 shadow-sm shadow-venom/10'
                : 'bg-muted/40 text-muted-foreground border border-transparent hover:bg-muted hover:text-foreground'
            }`}
          >
            {preset.label}
          </button>
        ))}
        {dateFilter.preset === 'custom' && (
          <div className="flex items-center gap-2 mr-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value)
                setDateFilter({ preset: 'custom', customFrom: e.target.value, customTo: customTo })
              }}
              className="h-7 text-xs bg-background border-border w-32"
            />
            <span className="text-xs text-muted-foreground">إلى</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value)
                setDateFilter({ preset: 'custom', customFrom: customFrom, customTo: e.target.value })
              }}
              className="h-7 text-xs bg-background border-border w-32"
            />
          </div>
        )}
      </motion.div>

      {/* Date filter active notice */}
      {dateFilter.preset !== 'all' && (
        <div className="bg-venom/5 border border-venom/20 rounded-lg p-2 flex items-center gap-2 flex-wrap">
          <Info className="w-4 h-4 text-venom shrink-0" />
          <span className="text-xs text-venom">
            <strong>الفلتر شغّال على وقت دخول العميل لشيتك</strong> - ظاهر {myLeadsDateFiltered.length} من إجمالي {myLeads.length}
          </span>
          <Badge className="bg-muted/50 text-muted-foreground border-border text-xs mr-auto">
            {DATE_PRESETS.find((p) => p.key === dateFilter.preset)?.label}
            {dateFilter.preset === 'custom' && customFrom && ` من ${customFrom}`}
            {dateFilter.preset === 'custom' && customTo && ` إلى ${customTo}`}
          </Badge>
        </div>
      )}

      {/* Search + Filter Row */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
      >
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث في شيتي..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-background border-border focus:border-venom/50 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_PILLS.map((pill) => {
            const count = pill.key === 'all' ? myLeadsDateFiltered.length : (filterCounts[pill.key as keyof typeof filterCounts] || 0)
            // Hide duplicates pill if no duplicates
            if (pill.key === 'duplicates' && count === 0) return null
            return (
              <div key={pill.key} className="contents">
                {pill.separatorBefore && (
                  <div className="w-px h-5 bg-border mx-1" />
                )}
                <button
                  onClick={() => setFilter(pill.key)}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    filter === pill.key
                      ? pill.key === 'duplicates'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm shadow-red-500/10'
                        : 'bg-venom text-venom-foreground border border-venom/40 shadow-sm shadow-venom/10'
                      : pill.key === 'duplicates'
                        ? 'bg-muted/50 text-red-400 border border-red-500/20 hover:bg-red-500/10'
                        : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {pill.label} ({count})
                </button>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Duplicate warning banner */}
      {myDuplicates.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-400">
            <strong>تنبيه:</strong> فيه {myDuplicates.length} رقم مكرر في شيتك
          </span>
        </div>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 overflow-hidden"
          >
            <Badge variant="outline" className="border-venom/30 text-venom bg-venom/10">
              {selectedIds.size} محدد
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkArchive}
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-8"
            >
              <Archive className="w-3.5 h-3.5 ml-1" />
              أرشفة
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkDeleteConfirm(true)}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8"
            >
              <Trash2 className="w-3.5 h-3.5 ml-1" />
              حذف
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground h-8"
            >
              إلغاء التحديد
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spreadsheet Grid */}
      <div
        ref={gridRef}
        className="bg-card border border-border rounded-xl overflow-auto max-h-[calc(100vh-320px)]"
        style={{ direction: 'rtl' }}
      >
          <div className="min-w-[900px]">
            {/* Header Row */}
            <div
              className={`grid ${GRID_COLS} bg-muted/40 border-b border-border sticky top-0 z-10`}
              dir="rtl"
            >
              <div className="px-1 py-2.5 text-center text-xs font-medium text-muted-foreground">#</div>
              <div className="px-1 py-2.5 flex items-center justify-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  className="border-muted-foreground/40 data-[state=checked]:bg-venom data-[state=checked]:border-venom"
                />
              </div>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">المتجر</div>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">الجوال</div>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">اسم العميل</div>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">النوع</div>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">نتيجة التواصل</div>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">البريف</div>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">الحالة</div>
              <div className="px-1 py-2.5" />
            </div>

            {/* Data Rows */}
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                <div className="text-center">
                  <div className="text-3xl mb-2">📋</div>
                  <p>مفيش بيانات. اضغط &quot;صف جديد&quot; أو &quot;رفع جماعي&quot; لتبدأ.</p>
                  {search && <p className="text-xs mt-1 text-muted-foreground/60">جرب تغيير البحث</p>}
                </div>
              </div>
            ) : (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const lead = filtered[virtualRow.index]
                  if (!lead) return null
                  const dupInfo = duplicateInfoMap.get(lead.id) || { isDuplicate: false, originalSheetName: null }
                  const { isDuplicate: isLeadDuplicate, originalSheetName } = dupInfo
                  const isSelected = selectedIds.has(lead.id)
                  const isDeleting = deleting === lead.id
                  const isClosed = lead.salesStatus === 'closed-won' || lead.salesStatus === 'closed-lost'
                  const isWon = lead.salesStatus === 'closed-won'
                  const canMove = MOVE_STATUSES.includes(lead.salesStatus || '')

                  // Row styling
                  let rowBgClass = ''
                  if (isLeadDuplicate) rowBgClass = 'bg-red-500/[0.04]'
                  else if (isWon) rowBgClass = 'bg-emerald-500/[0.03]'
                  if (isSelected) rowBgClass = 'bg-venom/8 border-r-2 border-r-venom/40'

                  return (
                    <div
                      key={lead.id}
                      className={`grid ${GRID_COLS} border-b border-border/30 hover:bg-venom/[0.02] transition-colors group ${rowBgClass}`}
                      style={{
                        ...(isClosed ? { opacity: 0.7 } : {}),
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {/* # Row number */}
                      <div className="px-1 py-1 flex items-center justify-center text-xs text-muted-foreground/60 tabular-nums">
                        {virtualRow.index + 1}
                      </div>

                      {/* ☐ Checkbox */}
                      <div className="px-1 py-1 flex items-center justify-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(lead.id)}
                          className="border-muted-foreground/40 data-[state=checked]:bg-venom data-[state=checked]:border-venom"
                        />
                      </div>

                      {/* المتجر - Store URL + open button */}
                      <div className="px-1 py-0.5 flex items-center gap-0.5">
                        <div className="flex-1 min-w-0">
                          <CellInput
                            value={lead.storeUrl}
                            onSave={(v) => handleCellSave(lead.id, 'storeUrl', v)}
                            placeholder="https://..."
                            dir="ltr"
                          />
                        </div>
                        {lead.storeUrl && (
                          <button
                            onClick={() => openStoreUrl(lead.storeUrl)}
                            className="shrink-0 p-1 rounded hover:bg-venom/10 text-muted-foreground hover:text-venom transition-colors cursor-pointer"
                            title="فتح المتجر"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* الجوال - Phone with duplicate detection */}
                      <div className="px-1 py-0.5 flex items-center gap-1">
                        {isLeadDuplicate && (
                          <span
                            className="shrink-0 text-[9px] px-1.5 py-0.5 rounded cursor-help leading-tight whitespace-nowrap bg-red-500/10 text-red-400"
                            title={originalSheetName ? `مكرر · أصلي عند ${originalSheetName}` : 'مكرر'}
                          >
                            🔴 مكرر
                            {originalSheetName && (
                              <strong className="mr-0.5">· أصلي عند {originalSheetName}</strong>
                            )}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <CellInput
                            value={lead.phone}
                            onSave={(v) => handleCellSave(lead.id, 'phone', v)}
                            placeholder="05XXXXXXXX"
                            mono
                            dir="ltr"
                            danger={isLeadDuplicate}
                          />
                        </div>
                      </div>

                      {/* اسم العميل - Customer name */}
                      <div className="px-1 py-0.5">
                        <CellInput
                          value={lead.customerName}
                          onSave={(v) => handleCellSave(lead.id, 'customerName', v)}
                          placeholder="—"
                        />
                        {lead.tele && (
                          <div className="text-[9px] text-venom/70 mt-0.5 leading-none" dir="rtl">
                            من {lead.tele}
                          </div>
                        )}
                      </div>

                      {/* النوع - Customer type */}
                      <div className="px-0.5 py-0.5">
                        <CellSelect
                          value={lead.customerType || ''}
                          options={customerTypeOptions}
                          onSave={(v) => handleCellSave(lead.id, 'customerType', v)}
                        />
                      </div>

                      {/* نتيجة التواصل - Contact result */}
                      <div className="px-0.5 py-0.5">
                        <CellSelect
                          value={lead.contactResult || ''}
                          options={contactOptions}
                          onSave={(v) => handleCellSave(lead.id, 'contactResult', v)}
                        />
                      </div>

                      {/* البريف - Brief */}
                      <div className="px-1 py-0.5">
                        <CellInput
                          value={lead.brief}
                          onSave={(v) => handleCellSave(lead.id, 'brief', v)}
                          placeholder="بريف العميل..."
                        />
                      </div>

                      {/* الحالة - Sales status */}
                      <div className="px-0.5 py-0.5">
                        <CellSelect
                          value={lead.salesStatus || ''}
                          options={salesStatusOptions}
                          onSave={(v) => handleCellSave(lead.id, 'salesStatus', v)}
                        />
                      </div>

                      {/* ⚡ Actions: نقل + Delete */}
                      <div className="px-0.5 py-0.5 flex items-center justify-center gap-0.5 flex-col">
                        {canMove && (
                          <button
                            onClick={() => setMoveLead(lead)}
                            className="px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-semibold hover:bg-emerald-600 transition-colors cursor-pointer flex items-center gap-0.5"
                            title="نقل لتاب موقف العملاء"
                          >
                            <ArrowRight className="w-2.5 h-2.5" />
                            نقل
                          </button>
                        )}
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
                        ) : (
                          <button
                            onClick={() => setDeleteLeadConfirm(lead)}
                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground/30 hover:text-red-400 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
      </div>

      {/* Bottom info bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground/50 px-1">
        <span>
          {filtered.length} صف
          {search && ` من ${myLeadsDateFiltered.length}`}
          {dateFilter.preset !== 'all' && ` (فلتر التاريخ: ${myLeadsDateFiltered.length} من ${myLeads.length})`}
        </span>
        <span>الحفظ تلقائي</span>
      </div>

      {/* Notes Dialog */}
      <NotesDialog
        lead={notesLead}
        open={!!notesLead}
        onOpenChange={(o) => {
          if (!o) setNotesLead(null)
        }}
      />

      {/* Move to Customers Dialog */}
      <MoveToCustomersDialog
        lead={moveLead}
        open={!!moveLead}
        onOpenChange={(o) => {
          if (!o) setMoveLead(null)
        }}
        onMoved={() => {}}
      />

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onUploaded={handleBulkUploaded}
        salesOwner={isViewingOwn ? (currentUser || '') : (viewingSheet || '')}
      />

      {/* Delete Single Lead Confirmation */}
      <Dialog open={!!deleteLeadConfirm} onOpenChange={(o) => { if (!o) setDeleteLeadConfirm(null) }}>
        <DialogContent className="max-w-sm bg-card border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              تأكيد الحذف
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            متأكد عايز تحذف العميل ده نهائياً؟
          </p>
          {deleteLeadConfirm && (
            <div className="bg-muted/30 rounded-lg p-2.5 text-xs space-y-1">
              {deleteLeadConfirm.customerName && <div><strong>الاسم:</strong> {deleteLeadConfirm.customerName}</div>}
              {deleteLeadConfirm.phone && <div><strong>الجوال:</strong> {deleteLeadConfirm.phone}</div>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteLeadConfirm(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteLeadConfirm && handleDelete(deleteLeadConfirm.id)} disabled={deleting === deleteLeadConfirm?.id}>
              {deleting === deleteLeadConfirm?.id ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Trash2 className="w-4 h-4 ml-1" />}
              احذف نهائياً
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="max-w-sm bg-card border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              تأكيد حذف {selectedIds.size} عميل
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            متأكد عايز تحذف {selectedIds.size} عميل المحددين؟ ده مش هيرجع تاني!
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="w-4 h-4 ml-1" />
              احذف {selectedIds.size} عميل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation - requires typing "مسح" */}
      <Dialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <DialogContent className="max-w-sm bg-card border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              تأكيد مسح الكل
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            هتمسح كل الـ <strong>{myLeads.length}</strong> عميل في شيت{' '}
            <strong>{viewingSheet}</strong> نهائياً! مش هيرجعوا تاني!
          </p>
          <div className="bg-red-500/5 border border-red-400/30 rounded-lg p-3 text-xs text-red-400">
            ⚠️ <strong>تحذير:</strong> ده إجراء نهائي مش هيقدر حد يرجع الداتا!
          </div>
          <SalesDeleteConfirmInput
            confirmText="مسح"
            onConfirm={handleDeleteAll}
            onCancel={() => setDeleteAllConfirm(false)}
            buttonText={`امسح ${myLeads.length} عميل نهائياً`}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
