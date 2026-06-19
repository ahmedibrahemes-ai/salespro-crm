'use client'

import { useState, useCallback, useRef } from 'react'

/**
 * useAI — Hook for calling the /api/ai endpoint.
 *
 * Usage:
 *   const { analyze, loading, error, result, reset } = useAI()
 *   await analyze('predict-closure', { name, status, meetings, ... })
 *
 * The hook handles:
 * - session token injection (via authHeaders)
 * - loading state
 * - error handling (Arabic messages)
 * - abort controller for cancellation
 */

type AIType = 'analyze-performance' | 'call-analysis' | 'predict-closure' | 'coaching' | 'smart-reply'

interface UseAIState {
  loading: boolean
  error: string | null
  result: string | null
}

export function useAI() {
  const [state, setState] = useState<UseAIState>({
    loading: false,
    error: null,
    result: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const analyze = useCallback(async (type: AIType, data: Record<string, unknown>): Promise<string | null> => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setState({ loading: true, error: null, result: null })

    try {
      // Build headers with session token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      try {
        const token = localStorage.getItem('venom-session')
        if (token) headers['Authorization'] = `Bearer ${token}`
      } catch { /* ignore */ }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, data }),
        signal: controller.signal,
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        const msg = json.error || json.response || `فشل التحليل (HTTP ${res.status})`
        setState({ loading: false, error: msg, result: null })
        return null
      }

      const result = json.response as string
      setState({ loading: false, error: null, result })
      return result
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Aborted — don't update state (a newer request is in flight)
        return null
      }
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع'
      setState({ loading: false, error: msg, result: null })
      return null
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }, [])

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setState({ loading: false, error: null, result: null })
  }, [])

  return {
    ...state,
    analyze,
    reset,
  }
}
