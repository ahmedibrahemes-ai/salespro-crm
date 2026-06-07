import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const leads = await db.lead.findMany({
      where: { isArchived: false },
      include: {
        activities: { orderBy: { createdAt: 'desc' } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(leads)
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const lead = await db.lead.create({
      data: {
        name: body.name || '',
        phone: body.phone || '',
        email: body.email || '',
        source: body.source || 'website',
        status: body.status || 'new',
        value: body.value || 0,
        probability: body.probability || 20,
        hot: body.hot || false,
        notes: body.notes || '[]',
        assignedTo: body.assignedTo || '',
        company: body.company || '',
        location: body.location || '',
        nextFollowUp: body.nextFollowUp || null,
        followUpType: body.followUpType || '',
      },
    })
    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })
    
    const lead = await db.lead.update({
      where: { id },
      data: updates,
    })
    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })
    
    await db.lead.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lead:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
