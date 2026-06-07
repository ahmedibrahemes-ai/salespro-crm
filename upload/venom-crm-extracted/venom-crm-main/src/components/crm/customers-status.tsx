'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Search,
  Download,
  Eye,
  MessageSquarePlus,
  Info,
  Users,
  CheckCircle2,
  Clock,
  Handshake,
  UserCircle,
  Trash2,
  Loader2,
  X,
  Pencil,
  Check,
} from 'lucide-react'
import {
  useCrmStore,
  SALES_STATUSES,
  STATUSES,
  formatDate,
  formatRelativeTime,
} from '@/lib/store'
import { apiUpdateLead, apiAddNote, apiDeleteNote, apiUpdateNote } from '@/lib/supabase'
import type { Lead, LeadNote } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

// ===== View Key for store state =====
const VIEW_KEY = 'customers-status'

// ===== Grid column template for virtual scrolling =====
const GRID_COLS = 'grid-cols-[40px_1.2fr_120px_130px_160px_250px_100px_80px]'

// ===== Note Category Templates =====
const NOTE_TEMPLATES: Record<string, string[]> = {
  meeting: [
    '✅ الاجتماع تم بنجاح والعميل تفاعل بشكل ممتاز',
    '⚠️ اجتماع قصير - مفيش وقت كافي',
    '🤝 العميل مهتم جداً وطلب عرض سعر',
    '🔄 طلب اجتماع تاني مع المدير',
    '❌ تأخر العميل ساعة عن الاجتماع',
    '⚡ تم شرح كل الخدمات والعميل عنده استفسارات',
    '📋 طلب وقت يفكر ويرجعلنا',
  ],
  customer: [
    '💰 ميزانية محدودة - يحتاج خطة مرنة',
    '🛒 عنده متجر شغال ومحتاج تطوير',
    '🆕 بيبدأ من الصفر ومحتاج توجيه كامل',
    '📊 طلب تقارير شهرية مفصلة',
    '🎯 مهتم بخدمة معينة فقط',
    '🤔 العميل متردد ومحتاج إقناع',
    '⭐ عميل VIP - أولوية قصوى',
  ],
  followup: [
    '📞 يحتاج call تاني خلال 24 ساعة',
    '💬 تواصل واتس - بانتظار الرد',
    '📤 تم إرسال عرض سعر - بانتظار الرد',
    '⏰ موعد متابعة الأسبوع الجاي',
    '🚫 توقف عن الرد - محتاج follow-up حازم',
    '✅ متفقين على البدء قريباً',
    '📝 طلب يشوف نماذج شغل سابق',
  ],
  other: [
    'محتاج تأكيد من الإدارة',
    'تم تحويل العميل لقسم تاني',
    'مشكلة فنية في التواصل',
    'العميل من توصية عميل سابق',
  ],
}

const CAT_LABELS: Record<string, string> = {
  meeting: '🎥 [اجتماع]',
  customer: '👤 [عميل]',
  followup: '🔄 [متابعة]',
  other: '📝',
}

// ===== InlineEdit Component =====
function InlineEdit({ value, onSave, canEdit, className, type }: {
  value: string
  onSave: (val: string) => void
  canEdit: boolean
  className?: string
  type?: 'text' | 'tel'
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  if (!canEdit || !editing) {
    return (
      <span
        className={`cursor-pointer ${canEdit ? 'hover:bg-venom/10 hover:rounded px-0.5 -mx-0.5 transition-colors' : ''} ${className || ''}`}
        onDoubleClick={() => {
          if (canEdit) {
            setEditValue(value)
            setEditing(true)
          }
        }}
        title={canEdit ? '\u062F\u0628\u0644 \u0643\u0644\u064A\u0643 \u0644\u0644\u062A\u0639\u062F\u064A\u0644' : undefined}
      >
        {value || '\u2014'}
        {canEdit && !editing && (
          <Pencil className="w-2.5 h-2.5 inline-block mr-1 opacity-0 group-hover:opacity-40 transition-opacity" />
        )}
      </span>
    )
  }

  return (
    <Input
      type={type || 'text'}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={() => {
        onSave(editValue)
        setEditing(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSave(editValue)
          setEditing(false)
        }
        if (e.key === 'Escape') {
          setEditing(false)
        }
      }}
      autoFocus
      className="h-7 text-xs bg-background border-venom/40"
    />
  )
}

// ===== Helper: effective status key =====
function effStatus(lead: Lead): string {
  return lead.salesStatus || lead.status || 'new'
}

// ===== Helper: truncate =====
function truncate(str: string, max: number): string {
  if (!str) return ''
  return str.length > max ? str.substring(0, max) + '...' : str
}

// ===== Main Component =====
export function CustomersStatus() {
  const {
    currentUser,
    currentRole,
    leads,
    team,
    salesAccess,
    canAccessSalesSheet,
    getAccessibleSalesSheets,
    addToast,
    updateLeadInCache,
    activeFilter,
    setActiveFilter,
    searchQueries,
    setSearchQuery,
  } = useCrmStore()

  // Local state
  const [selectedSheet, setSelectedSheet] = useState<string>(currentUser || '')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [noteModalLeadId, setNoteModalLeadId] = useState<string | null>(null)

  // Note modal state
  const [noteCat, setNoteCat] = useState<string>('meeting')
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  // Note edit state (detail modal)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')

  // Search from store
  const search = searchQueries[VIEW_KEY] || ''
  const statusFilter = activeFilter[VIEW_KEY] || 'all'

  // ===== Accessible Sheets =====
  const accessibleSheets = useMemo(() => {
    if (!currentUser) return []
    return getAccessibleSalesSheets(currentUser)
  }, [currentUser, getAccessibleSalesSheets])

  // ===== Selected sheet validation =====
  const validSheet = useMemo(() => {
    if (!currentUser) return ''
    const lower = String(selectedSheet).toLowerCase()
    if (accessibleSheets.map((s) => String(s).toLowerCase()).includes(lower)) {
      return selectedSheet
    }
    return currentUser
  }, [selectedSheet, accessibleSheets, currentUser])

  const isViewingOwn = String(validSheet).toLowerCase() === String(currentUser || '').toLowerCase()

  // ===== Filter leads to "my customers" =====
  const myCustomersAll = useMemo(() => {
    if (!currentUser || currentRole !== 'sales') return []
    const viewingSheetLower = String(validSheet).toLowerCase()

    return leads.filter((l) => {
      if (!l.sales || String(l.sales).trim().toLowerCase() !== viewingSheetLower) return false

      // Condition 1: ALL leads from tele (all meetings regardless of attendance)
      if (l.tele) return true

      // Condition 2: leads from own sales sheet (no tele) and replied
      if (!l.tele && l.contactResult === 'replied') return true

      // Condition 3: leads from own sales sheet (no tele) and whatsapp
      if (!l.tele && l.contactResult === 'whatsapp') return true

      return false
    })
  }, [leads, currentUser, currentRole, validSheet])

  // Stable position map - prevents row jumping on updates
  const customerPositionMap = useMemo(() => {
    const map = new Map<number, number>()
    myCustomersAll.forEach((l, i) => map.set(l.id, i))
    return map
  }, [myCustomersAll])

  const myCustomers = useMemo(() => {
    const posMap = customerPositionMap
    return [...myCustomersAll].sort((a, b) => (posMap.get(a.id) ?? 0) - (posMap.get(b.id) ?? 0))
  }, [myCustomersAll, customerPositionMap])

  // ===== Stats =====
  const stats = useMemo(() => {
    const all = myCustomers.length
    const attendedCount = myCustomers.filter((l) => l.attended === 'attended').length
    const pendingAttCount = myCustomers.filter(
      (l) => l.attended === null || l.attended === undefined || l.attended === 'pending'
    ).length
    const negotiationCount = myCustomers.filter((l) =>
      ['negotiation', 'proposal-sent', 'followup'].includes(effStatus(l))
    ).length

    return {
      all,
      attended: attendedCount,
      pending: pendingAttCount,
      negotiation: negotiationCount,
      new: myCustomers.filter((l) => effStatus(l) === 'new').length,
      'no-reply': myCustomers.filter((l) => effStatus(l) === 'no-reply').length,
      whatsapp: myCustomers.filter((l) => effStatus(l) === 'whatsapp').length,
      followup: myCustomers.filter((l) => effStatus(l) === 'followup').length,
      'meeting-done': myCustomers.filter((l) => effStatus(l) === 'meeting-done').length,
      objection: myCustomers.filter((l) =>
        ['objection-price', 'objection-other'].includes(effStatus(l))
      ).length,
      'proposal-sent': myCustomers.filter((l) => effStatus(l) === 'proposal-sent').length,
      negotiation_status: myCustomers.filter((l) => effStatus(l) === 'negotiation').length,
      'closed-won': myCustomers.filter((l) => effStatus(l) === 'closed-won').length,
      'closed-lost': myCustomers.filter((l) => effStatus(l) === 'closed-lost').length,
      noShow: myCustomers.filter((l) => l.attended === 'no-show').length,
    }
  }, [myCustomers])

  // ===== Apply filters =====
  const filtered = useMemo(() => {
    let result = myCustomers

    // Status filter
    if (statusFilter === 'attended') {
      result = result.filter((l) => l.attended === 'attended')
    } else if (statusFilter === 'no-show') {
      result = result.filter((l) => l.attended === 'no-show')
    } else if (statusFilter === 'pending-attendance') {
      result = result.filter(
        (l) => l.attended === null || l.attended === undefined || l.attended === 'pending'
      )
    } else if (statusFilter === 'objection') {
      result = result.filter((l) =>
        ['objection-price', 'objection-other'].includes(effStatus(l))
      )
    } else if (statusFilter !== 'all') {
      result = result.filter((l) => effStatus(l) === statusFilter)
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((l) => {
        return (
          (l.customerName || '').toLowerCase().includes(q) ||
          (l.phone || '').toLowerCase().includes(q) ||
          (l.storeUrl || '').toLowerCase().includes(q)
        )
      })
    }

    return result
  }, [myCustomers, statusFilter, search])

  // ===== Virtualizer =====
  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  // ===== Can edit check =====
  const canEditLead = useCallback(
    (lead: Lead): boolean => {
      if (!currentUser) return false
      if (currentRole === 'admin') return true
      if (
        currentRole === 'sales' &&
        lead.sales &&
        String(lead.sales).toLowerCase() === String(currentUser).toLowerCase()
      ) {
        return true
      }
      return false
    },
    [currentUser, currentRole]
  )

  // ===== Inline status change =====
  const handleInlineStatusChange = useCallback(
    async (leadId: string, newStatus: string) => {
      const lead = leads.find((l) => l.id === leadId)
      if (!lead) return

      if (!canEditLead(lead)) {
        addToast('error', 'مش معاك صلاحية تعديل عميل في شيت غيرك')
        return
      }

      const statusObj = SALES_STATUSES.find((s) => s.key === newStatus)
      const newStatusLabel = statusObj ? statusObj.label : newStatus

      try {
        await apiUpdateLead(leadId, { salesStatus: newStatus } as Partial<Lead>)
        updateLeadInCache(leadId, {
          salesStatus: newStatus,
          notes: [
            ...(lead.notes || []),
            {
              id: Date.now(),
              by: currentUser || '',
              cat: 'status',
              text: `🔄 الحالة اتغيرت: ${newStatusLabel}`,
              at: Date.now(),
            },
          ],
        })
        addToast('success', `✅ ${newStatusLabel}`)
      } catch {
        addToast('error', 'فشل التحديث')
      }
    },
    [leads, currentUser, canEditLead, addToast, updateLeadInCache]
  )

  // ===== Inline attendance change =====
  const handleInlineAttendanceChange = useCallback(
    async (leadId: string, newAttendance: string) => {
      const lead = leads.find((l) => l.id === leadId)
      if (!lead) return

      if (!canEditLead(lead)) {
        addToast('error', 'مش معاك صلاحية تعديل عميل في شيت غيرك')
        return
      }

      const label =
        newAttendance === 'attended'
          ? '✅ حضر'
          : newAttendance === 'no-show'
            ? '❌ لم يحضر'
            : '⏳ في الانتظار'

      const updateData: Partial<Lead> = {
        attended: newAttendance === 'pending' ? null : (newAttendance as string | null),
        attendanceMarkedAt: newAttendance !== 'pending' ? Date.now() : null,
        attendanceMarkedBy: newAttendance !== 'pending' ? currentUser : null,
      }

      try {
        await apiUpdateLead(leadId, updateData)
        updateLeadInCache(leadId, {
          ...updateData,
          notes: [
            ...(lead.notes || []),
            {
              id: Date.now(),
              by: currentUser || '',
              cat: 'meeting',
              text: `📝 الحضور: ${label}`,
              at: Date.now(),
            },
          ],
        })
        addToast('success', `✅ ${label}`)
        // Add note after successful update (non-blocking)
        apiAddNote(leadId, currentUser || '', 'meeting', `📝 الحضور: ${label}`).catch(() => {})
      } catch (err) {
        console.error('Attendance update error:', err)
        addToast('error', 'فشل التحديث')
      }
    },
    [leads, currentUser, canEditLead, addToast, updateLeadInCache]
  )

  // ===== Open detail modal =====
  const openDetail = useCallback(
    (lead: Lead) => {
      // Refresh lead data from leads array
      const freshLead = leads.find((l) => l.id === lead.id) || lead
      setDetailLead(freshLead)
      setDetailOpen(true)
    },
    [leads]
  )

  // ===== Inline field edit (customer name, phone, etc.) =====
  const handleInlineFieldEdit = useCallback(
    async (leadId: string, field: string, value: string) => {
      try {
        await apiUpdateLead(leadId, { [field]: value } as Partial<Lead>)
        updateLeadInCache(leadId, { [field]: value })
        addToast('success', '\u2705 \u062A\u0645 \u0627\u0644\u062A\u062D\u062F\u064A\u062B')
      } catch {
        addToast('error', '\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u062F\u064A\u062B')
      }
    },
    [updateLeadInCache, addToast]
  )

  // ===== Edit note handler =====
  const handleEditNote = useCallback(
    async (leadId: string, noteId: number | string, noteIndex: number, newText: string) => {
      if (!newText.trim()) {
        addToast('error', '\u0627\u0643\u062A\u0628 \u0645\u0644\u0627\u062D\u0638\u0629 \u0623\u0648\u0644')
        return
      }
      const lead = leads.find((l) => l.id === leadId)
      if (!lead) return

      try {
        await apiUpdateNote(noteId, { text: newText.trim() })
        const newNotes = (lead.notes || []).map((n, i) =>
          i === noteIndex ? { ...n, text: newText.trim() } : n
        )
        updateLeadInCache(leadId, { notes: newNotes })

        if (detailOpen && detailLead && detailLead.id === leadId) {
          setDetailLead({ ...detailLead, notes: newNotes })
        }
        setEditingNoteId(null)
        setEditingNoteText('')
        addToast('success', '\u2705 \u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629')
      } catch {
        addToast('error', '\u0641\u0634\u0644 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629')
      }
    },
    [leads, detailOpen, detailLead, addToast, updateLeadInCache]
  )

  // ===== Open add note modal =====
  const openAddNote = useCallback(
    (leadId: string) => {
      setNoteModalLeadId(leadId)
      setNoteCat('meeting')
      setNoteText('')
      setNoteModalOpen(true)
    },
    []
  )

  // ===== Save note =====
  const handleSaveNote = useCallback(async () => {
    if (!noteModalLeadId || !noteText.trim()) {
      addToast('error', 'اكتب ملاحظة الأول')
      return
    }

    const lead = leads.find((l) => l.id === noteModalLeadId)
    if (!lead) return

    setNoteSaving(true)
    try {
      const prefix = CAT_LABELS[noteCat] || '📝'
      const fullText = `${prefix} ${noteText.trim()}`

      await apiAddNote(noteModalLeadId, currentUser || '', noteCat, fullText)
      updateLeadInCache(noteModalLeadId, {
        notes: [
          ...(lead.notes || []),
          {
            id: Date.now(),
            by: currentUser || '',
            cat: noteCat,
            text: fullText,
            at: Date.now(),
          },
        ],
      })
      addToast('success', '✅ تم حفظ الملاحظة')
      setNoteModalOpen(false)
      setNoteText('')

      // If detail is open, refresh it
      if (detailOpen && detailLead && detailLead.id === noteModalLeadId) {
        setDetailLead({
          ...detailLead,
          notes: [
            ...(detailLead.notes || []),
            {
              id: Date.now(),
              by: currentUser || '',
              cat: noteCat,
              text: fullText,
              at: Date.now(),
            },
          ],
        })
      }
    } catch {
      addToast('error', '❌ فشل حفظ الملاحظة')
    } finally {
      setNoteSaving(false)
    }
  }, [noteModalLeadId, noteText, noteCat, leads, currentUser, addToast, updateLeadInCache, detailOpen, detailLead])

  // ===== Delete note =====
  const handleDeleteNote = useCallback(
    async (leadId: string, noteId: number | string, noteIndex: number) => {
      const lead = leads.find((l) => l.id === leadId)
      if (!lead) return

      try {
        await apiDeleteNote(noteId)
        const newNotes = (lead.notes || []).filter((_, i) => i !== noteIndex)
        updateLeadInCache(leadId, { notes: newNotes })

        if (detailOpen && detailLead && detailLead.id === leadId) {
          setDetailLead({ ...detailLead, notes: newNotes })
        }
        addToast('success', '✅ اتمسحت')
      } catch {
        addToast('error', 'فشل الحذف')
      }
    },
    [leads, detailOpen, detailLead, addToast, updateLeadInCache]
  )

  // ===== Export CSV =====
  const handleExportCSV = useCallback(() => {
    const headers = ['#', 'اسم العميل', 'الجوال', 'الحالة', 'حضر؟', 'آخر ملاحظة', 'تاريخ التحويل']
    const rows = filtered.map((l, idx) => {
      const effKey = effStatus(l)
      const list = l.salesStatus ? SALES_STATUSES : STATUSES
      const st = list.find((s) => s.key === effKey) || list[0] || STATUSES[0]
      const manualNotes = (l.notes || []).filter((n) => n.cat !== 'status')
      const lastNote = manualNotes[manualNotes.length - 1]
      return [
        idx + 1,
        l.customerName || '',
        l.phone || '',
        st.label,
        l.attended === 'attended'
          ? 'حضر'
          : l.attended === 'no-show'
            ? 'لم يحضر'
            : 'في الانتظار',
        lastNote ? lastNote.text : '',
        l.assignedAt ? new Date(l.assignedAt).toLocaleString('ar-SA') : '',
      ]
    })
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-status-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    addToast('success', '✅ تم التصدير')
  }, [filtered, addToast])

  // ===== Filter pills config =====
  const filterPills = useMemo(
    () => [
      { key: 'all', label: `الكل (${stats.all})` },
      { key: 'pending-attendance', label: `⏳ بانتظار الحضور (${stats.pending})` },
      { key: 'attended', label: `✅ حضروا (${stats.attended})` },
      { key: 'no-show', label: `❌ لم يحضروا (${stats.noShow})` },
      { key: 'new', label: `🆕 جديد (${stats.new})` },
      { key: 'no-reply', label: `📵 لم يرد (${stats['no-reply']})` },
      { key: 'whatsapp', label: `💬 واتس (${stats.whatsapp})` },
      { key: 'followup', label: `🔄 متابعة (${stats.followup})` },
      { key: 'meeting-done', label: `✅ اجتماع تم (${stats['meeting-done']})` },
      { key: 'objection', label: `⚠️ اعتراض (${stats.objection})` },
      { key: 'proposal-sent', label: `📤 عرض سعر (${stats['proposal-sent']})` },
      { key: 'negotiation', label: `🤝 تفاوض (${stats.negotiation_status})` },
      { key: 'closed-won', label: `🏆 تم التقفيل (${stats['closed-won']})` },
      { key: 'closed-lost', label: `❌ مقفولة - خسارة (${stats['closed-lost']})` },
    ],
    [stats]
  )

  // ===== Role guard: only sales =====
  if (!currentUser) return null
  if (currentRole !== 'sales') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-muted-foreground">
        <UserCircle className="w-12 h-12 opacity-30" />
        <p className="text-sm">غير متاح</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Sheet Selector */}
      {accessibleSheets.length > 1 && (
        <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl flex-wrap">
          <Users className="w-[18px] h-[18px] text-venom shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">اختار الشيت:</span>
          <Select
            value={validSheet}
            onValueChange={(v) => {
              setSelectedSheet(v)
              setActiveFilter(VIEW_KEY, 'all')
            }}
          >
            <SelectTrigger className="flex-1 min-w-[200px] h-8 text-sm bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accessibleSheets.map((name) => {
                const isOwn = String(name).toLowerCase() === String(currentUser).toLowerCase()
                const cnt = leads.filter(
                  (l) => l.sales && String(l.sales).trim().toLowerCase() === String(name).trim().toLowerCase()
                ).length
                return (
                  <SelectItem key={name} value={name}>
                    {isOwn ? '👤 شيتي - ' : '👁️ شيت '}
                    {name} ({cnt} عميل)
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {!isViewingOwn && (
            <Badge className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full font-semibold shrink-0">
              <Eye className="w-3 h-3 ml-1" />
              بتشوف عملاء {validSheet}
            </Badge>
          )}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-venom/10 border border-venom/30 rounded-lg p-2.5 text-xs text-venom">
        <Info className="w-3.5 h-3.5 inline-block ml-1 -mt-0.5" />
        <strong>اللي ظاهر هنا:</strong>{' '}
        كل الاجتماعات (من التيلي) · اللي ردوا (من شيتك الخاص) · اللي تواصلت معاهم واتس (من شيتك)
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">إجمالي العملاء</div>
          <div className="text-2xl font-bold text-venom">{stats.all}</div>
        </div>
        <div className="bg-card border border-emerald-500/30 rounded-xl p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">حضروا الاجتماع</div>
          <div className="text-2xl font-bold text-emerald-400">{stats.attended}</div>
        </div>
        <div className="bg-card border border-amber-500/30 rounded-xl p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">في الانتظار</div>
          <div className="text-2xl font-bold text-amber-400">{stats.pending}</div>
        </div>
        <div className="bg-card border border-purple-500/30 rounded-xl p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">قيد التفاوض</div>
          <div className="text-2xl font-bold text-purple-400">{stats.negotiation}</div>
        </div>
      </div>

      {/* Search + Export */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث في العملاء..."
            value={search}
            onChange={(e) => setSearchQuery(VIEW_KEY, e.target.value)}
            className="pr-10 bg-background border-border focus:border-venom/50 h-9 text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          className="border-border hover:border-venom/30 hover:text-venom h-9 text-xs gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          تصدير CSV
        </Button>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {filterPills.map((f) => (
          <Button
            key={f.key}
            variant={statusFilter === f.key ? 'default' : 'outline'}
            size="sm"
            className={
              statusFilter === f.key
                ? 'bg-venom text-venom-foreground border-venom/40 h-7 text-xs px-2.5 shadow-sm'
                : 'border-border h-7 text-xs px-2.5 hover:border-venom/30 hover:text-venom'
            }
            onClick={() => setActiveFilter(VIEW_KEY, f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Compact Table - Virtual Scrolled */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-420px)]" ref={parentRef}>
          <div className="min-w-[1100px]">
            {/* Header Row */}
            <div
              className={`grid ${GRID_COLS} bg-muted/40 border-b border-border sticky top-0 z-10`}
              dir="rtl"
            >
              <div className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                #
              </div>
              <div className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                العميل
              </div>
              <div className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                الجوال
              </div>
              <div className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                حضور
              </div>
              <div className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                الحالة
              </div>
              <div className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                آخر ملاحظة
              </div>
              <div className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                آخر تحديث
              </div>
              <div className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                إجراءات
              </div>
            </div>

            {/* Virtual Rows */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="w-8 h-8 opacity-30" />
                <span className="text-sm mt-2">مفيش عملاء في الحالة دي</span>
              </div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const lead = filtered[virtualRow.index]
                  if (!lead) return null
                  const effectiveKey = effStatus(lead)
                  const manualNotes = (lead.notes || []).filter((n) => n.cat !== 'status')
                  const lastNote = manualNotes[manualNotes.length - 1]
                  const lastUpdate = lastNote
                    ? formatRelativeTime(lastNote.at)
                    : lead.assignedAt
                      ? formatRelativeTime(lead.assignedAt)
                      : '—'
                  const canEdit = canEditLead(lead)
                  const currentAttendance = lead.attended || 'pending'

                  return (
                    <div
                      key={lead.id}
                      className={`grid ${GRID_COLS} border-b border-border/50 hover:bg-venom/5 transition-colors`}
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
                      {/* # */}
                      <div className="px-3 py-2 flex items-center text-muted-foreground text-xs">
                        {virtualRow.index + 1}
                      </div>

                      {/* Customer */}
                      <div className="px-3 py-2 flex items-center">
                        <div className="font-medium text-sm group">
                          <InlineEdit
                            value={lead.customerName}
                            onSave={(v) => handleInlineFieldEdit(lead.id, 'customerName', v)}
                            canEdit={canEdit}
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="px-3 py-2 flex items-center font-mono text-xs text-muted-foreground group" dir="ltr">
                        <InlineEdit
                          value={lead.phone}
                          onSave={(v) => handleInlineFieldEdit(lead.id, 'phone', v)}
                          canEdit={canEdit}
                          type="tel"
                        />
                      </div>

                      {/* Attendance - inline select */}
                      <div className="px-3 py-2 flex items-center">
                        <Select
                          value={currentAttendance}
                          disabled={!canEdit}
                          onValueChange={(v) => handleInlineAttendanceChange(lead.id, v)}
                        >
                          <SelectTrigger
                            className={`h-7 text-xs ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} bg-background border-border min-w-[100px]`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">⏳ في الانتظار</SelectItem>
                            <SelectItem value="attended">✅ حضر</SelectItem>
                            <SelectItem value="no-show">❌ لم يحضر</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Status - inline select */}
                      <div className="px-3 py-2 flex items-center">
                        <Select
                          value={effectiveKey}
                          disabled={!canEdit}
                          onValueChange={(v) => handleInlineStatusChange(lead.id, v)}
                        >
                          <SelectTrigger
                            className={`h-7 text-xs ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} bg-background border-border min-w-[140px]`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SALES_STATUSES.map((s) => (
                              <SelectItem key={s.key} value={s.key}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Last Note */}
                      <div className="px-3 py-2 flex items-center text-muted-foreground">
                        {lastNote ? (
                          <div className="min-w-0">
                            <div className="text-xs leading-tight line-clamp-2">
                              {truncate(lastNote.text, 80)}
                            </div>
                            <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                              — {lastNote.by || ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">مفيش ملاحظات</span>
                        )}
                      </div>

                      {/* Last Update */}
                      <div className="px-3 py-2 flex items-center text-muted-foreground text-xs">
                        {lastUpdate}
                      </div>

                      {/* Actions */}
                      <div className="px-3 py-2 flex items-center whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-venom hover:text-venom hover:bg-venom/10 h-6 w-6 p-0"
                            title="فتح التفاصيل والتعديل"
                            onClick={() => openDetail(lead)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-venom hover:text-venom hover:bg-venom/10 h-6 w-6 p-0"
                              title="إضافة ملاحظة"
                              onClick={() => openAddNote(lead.id)}
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Customer Detail Modal ===== */}
      <Dialog open={detailOpen} onOpenChange={(open) => {
        setDetailOpen(open)
        if (!open) setEditingNoteId(null)
      }}>
        <DialogContent className="max-w-[580px] bg-card border-border max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-venom">
              <UserCircle className="w-5 h-5" />
              {detailLead?.customerName || detailLead?.phone || 'العميل'}
              {detailLead && !canEditLead(detailLead) && (
                <Badge className="text-xs bg-muted/30 text-muted-foreground border border-border rounded-full font-medium">
                  <Eye className="w-3 h-3 ml-0.5" />
                  للعرض فقط
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailLead && (() => {
            const isSales = currentRole === 'sales'
            const statusList = isSales ? SALES_STATUSES : STATUSES
            const activeStatusKey = effStatus(detailLead)
            const curStatus = statusList.find((s) => s.key === activeStatusKey) || statusList[0]
            const canEdit = canEditLead(detailLead)
            const notes = detailLead.notes || []

            return (
              <div className="space-y-4">
                {/* Status & Attendance Badges */}
                <div className="flex gap-1.5 flex-wrap">
                  <Badge className={`text-xs ${curStatus.cls}`}>{curStatus.label}</Badge>
                  {detailLead.attended === 'attended' ? (
                    <Badge className="text-xs bg-emerald-500 text-white">✅ حضر</Badge>
                  ) : detailLead.attended === 'no-show' ? (
                    <Badge className="text-xs bg-red-500 text-white">❌ لم يحضر</Badge>
                  ) : (
                    <Badge className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30">⏳ في الانتظار</Badge>
                  )}
                  {detailLead.tele && (
                    <Badge className="text-xs bg-muted/30 text-muted-foreground border border-border">
                      📞 من {detailLead.tele}
                    </Badge>
                  )}
                </div>

                {/* Quick Edit Section */}
                {canEdit && (
                  <div className="bg-venom/10 border border-venom/30 rounded-lg p-3">
                    <h4 className="text-xs text-venom font-semibold mb-2.5 flex items-center gap-1">
                      ✏️ تعديل سريع
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">الحضور</label>
                        <Select
                          value={detailLead.attended || 'pending'}
                          onValueChange={async (v) => {
                            await handleInlineAttendanceChange(detailLead.id, v)
                            const fresh = leads.find((l) => l.id === detailLead.id)
                            if (fresh) setDetailLead(fresh)
                          }}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-background border-border cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">⏳ في الانتظار</SelectItem>
                            <SelectItem value="attended">✅ حضر</SelectItem>
                            <SelectItem value="no-show">❌ لم يحضر</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">الحالة</label>
                        <Select
                          value={activeStatusKey}
                          onValueChange={async (v) => {
                            await handleInlineStatusChange(detailLead.id, v)
                            const fresh = leads.find((l) => l.id === detailLead.id)
                            if (fresh) setDetailLead(fresh)
                          }}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-background border-border cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusList.map((s) => (
                              <SelectItem key={s.key} value={s.key}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Grid */}
                <div className="bg-muted/20 p-3 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <strong className="text-muted-foreground">الجوال:</strong>{' '}
                      <span className="font-mono">{detailLead.phone || '—'}</span>
                    </div>

                    {detailLead.storeUrl && (
                      <div className="col-span-2">
                        <strong className="text-muted-foreground">المتجر:</strong>{' '}
                        <a
                          href={detailLead.storeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-venom hover:underline"
                        >
                          {truncate(detailLead.storeUrl, 60)}
                        </a>
                      </div>
                    )}
                    <div>
                      <strong className="text-muted-foreground">حجزته:</strong>{' '}
                      {detailLead.tele || '—'}
                    </div>
                    <div>
                      <strong className="text-muted-foreground">السيلز:</strong>{' '}
                      {detailLead.sales || '—'}
                    </div>
                    {detailLead.meetingDate && (
                      <div>
                        <strong className="text-muted-foreground">موعد الاجتماع:</strong>{' '}
                        {formatDate(new Date(detailLead.meetingDate).getTime())}{' '}
                        {detailLead.meetingTime || ''}
                      </div>
                    )}
                    {detailLead.meetingType && (
                      <div>
                        <strong className="text-muted-foreground">طريقة الاجتماع:</strong>{' '}
                        {detailLead.meetingType}
                      </div>
                    )}
                    {detailLead.meetingLink && (
                      <div className="col-span-2">
                        <strong className="text-muted-foreground">لينك الاجتماع:</strong>{' '}
                        <a
                          href={detailLead.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-venom hover:underline"
                        >
                          {truncate(detailLead.meetingLink, 50)}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Brief */}
                {detailLead.brief && (
                  <div>
                    <h4 className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                      📋 البريف
                    </h4>
                    <div className="bg-muted/20 p-2.5 rounded-md text-xs leading-relaxed border-r-2 border-venom whitespace-pre-wrap">
                      {detailLead.brief}
                    </div>
                  </div>
                )}

                {/* Notes Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs text-muted-foreground flex items-center gap-1">
                      📜 سجل الملاحظات ({notes.length})
                    </h4>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-venom hover:text-venom hover:bg-venom/10 h-6 text-xs px-2"
                        onClick={() => {
                          setDetailOpen(false)
                          openAddNote(detailLead.id)
                        }}
                      >
                        + ملاحظة جديدة
                      </Button>
                    )}
                  </div>
                  <div className="max-h-[280px] overflow-y-auto space-y-1.5">
                    {notes.length === 0 ? (
                      <div className="text-center text-muted-foreground/50 py-5 text-xs">
                        مفيش ملاحظات لحد دلوقتي
                      </div>
                    ) : (
                      [...notes].reverse().map((note, revIdx) => {
                        const realIdx = notes.length - 1 - revIdx
                        const canDelete =
                          canEdit &&
                          (currentRole === 'admin' ||
                            (note.by &&
                              String(note.by).toLowerCase() ===
                                String(currentUser).toLowerCase()))
                        return (
                          <div
                            key={`${note.id}-${revIdx}`}
                            className="p-2 bg-muted/20 rounded-md border-r-2 border-venom relative"
                          >
                            <div className="flex justify-between items-center mb-1 text-xs text-muted-foreground">
                              <strong>{note.by || '—'}</strong>
                              <div className="flex items-center gap-1.5">
                                <span>{formatRelativeTime(note.at)}</span>
                                {canDelete && editingNoteId !== note.id && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-venom hover:text-venom hover:bg-venom/10 h-4 w-4 p-0"
                                      title="تعديل الملاحظة"
                                      onClick={() => {
                                        setEditingNoteId(note.id)
                                        setEditingNoteText(note.text || '')
                                      }}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-400 hover:text-red-300 h-4 w-4 p-0"
                                      title="حذف الملاحظة"
                                      onClick={() =>
                                        handleDeleteNote(detailLead.id, note.id, realIdx)
                                      }
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            {editingNoteId === note.id ? (
                              <div className="space-y-1.5">
                                <Textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="min-h-[60px] text-xs bg-background border-venom/40"
                                  autoFocus
                                />
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    className="h-6 text-[10px] bg-venom text-venom-foreground hover:bg-venom/90 px-2"
                                    disabled={!editingNoteText.trim()}
                                    onClick={async () => {
                                      try {
                                        await apiUpdateNote(note.id, { text: editingNoteText.trim() })
                                        const updatedNotes = (detailLead.notes || []).map((n) =>
                                          n.id === note.id ? { ...n, text: editingNoteText.trim() } : n
                                        )
                                        updateLeadInCache(detailLead.id, { notes: updatedNotes })
                                        setDetailLead({ ...detailLead, notes: updatedNotes })
                                        setEditingNoteId(null)
                                        addToast('success', '✅ تم تعديل الملاحظة')
                                      } catch {
                                        addToast('error', 'فشل تعديل الملاحظة')
                                      }
                                    }}
                                  >
                                    <Check className="w-3 h-3 ml-0.5" /> حفظ
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[10px] px-2"
                                    onClick={() => setEditingNoteId(null)}
                                  >
                                    إلغاء
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs leading-relaxed whitespace-pre-wrap">
                                {note.text || ''}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ===== Add Note Modal ===== */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="max-w-[520px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-venom">
              <MessageSquarePlus className="w-5 h-5" />
              إضافة ملاحظة جديدة
            </DialogTitle>
          </DialogHeader>

          {noteModalLeadId && (() => {
            const lead = leads.find((l) => l.id === noteModalLeadId)
            return (
              <p className="text-xs text-muted-foreground -mt-2">
                {lead?.customerName || '—'} · {lead?.phone || ''}
              </p>
            )
          })()}

          <div className="space-y-4">
            {/* Note category buttons */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">نوع الملاحظة</label>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: 'meeting', label: '🎥 عن الاجتماع' },
                  { key: 'customer', label: '👤 عن العميل' },
                  { key: 'followup', label: '🔄 متابعة' },
                  { key: 'other', label: '📝 ملاحظة عامة' },
                ].map((cat) => (
                  <Button
                    key={cat.key}
                    variant="outline"
                    size="sm"
                    className={
                      noteCat === cat.key
                        ? 'bg-venom/15 border-venom/30 text-venom h-8 text-[12px]'
                        : 'border-border text-muted-foreground h-8 text-[12px] hover:border-venom/30'
                    }
                    onClick={() => setNoteCat(cat.key)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Note text */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                الملاحظة <span className="text-red-400">*</span>
              </label>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="اكتب الملاحظة هنا..."
                className="bg-background border-border min-h-[100px] resize-none text-sm"
                autoFocus
              />
            </div>

            {/* Templates */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                قوالب جاهزة (اضغط لإضافة)
              </label>
              <div className="flex gap-1.5 flex-wrap max-h-32 overflow-y-auto">
                {(NOTE_TEMPLATES[noteCat] || []).map((t, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="border-border text-xs h-7 hover:border-venom/30 hover:text-venom"
                    onClick={() => setNoteText((prev) => (prev ? prev + '\n' : '') + t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setNoteModalOpen(false)}
                className="border-border hover:border-venom/30"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSaveNote}
                disabled={noteSaving || !noteText.trim()}
                className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30"
              >
                {noteSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-1" />
                ) : null}
                حفظ الملاحظة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
