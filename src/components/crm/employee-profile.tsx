'use client'

import { useMemo } from 'react'
import { useCrmStore, STATUSES, SALES_STATUSES, formatDate } from '@/lib/store'
import {
  Phone, Briefcase, Calendar, Trophy, Users, TrendingUp,
  Clock, CheckCircle2, XCircle, HourglassIcon, Target,
  PhoneCall, UserCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/* ═══════════════════════════════════════════════════════
   Employee Profile Component
   Each employee gets their own page with their stats & work
   ═══════════════════════════════════════════════════════ */
export function EmployeeProfile() {
  const currentUser = useCrmStore((s) => s.currentUser)
  const currentRole = useCrmStore((s) => s.currentRole)
  const leads = useCrmStore((s) => s.leads)

  /* ─── My leads only ─── */
  const myLeads = useMemo(() => {
    if (!currentUser) return []
    return leads.filter((l) => {
      if (l.isArchived) return false
      if (currentRole === 'tele') return l.tele === currentUser
      if (currentRole === 'sales') return l.sales === currentUser
      return false
    })
  }, [leads, currentUser, currentRole])

  /* ─── Tele Stats ─── */
  const teleStats = useMemo(() => {
    if (currentRole !== 'tele') return null
    const total = myLeads.length
    const contacted = myLeads.filter((l) => l.contactResult && l.contactResult !== 'none' && l.contactResult !== '').length
    const meetings = myLeads.filter((l) => l.meetingDate).length
    const transferred = myLeads.filter((l) => l.sales && l.meetingDate).length
    const closedWon = myLeads.filter((l) => l.status === 'closed-won').length
    const closedLost = myLeads.filter((l) => l.status === 'closed-lost').length
    const newLeads = myLeads.filter((l) => l.status === 'new' || !l.status).length
    const followup = myLeads.filter((l) => l.status === 'followup' || l.status === 'whatsapp').length
    const contactRate = total > 0 ? Math.round((contacted / total) * 100) : 0
    const meetingRate = contacted > 0 ? Math.round((meetings / contacted) * 100) : 0
    return { total, contacted, meetings, transferred, closedWon, closedLost, newLeads, followup, contactRate, meetingRate }
  }, [myLeads, currentRole])

  /* ─── Sales Stats ─── */
  const salesStats = useMemo(() => {
    if (currentRole !== 'sales') return null
    const total = myLeads.length
    const meetings = myLeads.filter((l) => l.meetingDate).length
    const attended = myLeads.filter((l) => l.attended === 'attended').length
    const noShow = myLeads.filter((l) => l.attended === 'no-show').length
    const pending = myLeads.filter((l) => !l.attended || l.attended === 'pending').length
    const closedWon = myLeads.filter((l) => l.salesStatus === 'closed-won').length
    const closedLost = myLeads.filter((l) => l.salesStatus === 'closed-lost').length
    const newLeads = myLeads.filter((l) => l.salesStatus === 'new' || !l.salesStatus).length
    const followup = myLeads.filter((l) => l.salesStatus === 'followup' || l.salesStatus === 'contacted').length
    const attendanceRate = (attended + noShow) > 0 ? Math.round((attended / (attended + noShow)) * 100) : 0
    const closingRate = (attended + noShow) > 0 ? Math.round((closedWon / (attended + noShow)) * 100) : 0

    // Today's meetings
    const todayStr = new Date().toISOString().split('T')[0]
    const todayMeetings = myLeads.filter((l) => l.meetingDate === todayStr)

    return { total, meetings, attended, noShow, pending, closedWon, closedLost, newLeads, followup, attendanceRate, closingRate, todayMeetings }
  }, [myLeads, currentRole])

  /* ─── Recent leads ─── */
  const recentLeads = useMemo(() => {
    return [...myLeads]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 10)
  }, [myLeads])

  /* ─── Status distribution ─── */
  const statusDistribution = useMemo(() => {
    if (currentRole === 'tele') {
      return STATUSES.map((s) => ({
        label: s.label,
        count: myLeads.filter((l) => l.status === s.key).length,
      })).filter((s) => s.count > 0)
    }
    return SALES_STATUSES.map((s) => ({
      label: s.label,
      count: myLeads.filter((l) => l.salesStatus === s.key).length,
    })).filter((s) => s.count > 0)
  }, [myLeads, currentRole])

  const maxStatusCount = Math.max(...statusDistribution.map((s) => s.count), 1)

  if (!currentUser) return null

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-[22px] font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)', fontFamily: 'Cairo, sans-serif' }}
        >
          {currentUser.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-[22px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {currentUser}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-[11px] border-0 font-bold ${currentRole === 'tele' ? 'bg-[#6c63ff]/20 text-[#a8a3ff]' : currentRole === 'sales' ? 'bg-[#00d4aa]/20 text-[#00d4aa]' : 'bg-amber-500/20 text-amber-400'}`}>
              {currentRole === 'tele' ? 'تيلي' : currentRole === 'sales' ? 'سيلز' : 'أدمن'}
            </Badge>
            <span className="text-[12px] text-[#8892b0]">
              {myLeads.length} عميل مسند
            </span>
          </div>
        </div>
      </div>

      {/* ═══ TELE STATS ═══ */}
      {teleStats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'إجمالي العملاء', value: teleStats.total, color: '#6c63ff', icon: Users },
              { label: 'تم التواصل', value: teleStats.contacted, color: '#00d4aa', icon: PhoneCall },
              { label: 'اجتماعات محجوزة', value: teleStats.meetings, color: '#ffd166', icon: Calendar },
              { label: 'تم التقفيل', value: teleStats.closedWon, color: '#00d4aa', icon: Trophy },
            ].map((k, i) => {
              const Icon = k.icon
              return (
                <div key={i} className="bg-[#111520] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-[#8892b0] font-semibold">{k.label}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}15` }}>
                      <Icon size={16} style={{ color: k.color }} />
                    </div>
                  </div>
                  <div className="text-[26px] font-bold" style={{ color: k.color, fontFamily: 'Cairo, sans-serif' }}>
                    {k.value}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-[#111520] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6c63ff]/15 flex items-center justify-center">
                    <TrendingUp size={18} className="text-[#6c63ff]" />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8892b0]">نسبة التواصل</div>
                    <div className="text-[22px] font-bold text-[#6c63ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {teleStats.contactRate}%
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#1c2234] overflow-hidden">
                  <div className="h-full rounded-full bg-[#6c63ff] transition-all duration-500" style={{ width: `${teleStats.contactRate}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#111520] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ffd166]/15 flex items-center justify-center">
                    <Target size={18} className="text-[#ffd166]" />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8892b0]">نسبة التحويل لاجتماع</div>
                    <div className="text-[22px] font-bold text-[#ffd166]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {teleStats.meetingRate}%
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#1c2234] overflow-hidden">
                  <div className="h-full rounded-full bg-[#ffd166] transition-all duration-500" style={{ width: `${teleStats.meetingRate}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#111520] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00d4aa]/15 flex items-center justify-center">
                    <UserCheck size={18} className="text-[#00d4aa]" />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8892b0]">تم التحويل للسيلز</div>
                    <div className="text-[22px] font-bold text-[#00d4aa]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {teleStats.transferred}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ═══ SALES STATS ═══ */}
      {salesStats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'إجمالي العملاء', value: salesStats.total, color: '#6c63ff', icon: Users },
              { label: 'اجتماعات اليوم', value: salesStats.todayMeetings.length, color: '#ffd166', icon: Calendar },
              { label: 'حضر', value: salesStats.attended, color: '#00d4aa', icon: CheckCircle2 },
              { label: 'لم يحضر', value: salesStats.noShow, color: '#ff6b6b', icon: XCircle },
              { label: 'تم التقفيل', value: salesStats.closedWon, color: '#00d4aa', icon: Trophy },
            ].map((k, i) => {
              const Icon = k.icon
              return (
                <div key={i} className="bg-[#111520] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-[#8892b0] font-semibold">{k.label}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}15` }}>
                      <Icon size={16} style={{ color: k.color }} />
                    </div>
                  </div>
                  <div className="text-[26px] font-bold" style={{ color: k.color, fontFamily: 'Cairo, sans-serif' }}>
                    {k.value}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-[#111520] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00d4aa]/15 flex items-center justify-center">
                    <TrendingUp size={18} className="text-[#00d4aa]" />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8892b0]">نسبة الحضور</div>
                    <div className="text-[22px] font-bold text-[#00d4aa]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {salesStats.attendanceRate}%
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#1c2234] overflow-hidden">
                  <div className="h-full rounded-full bg-[#00d4aa] transition-all duration-500" style={{ width: `${salesStats.attendanceRate}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#111520] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6c63ff]/15 flex items-center justify-center">
                    <Target size={18} className="text-[#6c63ff]" />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8892b0]">نسبة التقفيل</div>
                    <div className="text-[22px] font-bold text-[#6c63ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {salesStats.closingRate}%
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#1c2234] overflow-hidden">
                  <div className="h-full rounded-full bg-[#6c63ff] transition-all duration-500" style={{ width: `${salesStats.closingRate}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#111520] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ffd166]/15 flex items-center justify-center">
                    <HourglassIcon size={18} className="text-[#ffd166]" />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8892b0]">فى الانتظار</div>
                    <div className="text-[22px] font-bold text-[#ffd166]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {salesStats.pending}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Today's Meetings */}
          {salesStats.todayMeetings.length > 0 && (
            <Card className="bg-[#111520] border-white/[0.06]">
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px] text-[#f0f2ff] flex items-center gap-2">
                  <Calendar size={16} className="text-[#ffd166]" />
                  اجتماعات اليوم
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {salesStats.todayMeetings.map((lead) => (
                    <div key={lead.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[#0a0d14] border border-white/[0.04]">
                      <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/15 flex items-center justify-center text-[#6c63ff] shrink-0 text-[11px] font-bold">
                        {lead.customerName?.slice(0, 2) || '؟'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-[#f0f2ff] font-medium truncate">{lead.customerName || 'عميل'}</div>
                        <div className="text-[10px] text-[#8892b0]">{lead.meetingTime || '—'}</div>
                      </div>
                      <Badge className={`text-[9px] border-0 ${lead.attended === 'attended' ? 'bg-[#00d4aa]/15 text-[#00d4aa]' : lead.attended === 'no-show' ? 'bg-red-500/15 text-red-400' : 'bg-[#ffd166]/15 text-[#ffd166]'}`}>
                        {lead.attended === 'attended' ? 'حضر' : lead.attended === 'no-show' ? 'لم يحضر' : 'انتظار'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ═══ Status Distribution ═══ */}
      {statusDistribution.length > 0 && (
        <Card className="bg-[#111520] border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] text-[#f0f2ff] flex items-center gap-2">
              <TrendingUp size={16} className="text-[#6c63ff]" />
              توزيع الحالات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {statusDistribution.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[12px] text-[#f0f2ff] min-w-[100px] truncate">{s.label}</span>
                  <div className="flex-1 h-5 rounded-full bg-[#1c2234] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-[#6c63ff] to-[#00d4aa] transition-all duration-500"
                      style={{ width: `${(s.count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[12px] font-bold text-[#8892b0] min-w-[30px] text-left">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Recent Leads ═══ */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[14px] text-[#f0f2ff] flex items-center gap-2">
            <Clock size={16} className="text-[#6c63ff]" />
            آخر العملاء
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <div className="text-center py-8 text-[#4a5280] text-[12px]">لا يوجد عملاء بعد</div>
          ) : (
            <div className="space-y-1.5">
              {recentLeads.map((lead) => {
                const statusKey = currentRole === 'tele' ? lead.status : lead.salesStatus
                const statusObj = currentRole === 'tele'
                  ? STATUSES.find((s) => s.key === statusKey)
                  : SALES_STATUSES.find((s) => s.key === statusKey)
                return (
                  <div key={lead.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#1c2234]/50 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-[#6c63ff]/15 flex items-center justify-center text-[10px] text-[#a8a3ff] font-bold shrink-0">
                      {lead.customerName?.slice(0, 2) || '؟'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-[#f0f2ff] font-medium truncate">{lead.customerName || 'عميل'}</div>
                      <div className="text-[10px] text-[#4a5280]">{formatDate(lead.createdAt)}</div>
                    </div>
                    {statusObj && (
                      <Badge className="text-[9px] border-0 bg-[#1c2234] text-[#8892b0]">
                        {statusObj.label}
                      </Badge>
                    )}
                    {lead.meetingDate && (
                      <Badge className="bg-[#ffd166]/15 text-[#ffd166] text-[9px] border-0">
                        📅 {lead.meetingDate}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
