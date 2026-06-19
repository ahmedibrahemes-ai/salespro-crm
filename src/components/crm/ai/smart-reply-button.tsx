'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Copy, Check } from 'lucide-react'
import { useAI } from '@/hooks/use-ai'

/**
 * SmartReplyButton — generates a professional reply suggestion for a client message.
 *
 * Used in the chat/notes interface. On click, calls /api/ai with type 'smart-reply'
 * and shows the generated reply with a "copy" button.
 *
 * Props:
 * - message: the client's message to reply to
 * - leadName: the client's name
 * - stage: the current sales stage
 * - onUse: optional callback when the user copies the reply (e.g. to insert into textarea)
 */

interface SmartReplyButtonProps {
  message: string
  leadName: string
  stage: string
  onUse?: (reply: string) => void
}

export function SmartReplyButton({ message, leadName, stage, onUse }: SmartReplyButtonProps) {
  const { analyze, loading, result, error, reset } = useAI()
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setExpanded(true)
    setCopied(false)
    await analyze('smart-reply', {
      message,
      leadName,
      stage,
    })
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      if (onUse) onUse(result)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleReset = () => {
    setExpanded(false)
    reset()
    setCopied(false)
  }

  return (
    <div className="relative">
      <button
        onClick={handleGenerate}
        disabled={loading || !message.trim()}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#6c63ff]/15 to-[#00d4aa]/15 text-[#8b85ff] hover:from-[#6c63ff]/25 hover:to-[#00d4aa]/25 transition-all disabled:opacity-40 cursor-pointer border border-[#6c63ff]/20 text-[11px] font-medium"
        style={{ fontFamily: 'Cairo, sans-serif' }}
        title="اقتراح رد ذكي"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Sparkles className="w-3 h-3" />
        )}
        رد ذكي
      </button>

      {expanded && (
        <div
          className="mt-2 rounded-lg border border-[#6c63ff]/20 bg-[#6c63ff]/5 p-3"
          dir="rtl"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#8b85ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
              {loading ? 'جاري توليد الرد...' : 'الرد المقترح'}
            </span>
            <div className="flex gap-1">
              {result && !loading && (
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#6c63ff]/20 text-[#8b85ff] hover:bg-[#6c63ff]/30 transition-colors cursor-pointer"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {copied ? (
                    <>
                      <Check className="w-2.5 h-2.5" />
                      تم النسخ
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      نسخ
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleReset}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.04] text-[#8892b0] hover:bg-white/[0.08] transition-colors cursor-pointer"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                ✕
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-3 h-3 animate-spin text-[#6c63ff]" />
              <span className="text-[11px] text-[#8892b0]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                الذكاء الاصطناعي يكتب الرد...
              </span>
            </div>
          )}

          {error && !loading && (
            <p className="text-[11px] text-red-400" style={{ fontFamily: 'Cairo, sans-serif' }}>
              {error}
            </p>
          )}

          {result && !loading && !error && (
            <p
              className="text-[12px] leading-relaxed text-[#f0f2ff] whitespace-pre-wrap"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {result}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
