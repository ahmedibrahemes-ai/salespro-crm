'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Loader2, X, AlertCircle, Bot } from 'lucide-react'
import { useAI } from '@/hooks/use-ai'

/**
 * AIInsightButton — a reusable button that triggers an AI analysis and shows
 * the result in a popover/modal.
 *
 * Props:
 * - type: AI analysis type (predict-closure, call-analysis, coaching, smart-reply, analyze-performance)
 * - data: the data payload to send to the AI
 * - label: button label (default: "تحليل AI")
 * - icon: optional icon element
 * - variant: 'compact' | 'full' — controls button size
 * - onResult: optional callback when AI returns a result
 */

type AIType = 'analyze-performance' | 'call-analysis' | 'predict-closure' | 'coaching' | 'smart-reply'

interface AIInsightButtonProps {
  type: AIType
  data: Record<string, unknown>
  label?: string
  icon?: React.ReactNode
  variant?: 'compact' | 'full'
  onResult?: (result: string) => void
}

export function AIInsightButton({
  type,
  data,
  label = 'تحليل AI',
  icon,
  variant = 'compact',
  onResult,
}: AIInsightButtonProps) {
  const { analyze, loading, error, result, reset } = useAI()
  const [open, setOpen] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  const handleClick = async () => {
    setOpen(true)
    const res = await analyze(type, data)
    if (res && onResult) onResult(res)
  }

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        reset()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, reset])

  const isCompact = variant === 'compact'

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#6c63ff]/15 to-[#00d4aa]/15 text-[#8b85ff] hover:from-[#6c63ff]/25 hover:to-[#00d4aa]/25 transition-all disabled:opacity-50 cursor-pointer border border-[#6c63ff]/20 ${isCompact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'}`}
        style={{ fontFamily: 'Cairo, sans-serif' }}
        title="تحليل بالذكاء الاصطناعي"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          icon || <Sparkles className="w-3 h-3" />
        )}
        <span>{isCompact ? 'AI' : label}</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOpen(false)
              reset()
            }
          }}
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111520] shadow-2xl"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6c63ff] to-[#00d4aa]">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    {label}
                  </h3>
                  <p className="text-[11px] text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    تحليل بالذكاء الاصطناعي
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
                className="text-[#8892b0] hover:text-[#f0f2ff] transition-colors cursor-pointer p-1"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto max-h-[calc(85vh-140px)] px-5 py-5">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#00d4aa] animate-ping opacity-20" />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#6c63ff]/20 to-[#00d4aa]/20 border border-[#6c63ff]/30">
                      <Loader2 className="w-6 h-6 text-[#6c63ff] animate-spin" />
                    </div>
                  </div>
                  <p className="text-[13px] text-[#8892b0]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    جاري التحليل بالذكاء الاصطناعي...
                  </p>
                  <p className="text-[11px] text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    قد يستغرق هذا بضع ثوانٍ
                  </p>
                </div>
              )}

              {error && !loading && (
                <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold text-red-400" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      فشل التحليل
                    </p>
                    <p className="text-[12px] text-red-300/80 mt-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {result && !loading && !error && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-[#6c63ff]/20 bg-[#6c63ff]/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-[#6c63ff]" />
                      <span className="text-[12px] font-semibold text-[#8b85ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                        نتيجة التحليل
                      </span>
                    </div>
                    <div
                      className="text-[13px] leading-relaxed text-[#f0f2ff] whitespace-pre-wrap"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {result}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.06] px-5 py-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
                className="px-4 py-1.5 rounded-lg bg-white/[0.04] text-[#8892b0] text-[12px] font-medium hover:bg-white/[0.08] transition-colors cursor-pointer"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
