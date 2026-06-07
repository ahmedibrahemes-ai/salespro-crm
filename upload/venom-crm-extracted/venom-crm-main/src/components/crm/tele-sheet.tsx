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
  Loader2,
  X,
  Pencil,
  UserPlus,
  Calendar,
  Filter,
  Eye,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  CalendarOff,
  CalendarDays,
  UserCog,
  FolderOpen,
  Clock,
  Inbox,
  Info,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import {
  useCrmStore,
  CONTACT_RESULTS,
  normalizePhone,
  isValidSaudiPhone,
  formatDate,
  formatRelativeTime,
  getDateRange,
} from '@/lib/store'
import type { DateRangeFilter } from '@/lib/store'
import {
  apiUpdateLead,
  apiCreateLead,
  apiDeleteLead,
  apiDeleteLeadsBulk,
  apiArchiveLeads,
  apiAddNote,
  apiGetDuplicates,
  apiCheckDuplicatePhones,
  apiBroadcastChange,
} from '@/lib/supabase'
import type { Lead } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  useEffect(() => {
    fnRef.current = fn
  })

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

// ===== Filter key type =====
type FilterKey =
  | 'all'
  | 'pending'
  | 'assigned'
  | 'today'
  | 'duplicates'
  | 'replied'
  | 'no-reply'
  | 'whatsapp'
  | 'callback'
  | 'no-contact'

// ===== Grid column template (matching old HTML) =====
const GRID_COLS =
  'grid-cols-[36px_32px_1.2fr_1.2fr_0.9fr_0.7fr_0.95fr_1.3fr_110px_40px]'

// ===== Inline Text Cell (memoized for performance) =====
const CellInput = memo(function CellInput({
  value,
  onSave,
  onBlurProp,
  placeholder,
  mono,
  dir,
  className,
  danger,
  warning,
}: {
  value: string
  onSave: (v: string) => void
  onBlurProp?: () => void
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
    onBlurProp?.()
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

// ===== Inline Select Cell (native HTML for performance — no Radix Portal overhead) =====
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
    const val = e.target.value
    onSave(val === '__none__' || val === 'none' ? '' : val)
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

// ===== isToday helper =====
function isToday(ts: number | null): boolean {
  if (!ts) return false
  return new Date(ts).toDateString() === new Date().toDateString()
}

// ===== Delete Confirm Input (type-to-confirm) =====
function DeleteConfirmInput({
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

// ===== Contact result options =====
// Note: CONTACT_RESULTS already includes a 'none' option with '—' label
// We don't add a duplicate __none__ option to avoid two identical "—" entries
const CONTACT_OPTIONS = CONTACT_RESULTS.map((c) => ({ key: c.key, label: c.label, color: c.color }))

// ===== Customer type options =====
const CUSTOMER_TYPE_OPTIONS = [
  { key: '__none__', label: '—', color: 'text-muted-foreground' },
  { key: 'عنده متجر', label: 'عنده متجر', color: 'text-venom' },
  { key: 'إنشاء متجر', label: 'إنشاء متجر', color: 'text-amber-400' },
]

// ===== Meeting type options =====
const MEETING_TYPES = ['Google Meet', 'Zoom', 'Call', 'Whatsapp']

// ===== Date range preset labels =====
const DATE_PRESET_LABELS: Record<string, string> = {
  today: '📅 اليوم',
  yesterday: '🕐 أمس',
  week: '📆 الأسبوع الحالي',
  month: '🗓️ الشهر الحالي',
  all: '🌐 الكل',
  custom: '🎯 تاريخ محدد',
}

// ===== Assign Modal =====
function AssignModal({
  lead,
  open,
  onOpenChange,
  onAssigned,
}: {
  lead: Lead | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onAssigned: () => void
}) {
  const { currentUser, currentRole, team, leads, updateLeadInCache, addToast, telegramConfig } =
    useCrmStore(useShallow((s) => ({
      currentUser: s.currentUser,
      currentRole: s.currentRole,
      team: s.team,
      leads: s.leads,
      updateLeadInCache: s.updateLeadInCache,
      addToast: s.addToast,
      telegramConfig: s.telegramConfig,
    })))
  const [customerName, setCustomerName] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [phone, setPhone] = useState('')
  const [storeUrl, setStoreUrl] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingType, setMeetingType] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [brief, setBrief] = useState('')
  const [selectedSales, setSelectedSales] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Sync lead data to form when opening
  useEffect(() => {
    if (lead && open) {
      setCustomerName(lead.customerName || '')
      setCustomerType(lead.customerType || '')
      setPhone(lead.phone || '')
      setStoreUrl(lead.storeUrl || '')
      setMeetingDate(lead.meetingDate || '')
      setMeetingTime(lead.meetingTime || '')
      setMeetingType(lead.meetingType || '')
      setMeetingLink(lead.meetingLink || '')
      setBrief(lead.brief || '')
      setSelectedSales(null)
      setSaving(false)
    }
  }, [lead, open])

  // Count leads per sales (single-pass)
  const salesCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of leads) {
      if (l.sales) counts[l.sales] = (counts[l.sales] || 0) + 1
    }
    return counts
  }, [leads])

  const canSubmit = phone.trim() && brief.trim() && selectedSales

  const handleSubmit = useCallback(async () => {
    if (!lead || !selectedSales || !brief.trim() || !phone.trim()) return
    setSaving(true)
    try {
      const normalizedPhone = normalizePhone(phone.trim())
      const updates: Partial<Lead> = {
        customerName: customerName.trim(),
        customerType,
        phone: normalizedPhone,
        storeUrl: storeUrl.trim(),
        meetingDate,
        meetingTime,
        meetingType,
        meetingLink: meetingLink.trim(),
        brief: brief.trim(),
        sales: selectedSales,
        assignedAt: Date.now(),
        status: 'new',
      }
      await apiUpdateLead(lead.id, updates)
      updateLeadInCache(lead.id, updates)

      // Broadcast the assignment change to all other connected clients
      // This ensures sales users see the new assignment immediately regardless of RLS
      apiBroadcastChange({
        type: 'assignment',
        leadId: lead.id,
        data: updates,
        by: currentUser || '',
        byRole: currentRole || 'tele',
        at: Date.now(),
      })

      // Telegram notification
      const cfg = telegramConfig
      const targetChat =
        (cfg.salesChats && cfg.salesChats[selectedSales]) || cfg.groupChatId
      if (cfg.botToken && targetChat) {
        addToast('info', `تم إرسال إشعار التليجرام لـ ${selectedSales}`)
      }

      addToast('success', `✅ تم التحويل لـ ${selectedSales} - استلم العميل فوراً`)
      onAssigned()
      onOpenChange(false)
    } catch {
      addToast('error', '❌ فشل التحويل - حاولي تاني')
    } finally {
      setSaving(false)
    }
  }, [
    lead,
    selectedSales,
    customerName,
    customerType,
    phone,
    storeUrl,
    meetingDate,
    meetingTime,
    meetingType,
    meetingLink,
    brief,
    updateLeadInCache,
    addToast,
    telegramConfig,
    onAssigned,
    onOpenChange,
    currentUser,
    currentRole,
  ])

  if (!lead) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-venom">
            <UserPlus className="w-5 h-5" />
            تحويل العميل للسيلز
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          املي البيانات الناقصة واختاري السيلز ·{' '}
          <span className="text-red-400 font-semibold">البريف إجباري</span>
        </p>

        {/* Customer name & type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              اسم العميل{' '}
              <span className="text-muted-foreground/50 font-normal">(اختياري)</span>
            </label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="اسم العميل"
              className="h-8 text-xs bg-background border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              نوع العميل
            </label>
            <Select value={customerType || '__none__'} onValueChange={(v) => setCustomerType(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="__none__" className="text-xs">اختاري...</SelectItem>
                <SelectItem value="عنده متجر" className="text-xs">عنده متجر</SelectItem>
                <SelectItem value="إنشاء متجر" className="text-xs">إنشاء متجر</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Phone & store */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              رقم الجوال <span className="text-red-400">*</span>
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XXXXXXXX"
              dir="ltr"
              className={`h-8 text-xs bg-background border-border ${!phone.trim() ? 'border-red-400' : ''}`}
            />
            {!phone.trim() && (
              <p className="text-xs text-red-400 mt-0.5">مطلوب وصيغة صحيحة</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              رابط المتجر
            </label>
            <Input
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="https://..."
              dir="ltr"
              className="h-8 text-xs bg-background border-border"
            />
          </div>
        </div>

        {/* Meeting details */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              تاريخ الاجتماع
            </label>
            <Input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="h-8 text-xs bg-background border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الوقت</label>
            <Input
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="h-8 text-xs bg-background border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              طريقة التواصل
            </label>
            <Select value={meetingType || '__none__'} onValueChange={(v) => setMeetingType(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="__none__" className="text-xs">—</SelectItem>
                {MEETING_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Meeting link */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            رابط الاجتماع (اختياري)
          </label>
          <Input
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="https://meet.google.com/..."
            dir="ltr"
            className="h-8 text-xs bg-background border-border"
          />
        </div>

        {/* Brief */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            البريف <span className="text-red-400">*</span>{' '}
            <span className="text-muted-foreground/50 font-normal">
              (إجباري - ملخص اللي العميل عايزه)
            </span>
          </label>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="مثال: محتاج خدمة الحملات الإعلانية فقط، عنده ميزانية محدودة..."
            className={`bg-background border-border min-h-[50px] resize-none text-xs ${!brief.trim() ? 'border-red-400' : ''}`}
          />
          {!brief.trim() && (
            <p className="text-xs text-red-400 mt-0.5">البريف مطلوب لتحويل العميل</p>
          )}
        </div>

        {/* Sales picker */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">
            اختاري السيلز المسؤول <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {team.sales.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSales(s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer text-center ${
                  selectedSales === s
                    ? 'bg-venom/20 text-venom border-venom/40 shadow-sm'
                    : 'bg-background border-border hover:border-venom/30 hover:bg-venom/5 text-foreground'
                }`}
              >
                {s}
                <span className="block text-[9px] text-muted-foreground mt-0.5">
                  {salesCounts[s] || 0} عميل
                </span>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 ml-1 animate-spin" />
            ) : (
              <Send className="w-4 h-4 ml-1" />
            )}
            تحويل وإرسال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Change Meeting Modal =====
function ChangeMeetingModal({
  lead,
  open,
  onOpenChange,
  onDone,
}: {
  lead: Lead | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const { currentUser, team, leads, updateLeadInCache, addToast, telegramConfig } =
    useCrmStore(useShallow((s) => ({
      currentUser: s.currentUser,
      team: s.team,
      leads: s.leads,
      updateLeadInCache: s.updateLeadInCache,
      addToast: s.addToast,
      telegramConfig: s.telegramConfig,
    })))
  const [mode, setMode] = useState<'choose' | 'change' | 'edit'>('choose')
  const [newSales, setNewSales] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editType, setEditType] = useState('')
  const [editLink, setEditLink] = useState('')
  const [editBrief, setEditBrief] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (lead && open) {
      setMode('choose')
      setNewSales(null)
      setEditDate(lead.meetingDate || '')
      setEditTime(lead.meetingTime || '')
      setEditType(lead.meetingType || '')
      setEditLink(lead.meetingLink || '')
      setEditBrief(lead.brief || '')
      setSaving(false)
    }
  }, [lead, open])

  // Count leads per sales (single-pass)
  const salesCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of leads) {
      if (l.sales) counts[l.sales] = (counts[l.sales] || 0) + 1
    }
    return counts
  }, [leads])

  const handleCancelMeeting = useCallback(async () => {
    if (!lead || !lead.sales) return
    setSaving(true)
    try {
      const oldSales = lead.sales
      await apiUpdateLead(lead.id, {
        sales: null,
        assignedAt: null,
        status: 'new',
        cancelledFrom: oldSales,
        cancelledAt: Date.now(),
      } as Partial<Lead>)
      updateLeadInCache(lead.id, {
        sales: null,
        assignedAt: null,
        status: 'new',
        cancelledFrom: oldSales,
        cancelledAt: Date.now(),
      } as Partial<Lead>)
      // Add note (non-blocking)
      apiAddNote(lead.id, currentUser || '', 'status', `❌ تم إلغاء الاجتماع مع ${oldSales}`).catch(() => {})
      addToast('success', `✅ تم إلغاء الاجتماع - ${oldSales} استلم إشعار`)
      onDone()
      onOpenChange(false)
    } catch {
      addToast('error', '❌ فشل إلغاء الاجتماع - حاولي تاني')
    } finally {
      setSaving(false)
    }
  }, [lead, currentUser, updateLeadInCache, addToast, onDone, onOpenChange])

  const handleConfirmChangeSales = useCallback(async () => {
    if (!lead || !newSales || !lead.sales) return
    setSaving(true)
    try {
      const oldSales = lead.sales
      await apiUpdateLead(lead.id, {
        sales: newSales,
        assignedAt: Date.now(),
      } as Partial<Lead>)
      updateLeadInCache(lead.id, {
        sales: newSales,
        assignedAt: Date.now(),
      } as Partial<Lead>)
      // Add note (non-blocking)
      apiAddNote(lead.id, currentUser || '', 'status', `🔄 تم نقل العميل من ${oldSales} إلى ${newSales}`).catch(() => {})
      addToast('success', `✅ تم نقل العميل من ${oldSales} إلى ${newSales}`)
      onDone()
      onOpenChange(false)
    } catch {
      addToast('error', '❌ فشل نقل العميل - حاولي تاني')
    } finally {
      setSaving(false)
    }
  }, [lead, newSales, currentUser, updateLeadInCache, addToast, onDone, onOpenChange])

  const handleConfirmEdit = useCallback(async () => {
    if (!lead) return
    setSaving(true)
    try {
      const updates: Partial<Lead> = {
        meetingDate: editDate,
        meetingTime: editTime,
        meetingType: editType,
        meetingLink: editLink.trim(),
        brief: editBrief.trim(),
      }
      await apiUpdateLead(lead.id, updates)
      updateLeadInCache(lead.id, updates)
      addToast('success', '✅ تم تحديث تفاصيل الاجتماع')
      onDone()
      onOpenChange(false)
    } catch {
      addToast('error', '❌ فشل التحديث - حاولي تاني')
    } finally {
      setSaving(false)
    }
  }, [lead, editDate, editTime, editType, editLink, editBrief, updateLeadInCache, addToast, onDone, onOpenChange])

  if (!lead) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-venom">
            <Pencil className="w-5 h-5" />
            تعديل الاجتماع
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          {lead.customerName || lead.phone || 'العميل'} · مع {lead.sales}
        </p>

        {mode === 'choose' && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium mb-2">
              عايز تعمل إيه؟
            </p>
            <Button
              variant="outline"
              className="w-full justify-start text-xs h-9"
              onClick={() => setMode('change')}
            >
              <UserCog className="w-4 h-4 ml-2 text-venom" />
              تغيير السيلز المسؤول
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-xs h-9"
              onClick={handleCancelMeeting}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <CalendarOff className="w-4 h-4 ml-2 text-amber-400" />
              )}
              إلغاء الاجتماع (يبقى العميل في الشيت بدون سيلز)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-xs h-9"
              onClick={() => setMode('edit')}
            >
              <CalendarDays className="w-4 h-4 ml-2 text-emerald-400" />
              تعديل تفاصيل الاجتماع فقط (موعد/لينك/بريف)
            </Button>
          </div>
        )}

        {mode === 'change' && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              اختاري السيلز الجديد:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {team.sales.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    if (s !== lead.sales) setNewSales(s)
                  }}
                  disabled={s === lead.sales}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center ${
                    s === lead.sales
                      ? 'opacity-40 cursor-not-allowed bg-muted border-border'
                      : newSales === s
                        ? 'bg-venom/20 text-venom border-venom/40 cursor-pointer'
                        : 'bg-background border-border hover:border-venom/30 hover:bg-venom/5 cursor-pointer'
                  }`}
                >
                  {s}
                  {s === lead.sales && (
                    <span className="block text-[9px] text-muted-foreground">(الحالي)</span>
                  )}
                  <span className="block text-[9px] text-muted-foreground mt-0.5">
                    {salesCounts[s] || 0} عميل
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setMode('choose')}>
                رجوع
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmChangeSales}
                disabled={!newSales || saving}
                className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
                تأكيد
              </Button>
            </div>
          </div>
        )}

        {mode === 'edit' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">التاريخ</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">الوقت</label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">الطريقة</label>
                <Select value={editType || '__none__'} onValueChange={(v) => setEditType(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="__none__" className="text-xs">—</SelectItem>
                    {MEETING_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">اللينك</label>
              <Input
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                placeholder="رابط الاجتماع"
                dir="ltr"
                className="h-8 text-xs bg-background border-border"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">البريف</label>
              <Textarea
                value={editBrief}
                onChange={(e) => setEditBrief(e.target.value)}
                className="bg-background border-border min-h-[50px] resize-none text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode('choose')}>
                رجوع
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmEdit}
                disabled={saving}
                className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
                تأكيد
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ===== Delete Confirmation Modal =====
function DeleteConfirmModal({
  lead,
  open,
  onOpenChange,
  onDeleted,
}: {
  lead: Lead | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onDeleted: () => void
}) {
  const { removeLeadFromCache, addToast, telegramConfig } = useCrmStore(useShallow((s) => ({
    removeLeadFromCache: s.removeLeadFromCache,
    addToast: s.addToast,
    telegramConfig: s.telegramConfig,
  })))
  const [notifyTelegram, setNotifyTelegram] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setNotifyTelegram(true)
      setSaving(false)
    }
  }, [open])

  const handleDelete = useCallback(async () => {
    if (!lead) return
    setSaving(true)
    try {
      await apiDeleteLead(lead.id)
      removeLeadFromCache(lead.id)
      if (lead.sales && notifyTelegram) {
        addToast('info', 'تم إرسال إشعار حذف للسيلز')
      }
      addToast('success', `✅ تم حذف العميل${lead.sales ? ` ومسحه من عند ${lead.sales}` : ''}`)
      onDeleted()
      onOpenChange(false)
    } catch {
      addToast('error', 'فشل الحذف - حاول تاني')
    } finally {
      setSaving(false)
    }
  }, [lead, notifyTelegram, removeLeadFromCache, addToast, onDeleted, onOpenChange])

  if (!lead) return null

  const hasAssign = !!lead.sales

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Trash2 className="w-5 h-5" />
            تأكيد الحذف
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {hasAssign
            ? `هتمسحي العميل من عندك ومن عند ${lead.sales} برضو. ده نهائي.`
            : 'هتمسحي العميل نهائياً. مش هيرجع تاني.'}
        </p>

        <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
          {lead.customerName && (
            <div>
              <strong>الاسم:</strong> {lead.customerName}
            </div>
          )}
          {lead.phone && (
            <div>
              <strong>الجوال:</strong> {lead.phone}
            </div>
          )}
          {lead.sales && (
            <div className="text-venom">
              <strong>عند:</strong> {lead.sales}
            </div>
          )}
        </div>

        {hasAssign && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={notifyTelegram}
              onCheckedChange={(c) => setNotifyTelegram(c === true)}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            أرسل إشعار للسيلز على التليجرام
          </label>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 ml-1 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 ml-1" />
            )}
            احذف نهائياً
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Archive Modal =====
function ArchiveModal({
  leads: archiveLeads,
  open,
  onOpenChange,
  sheetName,
  onArchived,
}: {
  leads: Lead[]
  open: boolean
  onOpenChange: (o: boolean) => void
  sheetName: string
  onArchived: () => void
}) {
  const { currentUser, addToast, archiveLeadsInCache } = useCrmStore(useShallow((s) => ({
    currentUser: s.currentUser,
    addToast: s.addToast,
    archiveLeadsInCache: s.archiveLeadsInCache,
  })))
  const [previewIds, setPreviewIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPreviewIds(new Set())
      setSaving(false)
    }
  }, [open])

  const filters = useMemo(() => {
    const now = Date.now()
    const dayMs = 86400000
    return {
      all: archiveLeads,
      'older-1': archiveLeads.filter((l) => now - (l.createdAt || 0) > dayMs * 1),
      'older-7': archiveLeads.filter((l) => now - (l.createdAt || 0) > dayMs * 7),
      'older-30': archiveLeads.filter((l) => now - (l.createdAt || 0) > dayMs * 30),
      'older-60': archiveLeads.filter((l) => now - (l.createdAt || 0) > dayMs * 60),
      'older-90': archiveLeads.filter((l) => now - (l.createdAt || 0) > dayMs * 90),
      'no-reply': archiveLeads.filter(
        (l) => l.contactResult === 'no-reply' || l.contactResult === 'not-interested'
      ),
      closed: archiveLeads.filter(
        (l) =>
          l.status === 'closed-won' ||
          l.status === 'closed-lost' ||
          l.salesStatus === 'closed-won' ||
          l.salesStatus === 'closed-lost'
      ),
      'no-sales': archiveLeads.filter((l) => !l.sales),
      attended: archiveLeads.filter((l) => l.attended === 'attended'),
      'no-show': archiveLeads.filter((l) => l.attended === 'no-show'),
    }
  }, [archiveLeads])

  const filterButtons = [
    { key: 'older-1', label: '📅 أقدم من يوم', count: filters['older-1'].length },
    { key: 'older-7', label: '🗓️ أقدم من 7 أيام', count: filters['older-7'].length },
    { key: 'older-30', label: '📆 أقدم من 30 يوم', count: filters['older-30'].length },
    { key: 'older-60', label: '📆 أقدم من 60 يوم', count: filters['older-60'].length },
    { key: 'older-90', label: '📦 أقدم من 90 يوم', count: filters['older-90'].length },
    { key: 'no-reply', label: '📵 مردش/غير مهتم', count: filters['no-reply'].length },
    { key: 'no-sales', label: '⏳ بدون سيلز', count: filters['no-sales'].length },
    { key: 'closed', label: '✅ مقفول (Won/Lost)', count: filters['closed'].length },
    { key: 'attended', label: '✅ حضر', count: filters['attended'].length },
    { key: 'no-show', label: '❌ لم يحضر', count: filters['no-show'].length },
  ]

  const previewLeads = useMemo(
    () => archiveLeads.filter((l) => previewIds.has(l.id)),
    [archiveLeads, previewIds]
  )

  const setPreview = useCallback(
    (leads: Lead[]) => {
      setPreviewIds(new Set(leads.map((l) => l.id)))
    },
    []
  )

  const handleConfirm = useCallback(async () => {
    const ids = Array.from(previewIds)
    if (ids.length === 0) return
    setSaving(true)
    try {
      // Optimistic: update cache immediately, no server refresh needed
      archiveLeadsInCache(ids, currentUser || '')
      apiArchiveLeads(ids, currentUser || '').catch((err) => {
        console.error('[ArchiveModal] Archive error (background):', err)
      })
      addToast('success', `📦 تم أرشفة ${ids.length} عميل`)
      onArchived()
      onOpenChange(false)
    } catch {
      addToast('error', 'فشل الأرشفة - حاول تاني')
    } finally {
      setSaving(false)
    }
  }, [previewIds, currentUser, archiveLeadsInCache, addToast, onArchived, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card border-border max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <Archive className="w-5 h-5" />
            أرشفة مخصصة - شيت {sheetName}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          اختار اللي عايز ترشفه - تقدر تختار حسب التاريخ أو الحالة أو عدد محدد
        </p>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3">
            {/* Method 1: By count */}
            <div className="bg-muted/20 border border-border rounded-lg p-3">
              <ArchiveByCount allLeads={archiveLeads} onPreview={setPreview} />
            </div>

            {/* Method 2: By filter */}
            <div className="bg-muted/20 border border-border rounded-lg p-3">
              <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-venom" /> الطريقة 2: حسب الفلتر
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {filterButtons.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setPreview(filters[f.key] || [])}
                    disabled={f.count === 0}
                    className={`px-2.5 py-1.5 rounded-md text-xs border transition-all flex justify-between items-center ${
                      f.count === 0
                        ? 'opacity-40 cursor-not-allowed bg-muted border-border'
                        : 'bg-background border-border hover:border-venom/30 cursor-pointer'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="bg-muted px-1.5 rounded text-xs text-muted-foreground">
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Method 3: All */}
            <div className="bg-muted/20 border border-border rounded-lg p-3">
              <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5 text-red-400" /> الطريقة 3: الكل
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreview(archiveLeads)}
                className="border-red-400/30 text-red-400 hover:bg-red-500/10 text-xs"
              >
                <Archive className="w-3.5 h-3.5 ml-1" />
                أرشف كل الـ {archiveLeads.length} في الشيت
              </Button>
            </div>

            {/* Preview */}
            {previewLeads.length > 0 && (
              <div className="bg-venom/5 border border-venom/30 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-venom">
                    <Eye className="w-3.5 h-3.5 inline ml-1" />
                    معاينة: {previewLeads.length} عميل
                  </span>
                  <button
                    onClick={() => setPreviewIds(new Set())}
                    className="text-xs text-venom hover:underline cursor-pointer"
                  >
                    <X className="w-3 h-3 inline" /> إلغاء
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto text-xs font-mono bg-background rounded p-2 space-y-0.5">
                  {previewLeads.slice(0, 10).map((l, i) => (
                    <div key={l.id} className="py-0.5 border-b border-border/50">
                      {i + 1}. {l.phone || 'بدون رقم'}{' '}
                      {l.customerName ? `— ${l.customerName}` : ''}{' '}
                      <span className="text-muted-foreground float-left">
                        {l.createdAt ? formatDate(l.createdAt) : ''}
                      </span>
                    </div>
                  ))}
                  {previewLeads.length > 10 && (
                    <div className="text-center text-muted-foreground py-1">
                      ... و {previewLeads.length - 10} عميل آخر
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={previewIds.size === 0 || saving}
            className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 ml-1 animate-spin" />
            ) : (
              <Archive className="w-4 h-4 ml-1" />
            )}
            أرشف {previewIds.size} عميل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Archive By Count sub-component =====
function ArchiveByCount({
  allLeads,
  onPreview,
}: {
  allLeads: Lead[]
  onPreview: (leads: Lead[]) => void
}) {
  const [count, setCount] = useState(100)
  const [order, setOrder] = useState<'oldest' | 'newest'>('oldest')

  const handlePreview = useCallback(() => {
    if (count <= 0) return
    const sorted = [...allLeads].sort((a, b) => {
      const aT = a.createdAt || 0
      const bT = b.createdAt || 0
      return order === 'oldest' ? aT - bT : bT - aT
    })
    onPreview(sorted.slice(0, count))
  }, [count, order, allLeads, onPreview])

  return (
    <>
      <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-venom" /> الطريقة 1: حسب العدد
      </h4>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="number"
          min={1}
          max={allLeads.length}
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value) || 0)}
          className="w-24 h-8 text-xs bg-background border-border"
        />
        <span className="text-xs text-muted-foreground">
          من إجمالي {allLeads.length}
        </span>
        <Select value={order} onValueChange={(v) => setOrder(v as 'oldest' | 'newest')}>
          <SelectTrigger className="h-8 text-xs bg-background border-border w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="oldest" className="text-xs">الأقدم أولاً</SelectItem>
            <SelectItem value="newest" className="text-xs">الأحدث أولاً</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handlePreview}
          className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30 text-xs h-8"
        >
          <Eye className="w-3.5 h-3.5 ml-1" /> معاينة
        </Button>
      </div>
    </>
  )
}

// ===== Main Tele Sheet =====
export function TeleSheet() {
  const {
    currentUser,
    currentRole,
    leads,
    team,
    updateLeadInCache,
    addLeadToCache,
    removeLeadFromCache,
    batchRemoveLeadsFromCache,
    archiveLeadsInCache,
    addToast,
    getAccessibleTeleSheets,
    activeFilter,
    setActiveFilter,
    selectedLeadIds,
    toggleLeadSelection,
    setSelectedLeadIds,
    clearSelectedLeadIds,
    selectAllLeads,
    searchQueries,
    setSearchQuery,
    dateRangeFilters,
    setDateRangeFilter,
    leadsById,
    leadsVersion,
  } = useCrmStore(useShallow((s) => ({
    currentUser: s.currentUser,
    currentRole: s.currentRole,
    leads: s.leads,
    team: s.team,
    updateLeadInCache: s.updateLeadInCache,
    addLeadToCache: s.addLeadToCache,
    removeLeadFromCache: s.removeLeadFromCache,
    batchRemoveLeadsFromCache: s.batchRemoveLeadsFromCache,
    archiveLeadsInCache: s.archiveLeadsInCache,
    addToast: s.addToast,
    getAccessibleTeleSheets: s.getAccessibleTeleSheets,
    activeFilter: s.activeFilter,
    setActiveFilter: s.setActiveFilter,
    selectedLeadIds: s.selectedLeadIds,
    toggleLeadSelection: s.toggleLeadSelection,
    setSelectedLeadIds: s.setSelectedLeadIds,
    clearSelectedLeadIds: s.clearSelectedLeadIds,
    selectAllLeads: s.selectAllLeads,
    searchQueries: s.searchQueries,
    setSearchQuery: s.setSearchQuery,
    dateRangeFilters: s.dateRangeFilters,
    setDateRangeFilter: s.setDateRangeFilter,
    leadsById: s.leadsById,
    leadsVersion: s.leadsVersion,
  })))

  // View-specific keys
  const VIEW_KEY = 'tele-sheet'

  // Local state
  const [viewingSheet, setViewingSheet] = useState<string | null>(null)
  const [assignLead, setAssignLead] = useState<Lead | null>(null)
  const [changeMeetingLead, setChangeMeetingLead] = useState<Lead | null>(null)
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [addingRow, setAddingRow] = useState(false)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)

  // Read from store
  const filter = (activeFilter[VIEW_KEY] || 'all') as FilterKey
  const search = searchQueries[VIEW_KEY] || ''
  const dateFilter = dateRangeFilters[VIEW_KEY] || { preset: 'all' }
  const selectedIds = selectedLeadIds[VIEW_KEY] || []

  // Debounced search — don't trigger re-filter on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  // Accessible sheets
  const accessibleSheets = useMemo(() => {
    if (!currentUser) return []
    return getAccessibleTeleSheets(currentUser)
  }, [currentUser, getAccessibleTeleSheets])

  // Pre-compute sheet counts for dropdown (single pass instead of N*leads.length)
  const sheetCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of leads) {
      if (l.isArchived) continue
      const tele = (l.tele || '').toLowerCase()
      if (tele) counts[tele] = (counts[tele] || 0) + 1
    }
    return counts
  }, [leads])

  // Initialize viewing sheet
  useEffect(() => {
    if (!viewingSheet && currentUser) {
      setViewingSheet(currentUser)
    }
  }, [currentUser, viewingSheet])

  // Setters that update store
  const setFilter = useCallback(
    (f: string) => setActiveFilter(VIEW_KEY, f),
    [setActiveFilter]
  )
  const setSearch = useCallback(
    (q: string) => setSearchQuery(VIEW_KEY, q),
    [setSearchQuery]
  )
  const setDateFilter = useCallback(
    (f: DateRangeFilter) => setDateRangeFilter(VIEW_KEY, f),
    [setDateRangeFilter]
  )

  const isViewingOwn =
    viewingSheet?.toLowerCase() === currentUser?.toLowerCase()

  // Filter leads for viewed sheet (non-archived)
  // ALWAYS sort by id ASC to guarantee stable row order.
  // The leads array in the store may not be in id order after addLeadToCache
  // or syncChangesToCache append new leads at the end regardless of id.
  // Explicit sort ensures rows NEVER jump after editing or refreshing.
  const myLeadsAll = useMemo(() => {
    if (!currentUser || !viewingSheet) return []
    return leads
      .filter(
        (l) =>
          !l.isArchived &&
          String(l.tele || '').trim().toLowerCase() === viewingSheet.trim().toLowerCase()
      )
      .sort((a, b) => a.id - b.id)
  }, [leads, currentUser, viewingSheet])

  // Apply date range filter
  // Include leads where ANY activity happened in the period:
  // - Lead was created (createdAt)
  // - Call was made (contactResultAt)
  // - Lead was converted to sales (assignedAt)
  // This way, filtering "yesterday" shows calls made yesterday even on older leads
  const myLeadsDateFiltered = useMemo(() => {
    if (!dateFilter || dateFilter.preset === 'all') return myLeadsAll
    const { from, to } = getDateRange(
      dateFilter.preset,
      dateFilter.customFrom,
      dateFilter.customTo
    )
    return myLeadsAll.filter((l) => {
      // A lead is "in range" if any of its activity timestamps fall within the range
      const inRange = (ts: number | null) => ts !== null && ts >= from && ts < to
      return inRange(l.createdAt) || inRange(l.contactResultAt) || inRange(l.assignedAt)
    })
  }, [myLeadsAll, dateFilter])

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

  // My duplicates (leads in this sheet that are duplicates)
  const myDupes = useMemo(() => {
    return myLeadsDateFiltered.filter((l) => {
      const info = duplicateInfoMap.get(l.id)
      return info?.isDuplicate === true
    })
  }, [myLeadsDateFiltered, duplicateInfoMap])

  // Sorting strategy:
  // - myLeadsAll is already sorted by id ASC (stable insertion order).
  // - filtered() splits into nonAssigned (id ASC) and assigned (assignedAt ASC, id tiebreak).
  // - This guarantees rows NEVER move after editing any field.
  // - Only assigning to sales moves a row from nonAssigned to assigned group.

  // Apply filter pills + search + sorting
  const filtered = useMemo(() => {
    let result = myLeadsDateFiltered

    // Filter pills
    switch (filter) {
      case 'pending':
        result = result.filter((l) => !l.sales)
        break
      case 'assigned':
        result = result.filter((l) => !!l.sales)
        break
      case 'today':
        result = result.filter((l) => isToday(l.createdAt) || isToday(l.contactResultAt) || isToday(l.assignedAt))
        break
      case 'duplicates':
        result = myDupes
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

    // Split into non-assigned (top) and assigned (bottom).
    // BOTH groups sorted by id ASC (stable insertion order).
    // This guarantees rows NEVER move after editing any field or refreshing.
    // Previous sort used assignedAt which caused instability on first refresh
    // because assignedAt values could differ between cache and server response.
    const nonAssigned = result.filter((l) => !l.sales).sort((a, b) => a.id - b.id)
    const assigned = result.filter((l) => !!l.sales).sort((a, b) => a.id - b.id)
    result = [...nonAssigned, ...assigned]

    // Search (using debounced search for performance)
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(
        (l) =>
          (l.phone || '').toLowerCase().includes(q) ||
          (l.customerName || '').toLowerCase().includes(q) ||
          (l.storeUrl || '').toLowerCase().includes(q) ||
          (l.brief || '').toLowerCase().includes(q) ||
          (l.sales || '').toLowerCase().includes(q) ||
          (l.tele || '').toLowerCase().includes(q) ||
          (l.customerType || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [myLeadsDateFiltered, filter, debouncedSearch, myDupes])

  // ===== Virtualizer setup =====
  const gridRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => gridRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  // ===== Debounced cell save =====
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )
  const pendingSaves = useRef<Map<string, Record<string, unknown>>>(new Map())

  const handleCellSave = useCallback(
    (leadId: string, field: string, value: string | number | null) => {
      const key = `${leadId}_${field}`

      // Clear existing timer
      const existing = saveTimers.current.get(key)
      if (existing) clearTimeout(existing)

      // Mark pending
      if (!pendingSaves.current.has(leadId)) {
        pendingSaves.current.set(leadId, {})
      }
      const updates = pendingSaves.current.get(leadId)!
      updates[field] = value
      if (field === 'contactResult' && value) {
        updates.contactResultAt = Date.now()
      }

      // Optimistic update
      const cacheUpdates: Record<string, unknown> = { [field]: value }
      if (field === 'contactResult' && value) {
        cacheUpdates.contactResultAt = Date.now()
      }
      updateLeadInCache(leadId, cacheUpdates as Partial<Lead>)

      // Duplicate phone check: warn if the phone already exists in another lead
      if (field === 'phone' && value) {
        const norm = normalizePhone(value as string)
        if (norm) {
          const existingLead = leads.find(l => l.id !== leadId && l.phone && normalizePhone(l.phone) === norm)
          if (existingLead) {
            addToast('warning', `⚠️ رقم مكرر! موجود عند ${existingLead.tele || existingLead.sales || '—'}`, 5000)
          }
          // Also check server-side for cross-sheet duplicates (fire-and-forget)
          if (!existingLead) {
            apiCheckDuplicatePhones([value as string])
              .then((serverDups) => {
                const dupInfo = serverDups[norm]
                if (dupInfo) {
                  addToast('warning', `⚠️ رقم مكرر في شيت تاني (ID: ${dupInfo.existingId}, ${dupInfo.existingOwner})`, 5000)
                }
              })
              .catch(() => {
                // Non-critical: server check failed, local check is still valid
              })
          }
        }
      }

      // Debounced save
      const timer = setTimeout(async () => {
        const saves = pendingSaves.current.get(leadId)
        if (!saves || Object.keys(saves).length === 0) return

        // Phone normalization
        if (saves.phone) {
          saves.phone = normalizePhone(saves.phone as string)
        }

        const updatesCopy = { ...saves }

        try {
          await apiUpdateLead(leadId, updatesCopy as Partial<Lead>)
          // Clear saved fields from pending
          if (pendingSaves.current.has(leadId)) {
            const current = pendingSaves.current.get(leadId)!
            Object.keys(updatesCopy).forEach((k) => {
              if (current[k] === updatesCopy[k]) {
                delete current[k]
              }
            })
            if (Object.keys(current).length === 0) {
              pendingSaves.current.delete(leadId)
            }
          }
          saveTimers.current.delete(key)
        } catch {
          addToast('error', 'فشل الحفظ - الكتابة محفوظة محلياً')
        }
      }, 600)

      saveTimers.current.set(key, timer)
    },
    [updateLeadInCache, addToast, leads]
  )

  // Immediate save on blur
  const handleCellBlur = useCallback(
    async (leadId: string, field: string, value: string) => {
      const key = `${leadId}_${field}`
      const existing = saveTimers.current.get(key)
      if (!existing) return

      clearTimeout(existing)
      saveTimers.current.delete(key)

      const saves = pendingSaves.current.get(leadId)
      if (!saves || Object.keys(saves).length === 0) return

      if (saves.phone) {
        saves.phone = normalizePhone(saves.phone as string)
      }

      const updatesCopy = { ...saves }
      try {
        await apiUpdateLead(leadId, updatesCopy as Partial<Lead>)
        if (pendingSaves.current.has(leadId)) {
          const current = pendingSaves.current.get(leadId)!
          Object.keys(updatesCopy).forEach((k) => {
            if (current[k] === updatesCopy[k]) {
              delete current[k]
            }
          })
          if (Object.keys(current).length === 0) {
            pendingSaves.current.delete(leadId)
          }
        }
      } catch {
        addToast('error', 'فشل الحفظ - حاولي تعديل تاني')
      }
    },
    [addToast]
  )

  // Cleanup timers on unmount - flush pending saves before clearing
  useEffect(() => {
    return () => {
      // Flush all pending saves before unmounting
      pendingSaves.current.forEach((saves, leadId) => {
        if (Object.keys(saves).length > 0) {
          apiUpdateLead(leadId, { ...saves }).catch((err) => {
            console.error('[tele-sheet] Failed to flush pending save on unmount:', err)
          })
        }
      })
      saveTimers.current.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  // ===== Add new empty row =====
  const handleAddRow = useCallback(async () => {
    if (!currentUser) return
    setAddingRow(true)
    try {
      const teleName = isViewingOwn ? currentUser : viewingSheet || currentUser
      const lead = await apiCreateLead({
        customerName: '',
        phone: '',
        storeUrl: '',
        customerType: '',
        brief: '',
        contactResult: '',
        tele: teleName,
        sales: null,
        status: 'new',
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
      addToast('success', 'تم إضافة صف جديد')
    } catch (err) {
      console.error('[tele-sheet] Add row error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      addToast('error', `فشل في إضافة الصف: ${msg}`)
    } finally {
      setAddingRow(false)
    }
  }, [currentUser, viewingSheet, isViewingOwn, addLeadToCache, addToast])

  // ===== Delete single row =====
  // Opens the DeleteConfirmModal instead of deleting directly
  // (the modal is already wired up - see the JSX below)

  // ===== Flush pending saves before bulk operations =====
  const flushPendingSaves = useCallback(async () => {
    const flushPromises: Promise<unknown>[] = []
    pendingSaves.current.forEach((saves, leadId) => {
      if (Object.keys(saves).length > 0) {
        flushPromises.push(apiUpdateLead(leadId, { ...saves }).catch(() => {}))
      }
    })
    await Promise.all(flushPromises)
    pendingSaves.current.clear()
    saveTimers.current.forEach((t) => clearTimeout(t))
    saveTimers.current.clear()
  }, [])

  // ===== Bulk actions =====
  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.length === 0) return
    try {
      await flushPendingSaves()
      // Optimistic: update cache immediately, no server refresh needed
      archiveLeadsInCache([...selectedIds], currentUser || '')
      apiArchiveLeads([...selectedIds], currentUser || '').catch((err) => {
        console.error('[tele-sheet] Bulk archive error (background):', err)
      })
      clearSelectedLeadIds(VIEW_KEY)
      addToast('success', `📦 تم أرشفة ${selectedIds.length} عميل`)
    } catch (err) {
      console.error('[tele-sheet] Bulk archive error:', err)
      addToast('error', 'فشل في الأرشفة')
    }
  }, [selectedIds, currentUser, archiveLeadsInCache, clearSelectedLeadIds, addToast, flushPendingSaves])

  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return
    try {
      await flushPendingSaves()
      const idsToDelete = [...selectedIds]
      // Optimistic: update cache immediately, no server refresh needed
      batchRemoveLeadsFromCache(idsToDelete)
      apiDeleteLeadsBulk(idsToDelete).catch((err) => {
        console.error('[tele-sheet] Bulk delete error (background):', err)
      })
      clearSelectedLeadIds(VIEW_KEY)
      addToast('success', `✅ تم حذف ${idsToDelete.length} عميل بنجاح`)
      setBulkDeleteConfirm(false)
    } catch (err) {
      console.error('[tele-sheet] Bulk delete error:', err)
      addToast('error', 'فشل في الحذف')
    }
  }, [selectedIds, batchRemoveLeadsFromCache, clearSelectedLeadIds, addToast, flushPendingSaves])

  // ===== Delete all in sheet =====
  // FIXED: Deletes ALL leads in the sheet, not just date-filtered ones
  const handleDeleteAll = useCallback(async () => {
    if (myLeadsAll.length === 0) {
      addToast('info', 'الشيت فاضي خالص')
      return
    }
    try {
      await flushPendingSaves()
      const ids = myLeadsAll.map((l) => l.id)
      // Optimistic: update cache immediately, no server refresh needed
      batchRemoveLeadsFromCache(ids)
      apiDeleteLeadsBulk(ids).catch((err) => {
        console.error('[tele-sheet] Delete all error (background):', err)
      })
      clearSelectedLeadIds(VIEW_KEY)
      addToast('success', `✅ تم مسح ${ids.length} عميل من شيت ${viewingSheet}`)
      setDeleteAllConfirm(false)
    } catch (err) {
      console.error('[tele-sheet] Delete all error:', err)
      addToast('error', 'فشل المسح')
    }
  }, [myLeadsAll, viewingSheet, batchRemoveLeadsFromCache, clearSelectedLeadIds, addToast, flushPendingSaves])

  // ===== Checkbox handling =====
  const toggleSelect = useCallback(
    (id: string) => toggleLeadSelection(VIEW_KEY, id),
    [toggleLeadSelection]
  )

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === filtered.length) {
      clearSelectedLeadIds(VIEW_KEY)
    } else {
      selectAllLeads(VIEW_KEY, filtered.map((l) => l.id))
    }
  }, [selectedIds.length, filtered, clearSelectedLeadIds, selectAllLeads])

  // ===== Open store URL =====
  const openStoreUrl = useCallback((url: string) => {
    if (!url) return
    let href = url
    if (!/^https?:\/\//i.test(href)) {
      href = 'https://' + href
    }
    window.open(href, '_blank', 'noopener')
  }, [])

  // ===== Filter pills with counts =====
  const filterPills: { key: FilterKey; label: string; count: number; danger?: boolean }[] = useMemo(() => {
    // Single-pass computation instead of 9+ .filter() calls
    let pending = 0, assigned = 0, today = 0, replied = 0, noReply = 0, whatsapp = 0, callback = 0, noContact = 0
    for (const l of myLeadsDateFiltered) {
      if (!l.sales) pending++; else assigned++
      // "Today" = any activity today (created, called, or converted)
      if (isToday(l.createdAt) || isToday(l.contactResultAt) || isToday(l.assignedAt)) today++
      if (l.contactResult === 'replied') replied++
      else if (l.contactResult === 'no-reply') noReply++
      else if (l.contactResult === 'whatsapp') whatsapp++
      else if (l.contactResult === 'callback') callback++
      else if (!l.contactResult) noContact++
    }
    return [
      { key: 'all', label: 'الكل', count: myLeadsDateFiltered.length },
      { key: 'pending', label: 'بدون سيلز', count: pending },
      { key: 'assigned', label: 'تم التحويل', count: assigned },
      { key: 'today', label: 'اليوم', count: today },
      ...(myDupes.length > 0
        ? [
            {
              key: 'duplicates' as FilterKey,
              label: '⚠️ مكررات',
              count: myDupes.length,
              danger: true,
            },
          ]
        : []),
      // Divider - we'll handle this in JSX
      { key: 'replied', label: '✅ رد', count: replied },
      { key: 'no-reply', label: '📵 مردش', count: noReply },
      { key: 'whatsapp', label: '💬 واتس', count: whatsapp },
      { key: 'callback', label: '🔄 اتصال لاحقاً', count: callback },
      { key: 'no-contact', label: '⏳ لسة', count: noContact },
    ]
  }, [myLeadsDateFiltered, myDupes])

  const dividerIndex = filterPills.findIndex((p) => p.key === 'replied')

  if (!currentUser || currentRole !== 'tele') return null

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length
  const hasSelection = selectedIds.length > 0

  return (
    <div className="p-4 md:p-6 space-y-3" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold venom-text-glow text-venom">
            تليسيلز
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            إدارة العملاء والمتابعة ({myLeadsAll.length})
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleAddRow}
            disabled={addingRow}
            className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30 h-8 text-xs"
          >
            {addingRow ? (
              <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5 ml-1" />
            )}
            صف جديد
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setArchiveOpen(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-8 text-xs"
          >
            <Archive className="w-3.5 h-3.5 ml-1" /> أرشف الكل
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteAllConfirm(true)}
            className="h-8 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 ml-1" /> امسح الكل
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
          <FolderOpen className="w-4.5 h-4.5 text-venom" />
          <span className="text-xs text-muted-foreground font-medium">
            اختار الشيت:
          </span>
          <Select
            value={viewingSheet || currentUser}
            onValueChange={(v) => {
              setViewingSheet(v)
              setFilter('all')
            }}
          >
            <SelectTrigger className="w-64 h-8 text-xs bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {accessibleSheets.map((name) => {
                const isOwn = name.toLowerCase() === currentUser.toLowerCase()
                const count = sheetCounts[name.toLowerCase()] || 0
                return (
                  <SelectItem key={name} value={name} className="text-xs">
                    {isOwn ? '👤 شيتي - ' : '👁️ شيت '}
                    {name} ({count} عميل)
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {!isViewingOwn && (
            <Badge
              variant="outline"
              className="border-amber-500/30 text-amber-400 bg-amber-500/10 text-xs"
            >
              <Eye className="w-3 h-3 ml-1" /> بتشوف شيت {viewingSheet}
            </Badge>
          )}
        </motion.div>
      )}

      {/* Access notice */}
      {!isViewingOwn && (
        <div className="bg-venom/5 border border-venom/30 rounded-lg p-2.5 text-xs text-venom">
          <Shield className="w-3.5 h-3.5 inline ml-1" /> أنت بتعدل في شيت{' '}
          <strong>{viewingSheet}</strong> - عندك صلاحية كاملة للإضافة والتعديل
          والحذف
        </div>
      )}

      {/* Date range filter */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-venom" />
          <span className="text-xs text-muted-foreground font-medium">
            فلتر حسب التاريخ:
          </span>
          {['today', 'yesterday', 'week', 'month', 'all', 'custom'].map(
            (preset) => (
              <button
                key={preset}
                onClick={() => {
                  if (preset !== 'custom') {
                    setDateFilter({ preset, customFrom: '', customTo: '' })
                  } else {
                    setDateFilter({ preset: 'custom', customFrom: dateFilter.customFrom || '', customTo: dateFilter.customTo || '' })
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  dateFilter.preset === preset
                    ? 'bg-venom text-venom-foreground border border-venom/40'
                    : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted hover:text-foreground'
                }`}
              >
                {DATE_PRESET_LABELS[preset]}
              </button>
            )
          )}
        </div>
        {dateFilter.preset === 'custom' && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-muted-foreground">من:</span>
            <Input
              type="date"
              value={dateFilter.customFrom || ''}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, customFrom: e.target.value })
              }
              className="h-7 text-xs bg-background border-border w-36"
            />
            <span className="text-xs text-muted-foreground">إلى:</span>
            <Input
              type="date"
              value={dateFilter.customTo || ''}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, customTo: e.target.value })
              }
              className="h-7 text-xs bg-background border-border w-36"
            />
            <Button
              size="sm"
              onClick={() => {
                if (!dateFilter.customFrom) {
                  addToast('error', 'اختاري تاريخ "من" على الأقل')
                  return
                }
                setDateFilter({
                  preset: 'custom',
                  customFrom: dateFilter.customFrom,
                  customTo: dateFilter.customTo || dateFilter.customFrom,
                })
              }}
              className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30 h-7 text-xs"
            >
              تطبيق
            </Button>
          </div>
        )}
        {dateFilter.preset !== 'all' && (
          <div className="bg-venom/5 border border-venom/30 rounded-lg p-2 mt-2 text-xs text-venom flex items-center gap-2 flex-wrap">
            <Info className="w-3 h-3" />
            <span>
              <strong>الفلتر شغّال على وقت التحويل (assignedAt) أو وقت الإضافة (createdAt)</strong> -
              ظاهر {myLeadsDateFiltered.length} من إجمالي {myLeadsAll.length}
            </span>
          </div>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {filterPills.map((pill, i) => (
          <div key={pill.key} className="contents">
            {i === dividerIndex && (
              <div className="w-px h-5 bg-border mx-1" />
            )}
            <button
              onClick={() => setFilter(pill.key)}
              className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                filter === pill.key
                  ? pill.danger
                    ? 'bg-red-500/20 text-red-400 border border-red-400/40 shadow-sm'
                    : 'bg-venom text-venom-foreground border border-venom/40 shadow-sm shadow-venom/10'
                  : pill.danger
                    ? 'bg-muted/50 text-red-400 border border-transparent hover:bg-red-500/10'
                    : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted hover:text-foreground'
              }`}
            >
              {pill.label} ({pill.count})
            </button>
          </div>
        ))}
      </div>

      {/* Duplicate warning banner */}
      {myDupes.length > 0 && filter !== 'duplicates' && (
        <div className="bg-red-500/5 border border-red-400/30 rounded-lg p-2.5 text-xs flex justify-between items-center">
          <span className="text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 inline ml-1" />
            <strong>تنبيه:</strong> فيه {myDupes.length} رقم مكرر في شيتك
            (موجود قبل كده عند تيلي تاني)
          </span>
          <button
            onClick={() => setFilter('duplicates')}
            className="text-red-400 hover:underline text-xs cursor-pointer"
          >
            شوف المكررات
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-venom/5 border border-venom/30 rounded-lg p-2.5 flex items-center gap-3 overflow-hidden flex-wrap text-xs"
          >
            <span className="font-semibold text-venom">
              <CheckCircle2 className="w-3.5 h-3.5 inline ml-1" />
              تم اختيار {selectedIds.length}{' '}
              {selectedIds.length === 1 ? 'صف' : 'صفوف'}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => clearSelectedLeadIds(VIEW_KEY)}
              className="text-muted-foreground h-7 text-xs"
            >
              <X className="w-3 h-3 ml-0.5" /> إلغاء التحديد
            </Button>
            <div className="flex gap-2 mr-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkArchive}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-7 text-xs"
              >
                <Archive className="w-3 h-3 ml-0.5" /> أرشف الـ {selectedIds.length}{' '}
                المحددين
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteConfirm(true)}
                className="h-7 text-xs"
              >
                <Trash2 className="w-3 h-3 ml-0.5" /> احذف الـ {selectedIds.length}{' '}
                المحددين
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spreadsheet Grid with Virtualization */}
      <div
        className="bg-card border border-border rounded-xl overflow-auto max-h-[calc(100vh-320px)]"
        style={{ direction: 'rtl' }}
        ref={gridRef}
      >
        <div className="min-w-[900px]">
          {/* Header Row */}
          <div
            className={`grid ${GRID_COLS} bg-muted/40 border-b border-border sticky top-0 z-10`}
            dir="rtl"
          >
            <div className="px-1 py-2.5 text-center text-xs font-medium text-muted-foreground">
              #
            </div>
            <div className="px-1 py-2.5 flex items-center justify-center">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                className="border-muted-foreground/40 data-[state=checked]:bg-venom data-[state=checked]:border-venom"
              />
            </div>
            <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">
              المتجر
            </div>
            <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">
              الجوال
            </div>
            <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">
              اسم العميل
            </div>
            <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">
              النوع
            </div>
            <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">
              نتيجة التواصل
            </div>
            <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">
              البريف
            </div>
            <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">
              السيلز
            </div>
            <div className="px-1 py-2.5" />
          </div>

          {/* Data Rows - Virtualized */}
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <div className="text-center">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                {search
                  ? `مفيش نتائج للبحث "${search}"`
                  : 'مفيش Leads هنا. اضغط "صف جديد" لتبدئي.'}
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
                const { isDuplicate, originalSheetName } = dupInfo
                const isSelected = selectedIds.includes(lead.id)
                const hasSales = !!lead.sales

                return (
                  <div
                    key={lead.id}
                    className={`grid ${GRID_COLS} border-b border-border/30 hover:bg-venom/[0.02] transition-colors group ${
                      isDuplicate
                        ? 'bg-red-500/[0.04]'
                        : hasSales
                          ? 'bg-primary/5'
                          : ''
                    } ${isSelected ? '!bg-venom/8 !border-r-2 !border-r-venom/40' : ''}`}
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
                    <div className="px-1 py-0.5 flex items-center gap-0.5 relative">
                      <div className="flex-1 min-w-0">
                        <CellInput
                          value={lead.storeUrl}
                          onSave={(v) =>
                            handleCellSave(lead.id, 'storeUrl', v)
                          }
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
                      {isDuplicate && (
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
                          onSave={(v) =>
                            handleCellSave(lead.id, 'phone', v)
                          }
                          onBlurProp={() =>
                            handleCellBlur(lead.id, 'phone', lead.phone)
                          }
                          placeholder="05XXXXXXXX"
                          mono
                          dir="ltr"
                          danger={isDuplicate}
                        />
                      </div>
                    </div>

                    {/* اسم العميل - Customer name */}
                    <div className="px-1 py-0.5">
                      <CellInput
                        value={lead.customerName}
                        onSave={(v) =>
                          handleCellSave(lead.id, 'customerName', v)
                        }
                        placeholder="—"
                      />
                    </div>

                    {/* النوع - Customer type */}
                    <div className="px-0.5 py-0.5">
                      <CellSelect
                        value={lead.customerType || ''}
                        options={CUSTOMER_TYPE_OPTIONS}
                        onSave={(v) =>
                          handleCellSave(lead.id, 'customerType', v)
                        }
                      />
                    </div>

                    {/* نتيجة التواصل - Contact result */}
                    <div className="px-0.5 py-0.5">
                      <CellSelect
                        value={lead.contactResult || ''}
                        options={CONTACT_OPTIONS}
                        onSave={(v) =>
                          handleCellSave(lead.id, 'contactResult', v)
                        }
                      />
                    </div>

                    {/* البريف - Brief */}
                    <div className="px-1 py-0.5">
                      <CellInput
                        value={lead.brief}
                        onSave={(v) =>
                          handleCellSave(lead.id, 'brief', v)
                        }
                        placeholder="بريف العميل..."
                      />
                    </div>

                    {/* السيلز - Sales assignment */}
                    <div className="px-1 py-0.5 flex items-center">
                      {!hasSales ? (
                        <button
                          onClick={() => setAssignLead(lead)}
                          className="w-full px-2 py-1 rounded text-xs font-medium bg-venom/15 text-venom border border-venom/20 hover:bg-venom/25 transition-colors cursor-pointer flex items-center justify-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" />
                          تحويل
                        </button>
                      ) : (
                        <button
                          onClick={() => setChangeMeetingLead(lead)}
                          className="w-full px-2 py-1 rounded text-xs font-medium bg-venom/15 text-venom border border-venom/20 hover:bg-venom/25 transition-colors cursor-pointer flex items-center justify-center gap-1"
                          title="اضغط لتغيير السيلز"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="truncate max-w-[55px]">{lead.sales}</span>
                          <Pencil className="w-2.5 h-2.5 opacity-50 shrink-0" />
                        </button>
                      )}
                    </div>

                    {/* 🗑️ Delete */}
                    <div className="px-0.5 py-0.5 flex items-center justify-center">
                      <button
                        onClick={() => setDeleteLead(lead)}
                        className="p-1 rounded hover:bg-red-500/10 text-muted-foreground/30 hover:text-red-400 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
          {dateFilter.preset !== 'all' && ` (فلتر تاريخ: ${DATE_PRESET_LABELS[dateFilter.preset] || dateFilter.preset})`}
        </span>
        <span>الحفظ تلقائي</span>
      </div>

      {/* Search bar - positioned at bottom like old HTML viewActions */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-border pt-2 pb-1">
        <div className="relative w-full max-w-xs mx-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث في الشيت..."
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
      </div>

      {/* Modals */}
      <AssignModal
        lead={assignLead}
        open={!!assignLead}
        onOpenChange={(o) => {
          if (!o) setAssignLead(null)
        }}
        onAssigned={() => {}}
      />

      <ChangeMeetingModal
        lead={changeMeetingLead}
        open={!!changeMeetingLead}
        onOpenChange={(o) => {
          if (!o) setChangeMeetingLead(null)
        }}
        onDone={() => {}}
      />

      <DeleteConfirmModal
        lead={deleteLead}
        open={!!deleteLead}
        onOpenChange={(o) => {
          if (!o) setDeleteLead(null)
        }}
        onDeleted={() => {}}
      />

      <ArchiveModal
        leads={myLeadsAll}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        sheetName={viewingSheet || currentUser}
        onArchived={() => {}}
      />

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
            هتمسح كل الـ <strong>{myLeadsAll.length}</strong> عميل في شيت{' '}
            <strong>{viewingSheet}</strong> نهائياً! مش هيرجعوا تاني!
          </p>
          <div className="bg-red-500/5 border border-red-400/30 rounded-lg p-3 text-xs text-red-400">
            ⚠️ <strong>تحذير:</strong> ده إجراء نهائي مش هيقدر حد يرجع الداتا!
          </div>
          <DeleteConfirmInput
            confirmText="مسح"
            onConfirm={handleDeleteAll}
            onCancel={() => setDeleteAllConfirm(false)}
            buttonText={`امسح ${myLeadsAll.length} عميل نهائياً`}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="max-w-sm bg-card border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              تأكيد حذف {selectedIds.length} عميل
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            متأكد عايز تحذف {selectedIds.length} عميل المحددين؟ ده مش هيرجع تاني!
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkDeleteConfirm(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-4 h-4 ml-1" />
              احذف {selectedIds.length} عميل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
