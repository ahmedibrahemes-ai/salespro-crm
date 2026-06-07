import { NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'

// Demo data seeder — idempotent, uses Supabase
export async function POST() {
  try {
    const client = getSupabaseAdmin() || createAnonClient()

    // Check if data already exists
    const { count, error: countError } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }
    if (count && count > 0) {
      return NextResponse.json({ message: 'Data already seeded', count })
    }

    // Seed team members if empty
    const { data: existingTeam } = await client
      .from('team_members')
      .select('id')
      .limit(1)

    if (!existingTeam || existingTeam.length === 0) {
      await client.from('team_members').insert([
        { name: 'Amira', role: 'tele', is_active: true },
        { name: 'Neveen', role: 'tele', is_active: true },
        { name: 'Sara', role: 'tele', is_active: true },
        { name: 'Esraa', role: 'tele', is_active: true },
        { name: 'Rahma', role: 'tele', is_active: true },
        { name: 'Rania', role: 'sales', is_active: true },
        { name: 'Alaa', role: 'sales', is_active: true },
        { name: 'Samar', role: 'sales', is_active: true },
        { name: 'Admin', role: 'admin', is_active: true },
      ])
    }

    return NextResponse.json({ message: 'Seeding complete (team members only - leads come from your existing data)' })
  } catch (error) {
    console.error('Error seeding data:', error)
    const message = error instanceof Error ? error.message : 'Failed to seed data'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
