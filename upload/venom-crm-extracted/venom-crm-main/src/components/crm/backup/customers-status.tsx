'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Filter,
  Phone,
  Store,
  User,
  Calendar,
  ClipboardList,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  Hourglass,
  Loader2,
  MessageSquare,
} from 'lucide-react'
import {
  useCrmStore,
  CONTACT_RESULTS,
  SALES_STATUSES,
  ATTENDANCE_STATUSES,
  formatDate,
  formatRelativeTime,
  getDateRange,
} from '@/lib/store'
import { apiUpdateLead, apiAddNote, apiDeleteNote } from '@/lib/supabase'
import type { Lead } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

// ===== Main Component =====
export function CustomersStatus() {
  const { currentUser, currentRole, leads } = useCrmStore()
  const [search, setSearch] = useState('')
  const [attendanceFilter, setAttendanceFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Detail modal fields
  const [editAttendance, setEditAttendance] = useState<string>('')
  const [editSalesStatus, setEditSalesStatus] = useState<string>('')
  const [noteText, setNoteText] = useState('')

  // Filter leads by role
  const visibleLeads = useMemo(() => {
    if (!currentUser || !currentRole) return []
    if (currentRole === 'admin') return leads
    if (currentRole === 'tele') return leads.filter((l) => l.tele === currentUser)
    if (currentRole === 'sales') return leads.filter((l) => l.sales === currentUser)
    return []
  }, [leads, currentUser, currentRole])

  // Apply filters
  const filtered = useMemo(() => {
    const { from, to } = getDateRange(dateFilter, customFrom, customTo)

    return visibleLeads.filter((l) => {
      // Search
      if (search) {
        const q = search.toLowerCase()
        const matchSearch =
          (l.customerName || '').toLowerCase().includes(q) ||
          (l.phone || '').toLowerCase().includes(q) ||
          (l.storeUrl || '').toLowerCase().includes(q)
        if (!matchSearch) return false
      }

      // Attendance
      if (attendanceFilter !== 'all' && l.attended !== attendanceFilter) return false

      // Status
      if (statusFilter !== 'all') {
        if (currentRole === 'sales') {
          if (l.salesStatus !== statusFilter) return false
        } else {
          if (l.status !== statusFilter) return false
        }
      }

      // Date
      if (dateFilter !== 'all') {
        if (l.createdAt < from || l.createdAt >= to) return false
      }

      return true
    })
  }, [visibleLeads, search, attendanceFilter, statusFilter, dateFilter, customFrom, customTo, currentRole])

  // Open detail modal
  const openDetail = useCallback((lead: Lead) => {
    setSelectedLead(lead)
    setEditAttendance(lead.attended || 'pending')
    setEditSalesStatus(lead.salesStatus || 'new')
    setNoteText('')
    setDetailOpen(true)
  }, [])

  // Save changes
  const handleSave = useCallback(async () => {
    if (!selectedLead) return
    setSaving(true)
    try {
      const updates: Partial<Lead> = {}
      if (editAttendance !== (selectedLead.attended || 'pending')) {
        updates.attended = editAttendance
        updates.attendanceMarkedAt = Date.now()
        updates.attendanceMarkedBy = currentUser
      }
      if (currentRole === 'sales' && editSalesStatus !== (selectedLead.salesStatus || 'new')) {
        updates.salesStatus = editSalesStatus
      }

      if (Object.keys(updates).length > 0) {
        await apiUpdateLead(selectedLead.id, updates)
        const store = useCrmStore.getState()
        store.updateLeadInCache(selectedLead.id, updates)
      }

      // Add note if provided
      if (noteText.trim()) {
        await apiAddNote(selectedLead.id, currentUser || '', 'note', noteText.trim())
      }

      toast.success('تم الحفظ بنجاح')
      setDetailOpen(false)
    } catch {
      toast.error('فشل في الحفظ')
    } finally {
      setSaving(false)
    }
  }, [selectedLead, editAttendance, editSalesStatus, noteText, currentUser, currentRole])

  // Get status badge
  const getStatusBadge = useCallback(
    (lead: Lead) => {
      if (currentRole === 'sales' && lead.salesStatus) {
        const found = SALES_STATUSES.find((s) => s.key === lead.salesStatus)
        if (found) return <Badge className={`text-[10px] ${found.cls}`}>{found.label}</Badge>
      }
      const found = CONTACT_RESULTS.find((s) => s.key === lead.contactResult)
      if (found) return <Badge className="text-[10px] bg-venom/15 text-venom">{found.label}</Badge>
      return <Badge variant="secondary" className="text-[10px]">جديد</Badge>
    },
    [currentRole]
  )

  // Get attendance badge
  const getAttendanceBadge = (attended: string | null) => {
    const found = ATTENDANCE_STATUSES.find((s) => s.key === attended)
    if (!found) return <Badge variant="secondary" className="text-[10px]">—</Badge>
    return <Badge className={`text-[10px] ${found.cls}`}>{found.label}</Badge>
  }

  if (!currentUser) return null

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold venom-text-glow text-venom">موقف العملاء</h1>
        <p className="text-muted-foreground mt-1">
          {currentRole === 'admin' ? 'جميع العملاء' : currentRole === 'sales' ? 'عملاء المبيعات' : 'عملاء التلي'}
        </p>
      </motion.div>

      {/* Filter pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="space-y-3"
      >
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الموبايل أو المتجر..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-background border-border focus:border-venom/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Attendance filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground ml-1">الحضور:</span>
            {[
              { key: 'all', label: 'الكل' },
              { key: 'pending', label: '⏳' },
              { key: 'attended', label: '✅' },
              { key: 'no-show', label: '❌' },
            ].map((f) => (
              <Button
                key={f.key}
                variant={attendanceFilter === f.key ? 'default' : 'outline'}
                size="sm"
                className={
                  attendanceFilter === f.key
                    ? 'bg-venom/20 text-venom border-venom/30 h-7 text-xs px-2'
                    : 'border-border h-7 text-xs px-2 hover:border-venom/30'
                }
                onClick={() => setAttendanceFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Date filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground ml-1">التاريخ:</span>
            {[
              { key: 'all', label: 'الكل' },
              { key: 'today', label: 'اليوم' },
              { key: 'week', label: 'أسبوع' },
              { key: 'custom', label: 'تاريخ' },
            ].map((f) => (
              <Button
                key={f.key}
                variant={dateFilter === f.key ? 'default' : 'outline'}
                size="sm"
                className={
                  dateFilter === f.key
                    ? 'bg-venom/20 text-venom border-venom/30 h-7 text-xs px-2'
                    : 'border-border h-7 text-xs px-2 hover:border-venom/30'
                }
                onClick={() => setDateFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-32 h-7 text-xs bg-background border-border"
                />
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-32 h-7 text-xs bg-background border-border"
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ClipboardList className="w-4 h-4 text-venom" />
        <span>عدد النتائج: <span className="text-venom font-bold">{filtered.length}</span></span>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card className="bg-card border border-border overflow-hidden">
          <ScrollArea className="max-h-[calc(100vh-320px)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground w-10">#</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">العميل</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">الموبايل</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">المتجر</th>
                    {(currentRole === 'admin' || currentRole === 'sales') && (
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">التلي</th>
                    )}
                    {(currentRole === 'admin' || currentRole === 'tele') && (
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">السيلز</th>
                    )}
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">نتيجة التواصل</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحالة</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحضور</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">تاريخ الاجتماع</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                        لا توجد بيانات
                      </td>
                    </tr>
                  ) : (
                    filtered.map((lead, i) => (
                      <motion.tr
                        key={lead.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.5) }}
                        className="border-b border-border/50 hover:bg-venom/5 transition-colors cursor-pointer group"
                        onClick={() => openDetail(lead)}
                      >
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground truncate max-w-[150px]">
                          {lead.customerName || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs" dir="ltr">
                          {lead.phone || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">
                          {lead.storeUrl || '—'}
                        </td>
                        {(currentRole === 'admin' || currentRole === 'sales') && (
                          <td className="px-4 py-3 text-muted-foreground">{lead.tele || '—'}</td>
                        )}
                        {(currentRole === 'admin' || currentRole === 'tele') && (
                          <td className="px-4 py-3 text-muted-foreground">{lead.sales || '—'}</td>
                        )}
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-[10px]">
                            {CONTACT_RESULTS.find((s) => s.key === lead.contactResult)?.label || '—'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(lead)}</td>
                        <td className="px-4 py-3">{getAttendanceBadge(lead.attended)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {lead.meetingDate || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-venom hover:text-venom hover:bg-venom/10 h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDetail(lead)
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </Card>
      </motion.div>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-venom">
              <ClipboardList className="w-5 h-5" />
              تفاصيل العميل
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">الاسم</p>
                  <p className="text-sm font-medium">{selectedLead.customerName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">الموبايل</p>
                  <p className="text-sm font-mono" dir="ltr">{selectedLead.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">المتجر</p>
                  <p className="text-sm">{selectedLead.storeUrl || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">تاريخ الإنشاء</p>
                  <p className="text-sm">{formatDate(selectedLead.createdAt)}</p>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">الحضور</label>
                  <Select value={editAttendance} onValueChange={setEditAttendance}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {currentRole === 'sales' && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">حالة المبيعات</label>
                    <Select value={editSalesStatus} onValueChange={setEditSalesStatus}>
                      <SelectTrigger className="bg-background border-border">
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
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  إضافة ملاحظة
                </label>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="اكتب ملاحظة..."
                  className="bg-background border-border min-h-[80px] resize-none"
                />
              </div>

              {/* Existing Notes */}
              {selectedLead.notes && selectedLead.notes.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  <p className="text-xs text-muted-foreground">الملاحظات السابقة</p>
                  {selectedLead.notes.map((note) => (
                    <div key={note.id} className="bg-muted/30 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-venom">{note.by}</span>
                        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(note.at)}</span>
                      </div>
                      <p className="text-xs text-foreground">{note.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDetailOpen(false)}
              className="border-border hover:border-venom/30"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
