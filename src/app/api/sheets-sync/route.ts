import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'
import { normalizePhone } from '@/lib/crm-utils'

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

/** Generate phone variants for duplicate detection */
function generatePhoneVariants(phone: string): string[] {
  const variants = new Set<string>()
  if (!phone || !phone.trim()) return []
  const raw = phone.trim()
  variants.add(raw)

  const norm = normalizePhone(raw)
  if (norm) {
    variants.add(norm)
    if (norm.startsWith('+966')) {
      const digits = norm.substring(4)
      variants.add(digits)
      variants.add('0' + digits)
      variants.add('966' + digits)
      variants.add('00966' + digits)
    }
    if (norm.startsWith('00966')) {
      variants.add('+' + norm.substring(2))
    }
  }

  variants.delete('')
  return Array.from(variants)
}

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

    // Validate secret if configured
    if (SHEETS_SECRET && secret !== SHEETS_SECRET) {
      return NextResponse.json(
        { error: 'Invalid or missing secret key' },
        { status: 401 }
      )
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

    for (const row of data) {
      try {
        const phone = (row.phone || '').trim()
        const storeUrl = (row.storeUrl || '').trim()
        const customerName = (row.customerName || '').trim()
        const employeeName = (row.employeeName || '').trim()

        // At least phone or storeUrl required
        if (!phone && !storeUrl) {
          skipped.push({ phone: '', reason: 'No phone or storeUrl provided' })
          continue
        }

        // Check for duplicate phone
        if (phone) {
          const variants = generatePhoneVariants(phone)
          if (variants.length > 0) {
            const { data: existing } = await client
              .from('leads')
              .select('id, phone')
              .eq('is_archived', false)
              .in('phone', variants)
              .limit(1)

            if (existing && existing.length > 0) {
              skipped.push({ phone, reason: `Duplicate phone (existing ID: ${existing[0].id})` })
              continue
            }
          }
        }

        // Map employeeName to tele_name
        let teleName = ''
        if (employeeName) {
          // Try exact match in tele members first
          if (teleNames.has(employeeName.trim())) {
            teleName = employeeName.trim()
          } else if (salesNames.has(employeeName.trim())) {
            // If it's a sales name, assign as sales_name instead
            teleName = defaultTele || ''
          } else {
            // Try case-insensitive match
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
              // Employee not found — assign to default tele or leave unassigned
              teleName = defaultTele || ''
            }
          }
        } else {
          // No employee name — assign to default tele
          teleName = defaultTele || ''
        }

        // Generate customer name if not provided
        const finalCustomerName = customerName || (phone ? `عميل ${phone}` : storeUrl ? `متجر ${storeUrl.replace(/^https?:\/\//, '').split('/')[0]}` : 'عميل جديد')

        // Create the lead
        const leadData: Record<string, unknown> = {
          phone: phone || null,
          store_url: storeUrl || null,
          customer_name: finalCustomerName,
          tele_name: teleName || null,
          status: 'new',
          contact_result: null,
          is_archived: false,
        }

        const { error } = await client
          .from('leads')
          .insert(leadData)

        if (error) {
          errors.push(`Failed to create lead for ${phone || storeUrl}: ${error.message}`)
        } else {
          created.push({ phone: phone || storeUrl, customerName: finalCustomerName, teleName: teleName || '—' })
        }
      } catch (rowErr) {
        const msg = rowErr instanceof Error ? rowErr.message : String(rowErr)
        errors.push(`Row error: ${msg}`)
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
export async function GET() {
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
