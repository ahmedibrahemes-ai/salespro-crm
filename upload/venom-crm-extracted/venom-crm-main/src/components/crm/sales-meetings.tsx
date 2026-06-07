'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  CalendarOff,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  ExternalLink,
  Search,
  FolderOpen,
  Info,
  Eye,
  MessageSquarePlus,
  Trash2,
  RefreshCw,
  History,
  Loader2,
  Link as LinkIcon,
  Pencil,
} from 'lucide-react'
import {
  useCrmStore,
  SALES_STATUSES,
  CONTACT_RESULTS,
  ATTENDANCE_STATUSES,
  STATUSES,
  formatDate,
  formatRelativeTime,
  getDateRange,
  getAllLeadsForAnalytics,
  normalizePhone,
} from '@/lib/store'
import { apiUpdateLead, apiDeleteLead, apiAddNote, apiGetLeadNotes, apiUpdateNote, apiDeleteNote, apiBroadcastChange } from '@/lib/supabase'
import type { Lead } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
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
  DialogFooter,
} from '@/components/ui/dialog'

// ===== Date filter presets =====
const DATE_PRESETS = [
  { key: 'today', label: '📅 اليوم' },
  { key: 'yesterday', label: '🕐 أمس' },
  { key: 'week', label: '📆 آخر أسبوع' },
  { key: 'month', label: '🗓️ الشهر الحالي' },
  { key: 'all', label: '🌐 الكل' },
  { key: 'custom', label: '🎯 تاريخ محدد' },
]

// ===== Note templates =====
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

const NOTE_CAT_OPTIONS = [
  { key: 'meeting', label: '🎥 عن الاجتماع', emoji: '🎥' },
  { key: 'customer', label: '👤 عن العميل', emoji: '👤' },
  { key: 'followup', label: '🔄 متابعة', emoji: '🔄' },
  { key: 'other', label: '📝 ملاحظة عامة', emoji: '📝' },
]

// ===== Helpers =====
function isToday(ts: number | null): boolean {
  if (!ts) return false
  const d = new Date(ts)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function truncate(str: string, len: number): string {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) + '...' : str
}

// ===== Main Component =====
const VIEW_KEY = 'meetings'

export function SalesMeetings() {
  const {
    currentUser,
    currentRole,
    leads,
    archivedLeads,
    team,
    addToast,
    updateLeadInCache,
    removeLeadFromCache,
    getAccessibleSalesSheets,
    activeFilter,
    setActiveFilter,
    searchQueries,
    setSearchQuery,
    dateRangeFilters,
    setDateRangeFilter,
  } = useCrmStore()

  // Date filter state synced with store
  const dateFilter = dateRangeFilters[VIEW_KEY] || { preset: 'all', customFrom: '', customTo: '' }
  const setDateFilter = useCallback(
    (f: { preset: string; customFrom?: string; customTo?: string }) => setDateRangeFilter(VIEW_KEY, f),
    [setDateRangeFilter]
  )

  // Search query synced with store
  const searchQuery = searchQueries[VIEW_KEY] || ''

  // Active filter (from store)
  const attendFilter = activeFilter[VIEW_KEY] || 'all'

  // Sheet selector state
  const [viewingSheet, setViewingSheet] = useState<string | null>(null)

  // Note modal state
  const [noteModal, setNoteModal] = useState<{ open: boolean; leadId: string | null; cat: string; text: string; saving: boolean }>({
    open: false,
    leadId: null,
    cat: 'meeting',
    text: '',
    saving: false,
  })

  // Brief modal state
  const [briefModal, setBriefModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null })

  // History modal state
  const [historyModal, setHistoryModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null })
  const [historyNotesLoading, setHistoryNotesLoading] = useState(false)
  const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')

  // Load notes when history modal opens
  useEffect(() => {
    if (historyModal.open && historyModal.lead) {
      const lead = historyModal.lead
      if (!lead.notes || lead.notes.length === 0) {
        setHistoryNotesLoading(true)
        apiGetLeadNotes(lead.id)
          .then((fetchedNotes) => {
            updateLeadInCache(lead.id, { notes: fetchedNotes })
            setHistoryModal((p) => ({ ...p, lead: { ...lead, notes: fetchedNotes } }))
          })
          .catch(console.error)
          .finally(() => setHistoryNotesLoading(false))
      }
    }
  }, [historyModal.open, historyModal.lead, updateLeadInCache])

  // Marking attendance state
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Get accessible sales sheets
  const accessibleSheets = useMemo(() => {
    if (!currentUser) return []
    return getAccessibleSalesSheets(currentUser)
  }, [currentUser, getAccessibleSalesSheets])

  // Resolve which sheet we're viewing
  const resolvedSheet = useMemo(() => {
    if (viewingSheet && accessibleSheets.map((s) => s.toLowerCase()).includes(viewingSheet.toLowerCase())) {
      return viewingSheet
    }
    return currentUser || ''
  }, [viewingSheet, accessibleSheets, currentUser])

  const isViewingOwn = resolvedSheet.toLowerCase() === (currentUser || '').toLowerCase()

  // All leads (active + archived) for meetings
  const allLeads = useMemo(() => getAllLeadsForAnalytics(leads, archivedLeads), [leads, archivedLeads])

  // Filter: sales's meetings from tele only (l.tele exists)
  const myMeetings = useMemo(() => {
    if (!currentUser) return []
    const sheetLower = resolvedSheet.toLowerCase()
    let filtered = allLeads
      .filter((l) => l.sales && l.tele && String(l.sales || '').trim().toLowerCase() === sheetLower)
      .sort((a, b) => (b.assignedAt || 0) - (a.assignedAt || 0))

    // Apply date range filter on assignedAt
    const { from, to } = getDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo)
    if (dateFilter.preset !== 'all') {
      filtered = filtered.filter((l) => {
        const ts = l.assignedAt || 0
        return ts >= from && ts < to
      })
    }

    return filtered
  }, [allLeads, resolvedSheet, currentUser, dateFilter])

  // KPIs
  const kpis = useMemo(() => {
    const today = myMeetings.filter((l) => isToday(l.assignedAt))
    const pending = myMeetings.filter((l) => l.attended !== 'attended' && l.attended !== 'no-show')
    const attended = myMeetings.filter((l) => l.attended === 'attended')
    const noShow = myMeetings.filter((l) => l.attended === 'no-show')
    const urgentNeedAction = pending.filter((l) => {
      if (!l.assignedAt) return false
      const hours = (Date.now() - l.assignedAt) / 3600000
      return hours > 24
    })
    return { total: myMeetings.length, today, pending, attended, noShow, urgentNeedAction }
  }, [myMeetings])

  // Apply filter
  const filteredMeetings = useMemo(() => {
    if (attendFilter === 'today') return myMeetings.filter((l) => isToday(l.assignedAt))
    if (attendFilter === 'pending')
      return myMeetings.filter((l) => l.attended !== 'attended' && l.attended !== 'no-show')
    if (attendFilter === 'attended') return myMeetings.filter((l) => l.attended === 'attended')
    if (attendFilter === 'no-show') return myMeetings.filter((l) => l.attended === 'no-show')
    if (attendFilter === 'urgent') {
      return myMeetings.filter((l) => {
        if (l.attended === 'attended' || l.attended === 'no-show') return false
        if (!l.assignedAt) return false
        const hours = (Date.now() - l.assignedAt) / 3600000
        return hours > 24
      })
    }
    return myMeetings
  }, [myMeetings, attendFilter])

  // Apply search
  const displayedMeetings = useMemo(() => {
    if (!searchQuery.trim()) return filteredMeetings
    const q = searchQuery.toLowerCase()
    return filteredMeetings.filter(
      (l) =>
        (l.customerName || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.tele || '').toLowerCase().includes(q) ||
        (l.brief || '').toLowerCase().includes(q)
    )
  }, [filteredMeetings, searchQuery])

  // Date range label
  const dateRangeLabel = useMemo(() => {
    const p = dateFilter.preset
    if (p === 'all') return 'كل الأوقات'
    if (p === 'today') return 'اليوم'
    if (p === 'yesterday') return 'أمس'
    if (p === 'week') return 'آخر أسبوع'
    if (p === 'month') return 'الشهر الحالي'
    if (p === 'custom') return `${dateFilter.customFrom || '—'} → ${dateFilter.customTo || '—'}`
    return 'كل الأوقات'
  }, [dateFilter])

  // Mark attendance
  const handleMarkAttendance = useCallback(
    async (leadId: string, attended: boolean) => {
      const lead = allLeads.find((l) => l.id === leadId)
      if (!lead) return

      setMarkingId(leadId)
      const wasAttended = lead.attended
      const isChange = wasAttended === 'attended' || wasAttended === 'no-show'
      const attendedStr = attended ? 'attended' : 'no-show'

      let noteText: string
      if (isChange) {
        noteText = attended
          ? '🔄 تم تغيير الحالة من "لم يحضر" إلى "حضر"'
          : '🔄 تم تغيير الحالة من "حضر" إلى "لم يحضر"'
      } else {
        noteText = attended
          ? '✅ تأكيد حضور العميل للاجتماع'
          : '❌ العميل لم يحضر الاجتماع'
      }

      try {
        await apiUpdateLead(leadId, {
          attended: attendedStr,
          attendanceMarkedAt: Date.now(),
          attendanceMarkedBy: currentUser,
        } as Partial<Lead>)
        updateLeadInCache(leadId, {
          attended: attendedStr,
          attendanceMarkedAt: Date.now(),
          attendanceMarkedBy: currentUser,
        })
        addToast('success', attended ? '✅ تم تسجيل الحضور' : '❌ تم تسجيل عدم الحضور')
        // Broadcast the attendance change to all other connected clients
        // This ensures tele users see the change immediately regardless of RLS
        apiBroadcastChange({
          type: 'attendance',
          leadId,
          data: {
            attended: attendedStr,
            attendanceMarkedAt: Date.now(),
            attendanceMarkedBy: currentUser,
          },
          by: currentUser || '',
          byRole: currentRole || 'sales',
          at: Date.now(),
        })
        // Add note after successful update (non-blocking)
        apiAddNote(leadId, currentUser || '', 'meeting', noteText).catch(() => {})
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : (err as Record<string, unknown>)?.message || 'خطأ غير معروف'
        const hint = (err as Record<string, unknown>)?.hint as string | undefined
        console.error('Attendance update error:', { msg, hint, err })
        addToast('error', `فشل في تحديث الحضور: ${msg}${hint ? ` (${hint})` : ''}`)
      } finally {
        setMarkingId(null)
      }
    },
    [currentUser, currentRole, allLeads, updateLeadInCache, addToast]
  )

  // Reset attendance
  const handleResetAttendance = useCallback(
    async (leadId: string) => {
      try {
        await apiUpdateLead(leadId, { attended: null, attendanceMarkedAt: null, attendanceMarkedBy: null } as Partial<Lead>)
        updateLeadInCache(leadId, { attended: null, attendanceMarkedAt: null, attendanceMarkedBy: null })
        addToast('success', 'تم التراجع')
        // Broadcast the reset to all other connected clients
        apiBroadcastChange({
          type: 'reset-attendance',
          leadId,
          data: { attended: null, attendanceMarkedAt: null, attendanceMarkedBy: null },
          by: currentUser || '',
          byRole: currentRole || 'sales',
          at: Date.now(),
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطأ غير معروف'
        console.error('Reset attendance error:', err)
        addToast('error', `فشل التراجع: ${msg}`)
      }
    },
    [updateLeadInCache, addToast, currentUser, currentRole]
  )

  // Status change
  const handleStatusChange = useCallback(
    async (leadId: string, newStatus: string) => {
      const lead = allLeads.find((l) => l.id === leadId)
      if (!lead) return

      const isSales = currentRole === 'sales'
      const statusList = isSales ? SALES_STATUSES : STATUSES
      const newStatusLabel = statusList.find((s) => s.key === newStatus)?.label || ''
      const updateField = isSales ? 'salesStatus' : 'status'

      try {
        await apiUpdateLead(leadId, { [updateField]: newStatus } as Partial<Lead>)
        updateLeadInCache(leadId, { [updateField]: newStatus })
        addToast('success', `الحالة اتحدثت: ${newStatusLabel}`)
        // Add note after successful update (non-blocking)
        apiAddNote(leadId, currentUser || '', 'status', `🔄 الحالة اتغيرت: ${newStatusLabel}`).catch(() => {})
      } catch (err) {
        console.error('Status update error:', err)
        addToast('error', 'فشل التحديث')
      }
    },
    [currentUser, currentRole, allLeads, updateLeadInCache, addToast]
  )

  // Delete meeting
  const handleDeleteMeeting = useCallback(
    async (leadId: string) => {
      const lead = allLeads.find((l) => l.id === leadId)
      if (!lead) return
      const customerName = lead.customerName || lead.phone || 'العميل'
      if (!confirm(`متأكد عايز تمسح اجتماع ${customerName} نهائياً؟\nالعميل هيتمسح من قاعدة البيانات بالكامل.`)) return

      setDeletingId(leadId)
      try {
        await apiDeleteLead(leadId)
        removeLeadFromCache(leadId)
        addToast('success', `✅ تم حذف اجتماع ${customerName}`)
      } catch (err) {
        addToast('error', 'فشل الحذف')
      } finally {
        setDeletingId(null)
      }
    },
    [allLeads, removeLeadFromCache, addToast]
  )

  // Save note
  const handleSaveNote = useCallback(async () => {
    if (!noteModal.leadId || !noteModal.text.trim()) {
      addToast('error', 'اكتب ملاحظة الأول')
      return
    }

    setNoteModal((p) => ({ ...p, saving: true }))
    const catLabels: Record<string, string> = {
      meeting: '🎥 [اجتماع]',
      customer: '👤 [عميل]',
      followup: '🔄 [متابعة]',
      other: '📝',
    }

    try {
      const text = `${catLabels[noteModal.cat] || ''} ${noteModal.text}`
      await apiAddNote(noteModal.leadId, currentUser || '', noteModal.cat, text)

      // Update local cache so the note appears immediately in UI
      const lead = allLeads.find((l) => l.id === noteModal.leadId)
      const newNote = {
        id: Date.now(),
        by: currentUser || '',
        cat: noteModal.cat,
        text,
        at: Date.now(),
      }
      updateLeadInCache(noteModal.leadId, {
        notes: [...(lead?.notes || []), newNote],
      })

      addToast('success', '✅ تم حفظ الملاحظة')
      setNoteModal({ open: false, leadId: null, cat: 'meeting', text: '', saving: false })
    } catch (err) {
      addToast('error', '❌ فشل حفظ الملاحظة')
      setNoteModal((p) => ({ ...p, saving: false }))
    }
  }, [noteModal, currentUser, addToast, allLeads, updateLeadInCache])

  // Find lead for note modal
  const noteLead = useMemo(() => {
    if (!noteModal.leadId) return null
    return allLeads.find((l) => l.id === noteModal.leadId) || null
  }, [noteModal.leadId, allLeads])

  if (!currentUser || (currentRole !== 'sales' && currentRole !== 'admin')) return null

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-venom venom-text-glow">اجتماعات المبيعات</h1>
        <p className="text-muted-foreground text-sm mt-1">متابعة وتسجيل حضور العملاء</p>
      </motion.div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="بحث عن عميل..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(VIEW_KEY, e.target.value)}
          className="pr-10 h-9 text-sm bg-card border-border"
        />
      </div>

      {/* Sheet Selector */}
      {accessibleSheets.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl flex-wrap"
        >
          <FolderOpen className="w-4 h-4 text-venom shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">اختار الشيت:</span>
          <Select value={resolvedSheet} onValueChange={(v) => setViewingSheet(v)}>
            <SelectTrigger className="flex-1 min-w-[200px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accessibleSheets.map((name) => {
                const isOwn = name.toLowerCase() === currentUser.toLowerCase()
                const cnt = allLeads.filter(
                  (l) => l.sales && l.tele && String(l.sales || '').trim().toLowerCase() === name.trim().toLowerCase()
                ).length
                return (
                  <SelectItem key={name} value={name}>
                    {isOwn ? '👤 شيتي - ' : '👁️ شيت '}
                    {name} ({cnt} اجتماع)
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {!isViewingOwn && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
              <Eye className="w-3 h-3 ml-1" /> بتشوف اجتماعات {resolvedSheet}
            </Badge>
          )}
        </motion.div>
      )}

      {/* Date Range Filter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="p-3 bg-card border border-border rounded-xl"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-venom shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">فلتر حسب التاريخ:</span>
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={dateFilter.preset === p.key ? 'default' : 'outline'}
              className={
                dateFilter.preset === p.key
                  ? 'h-7 text-xs px-3 rounded-full bg-venom text-venom-foreground hover:bg-venom/90'
                  : 'h-7 text-xs px-3 rounded-full border-border hover:border-venom/30 hover:text-venom'
              }
              onClick={() => setDateFilter({ preset: p.key, customFrom: '', customTo: '' })}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {dateFilter.preset === 'custom' && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-muted-foreground">من:</span>
            <Input
              type="date"
              value={dateFilter.customFrom || ''}
              onChange={(e) => setDateFilter({ ...dateFilter, customFrom: e.target.value })}
              className="w-36 h-8 text-xs bg-background border-border"
            />
            <span className="text-xs text-muted-foreground">إلى:</span>
            <Input
              type="date"
              value={dateFilter.customTo || ''}
              onChange={(e) => setDateFilter({ ...dateFilter, customTo: e.target.value })}
              className="w-36 h-8 text-xs bg-background border-border"
            />
            <Button
              size="sm"
              className="h-8 text-xs bg-venom text-venom-foreground hover:bg-venom/90"
              onClick={() => {
                if (!dateFilter.customFrom) {
                  addToast('error', 'اختار تاريخ "من" على الأقل')
                  return
                }
                setDateFilter({
                  ...dateFilter,
                  preset: 'custom',
                  customTo: dateFilter.customTo || dateFilter.customFrom,
                })
              }}
            >
              تطبيق
            </Button>
          </div>
        )}
      </motion.div>

      {/* Info Banner */}
      <div className="flex items-center gap-2 bg-venom/5 border border-venom/30 rounded-lg px-3 py-2 text-xs text-venom flex-wrap">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          <strong>فلتر التاريخ بيشتغل على:</strong> تاريخ تحويل العميل ليك من التيلي
        </span>
        <span className="mr-auto bg-card px-2.5 py-0.5 rounded-lg font-semibold text-xs">
          {dateRangeLabel}
        </span>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {kpis.urgentNeedAction.length > 0 && (
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-gradient-to-br from-red-600 to-red-800 text-white rounded-xl p-3 cursor-pointer"
            onClick={() => setActiveFilter(VIEW_KEY, 'urgent')}
          >
            <div className="text-xs opacity-90">🚨 يحتاج اهتمامك الآن</div>
            <div className="text-xl font-bold">{kpis.urgentNeedAction.length}</div>
            <div className="text-[9px] opacity-85">اجتماعات بدون متابعة +24س</div>
          </motion.div>
        )}
        <div
          className="bg-card border border-amber-500/30 rounded-xl p-3 cursor-pointer"
          onClick={() => setActiveFilter(VIEW_KEY, 'pending')}
        >
          <div className="text-xs text-muted-foreground">في الانتظار</div>
          <div className="text-xl font-bold text-amber-400">{kpis.pending.length}</div>
          <div className="text-[9px] text-muted-foreground/60">محتاج تأكيد حضور</div>
        </div>
        <div
          className="bg-card border border-emerald-500/30 rounded-xl p-3 cursor-pointer"
          onClick={() => setActiveFilter(VIEW_KEY, 'attended')}
        >
          <div className="text-xs text-muted-foreground">حضروا</div>
          <div className="text-xl font-bold text-emerald-400">{kpis.attended.length}</div>
          <div className="text-[9px] text-muted-foreground/60">
            {kpis.total ? Math.round((kpis.attended.length / kpis.total) * 100) : 0}% من الكل
          </div>
        </div>
        <div
          className="bg-card border border-venom/30 rounded-xl p-3 cursor-pointer"
          onClick={() => setActiveFilter(VIEW_KEY, 'today')}
        >
          <div className="text-xs text-muted-foreground">اليوم</div>
          <div className="text-xl font-bold text-venom">{kpis.today.length}</div>
          <div className="text-[9px] text-muted-foreground/60">اجتماع جديد</div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all', label: '📋 الكل', count: kpis.total, color: '' },
          { key: 'urgent', label: '🚨 عاجل', count: kpis.urgentNeedAction.length, color: 'bg-red-500 text-white border-red-500' },
          { key: 'pending', label: '⏳ محتاج تأكيد', count: kpis.pending.length, color: 'bg-amber-500 text-white border-amber-500' },
          { key: 'today', label: '📅 اليوم', count: kpis.today.length, color: 'bg-venom text-venom-foreground border-venom' },
          { key: 'attended', label: '✅ حضروا', count: kpis.attended.length, color: 'bg-emerald-500 text-white border-emerald-500' },
          { key: 'no-show', label: '❌ لم يحضروا', count: kpis.noShow.length, color: 'bg-red-500 text-white border-red-500' },
        ].map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={attendFilter === f.key ? 'default' : 'outline'}
            className={
              attendFilter === f.key
                ? `h-8 text-[12px] rounded-full border ${f.color || 'bg-venom text-venom-foreground border-venom'}`
                : 'h-8 text-[12px] rounded-full border-border hover:border-venom/30 hover:text-venom'
            }
            onClick={() => setActiveFilter(VIEW_KEY, f.key)}
          >
            {f.label} ({f.count})
          </Button>
        ))}
      </div>

      {/* Meetings List */}
      <div className="max-h-[calc(100vh-500px)] overflow-y-auto custom-scrollbar space-y-3 pr-1">
        <AnimatePresence mode="popLayout">
          {displayedMeetings.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <CalendarOff className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground text-base font-medium">
                {attendFilter === 'all' ? 'مفيش اجتماعات' : 'مفيش نتائج للفلتر ده'}
              </p>
              <p className="text-muted-foreground/50 text-sm mt-1">
                {attendFilter === 'all' ? 'هتظهر هنا لما التيلي تحول عميل ليك' : 'جرّب فلتر تاني'}
              </p>
            </motion.div>
          ) : (
            displayedMeetings.map((lead, i) => (
              <SalesMeetingCard
                key={lead.id}
                lead={lead}
                index={i}
                currentRole={currentRole}
                currentUser={currentUser}
                marking={markingId === lead.id}
                deleting={false}
                onMarkAttendance={handleMarkAttendance}
                onResetAttendance={handleResetAttendance}
                onStatusChange={handleStatusChange}
                onDeleteMeeting={() => {}}
                onAddNote={(leadId) =>
                  setNoteModal({ open: true, leadId, cat: 'meeting', text: '', saving: false })
                }
                onViewHistory={(lead) => setHistoryModal({ open: true, lead })}
                onShowFullBrief={(lead) => setBriefModal({ open: true, lead })}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Add Note Modal */}
      <Dialog
        open={noteModal.open}
        onOpenChange={(open) => {
          if (!open) setNoteModal({ open: false, leadId: null, cat: 'meeting', text: '', saving: false })
        }}
      >
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-venom" /> إضافة ملاحظة جديدة
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {noteLead?.customerName || '—'} · {noteLead?.phone || ''}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category buttons */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-2 block">نوع الملاحظة</label>
              <div className="flex gap-2 flex-wrap">
                {NOTE_CAT_OPTIONS.map((cat) => (
                  <Button
                    key={cat.key}
                    size="sm"
                    variant={noteModal.cat === cat.key ? 'default' : 'outline'}
                    className={
                      noteModal.cat === cat.key
                        ? 'h-8 text-[12px] bg-venom text-venom-foreground border-venom/40 hover:bg-venom/90 shadow-sm'
                        : 'h-8 text-[12px] border-border hover:border-venom/30'
                    }
                    onClick={() => setNoteModal((p) => ({ ...p, cat: cat.key }))}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Note text */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-2 block">
                الملاحظة <span className="text-red-400">*</span>
              </label>
              <Textarea
                value={noteModal.text}
                onChange={(e) => setNoteModal((p) => ({ ...p, text: e.target.value }))}
                placeholder="اكتب الملاحظة هنا..."
                className="min-h-[100px] text-sm"
              />
            </div>

            {/* Templates */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-2 block">
                قوالب جاهزة (اضغط لإضافة)
              </label>
              <div className="flex gap-2 flex-wrap">
                {(NOTE_TEMPLATES[noteModal.cat] || []).map((t, ti) => (
                  <Button
                    key={ti}
                    size="sm"
                    variant="outline"
                    className="h-auto py-1.5 px-2.5 text-xs text-right border-border hover:border-venom/30 hover:text-venom"
                    onClick={() =>
                      setNoteModal((p) => ({
                        ...p,
                        text: p.text ? p.text + '\n' + t : t,
                      }))
                    }
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setNoteModal({ open: false, leadId: null, cat: 'meeting', text: '', saving: false })
              }
            >
              إلغاء
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={noteModal.saving || !noteModal.text.trim()}
              onClick={handleSaveNote}
            >
              {noteModal.saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-1" /> جاري الحفظ...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 ml-1" /> حفظ الملاحظة
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Brief Modal */}
      <Dialog
        open={briefModal.open}
        onOpenChange={(open) => {
          if (!open) setBriefModal({ open: false, lead: null })
        }}
      >
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📝 بريف العميل
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {briefModal.lead?.customerName || briefModal.lead?.phone || '—'}
            </p>
          </DialogHeader>
          <div className="bg-muted/50 p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto border-r-4 border-venom">
            {briefModal.lead?.brief || ''}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBriefModal({ open: false, lead: null })}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog
        open={historyModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryModal({ open: false, lead: null })
            setEditingNoteIdx(null)
            setEditingNoteText('')
          }
        }}
      >
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-venom" /> سجل الملاحظات
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {historyModal.lead?.customerName || historyModal.lead?.phone || '—'} ·{' '}
              {historyModal.lead?.notes?.length || 0} ملاحظة
            </p>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 custom-scrollbar">
            {historyNotesLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل الملاحظات...
              </div>
            ) : (historyModal.lead?.notes || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">مفيش ملاحظات لحد دلوقتي</div>
            ) : (
              (historyModal.lead?.notes || [])
                .slice()
                .reverse()
                .map((n, ni) => {
                  const canModify = currentRole === 'admin' || n.by === currentUser
                  return (
                    <div key={ni} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs text-muted-foreground mb-1">
                          {n.by} · {formatRelativeTime(n.at)}
                        </div>
                        {canModify && editingNoteIdx !== ni && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-venom"
                              onClick={() => {
                                setEditingNoteIdx(ni)
                                setEditingNoteText(n.text)
                              }}
                              title="تعديل الملاحظة"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                              onClick={async () => {
                                if (!confirm('متأكد عايز تمسح الملاحظة دي؟')) return
                                try {
                                  await apiDeleteNote(n.id)
                                  const lead = historyModal.lead
                                  if (lead) {
                                    const updatedNotes = (lead.notes || []).filter((note) => note.id !== n.id)
                                    updateLeadInCache(lead.id, { notes: updatedNotes })
                                    setHistoryModal((p) => ({
                                      ...p,
                                      lead: { ...lead, notes: updatedNotes },
                                    }))
                                  }
                                  addToast('success', '✅ تم حذف الملاحظة')
                                } catch {
                                  addToast('error', '❌ فشل حذف الملاحظة')
                                }
                              }}
                              title="حذف الملاحظة"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {editingNoteIdx === ni ? (
                        <div className="space-y-2 mt-1">
                          <Textarea
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            className="min-h-[80px] text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 text-white hover:bg-emerald-700"
                              disabled={!editingNoteText.trim()}
                              onClick={async () => {
                                try {
                                  await apiUpdateNote(n.id, { text: editingNoteText })
                                  const lead = historyModal.lead
                                  if (lead) {
                                    const updatedNotes = (lead.notes || []).map((note) =>
                                      note.id === n.id ? { ...note, text: editingNoteText } : note
                                    )
                                    updateLeadInCache(lead.id, { notes: updatedNotes })
                                    setHistoryModal((p) => ({
                                      ...p,
                                      lead: { ...lead, notes: updatedNotes },
                                    }))
                                  }
                                  addToast('success', '✅ تم تعديل الملاحظة')
                                  setEditingNoteIdx(null)
                                  setEditingNoteText('')
                                } catch {
                                  addToast('error', '❌ فشل تعديل الملاحظة')
                                }
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3 ml-1" /> حفظ
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setEditingNoteIdx(null)
                                setEditingNoteText('')
                              }}
                            >
                              إلغاء
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-foreground">{n.text}</div>
                      )}
                    </div>
                  )
                })
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setHistoryModal({ open: false, lead: null })
                setEditingNoteIdx(null)
                setEditingNoteText('')
              }}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Sales Meeting Card (matches old HTML renderLeadCard for meetings context) =====
function SalesMeetingCard({
  lead,
  index,
  currentRole,
  currentUser,
  marking,
  deleting,
  onMarkAttendance,
  onResetAttendance,
  onStatusChange,
  onDeleteMeeting,
  onAddNote,
  onViewHistory,
  onShowFullBrief,
}: {
  lead: Lead
  index: number
  currentRole: string | null
  currentUser: string | null
  marking: boolean
  deleting: boolean
  onMarkAttendance: (id: string, attended: boolean) => void
  onResetAttendance: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onDeleteMeeting: (id: string) => void
  onAddNote: (leadId: string) => void
  onViewHistory: (lead: Lead) => void
  onShowFullBrief: (lead: Lead) => void
}) {
  const refTime = lead.assignedAt || lead.createdAt
  const minsAgo = Math.floor((Date.now() - (refTime || 0)) / 60000)
  const isNew = minsAgo < 30 && (!lead.status || lead.status === 'new')
  const timeLabel = formatRelativeTime(refTime)

  // For sales: use salesStatus, for others: use status
  const isSales = currentRole === 'sales'
  const activeStatusKey = isSales ? lead.salesStatus || 'new' : lead.status || 'new'
  const statusList = isSales ? SALES_STATUSES : STATUSES
  const currentStatus = statusList.find((s) => s.key === activeStatusKey) || statusList[0]

  // Show actions if sales and owns the meeting
  const showActions = currentRole === 'sales' && lead.sales === currentUser

  const notes = lead.notes || []
  const hasName = lead.customerName && lead.customerName.trim()

  // Get status badge classes
  const statusClsMap: Record<string, string> = {
    'bg-venom/20 text-venom': 'bg-venom/20 text-venom',
    'bg-amber-500/20 text-amber-400': 'bg-amber-500/20 text-amber-400',
    'bg-emerald-500/20 text-emerald-400': 'bg-emerald-500/20 text-emerald-400',
    'bg-red-500/20 text-red-400': 'bg-red-500/20 text-red-400',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card
        className={`bg-card border border-border hover:border-venom/20 transition-all duration-200 overflow-hidden ${
          isNew ? 'ring-1 ring-venom/30' : ''
        }`}
      >
        <CardContent className="p-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-border/50 bg-muted/20">
            {isNew && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-venom text-venom-foreground animate-pulse">
                جديد
              </span>
            )}
            {activeStatusKey !== 'new' && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  currentStatus.cls || 'bg-muted text-muted-foreground'
                }`}
              >
                {currentStatus.label}
              </span>
            )}
            {lead.contactResult && (() => {
              const cr = CONTACT_RESULTS.find((c) => c.key === lead.contactResult)
              return cr ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted/50 text-muted-foreground border border-border">
                  {cr.label}
                </span>
              ) : null
            })()}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" /> {timeLabel}
            </span>
            {lead.tele && (
              <span className="text-xs text-muted-foreground">
                حجزته <strong className="text-foreground">{lead.tele}</strong>
              </span>
            )}
          </div>

          {/* Body: customer info + meeting date */}
          <div className="flex gap-3 px-4 py-3">
            {/* Customer Info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[13px] text-foreground truncate">
                  {hasName ? lead.customerName : <span className="text-muted-foreground font-normal">بدون اسم</span>}
                </span>
                {lead.customerType && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-venom/10 text-venom border border-venom/20">
                    {lead.customerType}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {lead.phone && (
                  <span className="inline-flex items-center gap-1" dir="ltr">
                    <Phone className="w-3 h-3" /> {normalizePhone(lead.phone)}
                  </span>
                )}
                {lead.storeUrl && (
                  <span className="inline-flex items-center gap-1 truncate max-w-[200px]" dir="ltr">
                    <LinkIcon className="w-3 h-3 shrink-0" />
                    <a
                      href={lead.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-venom hover:underline truncate"
                    >
                      {lead.storeUrl.replace(/^https?:\/\//, '').substring(0, 35)}
                    </a>
                  </span>
                )}
              </div>
              {lead.brief && (
                <div className="text-xs text-muted-foreground border-r-2 border-venom/40 pr-2 mt-1">
                  <strong className="text-[9px] text-venom">البريف:</strong>{' '}
                  {lead.brief.length > 120 ? (
                    <>
                      {truncate(lead.brief, 120)}{' '}
                      <button
                        className="text-venom hover:underline text-xs cursor-pointer"
                        onClick={() => onShowFullBrief(lead)}
                      >
                        [المزيد]
                      </button>
                    </>
                  ) : (
                    lead.brief
                  )}
                </div>
              )}
            </div>

            {/* Meeting Date/Time */}
            {lead.meetingDate && (
              <div className="shrink-0 text-center px-3 py-1.5 bg-muted/30 rounded-lg min-w-[75px]">
                <div className="text-[9px] text-muted-foreground">
                  {formatDate(new Date(lead.meetingDate).getTime())}
                </div>
                <div className="text-[13px] font-bold text-foreground">{lead.meetingTime || '—'}</div>
                {lead.meetingType && (
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {lead.meetingType === 'online' ? '🎥 أونلاين' : lead.meetingType === 'offline' ? '📍 حضوري' : ''}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes section (last note) */}
          {notes.length > 0 && (
            <div className="px-4 py-2 border-t border-border/30 bg-muted/10">
              <div className="py-0.5">
                <div className="text-[9px] text-muted-foreground">
                  {notes[notes.length - 1].by} · {formatRelativeTime(notes[notes.length - 1].at)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {truncate(notes[notes.length - 1].text, 100)}
                </div>
              </div>
              {notes.length > 1 && (
                <button
                  className="text-xs text-venom hover:underline mt-1 flex items-center gap-1 cursor-pointer"
                  onClick={() => onViewHistory(lead)}
                >
                  <History className="w-3 h-3" /> شوف باقي الملاحظات ({notes.length})
                </button>
              )}
            </div>
          )}

          {/* Action rows (only for sales who owns this meeting) */}
          {showActions && (
            <>
              {/* Attendance row */}
              <div className="px-4 py-2 border-t border-border/30">
                {(lead.attended !== 'attended' && lead.attended !== 'no-show') ? (
                  <div className="flex items-center gap-2 flex-wrap p-2 bg-amber-500/10 rounded-lg text-xs text-amber-400">
                    <Clock className="w-3.5 h-3.5" /> هل العميل حضر الاجتماع؟
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3 bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={marking}
                      onClick={() => onMarkAttendance(lead.id, true)}
                    >
                      {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 ml-0.5" />}
                      حضر
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3 bg-red-600 text-white hover:bg-red-700"
                      disabled={marking}
                      onClick={() => onMarkAttendance(lead.id, false)}
                    >
                      {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 ml-0.5" />}
                      لم يحضر
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                        lead.attended === 'attended'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {lead.attended === 'attended' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> حضر
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" /> لم يحضر
                        </>
                      )}
                    </span>
                    {lead.attended === 'attended' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-3 border-red-500/30 text-red-400 hover:bg-red-500/10"
                        disabled={marking}
                        onClick={() => onMarkAttendance(lead.id, false)}
                        title='تغيير لـ: لم يحضر'
                      >
                        <XCircle className="w-3 h-3 ml-0.5" /> غير لـ &quot;لم يحضر&quot;
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-3 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        disabled={marking}
                        onClick={() => onMarkAttendance(lead.id, true)}
                        title='تغيير لـ: حضر'
                      >
                        <CheckCircle2 className="w-3 h-3 ml-0.5" /> غير لـ &quot;حضر&quot;
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => onResetAttendance(lead.id)}
                      title="رجوع للوضع الأصلي (في الانتظار)"
                    >
                      <RefreshCw className="w-3 h-3 ml-0.5" /> رجوع للانتظار
                    </Button>
                  </div>
                )}
              </div>

              {/* Status + Actions row */}
              <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-t border-border/30">
                <Select
                  value={lead.salesStatus || 'new'}
                  onValueChange={(v) => onStatusChange(lead.id, v)}
                >
                  <SelectTrigger className="w-[160px] h-8 text-xs">
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

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs px-2 text-venom hover:text-venom/80"
                  onClick={() => onAddNote(lead.id)}
                >
                  <MessageSquarePlus className="w-3.5 h-3.5 ml-1" /> إضافة ملاحظة
                </Button>

                {notes.length > 2 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs px-2 text-muted-foreground"
                    onClick={() => onViewHistory(lead)}
                  >
                    <History className="w-3.5 h-3.5 ml-1" /> السجل ({notes.length})
                  </Button>
                )}

                {/* Delete button removed — sales cannot delete meetings transferred from telesales */}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
