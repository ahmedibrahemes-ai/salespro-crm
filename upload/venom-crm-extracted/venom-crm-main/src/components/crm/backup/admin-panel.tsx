'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Users,
  Phone,
  Calendar,
  Trophy,
  Shield,
  Settings,
  Key,
  DollarSign,
  TrendingUp,
  Search,
  Download,
  Eye,
  UserPlus,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRightLeft,
  Archive,
  Clock,
  UserCheck,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import {
  useCrmStore,
  CONTACT_RESULTS,
  SALES_STATUSES,
  ATTENDANCE_STATUSES,
  formatDate,
  formatRelativeTime,
  getDateRange,
  getAllLeadsForAnalytics,
  getCommissionSettings,
} from '@/lib/store'
import {
  apiAddTeamMember,
  apiRemoveTeamMember,
  apiRenameTeamMember,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

// ===== Tab names =====
const TABS = [
  { key: 'overview', label: 'نظرة عامة', icon: Shield },
  { key: 'tele', label: 'التلي سيلز', icon: Phone },
  { key: 'sales', label: 'السيلز', icon: TrendingUp },
  { key: 'all-leads', label: 'كل العملاء', icon: Users },
  { key: 'team', label: 'الفريق', icon: UserPlus },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
  { key: 'permissions', label: 'الصلاحيات', icon: Key },
  { key: 'commissions', label: 'العمولات', icon: DollarSign },
  { key: 'reports', label: 'التقارير', icon: BarChart3 },
]

// ===== Animated Counter =====
function StatCard({ icon, value, label, color, index = 0 }: { icon: React.ReactNode; value: number; label: string; color: string; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ scale: 1.03 }}
    >
      <Card className="bg-card border border-border hover:border-venom/30 transition-all duration-300 relative overflow-hidden group">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, ${color}10 0%, transparent 70%)` }} />
        <CardContent className="p-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full shrink-0" style={{ backgroundColor: `${color}15` }}>
              <div style={{ color }}>{icon}</div>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ===== Main Component =====
export function AdminPanel() {
  const { currentUser, currentRole, leads, archivedLeads, team, setTeam, setLeads, setArchivedLeads } = useCrmStore()
  const [activeTab, setActiveTab] = useState('overview')

  const allLeads = useMemo(() => getAllLeadsForAnalytics(leads, archivedLeads), [leads, archivedLeads])

  if (!currentUser || currentRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">صلاحية المدير مطلوبة</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold venom-text-glow text-venom">لوحة الإدارة</h1>
        <p className="text-muted-foreground mt-1">إدارة شاملة للنظام والفريق</p>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <TabsList className="bg-card border border-border p-1 gap-1 flex-wrap h-auto">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="data-[state=active]:bg-venom/15 data-[state=active]:text-venom text-xs gap-1.5 px-3 py-1.5"
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        <TabsContent value="overview"><OverviewTab leads={leads} archivedLeads={archivedLeads} allLeads={allLeads} team={team} /></TabsContent>
        <TabsContent value="tele"><TeleTab leads={leads} team={team} /></TabsContent>
        <TabsContent value="sales"><SalesTab leads={leads} team={team} /></TabsContent>
        <TabsContent value="all-leads"><AllLeadsTab leads={leads} allLeads={allLeads} /></TabsContent>
        <TabsContent value="team"><TeamTab team={team} setTeam={setTeam} setLeads={setLeads} setArchivedLeads={setArchivedLeads} /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab team={team} /></TabsContent>
        <TabsContent value="commissions"><CommissionsTab leads={leads} team={team} /></TabsContent>
        <TabsContent value="reports"><ReportsTab leads={leads} archivedLeads={archivedLeads} allLeads={allLeads} team={team} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ===== Overview Tab =====
function OverviewTab({ leads, archivedLeads, allLeads, team }: { leads: Lead[]; archivedLeads: Lead[]; allLeads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const totalLeads = leads.length
  const callsToday = leads.filter((l) => l.contactResult && l.contactResult.trim() !== '' && isToday(l.contactResultAt)).length
  const transfers = leads.filter((l) => l.sales && l.sales.trim() !== '').length
  const meetings = leads.filter((l) => l.meetingDate && l.meetingDate.trim() !== '').length
  const attended = leads.filter((l) => l.attended === 'attended').length
  const closedWon = leads.filter((l) => l.salesStatus === 'closed-won').length
  const totalArchived = archivedLeads.length

  const chartData = useMemo(() => getLast7DaysData(allLeads), [allLeads])

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} value={totalLeads} label="إجمالي العملاء" color="#00FF88" index={0} />
        <StatCard icon={<Phone className="w-5 h-5" />} value={callsToday} label="مكالمات اليوم" color="#8B5CF6" index={1} />
        <StatCard icon={<ArrowRightLeft className="w-5 h-5" />} value={transfers} label="تحويلات" color="#F59E0B" index={2} />
        <StatCard icon={<Calendar className="w-5 h-5" />} value={meetings} label="اجتماعات" color="#06B6D4" index={3} />
        <StatCard icon={<UserCheck className="w-5 h-5" />} value={attended} label="حضور" color="#10B981" index={4} />
        <StatCard icon={<Trophy className="w-5 h-5" />} value={closedWon} label="تقفيلات" color="#00FF88" index={5} />
        <StatCard icon={<Archive className="w-5 h-5" />} value={totalArchived} label="الأرشيف" color="#F43F5E" index={6} />
      </div>

      {/* Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-venom" />
              النشاط اليومي (آخر 7 أيام)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminVenomGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00FF88" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00FF88" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="adminPurpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2e22" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b8f7b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b8f7b' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a1410', border: '1px solid #1a2e22', borderRadius: '8px', fontSize: '12px', color: '#e8f5ee' }} />
                  <Area type="monotone" dataKey="leads" stroke="#00FF88" strokeWidth={2} fill="url(#adminVenomGrad)" name="عملاء" />
                  <Area type="monotone" dataKey="calls" stroke="#8B5CF6" strokeWidth={2} fill="url(#adminPurpleGrad)" name="مكالمات" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ===== Tele Tab =====
function TeleTab({ leads, team }: { leads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const [dateFilter, setDateFilter] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedTele, setSelectedTele] = useState<string>('all')

  const { from, to } = useMemo(() => getDateRange(dateFilter, customFrom, customTo), [dateFilter, customFrom, customTo])

  const teleLeads = useMemo(() => {
    let filtered = leads
    if (selectedTele !== 'all') filtered = filtered.filter((l) => l.tele === selectedTele)
    return filtered.filter((l) => l.createdAt >= from && l.createdAt < to)
  }, [leads, selectedTele, from, to])

  // Breakdown by contact result
  const resultBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    teleLeads.forEach((l) => {
      const key = l.contactResult || 'none'
      breakdown[key] = (breakdown[key] || 0) + 1
    })
    return breakdown
  }, [teleLeads])

  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedTele} onValueChange={setSelectedTele}>
          <SelectTrigger className="w-40 bg-background border-border"><SelectValue placeholder="التلي" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {team.tele.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {['all', 'today', 'week', 'month'].map((f) => (
          <Button key={f} variant={dateFilter === f ? 'default' : 'outline'} size="sm" className={dateFilter === f ? 'bg-venom/20 text-venom border-venom/30' : 'border-border hover:border-venom/30'} onClick={() => setDateFilter(f)}>
            {{ all: 'الكل', today: 'اليوم', week: 'أسبوع', month: 'شهر' }[f] || f}
          </Button>
        ))}
        {dateFilter === 'custom' && (
          <div className="flex gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-32 h-8 text-xs bg-background border-border" />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-32 h-8 text-xs bg-background border-border" />
          </div>
        )}
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {CONTACT_RESULTS.filter((c) => c.key !== '').map((cr) => (
          <div key={cr.key} className="text-center p-3 rounded-lg border border-border">
            <p className={`text-2xl font-bold ${(resultBreakdown[cr.key] || 0) > 0 ? cr.color : 'text-muted-foreground/30'}`}>{resultBreakdown[cr.key] || 0}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{cr.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <LeadsTable leads={teleLeads.slice(0, 100)} showTele={false} showSales />
    </div>
  )
}

// ===== Sales Tab =====
function SalesTab({ leads, team }: { leads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const [dateFilter, setDateFilter] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedSales, setSelectedSales] = useState<string>('all')

  const { from, to } = useMemo(() => getDateRange(dateFilter, customFrom, customTo), [dateFilter, customFrom, customTo])

  const salesLeads = useMemo(() => {
    let filtered = leads.filter((l) => l.sales)
    if (selectedSales !== 'all') filtered = filtered.filter((l) => l.sales === selectedSales)
    return filtered.filter((l) => l.createdAt >= from && l.createdAt < to)
  }, [leads, selectedSales, from, to])

  // Attendance breakdown
  const attendanceBreakdown = useMemo(() => ({
    pending: salesLeads.filter((l) => l.attended === 'pending' || !l.attended).length,
    attended: salesLeads.filter((l) => l.attended === 'attended').length,
    noShow: salesLeads.filter((l) => l.attended === 'no-show').length,
  }), [salesLeads])

  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedSales} onValueChange={setSelectedSales}>
          <SelectTrigger className="w-40 bg-background border-border"><SelectValue placeholder="السيلز" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {team.sales.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {['all', 'today', 'week', 'month'].map((f) => (
          <Button key={f} variant={dateFilter === f ? 'default' : 'outline'} size="sm" className={dateFilter === f ? 'bg-venom/20 text-venom border-venom/30' : 'border-border hover:border-venom/30'} onClick={() => setDateFilter(f)}>
            {{ all: 'الكل', today: 'اليوم', week: 'أسبوع', month: 'شهر' }[f] || f}
          </Button>
        ))}
      </div>

      {/* Attendance breakdown */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Clock className="w-5 h-5" />} value={attendanceBreakdown.pending} label="في الانتظار" color="#F59E0B" index={0} />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} value={attendanceBreakdown.attended} label="حضروا" color="#10B981" index={1} />
        <StatCard icon={<XCircle className="w-5 h-5" />} value={attendanceBreakdown.noShow} label="لم يحضروا" color="#EF4444" index={2} />
      </div>

      {/* Table */}
      <LeadsTable leads={salesLeads.slice(0, 100)} showTele showSales={false} />
    </div>
  )
}

// ===== All Leads Tab =====
function AllLeadsTab({ leads, allLeads }: { leads: Lead[]; allLeads: Lead[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    let result = leads
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((l) =>
        (l.customerName || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.storeUrl || '').toLowerCase().includes(q) ||
        (l.tele || '').toLowerCase().includes(q) ||
        (l.sales || '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') {
      result = result.filter((l) => l.status === statusFilter || l.salesStatus === statusFilter)
    }
    return result
  }, [leads, search, statusFilter])

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 bg-background border-border" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-background border-border"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {SALES_STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">{filtered.length} نتيجة</Badge>
      </div>
      <LeadsTable leads={filtered.slice(0, 200)} showTele showSales />
    </div>
  )
}

// ===== Team Tab =====
function TeamTab({ team, setTeam, setLeads, setArchivedLeads }: { team: { tele: string[]; sales: string[]; admin: string[] }; setTeam: (t: { tele: string[]; sales: string[]; admin: string[] }) => void; setLeads: (l: Lead[]) => void; setArchivedLeads: (l: Lead[]) => void }) {
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'tele' | 'sales'>('tele')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      await apiAddTeamMember(newName.trim(), newRole)
      const updated = { ...team }
      updated[newRole] = [...updated[newRole], newName.trim()]
      setTeam(updated)
      setNewName('')
      toast.success(`تم إضافة ${newName.trim()} للفريق`)
    } catch {
      toast.error('فشل في إضافة عضو')
    } finally {
      setLoading(false)
    }
  }, [newName, newRole, team, setTeam])

  const handleRemove = useCallback(async (name: string, role: 'tele' | 'sales') => {
    setLoading(true)
    try {
      await apiRemoveTeamMember(name)
      const updated = { ...team }
      updated[role] = updated[role].filter((n) => n !== name)
      setTeam(updated)
      toast.success(`تم حذف ${name}`)
    } catch {
      toast.error('فشل في حذف العضو')
    } finally {
      setLoading(false)
    }
  }, [team, setTeam])

  const handleRename = useCallback(async (oldName: string, newNameVal: string, role: 'tele' | 'sales') => {
    if (!newNameVal.trim()) return
    setLoading(true)
    try {
      await apiRenameTeamMember(oldName, newNameVal.trim())
      const updated = { ...team }
      updated[role] = updated[role].map((n) => n === oldName ? newNameVal.trim() : n)
      setTeam(updated)
      // Reload leads to reflect name changes
      const [active, archived] = await Promise.all([apiGetLeads(false), apiGetArchivedLeads().catch(() => [])])
      setLeads(active)
      setArchivedLeads(archived)
      setEditingName(null)
      toast.success(`تم إعادة تسمية ${oldName} إلى ${newNameVal.trim()}`)
    } catch {
      toast.error('فشل في إعادة التسمية')
    } finally {
      setLoading(false)
    }
  }, [team, setTeam, setLeads, setArchivedLeads])

  return (
    <div className="space-y-6 mt-4">
      {/* Add member */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-venom" />
            إضافة عضو جديد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم العضو" className="bg-background border-border" />
            </div>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as 'tele' | 'sales')}>
              <SelectTrigger className="w-32 bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tele">تلي</SelectItem>
                <SelectItem value="sales">سيلز</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={loading || !newName.trim()} className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30">
              <UserPlus className="w-4 h-4 ml-2" />
              إضافة
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tele team */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="w-4 h-4 text-venom" />
            فريق التلي ({team.tele.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {team.tele.map((name) => (
            <div key={name} className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-venom/20 transition-colors group">
              {editingName === name ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} className="h-8 bg-background border-border" />
                  <Button size="sm" onClick={() => handleRename(name, editNameValue, 'tele')} className="bg-venom/20 text-venom h-8">حفظ</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingName(null)} className="h-8">إلغاء</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-venom/10 flex items-center justify-center text-xs font-bold text-venom">{name.charAt(0)}</div>
                    <span className="text-sm font-medium">{name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-venom" onClick={() => { setEditingName(name); setEditNameValue(name) }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => handleRemove(name, 'tele')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sales team */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-venom-purple" />
            فريق المبيعات ({team.sales.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {team.sales.map((name) => (
            <div key={name} className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-venom-purple/20 transition-colors group">
              {editingName === `sales-${name}` ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} className="h-8 bg-background border-border" />
                  <Button size="sm" onClick={() => handleRename(name, editNameValue, 'sales')} className="bg-venom/20 text-venom h-8">حفظ</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingName(null)} className="h-8">إلغاء</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-venom-purple/10 flex items-center justify-center text-xs font-bold text-venom-purple">{name.charAt(0)}</div>
                    <span className="text-sm font-medium">{name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-venom-purple" onClick={() => { setEditingName(`sales-${name}`); setEditNameValue(name) }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => handleRemove(name, 'sales')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Settings Tab =====
function SettingsTab() {
  const [commissionPerAttendance, setCommissionPerAttendance] = useState('50')
  const [commissionPerClosed, setCommissionPerClosed] = useState('200')

  const handleSave = () => {
    localStorage.setItem('crm_commission_attendance', commissionPerAttendance)
    localStorage.setItem('crm_commission_closed', commissionPerClosed)
    toast.success('تم حفظ الإعدادات')
  }

  return (
    <div className="space-y-6 mt-4">
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-venom" />
            إعدادات العمولات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">عمولة الحضور (ريال)</label>
              <Input type="number" value={commissionPerAttendance} onChange={(e) => setCommissionPerAttendance(e.target.value)} className="bg-background border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">عمولة التقفيل (ريال)</label>
              <Input type="number" value={commissionPerClosed} onChange={(e) => setCommissionPerClosed(e.target.value)} className="bg-background border-border" />
            </div>
          </div>
          <Button onClick={handleSave} className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30">
            حفظ الإعدادات
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Permissions Tab =====
function PermissionsTab({ team }: { team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const [permissions, setPermissions] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('crm_permissions')
    if (saved) return JSON.parse(saved)
    const init: Record<string, string[]> = {}
    team.tele.forEach((t) => { init[t] = ['my-sheet', 'my-meetings', 'daily-report', 'my-archive', 'bulk-add'] })
    team.sales.forEach((s) => { init[s] = ['sales-sheet', 'meetings', 'customers-status', 'daily-report', 'my-archive'] })
    return init
  })

  const allPermissions = [
    { key: 'my-sheet', label: 'شيتي' },
    { key: 'sales-sheet', label: 'شيت المبيعات' },
    { key: 'my-meetings', label: 'اجتماعاتي' },
    { key: 'meetings', label: 'الاجتماعات' },
    { key: 'customers-status', label: 'موقف العملاء' },
    { key: 'daily-report', label: 'تقرير يومي' },
    { key: 'my-archive', label: 'الأرشيف' },
    { key: 'bulk-add', label: 'إضافة بيانات' },
    { key: 'admin', label: 'الإدارة' },
  ]

  const togglePermission = (member: string, perm: string) => {
    setPermissions((prev) => {
      const current = prev[member] || []
      const updated = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm]
      const newState = { ...prev, [member]: updated }
      localStorage.setItem('crm_permissions', JSON.stringify(newState))
      return newState
    })
  }

  return (
    <div className="space-y-4 mt-4">
      {[...team.tele, ...team.sales].map((member) => (
        <Card key={member} className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-venom/10 flex items-center justify-center text-xs font-bold text-venom">{member.charAt(0)}</div>
              {member}
              <Badge variant="secondary" className="text-[10px] mr-2">
                {team.tele.includes(member) ? 'تلي' : 'سيلز'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allPermissions.map((perm) => (
                <Button
                  key={perm.key}
                  variant={(permissions[member] || []).includes(perm.key) ? 'default' : 'outline'}
                  size="sm"
                  className={`text-xs h-7 ${(permissions[member] || []).includes(perm.key) ? 'bg-venom/20 text-venom border-venom/30' : 'border-border'}`}
                  onClick={() => togglePermission(member, perm.key)}
                >
                  {perm.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ===== Commissions Tab =====
function CommissionsTab({ leads, team }: { leads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const commSettings = getCommissionSettings()

  const teleCommissions = useMemo(() => {
    return team.tele.map((name) => {
      const myLeads = leads.filter((l) => l.tele === name)
      const attendedCount = myLeads.filter((l) => l.attended === 'attended').length
      const closedCount = myLeads.filter((l) => l.salesStatus === 'closed-won').length
      const total = (attendedCount * commSettings.perAttendance) + (closedCount * commSettings.perClosedDeal)
      return { name, attendedCount, closedCount, total }
    })
  }, [leads, team.tele, commSettings])

  const salesCommissions = useMemo(() => {
    return team.sales.map((name) => {
      const myLeads = leads.filter((l) => l.sales === name)
      const closedCount = myLeads.filter((l) => l.salesStatus === 'closed-won').length
      const total = closedCount * commSettings.perClosedDeal
      return { name, closedCount, total }
    })
  }, [leads, team.sales, commSettings])

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <DollarSign className="w-4 h-4 text-venom" />
        <span>عمولة الحضور: <span className="text-venom font-bold">{commSettings.perAttendance} {commSettings.currency}</span></span>
        <span className="mx-2">|</span>
        <span>عمولة التقفيل: <span className="text-venom font-bold">{commSettings.perClosedDeal} {commSettings.currency}</span></span>
      </div>

      {/* Tele commissions */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="w-4 h-4 text-venom" />
            عمولات التلي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">الاسم</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">حضور</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">تقفيلات</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {teleCommissions.map((c) => (
                  <tr key={c.name} className="border-b border-border/50">
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5">{c.attendedCount} × {commSettings.perAttendance} = <span className="text-emerald-400">{c.attendedCount * commSettings.perAttendance}</span></td>
                    <td className="px-4 py-2.5">{c.closedCount} × {commSettings.perClosedDeal} = <span className="text-venom">{c.closedCount * commSettings.perClosedDeal}</span></td>
                    <td className="px-4 py-2.5 font-bold text-venom">{c.total} {commSettings.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sales commissions */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-venom-purple" />
            عمولات المبيعات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">الاسم</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">تقفيلات</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {salesCommissions.map((c) => (
                  <tr key={c.name} className="border-b border-border/50">
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5">{c.closedCount} × {commSettings.perClosedDeal} = <span className="text-venom">{c.closedCount * commSettings.perClosedDeal}</span></td>
                    <td className="px-4 py-2.5 font-bold text-venom-purple">{c.total} {commSettings.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Reports Tab =====
function ReportsTab({ leads, archivedLeads, allLeads, team }: { leads: Lead[]; archivedLeads: Lead[]; allLeads: Lead[]; team: { tele: string[]; sales: string[]; admin: string[] } }) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [memberModalOpen, setMemberModalOpen] = useState(false)

  // KPI data
  const kpis = useMemo(() => ({
    totalLeads: leads.length,
    conversionRate: leads.length > 0 ? ((leads.filter((l) => l.salesStatus === 'closed-won').length / leads.length) * 100).toFixed(1) : '0',
    avgResponseTime: '—',
    totalRevenue: leads.filter((l) => l.salesStatus === 'closed-won').length,
  }), [leads])

  // Chart data per tele
  const teleChartData = useMemo(() => {
    return team.tele.map((name) => ({
      name,
      leads: leads.filter((l) => l.tele === name).length,
      calls: leads.filter((l) => l.tele === name && l.contactResult).length,
      transfers: leads.filter((l) => l.tele === name && l.sales).length,
      attended: leads.filter((l) => l.tele === name && l.attended === 'attended').length,
    }))
  }, [leads, team.tele])

  // Chart data per sales
  const salesChartData = useMemo(() => {
    return team.sales.map((name) => ({
      name,
      leads: leads.filter((l) => l.sales === name).length,
      attended: leads.filter((l) => l.sales === name && l.attended === 'attended').length,
      closed: leads.filter((l) => l.sales === name && l.salesStatus === 'closed-won').length,
    }))
  }, [leads, team.sales])

  // CSV export
  const exportReport = useCallback((type: 'tele' | 'sales') => {
    const data = type === 'tele' ? teleChartData : salesChartData
    const headers = type === 'tele' ? ['الاسم', 'عملاء', 'مكالمات', 'تحويلات', 'حضور'] : ['الاسم', 'عملاء', 'حضور', 'تقفيلات']
    const rows = data.map((d) => Object.values(d).map(String))
    const BOM = '\uFEFF'
    const csv = BOM + [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `تقرير-${type === 'tele' ? 'تلي' : 'سيلز'}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير التقرير')
  }, [teleChartData, salesChartData])

  // Open member detail
  const openMemberDetail = (name: string) => {
    setSelectedMember(name)
    setMemberModalOpen(true)
  }

  const memberLeads = useMemo(() => {
    if (!selectedMember) return []
    return leads.filter((l) => l.tele === selectedMember || l.sales === selectedMember)
  }, [leads, selectedMember])

  // Conversion matrix
  const conversionMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {}
    leads.forEach((l) => {
      const from = l.tele || 'none'
      const to = l.salesStatus || 'none'
      if (!matrix[from]) matrix[from] = {}
      matrix[from][to] = (matrix[from][to] || 0) + 1
    })
    return matrix
  }, [leads])

  return (
    <div className="space-y-6 mt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} value={kpis.totalLeads} label="إجمالي العملاء" color="#00FF88" index={0} />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} value={parseFloat(kpis.conversionRate)} label="معدل التحويل %" color="#8B5CF6" index={1} />
        <StatCard icon={<Clock className="w-5 h-5" />} value={0} label="متوسط الاستجابة" color="#F59E0B" index={2} />
        <StatCard icon={<Trophy className="w-5 h-5" />} value={kpis.totalRevenue} label="إجمالي التقفيلات" color="#10B981" index={3} />
      </div>

      {/* Tele chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-venom" />
                أداء التلي
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-venom h-7" onClick={() => exportReport('tele')}>
                <Download className="w-3.5 h-3.5 ml-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teleChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2e22" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b8f7b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b8f7b' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a1410', border: '1px solid #1a2e22', borderRadius: '8px', fontSize: '12px', color: '#e8f5ee' }} />
                  <Bar dataKey="leads" fill="#00FF88" name="عملاء" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="transfers" fill="#8B5CF6" name="تحويلات" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="attended" fill="#10B981" name="حضور" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Clickable member list */}
            <div className="flex flex-wrap gap-2 mt-3">
              {team.tele.map((name) => (
                <Button key={name} variant="outline" size="sm" className="border-border hover:border-venom/30 hover:text-venom text-xs h-7" onClick={() => openMemberDetail(name)}>
                  <Eye className="w-3 h-3 ml-1" /> {name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-venom-purple" />
                أداء المبيعات
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-venom h-7" onClick={() => exportReport('sales')}>
                <Download className="w-3.5 h-3.5 ml-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2e22" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b8f7b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b8f7b' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a1410', border: '1px solid #1a2e22', borderRadius: '8px', fontSize: '12px', color: '#e8f5ee' }} />
                  <Bar dataKey="leads" fill="#8B5CF6" name="عملاء" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="attended" fill="#10B981" name="حضور" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="closed" fill="#00FF88" name="تقفيلات" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {team.sales.map((name) => (
                <Button key={name} variant="outline" size="sm" className="border-border hover:border-venom-purple/30 hover:text-venom-purple text-xs h-7" onClick={() => openMemberDetail(name)}>
                  <Eye className="w-3 h-3 ml-1" /> {name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion matrix */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-venom" />
            مصفوفة التحويل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-right text-muted-foreground">التلي</th>
                  {SALES_STATUSES.map((s) => (
                    <th key={s.key} className="px-3 py-2 text-center text-muted-foreground">{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(conversionMatrix).map(([tele, statuses]) => (
                  <tr key={tele} className="border-b border-border/50">
                    <td className="px-3 py-2 font-medium text-venom">{tele}</td>
                    {SALES_STATUSES.map((s) => (
                      <td key={s.key} className="px-3 py-2 text-center">
                        {(statuses[s.key] || 0) > 0 ? (
                          <Badge className="text-[10px] bg-venom/15 text-venom">{statuses[s.key]}</Badge>
                        ) : (
                          <span className="text-muted-foreground/30">0</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Member Detail Modal */}
      <Dialog open={memberModalOpen} onOpenChange={setMemberModalOpen}>
        <DialogContent className="max-w-3xl bg-card border-border max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-venom">
              <Eye className="w-5 h-5" />
              تفاصيل {selectedMember}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <LeadsTable leads={memberLeads.slice(0, 100)} showTele showSales />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Shared: Leads Table =====
function LeadsTable({ leads, showTele, showSales }: { leads: Lead[]; showTele: boolean; showSales: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground w-10">#</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">العميل</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">الموبايل</th>
            {showTele && <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">التلي</th>}
            {showSales && <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">السيلز</th>}
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">الحالة</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">الحضور</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 ? (
            <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>
          ) : (
            leads.map((lead, i) => (
              <tr key={lead.id} className="border-b border-border/50 hover:bg-venom/5 transition-colors">
                <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium truncate max-w-[120px]">{lead.customerName || '—'}</td>
                <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs" dir="ltr">{lead.phone || '—'}</td>
                {showTele && <td className="px-3 py-2.5 text-muted-foreground">{lead.tele || '—'}</td>}
                {showSales && <td className="px-3 py-2.5 text-muted-foreground">{lead.sales || '—'}</td>}
                <td className="px-3 py-2.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {SALES_STATUSES.find((s) => s.key === lead.salesStatus)?.label || lead.status || '—'}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {ATTENDANCE_STATUSES.find((a) => a.key === lead.attended)?.label || '—'}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{formatDate(lead.createdAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ===== Helper Functions =====
function isToday(ts: number | null): boolean {
  if (!ts) return false
  const d = new Date(ts)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function getLast7DaysData(allLeads: Lead[]) {
  const days: { name: string; leads: number; calls: number }[] = []
  const dayNames = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']

  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const dayEnd = dayStart + 86400000

    days.push({
      name: dayNames[date.getDay()],
      leads: allLeads.filter((l) => l.createdAt >= dayStart && l.createdAt < dayEnd).length,
      calls: allLeads.filter((l) => l.contactResultAt && l.contactResultAt >= dayStart && l.contactResultAt < dayEnd).length,
    })
  }
  return days
}
