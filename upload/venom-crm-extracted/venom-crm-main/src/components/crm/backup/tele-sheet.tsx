'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Phone,
  Store,
  Calendar,
  ArrowRightLeft,
  Plus,
  MoreHorizontal,
  Archive,
  MessageSquare,
  Loader2,
  Filter,
  CheckCircle2,
} from 'lucide-react'
import {
  useCrmStore,
  CONTACT_RESULTS,
  SALES_STATUSES,
  ATTENDANCE_STATUSES,
  formatDate,
  formatRelativeTime,
  normalizePhone,
  isValidSaudiPhone,
} from '@/lib/store'
import {
  apiUpdateLead,
  apiCreateLead,
  apiArchiveLeads,
  apiAddNote,
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

export function TeleSheet() {
  const { currentUser, leads, team, updateLeadInCache, addLeadToCache, setLeads, setArchivedLeads } = useCrmStore()
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit fields
  const [editContactResult, setEditContactResult] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editMeetingDate, setEditMeetingDate] = useState('')
  const [editMeetingTime, setEditMeetingTime] = useState('')
  const [editMeetingType, setEditMeetingType] = useState('')
  const [editMeetingLink, setEditMeetingLink] = useState('')
  const [editSales, setEditSales] = useState('')
  const [noteText, setNoteText] = useState('')

  // Add new lead fields
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newStore, setNewStore] = useState('')

  // Filter leads for current tele user
  const myLeads = useMemo(() => {
    if (!currentUser) return []
    return leads.filter((l) => l.tele === currentUser)
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
    setEditContactResult(lead.contactResult || '')
    setEditStatus(lead.status || 'new')
    setEditMeetingDate(lead.meetingDate || '')
    setEditMeetingTime(lead.meetingTime || '')
    setEditMeetingType(lead.meetingType || '')
    setEditMeetingLink(lead.meetingLink || '')
    setEditSales(lead.sales || '')
    setNoteText('')
    setDetailOpen(true)
  }

  // Save detail
  const handleSave = useCallback(async () => {
    if (!selectedLead) return
    setSaving(true)
    try {
      const updates: Partial<Lead> = {
        contactResult: editContactResult,
        contactResultAt: editContactResult ? Date.now() : null,
        status: editStatus,
        meetingDate: editMeetingDate,
        meetingTime: editMeetingTime,
        meetingType: editMeetingType,
        meetingLink: editMeetingLink,
        sales: editSales || null,
        assignedAt: editSales && !selectedLead.sales ? Date.now() : selectedLead.assignedAt,
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
  }, [selectedLead, editContactResult, editStatus, editMeetingDate, editMeetingTime, editMeetingType, editMeetingLink, editSales, noteText, currentUser, updateLeadInCache])

  // Add new lead
  const handleAddLead = useCallback(async () => {
    if (!newName.trim() || !newPhone.trim()) {
      toast.error('الاسم والموبايل مطلوبان')
      return
    }
    const normalized = normalizePhone(newPhone.trim())
    if (!isValidSaudiPhone(normalized)) {
      toast.error('رقم موبايل غير صحيح')
      return
    }
    setSaving(true)
    try {
      const lead = await apiCreateLead({
        customerName: newName.trim(),
        phone: normalized,
        storeUrl: newStore.trim(),
        tele: currentUser || '',
        status: 'new',
        contactResult: '',
        meetingDate: '',
        meetingTime: '',
        meetingType: '',
        meetingLink: '',
        attended: null,
        isArchived: false,
      } as Partial<Lead>)
      addLeadToCache(lead)
      toast.success('تم إضافة العميل بنجاح')
      setAddOpen(false)
      setNewName('')
      setNewPhone('')
      setNewStore('')
    } catch {
      toast.error('فشل في إضافة العميل')
    } finally {
      setSaving(false)
    }
  }, [newName, newPhone, newStore, currentUser, addLeadToCache])

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

  if (!currentUser) return null

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold venom-text-glow text-venom">شيتي</h1>
          <p className="text-muted-foreground mt-1">إدارة العملاء والمتابعة ({myLeads.length})</p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30"
        >
          <Plus className="w-4 h-4 ml-2" />
          عميل جديد
        </Button>
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
        <ScrollArea className="max-h-[calc(100vh-260px)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground w-10">#</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">العميل</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الموبايل</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">المتجر</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">نتيجة التواصل</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">السيلز</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الاجتماع</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">لا توجد بيانات</td>
                  </tr>
                ) : (
                  filtered.map((lead, i) => {
                    const cr = CONTACT_RESULTS.find((c) => c.key === lead.contactResult)
                    return (
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
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={`text-[10px] ${cr?.color || ''}`}>
                            {cr?.label || '—'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{lead.sales || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{lead.meetingDate || '—'}</td>
                      </motion.tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </Card>

      {/* Add Lead Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-venom">
              <Plus className="w-5 h-5" />
              عميل جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">اسم العميل *</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="الاسم" className="bg-background border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">الموبايل *</label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="05XXXXXXXX" dir="ltr" className="bg-background border-border font-mono" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">المتجر</label>
              <Input value={newStore} onChange={(e) => setNewStore(e.target.value)} placeholder="رابط المتجر" className="bg-background border-border" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} className="border-border">إلغاء</Button>
            <Button onClick={handleAddLead} disabled={saving} className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <p className="text-xs text-muted-foreground mb-1">تاريخ الإنشاء</p>
                  <p className="text-sm">{formatDate(selectedLead.createdAt)}</p>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">نتيجة التواصل</label>
                  <Select value={editContactResult} onValueChange={setEditContactResult}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONTACT_RESULTS.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">الحالة</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SALES_STATUSES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">تاريخ الاجتماع</label>
                  <Input type="date" value={editMeetingDate} onChange={(e) => setEditMeetingDate(e.target.value)} className="bg-background border-border" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">وقت الاجتماع</label>
                  <Input type="time" value={editMeetingTime} onChange={(e) => setEditMeetingTime(e.target.value)} className="bg-background border-border" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">نوع الاجتماع</label>
                  <Select value={editMeetingType} onValueChange={setEditMeetingType}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">أونلاين</SelectItem>
                      <SelectItem value="offline">حضوري</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">السيلز</label>
                  <Select value={editSales} onValueChange={setEditSales}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— بدون —</SelectItem>
                      {team.sales.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">رابط الاجتماع</label>
                <Input value={editMeetingLink} onChange={(e) => setEditMeetingLink(e.target.value)} placeholder="https://..." dir="ltr" className="bg-background border-border" />
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


