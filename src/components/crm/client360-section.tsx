'use client'

import { motion } from 'framer-motion'
import {
  Phone,
  MessageCircle,
  Mail,
  FileText,
  MapPin,
  Building,
  Globe,
  Brain,
  Edit,
} from 'lucide-react'
import { useCrmStore, getInitials, getSourceLabel, PIPELINE_STAGES, getStatusColor, type Activity } from '@/lib/store'

function getActivityIcon(type: string) {
  switch (type) {
    case 'call': return <Phone size={12} />
    case 'whatsapp': return <MessageCircle size={12} />
    case 'email': return <Mail size={12} />
    case 'note': return <FileText size={12} />
    default: return <FileText size={12} />
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'call': return { bg: 'bg-[#6c63ff]/15', text: 'text-[#6c63ff]', dot: '#6c63ff' }
    case 'whatsapp': return { bg: 'bg-[#00d4aa]/15', text: 'text-[#00d4aa]', dot: '#00d4aa' }
    case 'email': return { bg: 'bg-[#6c9fff]/15', text: 'text-[#6c9fff]', dot: '#6c9fff' }
    case 'note': return { bg: 'bg-[#ffd166]/15', text: 'text-[#ffd166]', dot: '#ffd166' }
    default: return { bg: 'bg-[#8892b0]/15', text: 'text-[#8892b0]', dot: '#8892b0' }
  }
}

export default function Client360Section() {
  const { leads, selectedLeadId } = useCrmStore()

  const lead = selectedLeadId
    ? leads.find(l => l.id === selectedLeadId)
    : leads[0]

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8892b0]">
        لا يوجد بيانات عميل
      </div>
    )
  }

  const statusInfo = getStatusColor(lead.status)
  const stageLabel = PIPELINE_STAGES.find(s => s.key === lead.status)?.label || lead.status
  const activities = lead.activities || []

  const aiScore = lead.probability >= 80 ? 9.2 : lead.probability >= 60 ? 7.8 : lead.probability >= 40 ? 5.4 : 3.2

  const infoItems = [
    { icon: Globe, label: 'المصدر', value: getSourceLabel(lead.source) },
    { icon: Phone, label: 'الهاتف', value: lead.phone },
    { icon: Mail, label: 'الإيميل', value: lead.email || 'غير محدد' },
    { icon: MapPin, label: 'الموقع', value: lead.location || 'غير محدد' },
    { icon: Building, label: 'المرحلة', value: stageLabel },
    { icon: Brain, label: 'AI Score', value: `${aiScore}/10` },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Header card */}
      <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-[#6c63ff]/10 to-transparent rounded-full -translate-x-12 -translate-y-12 pointer-events-none" />
        <div className="relative flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold shrink-0"
            style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
          >
            {getInitials(lead.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[#f0f2ff] text-lg font-bold">{lead.name}</h2>
              <span
                className="text-[12px] font-bold px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
              >
                {stageLabel}
              </span>
            </div>
            <p className="text-[#8892b0] text-sm mt-0.5">{lead.company || 'غير محدد'}</p>
            {lead.value > 0 && (
              <p className="text-[#00d4aa] text-sm font-semibold mt-1">
                فرصة: {lead.value.toLocaleString()} EGP
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="w-9 h-9 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center hover:bg-[#00d4aa]/20 transition-all">
              <Phone size={16} className="text-[#00d4aa]" />
            </button>
            <button className="w-9 h-9 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center hover:bg-[#00d4aa]/20 transition-all">
              <MessageCircle size={16} className="text-[#00d4aa]" />
            </button>
            <button className="w-9 h-9 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center hover:bg-[#00d4aa]/20 transition-all">
              <Mail size={16} className="text-[#00d4aa]" />
            </button>
            <button className="w-9 h-9 rounded-lg bg-[#161b28] flex items-center justify-center hover:bg-[#1c2234] transition-all border border-white/[0.06]">
              <Edit size={14} className="text-[#8892b0]" />
            </button>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {infoItems.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className="text-[#8892b0]" />
                <span className="text-[#8892b0] text-[12px]">{item.label}</span>
              </div>
              <p className="text-[#f0f2ff] text-sm font-medium truncate">{item.value}</p>
            </div>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="bg-[#111520] border border-white/[0.06] rounded-[14px] p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-[#6c63ff]" />
          <span className="text-sm font-semibold text-[#f0f2ff]">النشاط والتفاعل</span>
        </div>
        <div className="space-y-0 max-h-80 overflow-y-auto">
          {activities.length > 0 ? activities.map((activity, i) => {
            const colors = getActivityColor(activity.type)
            return (
              <div key={activity.id || i} className="flex gap-3 relative">
                {/* Timeline line */}
                {i < activities.length - 1 && (
                  <div className="absolute right-[15px] top-8 bottom-0 w-px bg-white/[0.04]" />
                )}
                {/* Dot */}
                <div
                  className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 z-10"
                  style={{ backgroundColor: `${colors.dot}20`, color: colors.dot }}
                >
                  {getActivityIcon(activity.type)}
                </div>
                {/* Content */}
                <div className="flex-1 pb-4 min-w-0">
                  <p className="text-[#f0f2ff] text-sm leading-relaxed">{activity.text}</p>
                  <p className="text-[#4a5280] text-[12px] mt-1">
                    {activity.createdAt ? new Date(activity.createdAt).toLocaleDateString('ar-EG', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    }) : ''}
                  </p>
                </div>
              </div>
            )
          }) : (
            <p className="text-[#8892b0] text-sm text-center py-6">لا يوجد نشاط مسجل</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
