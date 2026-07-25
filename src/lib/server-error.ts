/**
 * Server error helper (audit H5).
 *
 * In production, catch blocks should NOT return err.message directly —
 * it can leak internal details like schema names, file paths, or stack traces.
 * This helper returns a generic Arabic message in production while preserving
 * the full error in server logs for debugging.
 *
 * IMPORTANT: Server-side only.
 */

/**
 * Get a safe error message for API responses.
 * - Development: return the actual error message (for debugging)
 * - Production: return a generic message (prevents information leakage)
 */
export function safeErrorMessage(err: unknown, fallback = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'): string {
  // Always log the full error server-side for debugging
  const fullMessage = err instanceof Error ? err.message : String(err)
  console.error('[server-error]', fullMessage, err instanceof Error ? err.stack : '')

  if (process.env.NODE_ENV === 'production') {
    return fallback
  }
  return fullMessage
}
