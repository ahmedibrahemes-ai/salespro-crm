'use client'

import { useCrmStore, PIPELINE_STAGES, getInitials, formatCurrency, getLostReasonLabel, getDaysSince } from '@/lib/store'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners, useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Clock, Check, X, GripVertical, AlertCircle } from 'lucide-react'
import type { Lead } from '@/lib/store'

// ===== Sortable Deal Card =====
function SortableDealCard({ lead, stageColor }: { lead: Lead; stageColor: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { status: lead.status },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const daysSince = getDaysSince(lead.createdAt)
  const timeLabel = daysSince === 0 ? 'اليوم' : daysSince === 1 ? 'أمس' : `منذ ${daysSince} يوم`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[#161b28] border border-white/[0.06] rounded-xl p-3 cursor-grab active:cursor-grabbing
        transition-all hover:-translate-y-0.5 hover:border-[#6c63ff]/40 hover:shadow-[0_4px_24px_rgba(0,0,0,.4)]
        ${lead.hot ? 'border-r-[3px] border-r-[#6c63ff]' : ''}
        ${lead.status === 'won' ? 'border-r-[3px] border-r-[#00d4aa]' : ''}
        ${lead.status === 'lost' ? 'border-r-[3px] border-r-[#ff4d4d]' : ''}
      `}
      {...attributes}
      {...listeners}
    >
      {/* Top row: Grip + Name */}
      <div className="flex items-center gap-1.5 mb-1">
        <GripVertical size={11} className="text-[#4a5280] shrink-0" />
        <span className="text-[14px] font-semibold text-[#f0f2ff] truncate flex-1">
          {lead.name}
          {lead.hot && <span className="mr-1">🔥</span>}
        </span>
        {lead.status === 'won' && (
          <div className="w-4 h-4 rounded-full bg-[#00d4aa]/20 flex items-center justify-center shrink-0">
            <Check size={10} className="text-[#00d4aa]" />
          </div>
        )}
      </div>

      {/* Value */}
      <div className="text-[13px] text-[#00d4aa] font-bold mr-5">
        {formatCurrency(lead.value)} EGP
      </div>

      {/* Time since creation */}
      <div className="text-[12px] text-[#4a5280] mt-0.5 flex items-center gap-1 mr-5">
        {lead.status === 'won' ? (
          <>
            <Check size={10} className="text-[#00d4aa]" />
            <span className="text-[#00d4aa]">تم الإغلاق</span>
          </>
        ) : lead.status === 'lost' ? (
          <>
            <X size={10} className="text-[#ff4d4d]" />
            <span className="text-[#ff4d4d]">{getLostReasonLabel(lead.lostReason) || 'خسارة'}</span>
          </>
        ) : (
          <>
            <Clock size={10} />
            <span>{timeLabel}</span>
          </>
        )}
      </div>

      {/* Lost reason detail */}
      {lead.status === 'lost' && lead.lostReason && (
        <div className="flex items-center gap-1 mt-1 mr-5">
          <AlertCircle size={9} className="text-[#ff4d4d]/60" />
          <span className="text-[11px] text-[#ff4d4d]/70">{getLostReasonLabel(lead.lostReason)}</span>
        </div>
      )}

      {/* Probability bar */}
      {lead.probability > 0 && lead.probability < 100 && (
        <div className="flex items-center gap-1.5 mt-1.5 mr-5">
          <div className="flex-1 h-[3px] bg-[#0a0d14] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${lead.probability}%`, background: stageColor }}
            />
          </div>
          <span className="text-[12px] text-[#8892b0] shrink-0">{lead.probability}%</span>
        </div>
      )}
    </div>
  )
}

// ===== Droppable Stage Column =====
function StageColumn({ stage, leads }: { stage: typeof PIPELINE_STAGES[number]; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.key,
    data: { status: stage.key },
  })

  const stageValue = leads.reduce((sum, l) => sum + l.value, 0)

  return (
    <div className="flex-1 min-w-[130px]">
      {/* Stage Header */}
      <div
        className="text-[13px] font-bold py-2 px-2.5 rounded-lg text-center mb-2.5 tracking-wide transition-all"
        style={{
          background: stage.bg,
          color: stage.color,
          border: isOver ? `1.5px solid ${stage.color}` : '1px solid transparent',
          boxShadow: isOver ? `0 0 12px ${stage.color}33` : 'none',
        }}
      >
        <div>{stage.labelEn}</div>
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <span className="text-[12px] opacity-80">{leads.length} deals</span>
          {stageValue > 0 && (
            <span className="text-[11px] opacity-60">· {formatCurrency(stageValue)}</span>
          )}
        </div>
      </div>

      {/* Cards Container */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 min-h-[120px] p-1 rounded-xl transition-all ${
          isOver ? 'bg-white/[0.03] ring-1 ring-white/[0.08]' : ''
        }`}
        data-stage={stage.key}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <SortableDealCard key={lead.id} lead={lead} stageColor={stage.color} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[13px] text-[#4a5280]">
            فارغ
          </div>
        )}
      </div>
    </div>
  )
}

// ===== Main Sales Pipeline =====
export function SalesPipeline() {
  const { leads, updateLead } = useCrmStore()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeLeads = leads.filter(l => !l.isArchived)

  const getLeadsByStage = useCallback((stageKey: string) => {
    return activeLeads.filter(l => l.status === stageKey)
  }, [activeLeads])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const leadId = String(active.id)
    const overId = String(over.id)

    // Determine target stage
    let newStage: string | null = null

    // Check if dropped directly on a stage column
    const stage = PIPELINE_STAGES.find(s => s.key === overId)
    if (stage) {
      newStage = stage.key
    } else {
      // Dropped on another lead — move to that lead's stage
      const targetLead = activeLeads.find(l => l.id === overId)
      if (targetLead && targetLead.status !== activeLeads.find(l => l.id === leadId)?.status) {
        newStage = targetLead.status
      }
    }

    if (newStage) {
      // Optimistic update
      updateLead(leadId, { status: newStage })

      // Persist to API
      try {
        await fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: leadId, status: newStage }),
        })
      } catch (err) {
        console.error('Failed to update lead status:', err)
      }
    }
  }

  const activeLead = activeId ? activeLeads.find(l => l.id === activeId) : null

  const totalPipelineValue = activeLeads
    .filter(l => !['won', 'lost'].includes(l.status))
    .reduce((sum, l) => sum + l.value, 0)

  const totalActiveDeals = activeLeads.filter(l => !['won', 'lost'].includes(l.status)).length

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-[#f0f2ff]">Sales Pipeline</h2>
          <p className="text-[14px] text-[#4a5280] mt-0.5">اسحب الكارت بين المراحل</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-[#111520] border border-white/[0.06] rounded-xl px-4 py-2.5">
            <div className="text-[12px] text-[#4a5280] uppercase tracking-wider">Pipeline Value</div>
            <div className="text-[18px] font-bold text-[#00d4aa] mt-0.5">
              {formatCurrency(totalPipelineValue)} <span className="text-[13px] text-[#4a5280]">EGP</span>
            </div>
          </div>
          <div className="bg-[#111520] border border-white/[0.06] rounded-xl px-4 py-2.5">
            <div className="text-[12px] text-[#4a5280] uppercase tracking-wider">Active Deals</div>
            <div className="text-[18px] font-bold text-[#f0f2ff] mt-0.5">{totalActiveDeals}</div>
          </div>
        </div>
      </div>

      {/* Pipeline Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-3 -mx-1">
          <div className="flex gap-3 min-w-[920px] px-1">
            {PIPELINE_STAGES.map(stage => (
              <StageColumn
                key={stage.key}
                stage={stage}
                leads={getLeadsByStage(stage.key)}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeLead && (
            <div className="bg-[#161b28] border-2 border-[#6c63ff] rounded-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,.5)] opacity-95 rotate-1">
              <div className="flex items-center gap-1.5 mb-1">
                <GripVertical size={11} className="text-[#6c63ff]" />
                <span className="text-[14px] font-semibold text-[#f0f2ff]">{activeLead.name}</span>
              </div>
              <div className="text-[13px] text-[#00d4aa] font-bold ml-5">
                {formatCurrency(activeLead.value)} EGP
              </div>
              {activeLead.probability > 0 && activeLead.probability < 100 && (
                <div className="flex items-center gap-1.5 mt-1.5 ml-5">
                  <div className="flex-1 h-[3px] bg-[#0a0d14] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#6c63ff]" style={{ width: `${activeLead.probability}%` }} />
                  </div>
                  <span className="text-[12px] text-[#8892b0] shrink-0">{activeLead.probability}%</span>
                </div>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </motion.div>
  )
}
