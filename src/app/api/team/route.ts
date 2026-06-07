import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const team = await db.teamMember.findMany({
      orderBy: { revenue: 'desc' },
    })
    return NextResponse.json(team)
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const member = await db.teamMember.create({
      data: {
        name: body.name || '',
        nameAr: body.nameAr || '',
        role: body.role || 'sales',
        initials: body.initials || '',
        points: body.points || 0,
        deals: body.deals || 0,
        revenue: body.revenue || 0,
        calls: body.calls || 0,
        convRate: body.convRate || 0,
        badges: body.badges || '[]',
      },
    })
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('Error creating team member:', error)
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 })
  }
}
