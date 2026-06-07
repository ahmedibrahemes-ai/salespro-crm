import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client using the service role key.
 * This bypasses Row Level Security (RLS) policies.
 *
 * IMPORTANT: This file MUST only be used in server-side code
 * (API routes, Server Components, Server Actions).
 * NEVER import this in client-side code.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gopgmisvyvqdbgkfekuf.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvcGdtaXN2eXZxZGJna2Zla3VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MDcwNjksImV4cCI6MjA5NDM4MzA2OX0.TBj7jDZ5lCLMJcoXZOoWY7-RXBIa47FKeS1lkjqWUgA'

let _supabaseAdmin: SupabaseClient | null = null

// Only create the admin client if the service role key is provided
// This prevents "supabaseKey is required" crash during build
if (SERVICE_ROLE_KEY) {
  _supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
} else {
  console.warn('[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not set. Write operations will use authenticated client fallback.')
}

/**
 * Returns the service-role Supabase client (bypasses RLS), or null if the key is not configured.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  return _supabaseAdmin
}

export function isAdminAvailable(): boolean {
  return !!_supabaseAdmin
}

/**
 * Create a Supabase client authenticated with the user's access token.
 * This allows write operations if RLS policies permit authenticated users.
 * Requires NEXT_PUBLIC_SUPABASE_ANON_KEY to be set.
 */
export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  if (!ANON_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured. Please add it to your environment variables.')
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
