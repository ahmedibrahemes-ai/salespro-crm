/**
 * Password Hashing Module
 *
 * Uses bcrypt for new passwords (cost factor 10).
 * Maintains backward compatibility with legacy SHA-256 hashes by
 * auto-upgrading them to bcrypt on successful login.
 *
 * IMPORTANT: Server-side only. Never import this in client components.
 */

import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 10

/**
 * Hash a password using bcrypt.
 * Returns the bcrypt hash string (which embeds the salt).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/**
 * Verify a password against a stored hash.
 *
 * Supports two formats:
 *  - bcrypt hashes (start with "$2a$", "$2b$", "$2y$") → modern, secure
 *  - legacy SHA-256 hashes (64 hex chars) with separate salt → auto-upgrade on success
 *
 * Returns { valid, needsUpgrade }:
 *   - valid: whether the password matches
 *   - needsUpgrade: if true, the caller should re-hash the password with bcrypt
 *                   and store it back (replacing both password_hash and password_salt)
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt?: string | null
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!storedHash) return { valid: false, needsUpgrade: false }

  // Modern bcrypt hash
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    try {
      const valid = await bcrypt.compare(password, storedHash)
      return { valid, needsUpgrade: false }
    } catch {
      return { valid: false, needsUpgrade: false }
    }
  }

  // Legacy SHA-256 hash (hex string, with separate salt column)
  // Note: salt may be '' (empty string) for bcrypt-upgraded accounts — skip legacy check.
  if (salt && salt.length > 0) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password + salt)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const legacyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    if (legacyHash === storedHash) {
      // Password is correct but stored in legacy format — flag for upgrade
      return { valid: true, needsUpgrade: true }
    }
  }

  return { valid: false, needsUpgrade: false }
}

/**
 * Check whether a stored hash is legacy (SHA-256) and should be upgraded.
 */
export function isLegacyHash(storedHash: string): boolean {
  if (!storedHash) return false
  return !storedHash.startsWith('$2a$') && !storedHash.startsWith('$2b$') && !storedHash.startsWith('$2y$')
}

/**
 * Validate password strength (audit L5).
 * Requires: 8+ chars, at least one letter, at least one number.
 * Returns { valid, message } — message is Arabic for user-facing display.
 *
 * This is intentionally NOT as strict as "uppercase + lowercase + special char"
 * — the team uses Arabic keyboards and complex rules cause friction. The goal
 * is to prevent trivially weak passwords like "123456" or "aaaaaa".
 */
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'كلمة المرور يجب ألا تقل عن 8 أحرف' }
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: 'كلمة المرور يجب أن تحتوي على حرف واحد على الأقل' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل' }
  }
  return { valid: true }
}
