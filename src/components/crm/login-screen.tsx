'use client'

import { useState } from 'react'
import { Loader2, AlertCircle, User, Lock, Eye, EyeOff } from 'lucide-react'
import { useCrmStore } from '@/lib/store'

/* ------------------------------------------------------------------ */
/*  Animated background particles (pure CSS)                           */
/* ------------------------------------------------------------------ */
const PARTICLE_COUNT = 35
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  duration: Math.random() * 6 + 6,
  delay: Math.random() * 6,
  opacity: Math.random() * 0.3 + 0.05,
}))

export function LoginScreen() {
  const login = useCrmStore((s) => s.login)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!username.trim()) {
      setError('الرجاء إدخال اسم المستخدم')
      return
    }

    if (!password) {
      setError('الرجاء إدخال كلمة المرور')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username: username.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'فشل تسجيل الدخول')
        return
      }

      if (data.success && data.user) {
        // Login with the user's display name, role, userId, and username from the server
        login(data.user.displayName, data.user.role, data.user.id, data.user.username)
      } else {
        setError('حدث خطأ غير متوقع')
      }
    } catch (err) {
      console.error('[login] Error:', err)
      // Demo mode fallback: if API is unreachable, allow demo login
      // This enables testing when Supabase is not configured
      const DEMO_USERS: Record<string, { displayName: string; role: 'tele' | 'sales' | 'admin'; id: string; username: string }> = {
        admin: { displayName: 'أحمد سالم', role: 'admin', id: 'demo-admin', username: 'admin' },
        tele: { displayName: 'Amira', role: 'tele', id: 'demo-tele', username: 'tele' },
        sales: { displayName: 'Rania', role: 'sales', id: 'demo-sales', username: 'sales' },
      }
      const demoUser = DEMO_USERS[username.trim().toLowerCase()]
      if (demoUser) {
        login(demoUser.displayName, demoUser.role, demoUser.id, demoUser.username)
        return
      }
      setError('فشل الاتصال بالخادم — جرب admin / tele / sales كوضع تجريبي')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#0a0d14]">
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(108,99,255,0.08) 0%, rgba(0,212,170,0.04) 40%, transparent 70%)',
        }}
      />

      {/* Animated particles */}
      <div className="pointer-events-none absolute inset-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: `rgba(108,99,255,${p.opacity})`,
              animation: `vn-float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Login card */}
      <div
        className="relative z-10 w-full max-w-[420px] rounded-2xl border border-white/[0.06] bg-[#111520]/90 px-8 py-10 backdrop-blur-xl sm:px-10"
        style={{
          boxShadow:
            '0 0 80px rgba(108,99,255,0.06), 0 0 160px rgba(0,212,170,0.03)',
        }}
      >
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-black text-white select-none"
            style={{
              background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)',
              fontFamily: 'Cairo, sans-serif',
              boxShadow:
                '0 0 30px rgba(108,99,255,0.3), 0 0 60px rgba(0,212,170,0.15)',
            }}
          >
            VN
          </div>
        </div>

        {/* Title */}
        <h1
          className="mb-1 text-center text-3xl font-bold tracking-tight text-[#f0f2ff]"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          Venom CRM
        </h1>
        <p
          className="mb-8 text-center text-sm text-[#8892b0]"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          منصة المبيعات الذكية
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Username Input */}
          <div className="relative">
            <User className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8892b0]" />
            <input
              type="text"
              placeholder="اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#161b28] pr-10 pl-3 text-sm text-[#f0f2ff] placeholder:text-[#4a5280] outline-none transition-all focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/30"
              style={{ fontFamily: 'Cairo, sans-serif' }}
              autoComplete="username"
              disabled={loading}
              dir="rtl"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <Lock className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8892b0]" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#161b28] pr-10 pl-10 text-sm text-[#f0f2ff] placeholder:text-[#4a5280] outline-none transition-all focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/30"
              style={{ fontFamily: 'Cairo, sans-serif' }}
              autoComplete="current-password"
              disabled={loading}
              dir="rtl"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5280] hover:text-[#8892b0] transition-colors cursor-pointer"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="group relative mt-1 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%)',
              fontFamily: 'Cairo, sans-serif',
            }}
          >
            {/* Hover glow layer */}
            <span
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                boxShadow:
                  '0 0 24px rgba(108,99,255,0.4), 0 0 64px rgba(0,212,170,0.15)',
              }}
            />
            <span className="relative flex items-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </span>
          </button>
        </form>

        {/* Bottom accent line */}
        <div
          className="mt-8 h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(108,99,255,0.3), rgba(0,212,170,0.3), transparent)',
          }}
        />
        <p
          className="mt-4 text-center text-xs text-[#4a5280]"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          Venom CRM &copy; {new Date().getFullYear()}
        </p>
      </div>

      {/* Float animation keyframes */}
      <style jsx global>{`
        @keyframes vn-float {
          0% {
            transform: translateY(0px) translateX(0px);
            opacity: 0.05;
          }
          100% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.2;
          }
        }
      `}</style>
    </div>
  )
}
