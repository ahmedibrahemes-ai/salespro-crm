'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Phone,
  Calendar,
  ArrowRightLeft,
  MoreHorizontal,
  Archive,
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  Hourglass,
  User,
} from 'lucide-react'
import {
  useCrmStore,
  CONTACT_RESULTS,
  SALES_STATUSES,
  ATTENDANCE_STATUSES,
  formatDate,
  formatRelativeTime,
} from '@/lib/store'
import {
  apiUpdateLead,
  apiAddNote,
  apiArchiveLeads,
  apiGetLeads,
  apiGetArchivedLeads,
} from '@/lib/supabase'
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

export function SalesSheet() {
  const { currentUser, leads, updateLeadInCache, setLeads, setArchivedLeads } = useCrmStore()
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit fields
  const [editSalesStatus, setEditSalesStatus] = useState('')
  const [editAttendance, setEditAttendance] = useState('')
  const [noteText, setNoteText] = useState('')

  // Filter leads for current sales user
  const myLeads = useMemo(() => {
    if (!currentUser) return []
    return leads.filter((l) => l.sales === currentUser)
  }, [leads, currentUser])

  const filtered = useMemo(() => {
    if (!search) return myLeads
    const q = search.toLowerCase()
    return myLeads.filter(
      (l) =>
        (l.customerName || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.storeUrl || '').toLowerCase().includes(q)
    )
  }, [myLeads, search])

  // Open detail
  const openDetail = (lead: Lead) => {
    setSelectedLead(lead)
    setEditSalesStatus(lead.salesStatus || 'new')
    setEditAttendance(lead.attended || 'pending')
    setNoteText('')
    setDetailOpen(true)
  }

  // Save detail
  const handleSave = useCallback(async () => {
    if (!selectedLead) return
    setSaving(true)
    try {
      const updates: Partial<Lead> = {
        salesStatus: editSalesStatus,
        attended: editAttendance,
        attendanceMarkedAt: editAttendance !== (selectedLead.attended || 'pending') ? Date.now() : selectedLead.attendanceMarkedAt,
        attendanceMarkedBy: editAttendance !== (selectedLead.attended || 'pending') ? currentUser : selectedLead.attendanceMarkedBy,
      }
      await apiUpdateLead(selectedLead.id, updates)
      updateLeadInCache(selectedLead.id, updates)

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
  }, [selectedLead, editSalesStatus, editAttendance, noteText, currentUser, updateLeadInCache])

  // Archive lead
  const handleArchive = useCallback(async (leadId: number) => {
    try {
      await apiArchiveLeads([leadId], currentUser || '')
      const [active, archived] = await Promise.all([apiGetLeads(false), apiGetArchivedLeads().catch(() => [])])
      setLeads(active)
      setArchivedLeads(archived)
      setDetailOpen(false)
      toast.success('تم الأرشفة')
    } catch {
      toast.error('فشل في الأرشفة')
    }
  }, [currentUser, setLeads, setArchivedLeads])

  // Get attendance badge
  const getAttBadge = (attended: string | null) => {
    const found = ATTENDANCE_STATUSES.find((s) => s.key === attended)
    if (!found) return <Badge variant="secondary" className="text-[10px]">—</Badge>
    return <Badge className={`text-[10px] ${found.cls}`}>{found.label}</Badge>
  }

  // Get status badge
  const getStatusBadge = (status: string | null) => {
    const found = SALES_STATUSES.find((s) => s.key === status)
    if (!found) return <Badge variant="secondary" className="text-[10px]">جديد</Badge>
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
        <h1 className="text-2xl font-bold venom-text-glow text-venom">شيتي</h1>
        <p className="text-muted-foreground mt-1">إدارة عملاء المبيعات ({myLeads.length})</p>
      </motion.div>

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

      {/* Table */}
      <Card className="bg-card border border-border overflow-hidden">
        <ScrollArea className="max-h-[calc(100vh-240px)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground w-10">#</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">العميل</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الموبايل</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">المتجر</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">التلي</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحضور</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الاجتماع</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">لا توجد بيانات</td>
                  </tr>
                ) : (
                  filtered.map((lead, i) => (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.5) }}
                      className="border-b border-border/50 hover:bg-venom/5 transition-colors cursor-pointer"
                      onClick={() => openDetail(lead)}
                    >
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-medium truncate max-w-[130px]">{lead.customerName || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs" dir="ltr">{lead.phone || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[100px]">{lead.storeUrl || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{lead.tele || '—'}</td>
                      <td className="px-4 py-3">{getStatusBadge(lead.salesStatus)}</td>
                      <td className="px-4 py-3">{getAttBadge(lead.attended)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{lead.meetingDate || '—'}</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-venom">
              <MoreHorizontal className="w-5 h-5" />
              تفاصيل العميل
            </DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              {/* Basic Info */}
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
                  <p className="text-xs text-muted-foreground mb-1">التلي</p>
                  <p className="text-sm flex items-center gap-1">
                    <User className="w-3 h-3 text-venom" />
                    {selectedLead.tele || '—'}
                  </p>
                </div>
              </div>

              {/* Meeting Info */}
              {selectedLead.meetingDate && (
                <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-venom" />
                    <span className="text-muted-foreground">الاجتماع:</span>
                    <span>{formatDate(new Date(selectedLead.meetingDate).getTime())}</span>
                    {selectedLead.meetingTime && <span className="text-muted-foreground">{selectedLead.meetingTime}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>النوع: {selectedLead.meetingType === 'online' ? 'أونلاين' : 'حضوري'}</span>
                  </div>
                </div>
              )}

              {/* Editable Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">حالة المبيعات</label>
                  <Select value={editSalesStatus} onValueChange={setEditSalesStatus}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SALES_STATUSES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">الحضور</label>
                  <Select value={editAttendance} onValueChange={setEditAttendance}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> ملاحظة
                </label>
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="اكتب ملاحظة..." className="bg-background border-border min-h-[60px] resize-none" />
              </div>

              {/* Existing Notes */}
              {selectedLead.notes && selectedLead.notes.length > 0 && (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  <p className="text-xs text-muted-foreground">الملاحظات</p>
                  {selectedLead.notes.map((n) => (
                    <div key={n.id} className="bg-muted/30 rounded-lg p-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-medium text-venom">{n.by}</span>
                        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(n.at)}</span>
                      </div>
                      <p className="text-xs">{n.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetailOpen(false)} className="border-border">إلغاء</Button>
            {selectedLead && (
              <Button variant="outline" onClick={() => handleArchive(selectedLead.id)} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                <Archive className="w-4 h-4 ml-1" /> أرشفة
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
