'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useAI } from '@/hooks/use-ai'

/**
 * AIScoreBadge — displays a lead closure probability score (0-100%).
 *
 * Calls /api/ai with type 'predict-closure' on first render, then caches
 * the result in localStorage (per lead ID) for 24 hours to avoid repeat calls.
 *
 * Shows a colored badge:
 * - Green (70-100%): high probability — TrendingUp icon
 * - Amber (40-69%): medium — Minus icon
 * - Red (0-39%): low — TrendingDown icon
 *
 * Hover/click shows the AI reasoning.
 */

interface AIScoreBadgeProps {
  leadId: string
  leadName: string
  status: string
  meetings: number
  attended: string | null
  salesStatus: string | null
  contactResult: string | null
}

const CACHE_KEY_PREFIX = 'ai-score-'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CachedScore {
  score: number | null
  reason: string
  timestamp: number
}

function getCachedScore(leadId: string): CachedScore | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + leadId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedScore
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function setCachedScore(leadId: string, score: number | null, reason: string) {
  try {
    localStorage.setItem(
      CACHE_KEY_PREFIX + leadId,
      JSON.stringify({ score, reason, timestamp: Date.now() })
    )
  } catch { /* ignore quota errors */ }
}

function extractScore(text: string): { score: number | null; reason: string } {
  // Try to extract a percentage from the AI response
  const match = text.match(/(\d{1,3})\s*%/)
  const score = match ? Math.min(100, Math.max(0, parseInt(match[1], 10))) : null
  return { score, reason: text }
}

export function AIScoreBadge({
  leadId,
  leadName,
  status,
  meetings,
  attended,
  salesStatus,
  contactResult,
}: AIScoreBadgeProps) {
  const { analyze, loading } = useAI()
  const [showTooltip, setShowTooltip] = useState(false)
  const [error, setError] = useState(false)
  const fetchedRef = useRef(false)

  // Lazy-initialize score+reason from localStorage cache (client-only).
  // We use a function initializer so we don't need a setState-in-effect.
  const [initialCache] = useState(() => {
    if (typeof window === 'undefined') return { score: null as number | null, reason: '' }
    return getCachedScore(leadId) || { score: null as number | null, reason: '' }
  })
  const [score, setScore] = useState<number | null>(initialCache.score)
  const [reason, setReason] = useState<string>(initialCache.reason)
  const [cachedChecked, setCachedChecked] = useState(!!initialCache.score || !!initialCache.reason)

  // Fetch from AI if not cached
  useEffect(() => {
    if (fetchedRef.current) return
    if (cachedChecked) return // already have cached data

    fetchedRef.current = true
    analyze('predict-closure', {
      name: leadName || 'عميل',
      status,
      meetings,
      attended: attended || 'pending',
      salesStatus: salesStatus || 'N/A',
      contactResult: contactResult || 'N/A',
    }).then((result) => {
      if (result) {
        const { score: extractedScore, reason: extractedReason } = extractScore(result)
        setScore(extractedScore)
        setReason(extractedReason)
        setCachedScore(leadId, extractedScore, extractedReason)
      } else {
        setError(true)
      }
    })
  }, [leadId, leadName, status, meetings, attended, salesStatus, contactResult, analyze, cachedChecked])

  // Don't render anything if loading hasn't started or failed
  if (error) return null

  if (loading && score === null) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/[0.04] text-[#4a5280]"
        title="جاري حساب الاحتمالية..."
      >
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        AI
      </span>
    )
  }

  if (score === null) return null

  // Determine color + icon based on score
  let color = 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  let Icon = Minus
  if (score >= 70) {
    color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    Icon = TrendingUp
  } else if (score < 40) {
    color = 'text-red-400 bg-red-500/10 border-red-500/20'
    Icon = TrendingDown
  }

  return (
    <span
      className={`relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-help ${color}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.stopPropagation()
        setShowTooltip(!showTooltip)
      }}
    >
      <Icon className="w-2.5 h-2.5" />
      <span>{score}%</span>
      <Sparkles className="w-2 h-2 opacity-50" />

      {showTooltip && reason && (
        <span
          className="absolute bottom-full right-0 mb-1 w-64 p-2.5 rounded-lg bg-[#1a1f2e] border border-white/[0.08] shadow-xl text-[11px] font-normal text-[#f0f2ff] leading-relaxed z-50 block whitespace-pre-wrap"
          style={{ fontFamily: 'Cairo, sans-serif' }}
          dir="rtl"
        >
          {reason.slice(0, 300)}
          {reason.length > 300 ? '...' : ''}
        </span>
      )}
    </span>
  )
}
