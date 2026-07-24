import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'
import { normalizePhone, generatePhoneVariants } from '@/lib/crm-utils'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'

/* ═══════════════════════════════════════════════════════
   Google Sheets Sync API
   ═══════════════════════════════════════════════════════ */

// In-memory sync history (last 20 syncs)
interface SyncRecord {
  id: string
  timestamp: number
  received: number
  created: number
  skipped: number
  errors: string[]
}

const syncHistory: SyncRecord[] = []
const MAX_HISTORY = 20

/** Shared secret — if set in env, requests must include it */
const SHEETS_SECRET = process.env.SHEETS_SYNC_SECRET || ''

/**
 * Constant-time string comparison to prevent timing attacks (audit issue #13).
 * XORs all character codes so the comparison takes the same time regardless
 * of how many characters match — an attacker can't guess the secret byte-by-byte.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// generatePhoneVariants is now imported from @/lib/crm-utils (audit issue #12 — dedup)

// generatePhoneVariants removed — imported from @/lib/crm-utils (audit issue #12)

// ===== POST handler — Accept incoming data from Google Sheets =====
export async function POST(request: NextRequest) {
  const client = getSupabaseAdmin()
  if (!client) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured. Cannot process sync requests.' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { data, secret } = body as {
      data?: Array<{
        phone?: string
        storeUrl?: string
        customerName?: string
        employeeName?: string
      }>
      secret?: string
    }

    // Authentication: if SHEETS_SYNC_SECRET is configured, this is webhook mode
    // (Google Sheets calls this with the secret in the body). Otherwise, require
    // an authenticated admin session (UI-triggered sync).
    if (SHEETS_SECRET) {
      if (!secret || !constantTimeEqual(secret, SHEETS_SECRET)) {
        return NextResponse.json(
          { error: 'Invalid or missing secret key' },
          { status: 401 }
        )
      }
    } else {
      const session = await requireAdmin(request)
      if (!session) {
        return session === null ? forbiddenResponse('هذه العملية تتطلب صلاحيات مدير') : unauthorizedResponse()
      }
    }

    // Validate data array
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'data array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Fetch active team members for name mapping
    const { data: teamMembers } = await client
      .from('team_members')
      .select('name, role')
      .eq('is_active', true)

    const teleNames = new Set<string>()
    const salesNames = new Set<string>()
    if (teamMembers && Array.isArray(teamMembers)) {
      for (const m of teamMembers) {
        if (m.role === 'tele') teleNames.add(m.name.trim())
        if (m.role === 'sales') salesNames.add(m.name.trim())
      }
    }

    // Find a default tele (first active tele) for unassigned leads
    const defaultTele = teleNames.values().next().value || null

    const created: Array<{ phone: string; customerName: string; teleName: string }> = []
    const skipped: Array<{ phone: string; reason: string }> = []
    const errors: string[] = []

    // OPTIMIZATION: Batch duplicate check — collect all phones first, then do a single query
    const phoneVariants: string[] = []
    const phoneToRowIdx: Map<string, number> = new Map()
    for (let i = 0; i < data.length; i++) {
      const phone = (data[i].phone || '').trim()
      if (!phone) continue
      const variants = generatePhoneVariants(phone)
      for (const v of variants) {
        if (!phoneVariants.includes(v)) {
          phoneVariants.push(v)
          phoneToRowIdx.set(v, i)
        }
      }
    }

    // Single batch query for all duplicate checks
    const existingPhoneSet = new Set<string>()
    if (phoneVariants.length > 0) {
      const BATCH_SIZE = 500
      for (let i = 0; i < phoneVariants.length; i += BATCH_SIZE) {
        const batch = phoneVariants.slice(i, i + BATCH_SIZE)
        const { data: existing } = await client
          .from('leads')
          .select('phone')
          .eq('is_archived', false)
          .in('phone', batch)
        if (existing) {
          for (const row of existing) {
            if (row.phone) existingPhoneSet.add(row.phone)
          }
        }
      }
    }

    // Now process each row, using the pre-computed duplicate set
    const rowsToInsert: Record<string, unknown>[] = []
    for (let idx = 0; idx < data.length; idx++) {
      try {
        const row = data[idx]
        const phone = (row.phone || '').trim()
        const storeUrl = (row.storeUrl || '').trim()
        const customerName = (row.customerName || '').trim()
        const employeeName = (row.employeeName || '').trim()

        // At least phone or storeUrl required
        if (!phone && !storeUrl) {
          skipped.push({ phone: '', reason: 'No phone or storeUrl provided' })
          continue
        }

        // Check for duplicate phone using pre-computed set
        if (phone) {
          const variants = generatePhoneVariants(phone)
          const isDuplicate = variants.some(v => existingPhoneSet.has(v))
          if (isDuplicate) {
            skipped.push({ phone, reason: 'Duplicate phone (already exists)' })
            continue
          }
        }

        // Map employeeName to tele_name
        let teleName = ''
        if (employeeName) {
          if (teleNames.has(employeeName.trim())) {
            teleName = employeeName.trim()
          } else if (salesNames.has(employeeName.trim())) {
            teleName = defaultTele || ''
          } else {
            const lowerName = employeeName.toLowerCase().trim()
            let found = false
            for (const name of teleNames) {
              if (name.toLowerCase() === lowerName) {
                teleName = name
                found = true
                break
              }
            }
            if (!found) {
              for (const name of salesNames) {
                if (name.toLowerCase() === lowerName) {
                  teleName = defaultTele || ''
                  found = true
                  break
                }
              }
            }
            if (!found) {
              teleName = defaultTele || ''
            }
          }
        } else {
          teleName = defaultTele || ''
        }

        // Use customer name if provided, otherwise leave empty
        const finalCustomerName = customerName || ''

        rowsToInsert.push({
          phone: phone || null,
          store_url: storeUrl || null,
          customer_name: finalCustomerName,
          tele_name: teleName || null,
          status: null,
          contact_result: null,
          is_archived: false,
        })
      } catch (rowErr) {
        const msg = rowErr instanceof Error ? rowErr.message : String(rowErr)
        errors.push(`Row error: ${msg}`)
      }
    }

    // Batch insert all valid rows at once
    if (rowsToInsert.length > 0) {
      const INSERT_BATCH = 500
      for (let i = 0; i < rowsToInsert.length; i += INSERT_BATCH) {
        const batch = rowsToInsert.slice(i, i + INSERT_BATCH)
        const { error } = await client.from('leads').insert(batch)
        if (error) {
          errors.push(`Batch insert error: ${error.message}`)
        } else {
          for (const row of batch) {
            created.push({ phone: String(row.phone || row.store_url || ''), customerName: String(row.customer_name || ''), teleName: String(row.tele_name || '—') })
          }
        }
      }
    }

    // Record sync history
    const syncRecord: SyncRecord = {
      id: `sync-${Date.now()}`,
      timestamp: Date.now(),
      received: data.length,
      created: created.length,
      skipped: skipped.length,
      errors,
    }
    syncHistory.unshift(syncRecord)
    if (syncHistory.length > MAX_HISTORY) {
      syncHistory.pop()
    }

    console.log(`[sheets-sync] POST: ${data.length} received, ${created.length} created, ${skipped.length} skipped, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      received: data.length,
      created: created.length,
      skipped: skipped.length,
      skippedDetails: skipped,
      errors: errors.length > 0 ? errors : undefined,
      createdDetails: created,
    })
  } catch (err) {
    console.error('[sheets-sync] POST unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ===== GET handler — Return sync configuration and stats =====
export async function GET(request: NextRequest) {
  // Require admin to view sync stats
  const session = await requireAdmin(request)
  if (!session) {
    return session === null ? forbiddenResponse('هذه العملية تتطلب صلاحيات مدير') : unauthorizedResponse()
  }

  try {
    // Build webhook URL — for external use, the caller should replace with their actual domain
    const webhookPath = '/api/sheets-sync'

    // Get recent sync history (last 10)
    const recentSyncs = syncHistory.slice(0, 10).map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      received: s.received,
      created: s.created,
      skipped: s.skipped,
      errorCount: s.errors.length,
    }))

    return NextResponse.json({
      webhookPath,
      secretConfigured: !!SHEETS_SECRET,
      recentSyncs,
      lastSync: syncHistory.length > 0
        ? {
            timestamp: syncHistory[0].timestamp,
            received: syncHistory[0].received,
            created: syncHistory[0].created,
            skipped: syncHistory[0].skipped,
          }
        : null,
    })
  } catch (err) {
    console.error('[sheets-sync] GET unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
