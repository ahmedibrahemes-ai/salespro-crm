import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-guard'

// Chat messages API — uses Supabase lead_notes table
// GET: Fetch notes for a lead
// POST: Add a note to a lead
// Both endpoints require authentication.

export async function GET(request: NextRequest) {
  // Require auth
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const client = createAnonClient()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }
    const { data, error } = await client
      .from('lead_notes')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Map to chat message format for backwards compatibility
    const messages = (data || []).map((note: Record<string, unknown>) => ({
      id: String(note.id),
      leadId: String(note.lead_id),
      fromMe: note.category === 'whatsapp-outgoing',
      text: String(note.text || ''),
      read: true,
      createdAt: note.created_at,
    }))

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error fetching chat:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch chat'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Require auth
  const session = await requireAuth(request)
  if (!session) return unauthorizedResponse()

  try {
    const client = getSupabaseAdmin() || createAnonClient()
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }
    const body = await request.json()

    // Validate input
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    if (!body.leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }
    if (typeof body.text !== 'string' || body.text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    // Cap message length to prevent abuse
    const text = body.text.trim().slice(0, 5000)
    const fromMe = Boolean(body.fromMe)

    // Use the authenticated user's name (from session) — ignore client-supplied identity
    const byName = session.uname || 'Unknown'

    const { data, error } = await client
      .from('lead_notes')
      .insert({
        lead_id: body.leadId,
        by_name: byName,
        category: fromMe ? 'whatsapp-outgoing' : 'whatsapp-incoming',
        text,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return in chat message format
    const message = {
      id: String(data.id),
      leadId: String(data.lead_id),
      fromMe,
      text,
      read: true,
      createdAt: data.created_at,
    }

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Error creating message:', error)
    const message = error instanceof Error ? error.message : 'Failed to create message'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
