/**
 * Session Token Management
 *
 * Lightweight HMAC-signed session tokens (JWT-like) for API authentication.
 * Tokens are issued by /api/auth (login action) and verified by auth-guard.ts.
 *
 * Token format: base64url(payload).base64url(signature)
 *   payload = { uid, uname, role, iat, exp }
 *   signature = HMAC-SHA256(payload, SESSION_SECRET)
 *
 * IMPORTANT: Server-side only. Never import this in client components.
 */

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days
const TOKEN_HEADER = 'authorization'

function getSessionSecret(): string {
  // Prefer a dedicated SESSION_HMAC_SECRET env var (audit §1 row 8 — decouples
  // session signing from the Supabase service role key, so rotating the DB
  // key doesn't invalidate all sessions, and losing one doesn't compromise both).
  //
  // Fallback to SUPABASE_SERVICE_ROLE_KEY for backward compatibility with
  // existing deployments that haven't set SESSION_HMAC_SECRET yet. This means
  // EXISTING sessions continue to work after this deploy — no forced logouts.
  // Once SESSION_HMAC_SECRET is set in Vercel, new sessions use it; old
  // sessions signed with the service-role key will fail verification and
  // users will be asked to log in again (one-time, expected).
  const secret = process.env.SESSION_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('SESSION_SECRET unavailable: set SESSION_HMAC_SECRET (preferred) or SUPABASE_SERVICE_ROLE_KEY')
  }
  return secret
}

export interface SessionPayload {
  uid: string | number
  uname: string
  role: 'tele' | 'sales' | 'admin'
  iat: number
  exp: number
}

// ===== base64url helpers (no Node Buffer needed — works on edge runtime) =====
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function stringToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

// ===== Token API =====

export async function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  }

  const payloadJson = JSON.stringify(fullPayload)
  const payloadB64 = bytesToBase64Url(stringToBytes(payloadJson))

  const secret = getSessionSecret()
  const secretBytes = stringToBytes(secret)
  const payloadB64Bytes = stringToBytes(payloadB64)
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, payloadB64Bytes as BufferSource)
  const sigB64 = bytesToBase64Url(new Uint8Array(sigBuffer))

  return `${payloadB64}.${sigB64}`
}

export async function verifySessionToken(token: string | null | undefined): Promise<SessionPayload | null> {
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [payloadB64, sigB64] = parts

  // Verify signature
  try {
    const secret = getSessionSecret()
    const secretBytes = stringToBytes(secret)
    const payloadBytes = stringToBytes(payloadB64)
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const sigBytes = base64UrlToBytes(sigB64)
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes as BufferSource, payloadBytes as BufferSource)
    if (!valid) return null
  } catch {
    return null
  }

  // Decode payload
  let payload: SessionPayload
  try {
    const payloadJson = bytesToString(base64UrlToBytes(payloadB64))
    payload = JSON.parse(payloadJson)
  } catch {
    return null
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp < now) {
    return null
  }

  return payload
}

// ===== Request helpers =====

export function extractTokenFromRequest(request: Request): string | null {
  const header = request.headers.get(TOKEN_HEADER)
  if (!header) return null
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.substring(7).trim()
  }
  return header.trim()
}

export { TOKEN_HEADER }
