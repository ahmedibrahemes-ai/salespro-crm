import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, createAnonClient } from '@/lib/supabase-admin'
import { hashPassword, verifyPassword, isLegacyHash } from '@/lib/password'
import { createSessionToken } from '@/lib/session'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-guard'
import { logAuditEvent } from '@/app/api/audit-log/helpers'

// ===== POST: Auth operations =====
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseAdmin() || createAnonClient()
    if (!client) {
      return NextResponse.json({ error: 'قاعدة البيانات غير متاحة. يرجى إعداد Supabase.' }, { status: 503 })
    }
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
      const { valid, needsUpgrade } = await verifyPassword(password, user.password_hash, user.password_salt)
      if (!valid) {
        return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 })
      }

      // Auto-upgrade legacy SHA-256 hash to bcrypt
      if (needsUpgrade) {
        try {
          const newHash = await hashPassword(password)
          await client
            .from('app_users')
            .update({ password_hash: newHash, password_salt: '' })
            .eq('id', user.id)
          console.log(`[auth] Upgraded legacy hash for user ${user.username}`)
        } catch (upgradeErr) {
          // Non-fatal — login still succeeds, but log the issue
          console.error('[auth] Failed to upgrade hash:', upgradeErr)
        }
      }

      // Update last login
      await client
        .from('app_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id)

      // Issue a signed session token
      const token = await createSessionToken({
        uid: user.id,
        uname: user.username,
        role: user.role,
      })

      return NextResponse.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          role: user.role,
        },
      })
    }

    // ── Validate Session ──
    if (action === 'validate-session') {
      const { userId } = body
      if (!userId) {
        return NextResponse.json({ valid: false }, { status: 200 })
      }

      const { data: users } = await client
        .from('app_users')
        .select('id, is_active')
        .eq('id', userId)
        .limit(1)

      if (!users || users.length === 0 || !users[0].is_active) {
        return NextResponse.json({ valid: false }, { status: 200 })
      }

      return NextResponse.json({ valid: true }, { status: 200 })
    }

    // ===== Admin-only operations =====
    // All actions below this point require an authenticated admin session.

    // ── Change Password ──
    // Allowed for any authenticated user (changes their own password).
    if (action === 'change-password') {
      const { currentPassword, newPassword } = body

      // Verify session from Authorization header
      const token = request.headers.get('authorization')?.replace(/^bearer\s+/i, '').trim()
      if (!token) {
        return unauthorizedResponse('يجب تسجيل الدخول لتغيير كلمة المرور')
      }
      const { verifySessionToken } = await import('@/lib/session')
      const session = await verifySessionToken(token)
      if (!session) {
        return unauthorizedResponse('جلسة غير صالحة — يرجى تسجيل الدخول مجدداً')
      }

      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف' }, { status: 400 })
      }

      const { data: users } = await client
        .from('app_users')
        .select('*')
        .eq('id', session.uid)
        .limit(1)

      if (!users || users.length === 0) {
        return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
      }

      const user = users[0]
      const { valid } = await verifyPassword(currentPassword, user.password_hash, user.password_salt)
      if (!valid) {
        return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 401 })
      }

      const newHash = await hashPassword(newPassword)
      await client
        .from('app_users')
        .update({ password_hash: newHash, password_salt: '' })
        .eq('id', session.uid)

      // Audit log
      await logAuditEvent(session, 'change-password', 'app_user', String(session.uid))
      return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
    }

    // ── Admin-guarded actions ──
    const adminSession = await requireAdmin(request)
    if (!adminSession) {
      return forbiddenResponse('هذه العملية تتطلب صلاحيات مدير')
    }

    // ── Create User ──
    if (action === 'create-user') {
      const { username, password, displayName, role } = body
      if (!username || !password || !displayName || !role) {
        return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
      }
      if (!['tele', 'sales', 'admin'].includes(role)) {
        return NextResponse.json({ error: 'صلاحية غير صالحة' }, { status: 400 })
      }
      if (password.length < 6) {
        return NextResponse.json({ error: 'كلمة المرور يجب ألا تقل عن 6 أحرف' }, { status: 400 })
      }

      const { data: existing } = await client
        .from('app_users')
        .select('id')
        .eq('username', username)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'اسم المستخدم موجود بالفعل' }, { status: 409 })
      }

      const hash = await hashPassword(password)
      const { data: newUser, error: insertError } = await client
        .from('app_users')
        .insert({
          username,
          password_hash: hash,
          password_salt: '',
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

      // Audit log
      await logAuditEvent(adminSession, 'create-user', 'app_user', String(newUser.id), { username, role })
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

      // Prevent admin from deactivating themselves
      if (String(userId) === String(adminSession.uid) && isActive === false) {
        return NextResponse.json({ error: 'لا يمكنك تعطيل حسابك الحالي' }, { status: 400 })
      }

      await client
        .from('app_users')
        .update({ is_active: isActive })
        .eq('id', userId)

      // Audit log
      await logAuditEvent(adminSession, 'toggle-user', 'app_user', String(userId), { isActive })
      return NextResponse.json({ success: true })
    }

    // ── Reset Password (admin) ──
    if (action === 'reset-password') {
      const { userId, newPassword } = body
      if (!userId || !newPassword) {
        return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'كلمة المرور يجب ألا تقل عن 6 أحرف' }, { status: 400 })
      }

      const hash = await hashPassword(newPassword)
      await client
        .from('app_users')
        .update({ password_hash: hash, password_salt: '' })
        .eq('id', userId)

      // Audit log
      await logAuditEvent(adminSession, 'reset-password', 'app_user', String(userId))
      return NextResponse.json({ success: true, message: 'تم إعادة تعيين كلمة المرور' })
    }

    // ── Delete User (admin) ──
    if (action === 'delete-user') {
      const { userId } = body
      if (!userId) {
        return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 })
      }

      // Prevent admin from deleting themselves
      if (String(userId) === String(adminSession.uid)) {
        return NextResponse.json({ error: 'لا يمكنك حذف حسابك الحالي' }, { status: 400 })
      }

      const { error: deleteError } = await client
        .from('app_users')
        .delete()
        .eq('id', userId)

      if (deleteError) {
        console.error('[auth] Delete user error:', deleteError.message)
        return NextResponse.json({ error: 'فشل في حذف المستخدم' }, { status: 500 })
      }

      // Audit log
      await logAuditEvent(adminSession, 'delete-user', 'app_user', String(userId))
      return NextResponse.json({ success: true, message: 'تم حذف المستخدم' })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    console.error('[auth] Unexpected error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
