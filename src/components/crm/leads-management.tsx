'use client'

import { useState, useMemo } from 'react'
import {
  useCrmStore,
  LEAD_SOURCES,
  getInitials,
  getTemperatureLabel,
  getSourceLabel,
  isOverdue,
  isToday,
  getDaysSince,
  formatCurrency,
  type Lead,
} from '@/lib/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  UserPlus,
  Filter,
  Phone,
  MessageCircle,
  Mail,
  UserCircle,
  Flame,
  Search,
  Calendar,
  Clock,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ───────── Avatar with temperature color ───────── */
function LeadAvatar({ lead }: { lead: Lead }) {
  const temp = getTemperatureLabel(lead)
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
      style={{
        background: temp.bg,
        color: temp.color,
        border: `1.5px solid ${temp.color}33`,
      }}
    >
      {getInitials(lead.name)}
    </div>
  )
}

/* ───────── Action button (small icon) ───────── */
function ActionBtn({
  icon,
  label,
  color = '#8892b0',
  hoverBorder,
  hoverBg,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  color?: string
  hoverBorder?: string
  hoverBg?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="w-7 h-7 rounded-md border border-white/[0.06] flex items-center justify-center text-[14px] transition-all cursor-pointer hover:scale-105"
      style={{
        color,
      }}
      onMouseEnter={(e) => {
        if (hoverBorder) (e.currentTarget as HTMLElement).style.borderColor = hoverBorder
        if (hoverBg) (e.currentTarget as HTMLElement).style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {icon}
    </button>
  )
}

/* ───────── Temperature badge ───────── */
function TempBadge({ lead }: { lead: Lead }) {
  const temp = getTemperatureLabel(lead)
  return (
    <span
      className="text-[12px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: temp.bg, color: temp.color }}
    >
      {temp.label}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════ */
export function LeadsManagement() {
  const {
    leads,
    leadFilter,
    setLeadFilter,
    searchQuery,
    setSearchQuery,
    selectedLeadId,
    setSelectedLeadId,
    setCurrentView,
    addLead,
    addLeadDialogOpen,
    setAddLeadDialogOpen,
  } = useCrmStore()

  /* ── Dialog state (synced with global) ── */
  const dialogOpen = addLeadDialogOpen
  const setDialogOpen = setAddLeadDialogOpen
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  /* ── Filter panel ── */
  const [filterOpen, setFilterOpen] = useState(false)

  /* ── Form fields ── */
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'website',
    company: '',
    location: '',
    value: '',
    notes: '',
  })

  const setField = (key: string, val: string) =>
    setForm((p) => ({ ...p, [key]: val }))

  const resetForm = () =>
    setForm({
      name: '',
      phone: '',
      email: '',
      source: 'website',
      company: '',
      location: '',
      value: '',
      notes: '',
    })

  /* ── Derived data ── */
  const activeLeads = useMemo(
    () => leads.filter((l) => !l.isArchived),
    [leads]
  )

  const hotLeads = useMemo(
    () => activeLeads.filter((l) => l.hot),
    [activeLeads]
  )
  const warmLeads = useMemo(
    () =>
      activeLeads.filter(
        (l) => !l.hot && l.probability >= 50 && l.status !== 'won' && l.status !== 'lost'
      ),
    [activeLeads]
  )
  const coldLeads = useMemo(
    () =>
      activeLeads.filter(
        (l) => !l.hot && l.probability < 50 && l.status !== 'won' && l.status !== 'lost'
      ),
    [activeLeads]
  )
  const overdueLeads = useMemo(
    () => activeLeads.filter((l) => isOverdue(l)),
    [activeLeads]
  )
  const todayLeads = useMemo(
    () => activeLeads.filter((l) => isToday(l.nextFollowUp)),
    [activeLeads]
  )

  /* filtered + searched leads */
  const filteredLeads = useMemo(() => {
    let list = activeLeads
    if (leadFilter === 'hot') list = hotLeads
    else if (leadFilter === 'warm') list = warmLeads
    else if (leadFilter === 'cold') list = coldLeads
    else if (leadFilter === 'overdue') list = overdueLeads

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.company && l.company.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q))
      )
    }
    return list
  }, [activeLeads, leadFilter, hotLeads, warmLeads, coldLeads, overdueLeads, searchQuery])

  /* ── Submit handler ── */
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError('اسم العميل مطلوب')
      return
    }
    setSubmitting(true)
    setFormError('')

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          source: form.source,
          company: form.company.trim(),
          location: form.location.trim(),
          value: Number(form.value) || 0,
          notes: form.notes.trim(),
          status: 'new',
          probability: 20,
          hot: false,
        }),
      })

      if (!res.ok) throw new Error('Failed to create lead')

      const created: Lead = await res.json()
      addLead(created)
      setDialogOpen(false)
      resetForm()
    } catch {
      setFormError('حدث خطأ أثناء إضافة العميل')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Open 360 view ── */
  const open360 = (id: string) => {
    setSelectedLeadId(id)
    setCurrentView('client360')
  }

  /* ═══════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════ */
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* ──────── Top Action Bar ──────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Add Lead button */}
        <button
          onClick={() => {
            resetForm()
            setFormError('')
            setDialogOpen(true)
          }}
          className="bg-gradient-to-br from-[#6c63ff] to-[#8b84ff] text-white px-4 py-2 rounded-lg text-[15px] font-medium flex items-center gap-1.5 hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(108,99,255,0.4)] transition-all cursor-pointer"
        >
          <UserPlus size={14} />
          إضافة Lead
        </button>

        {/* Filter toggle */}
        <button
          onClick={() => setFilterOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[15px] font-medium border cursor-pointer transition-all ${
            filterOpen
              ? 'bg-[#6c63ff]/15 border-[#6c63ff]/30 text-[#8b84ff]'
              : 'bg-[#161b28] border-white/[0.06] text-[#8892b0] hover:border-[#6c63ff]/20 hover:text-[#a0a8d0]'
          }`}
        >
          <Filter size={14} />
          تصفية
        </button>

        {/* Search */}
        <div className="relative flex-1 max-w-[260px]">
          <Search
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5280] pointer-events-none"
          />
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 bg-[#161b28] border border-white/[0.06] rounded-lg text-[15px] text-[#f0f2ff] outline-none focus:border-[#6c63ff]/30 transition-colors"
            dir="rtl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[#4a5280] hover:text-[#8892b0] cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Count badges */}
        <div className="mr-auto flex gap-2 flex-wrap">
          {[
            { key: 'hot', label: 'Hot', count: hotLeads.length, cls: 'bg-[#ff6b6b]/15 text-[#ff6b6b]', ring: 'ring-[#ff6b6b]/40' },
            { key: 'warm', label: 'Warm', count: warmLeads.length, cls: 'bg-[#ffd166]/15 text-[#ffd166]', ring: 'ring-[#ffd166]/40' },
            { key: 'cold', label: 'Cold', count: coldLeads.length, cls: 'bg-[#6c9fff]/15 text-[#6c9fff]', ring: 'ring-[#6c9fff]/40' },
            { key: 'overdue', label: 'Overdue', count: overdueLeads.length, cls: 'bg-[#ff4d4d]/15 text-[#ff4d4d]', ring: 'ring-[#ff4d4d]/40' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() =>
                setLeadFilter(leadFilter === f.key ? 'all' : f.key)
              }
              className={`${f.cls} text-[14px] font-bold px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                leadFilter === f.key ? `ring-1 ${f.ring} ring-offset-1 ring-offset-[#0a0d14]` : ''
              }`}
            >
              {f.label}: {f.count}
            </button>
          ))}
        </div>
      </div>

      {/* ──────── Filter panel (collapsible) ──────── */}
      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-4 flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'الكل', icon: <UserCircle size={13} /> },
                { key: 'hot', label: 'Hot 🔥', icon: <Flame size={13} /> },
                { key: 'warm', label: 'Warm', icon: <Clock size={13} /> },
                { key: 'cold', label: 'Cold', icon: <AlertTriangle size={13} /> },
                { key: 'overdue', label: 'Overdue', icon: <AlertTriangle size={13} /> },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setLeadFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium border cursor-pointer transition-all ${
                    leadFilter === f.key
                      ? 'bg-[#6c63ff]/15 border-[#6c63ff]/30 text-[#8b84ff]'
                      : 'bg-[#161b28] border-white/[0.06] text-[#8892b0] hover:border-[#6c63ff]/20'
                  }`}
                >
                  {f.icon}
                  {f.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────── Overdue Leads Card ──────── */}
      {overdueLeads.length > 0 && (
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f2ff] mb-3.5">
            <Flame size={15} className="text-[#ff6b6b]" />
            عملاء متأخر عليهم متابعة
            <span className="text-[13px] font-normal text-[#8892b0]">
              ({overdueLeads.length})
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto scrollbar-thin">
            {overdueLeads.map((lead) => {
              const daysSince = lead.lastContactAt
                ? getDaysSince(lead.lastContactAt)
                : 0
              return (
                <div
                  key={lead.id}
                  className="flex items-center gap-2.5 py-2.5 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] rounded-lg px-2 transition-colors cursor-pointer"
                  onClick={() => open360(lead.id)}
                >
                  <LeadAvatar lead={lead} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-[#f0f2ff] truncate">
                      {lead.name}
                    </div>
                    <div className="text-[13px] text-[#8892b0]">
                      {getSourceLabel(lead.source)}
                      {daysSince > 0 && ` · ${daysSince} يوم بدون تواصل`}
                    </div>
                  </div>
                  <span className="bg-[#ff4d4d]/15 text-[#ff4d4d] text-[12px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    Overdue {lead.nextFollowUp ? `${getDaysSince(lead.nextFollowUp)}d` : ''}
                  </span>
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <ActionBtn
                      icon={<Phone size={12} />}
                      label="اتصال"
                      hoverBorder="#6c63ff"
                      hoverBg="rgba(108,99,255,0.1)"
                    />
                    <ActionBtn
                      icon={<MessageCircle size={12} />}
                      label="واتساب"
                      color="#25d366"
                      hoverBorder="#25d366"
                      hoverBg="rgba(37,211,102,0.1)"
                    />
                    <ActionBtn
                      icon={<Mail size={12} />}
                      label="إيميل"
                      color="#6c9fff"
                      hoverBorder="#6c9fff"
                      hoverBg="rgba(108,159,255,0.1)"
                    />
                    <ActionBtn
                      icon={<UserCircle size={12} />}
                      label="عرض 360°"
                      hoverBorder="#6c63ff"
                      hoverBg="rgba(108,99,255,0.1)"
                      onClick={() => open360(lead.id)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ──────── Today Follow-ups Card ──────── */}
      {todayLeads.length > 0 && (
        <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f2ff] mb-3.5">
            <Calendar size={15} className="text-[#00d4aa]" />
            متابعات اليوم
            <span className="text-[13px] font-normal text-[#8892b0]">
              ({todayLeads.length})
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto scrollbar-thin">
            {todayLeads.map((lead) => {
              const temp = getTemperatureLabel(lead)
              const followUpTime = lead.nextFollowUp
                ? new Date(lead.nextFollowUp).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''
              return (
                <div
                  key={lead.id}
                  className="flex items-center gap-2.5 py-2.5 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] rounded-lg px-2 transition-colors cursor-pointer"
                  onClick={() => open360(lead.id)}
                >
                  <LeadAvatar lead={lead} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-[#f0f2ff] truncate">
                      {lead.name}
                    </div>
                    <div className="text-[13px] text-[#8892b0]">
                      {temp.label}
                      {followUpTime && ` · مجدول ${followUpTime}`}
                    </div>
                  </div>
                  <span className="bg-[#00d4aa]/15 text-[#00d4aa] text-[12px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    Today
                  </span>
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <ActionBtn
                      icon={<Phone size={12} />}
                      label="اتصال"
                      hoverBorder="#6c63ff"
                      hoverBg="rgba(108,99,255,0.1)"
                    />
                    <ActionBtn
                      icon={<MessageCircle size={12} />}
                      label="واتساب"
                      color="#25d366"
                      hoverBorder="#25d366"
                      hoverBg="rgba(37,211,102,0.1)"
                    />
                    <ActionBtn
                      icon={<Calendar size={12} />}
                      label="تقويم"
                      color="#ffd166"
                      hoverBorder="#ffd166"
                      hoverBg="rgba(255,209,102,0.1)"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ──────── All Leads Card ──────── */}
      <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f2ff] mb-3.5">
          <UserCircle size={15} className="text-[#6c63ff]" />
          كل العملاء
          <span className="text-[13px] font-normal text-[#8892b0]">
            ({filteredLeads.length})
          </span>
        </div>
        <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
          {filteredLeads.length > 0 ? (
            filteredLeads.map((lead) => {
              const temp = getTemperatureLabel(lead)
              const daysSince = lead.lastContactAt
                ? getDaysSince(lead.lastContactAt)
                : 0
              return (
                <div
                  key={lead.id}
                  className={`flex items-center gap-2.5 py-2.5 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] rounded-lg px-2 transition-colors cursor-pointer ${
                    selectedLeadId === lead.id ? 'bg-[#6c63ff]/8 border-l-2 border-l-[#6c63ff]' : ''
                  }`}
                  onClick={() => open360(lead.id)}
                >
                  <LeadAvatar lead={lead} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-[#f0f2ff] truncate">
                      {lead.name}
                    </div>
                    <div className="text-[13px] text-[#8892b0]">
                      {getSourceLabel(lead.source)}
                      {daysSince > 0 ? ` · ${daysSince}d ago` : ''}
                      {lead.company ? ` · ${lead.company}` : ''}
                    </div>
                  </div>
                  <TempBadge lead={lead} />
                  {lead.value > 0 && (
                    <span className="text-[13px] text-[#8892b0] font-medium">
                      {formatCurrency(lead.value)}
                    </span>
                  )}
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <ActionBtn
                      icon={<Phone size={12} />}
                      label="اتصال"
                      hoverBorder="#6c63ff"
                      hoverBg="rgba(108,99,255,0.1)"
                    />
                    <ActionBtn
                      icon={<MessageCircle size={12} />}
                      label="واتساب"
                      color="#25d366"
                      hoverBorder="#25d366"
                      hoverBg="rgba(37,211,102,0.1)"
                    />
                    <ActionBtn
                      icon={<Mail size={12} />}
                      label="إيميل"
                      color="#6c9fff"
                      hoverBorder="#6c9fff"
                      hoverBg="rgba(108,159,255,0.1)"
                    />
                  </div>
                </div>
              )
            })
          ) : (
            <div className="py-12 text-center">
              <UserCircle size={32} className="mx-auto text-[#2a3050] mb-2" />
              <div className="text-[15px] text-[#8892b0]">لا يوجد عملاء</div>
              <div className="text-[13px] text-[#4a5280] mt-1">
                جرّب تغيير الفلتر أو البحث
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════ Add Lead Dialog ══════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#111520] border-white/[0.08] text-[#f0f2ff] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#f0f2ff] text-right" dir="rtl">
              إضافة Lead جديد
            </DialogTitle>
            <DialogDescription className="text-[#8892b0] text-right" dir="rtl">
              أدخل بيانات العميل الجديد
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2" dir="rtl">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label className="text-[#c0c6e0] text-[14px]">
                الاسم <span className="text-[#ff6b6b]">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="اسم العميل"
                className="bg-[#161b28] border-white/[0.06] text-[#f0f2ff] placeholder:text-[#4a5280] focus-visible:border-[#6c63ff]/40 focus-visible:ring-[#6c63ff]/20"
                dir="rtl"
              />
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-[#c0c6e0] text-[14px]">الهاتف</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="bg-[#161b28] border-white/[0.06] text-[#f0f2ff] placeholder:text-[#4a5280] focus-visible:border-[#6c63ff]/40 focus-visible:ring-[#6c63ff]/20"
                  dir="ltr"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[#c0c6e0] text-[14px]">الإيميل</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="email@example.com"
                  className="bg-[#161b28] border-white/[0.06] text-[#f0f2ff] placeholder:text-[#4a5280] focus-visible:border-[#6c63ff]/40 focus-visible:ring-[#6c63ff]/20"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Source */}
            <div className="grid gap-1.5">
              <Label className="text-[#c0c6e0] text-[14px]">المصدر</Label>
              <Select
                value={form.source}
                onValueChange={(val) => setField('source', val)}
              >
                <SelectTrigger className="bg-[#161b28] border-white/[0.06] text-[#f0f2ff] w-full focus:ring-[#6c63ff]/20">
                  <SelectValue placeholder="اختر المصدر" />
                </SelectTrigger>
                <SelectContent className="bg-[#161b28] border-white/[0.08] text-[#f0f2ff]">
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Company & Location */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-[#c0c6e0] text-[14px]">الشركة</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setField('company', e.target.value)}
                  placeholder="اسم الشركة"
                  className="bg-[#161b28] border-white/[0.06] text-[#f0f2ff] placeholder:text-[#4a5280] focus-visible:border-[#6c63ff]/40 focus-visible:ring-[#6c63ff]/20"
                  dir="rtl"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[#c0c6e0] text-[14px]">الموقع</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setField('location', e.target.value)}
                  placeholder="المدينة / المنطقة"
                  className="bg-[#161b28] border-white/[0.06] text-[#f0f2ff] placeholder:text-[#4a5280] focus-visible:border-[#6c63ff]/40 focus-visible:ring-[#6c63ff]/20"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Value */}
            <div className="grid gap-1.5">
              <Label className="text-[#c0c6e0] text-[14px]">القيمة (EGP)</Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setField('value', e.target.value)}
                placeholder="0"
                className="bg-[#161b28] border-white/[0.06] text-[#f0f2ff] placeholder:text-[#4a5280] focus-visible:border-[#6c63ff]/40 focus-visible:ring-[#6c63ff]/20"
                dir="ltr"
              />
            </div>

            {/* Notes */}
            <div className="grid gap-1.5">
              <Label className="text-[#c0c6e0] text-[14px]">ملاحظات</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="أضف ملاحظات عن العميل..."
                className="bg-[#161b28] border-white/[0.06] text-[#f0f2ff] placeholder:text-[#4a5280] focus-visible:border-[#6c63ff]/40 focus-visible:ring-[#6c63ff]/20 min-h-[80px]"
                dir="rtl"
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="bg-[#ff4d4d]/10 border border-[#ff4d4d]/20 rounded-lg px-3 py-2 text-[14px] text-[#ff6b6b]">
                {formError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 rounded-lg text-[15px] font-medium border border-white/[0.06] text-[#8892b0] hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-br from-[#6c63ff] to-[#8b84ff] text-white px-5 py-2 rounded-lg text-[15px] font-medium flex items-center gap-1.5 hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(108,99,255,0.4)] transition-all cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  جاري الإضافة...
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  إضافة العميل
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
