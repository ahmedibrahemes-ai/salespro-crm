import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client using the service role key.
 * This bypasses Row Level Security (RLS) policies.
 *
 * IMPORTANT: This file MUST only be used in server-side code.
 * NO hardcoded credentials — environment variables only.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _supabaseAdmin: SupabaseClient | null = null

if (SUPABASE_URL && SERVICE_ROLE_KEY) {
  _supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
} else {
  console.warn('[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not set. Write operations will use authenticated client fallback.')
}

export function getSupabaseAdmin(): SupabaseClient | null {
  return _supabaseAdmin
}

export function isAdminAvailable(): boolean {
  return !!_supabaseAdmin
}

export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  if (!SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.')
  }
  if (!ANON_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.')
  }
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Create an anon/public client for read operations.
 * Used for reliable pagination in GET endpoints.
 * RLS SELECT policies should allow public reads.
 */
export function createAnonClient(): SupabaseClient | null {
  if (!SUPABASE_URL) {
    console.warn('[supabase-admin] NEXT_PUBLIC_SUPABASE_URL is not configured. Returning null.')
    return null
  }
  if (!ANON_KEY) {
    console.warn('[supabase-admin] NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured. Returning null.')
    return null
  }
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
