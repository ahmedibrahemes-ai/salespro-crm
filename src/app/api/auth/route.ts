import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'

// ===== Password Hashing using Web Crypto API =====
async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const actualSalt = salt || crypto.randomUUID().replace(/-/g, '').substring(0, 16)
  const encoder = new TextEncoder()
  const data = encoder.encode(password + actualSalt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return { hash: hashHex, salt: actualSalt }
}

async function verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt)
  return hash === storedHash
}

// ===== POST: Auth operations =====
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseAdmin() || createAnonClient()
    const body = await request.json()
    const { action } = body

    // ── Login ──
    if (action === 'login') {
      const { username, password } = body
      if (!username || !password) {
        return NextResponse.json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' }, { status: 400 })
      }

      const { data: users, error: findError } = await client
        .from('app_users')
        .select('*')
        .eq('username', username)
        .eq('is_active', true)
        .limit(1)

      if (findError) {
        console.error('[auth] Login query error:', findError.message)
        return NextResponse.json({ error: 'خطأ في قاعدة البيانات' }, { status: 500 })
      }

      if (!users || users.length === 0) {
        return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 })
      }

      const user = users[0]
      const isValid = await verifyPassword(password, user.password_hash, user.password_salt)
      if (!isValid) {
        return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 })
      }

      // Update last login
      await client
        .from('app_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id)

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          role: user.role,
        },
      })
    }

    // ── Change Password ──
    if (action === 'change-password') {
      const { userId, currentPassword, newPassword } = body
      if (!userId || !currentPassword || !newPassword) {
        return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
      }

      const { data: users } = await client
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .limit(1)

      if (!users || users.length === 0) {
        return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
      }

      const user = users[0]
      const isValid = await verifyPassword(currentPassword, user.password_hash, user.password_salt)
      if (!isValid) {
        return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 401 })
      }

      const { hash, salt } = await hashPassword(newPassword)
      await client
        .from('app_users')
        .update({ password_hash: hash, password_salt: salt })
        .eq('id', userId)

      return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
    }

    // ── Create User ──
    if (action === 'create-user') {
      const { username, password, displayName, role } = body
      if (!username || !password || !displayName || !role) {
        return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
      }

      const { data: existing } = await client
        .from('app_users')
        .select('id')
        .eq('username', username)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'اسم المستخدم موجود بالفعل' }, { status: 409 })
      }

      const { hash, salt } = await hashPassword(password)
      const { data: newUser, error: insertError } = await client
        .from('app_users')
        .insert({
          username,
          password_hash: hash,
          password_salt: salt,
          display_name: displayName,
          role,
          is_active: true,
        })
        .select('id, username, display_name, role, is_active, created_at')
        .single()

      if (insertError) {
        console.error('[auth] Create user error:', insertError.message)
        return NextResponse.json({ error: 'فشل في إنشاء المستخدم' }, { status: 500 })
      }

      return NextResponse.json({ success: true, user: newUser })
    }

    // ── List Users ──
    if (action === 'list-users') {
      const { data: users, error } = await client
        .from('app_users')
        .select('id, username, display_name, role, is_active, last_login_at, created_at')
        .order('created_at', { ascending: true })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ users: users || [] })
    }

    // ── Toggle User Active ──
    if (action === 'toggle-user') {
      const { userId, isActive } = body
      if (!userId) {
        return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 })
      }

      await client
        .from('app_users')
        .update({ is_active: isActive })
        .eq('id', userId)

      return NextResponse.json({ success: true })
    }

    // ── Reset Password (admin) ──
    if (action === 'reset-password') {
      const { userId, newPassword } = body
      if (!userId || !newPassword) {
        return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
      }

      const { hash, salt } = await hashPassword(newPassword)
      await client
        .from('app_users')
        .update({ password_hash: hash, password_salt: salt })
        .eq('id', userId)

      return NextResponse.json({ success: true, message: 'تم إعادة تعيين كلمة المرور' })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    console.error('[auth] Unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
