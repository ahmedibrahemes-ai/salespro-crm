// This file previously used Prisma which caused Vercel build failures.
// The project uses Supabase exclusively. Import from '@/lib/supabase' or
// '@/lib/supabase-admin' instead.
//
// This file is kept as a stub to prevent any remaining imports from breaking.
// It will be removed in a future cleanup.

console.warn(
  '[db] Prisma is no longer used. This project uses Supabase. ' +
  'Import from @/lib/supabase or @/lib/supabase-admin instead.'
)

export const db = new Proxy({} as Record<string, unknown>, {
  get() {
    throw new Error(
      'Prisma is no longer available. Use Supabase client from @/lib/supabase or @/lib/supabase-admin.'
    )
  },
})
