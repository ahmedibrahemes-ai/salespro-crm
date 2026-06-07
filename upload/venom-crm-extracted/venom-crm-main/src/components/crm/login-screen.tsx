'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react'
import { apiLogin, apiGetSession, apiGetTeam } from '@/lib/supabase'
import { useCrmStore, DEFAULT_TEAM } from '@/lib/store'

/* ------------------------------------------------------------------ */
/*  Particles background (pure CSS, no library)                       */
/* ------------------------------------------------------------------ */
const PARTICLE_COUNT = 40
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  duration: Math.random() * 6 + 6,
  delay: Math.random() * 6,
  opacity: Math.random() * 0.3 + 0.05,
}))

/* ------------------------------------------------------------------ */
/*  Login Screen Component                                             */
/* ------------------------------------------------------------------ */
export function LoginScreen() {
  const store = useCrmStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  /* ---- Check existing session on mount ---- */
  useEffect(() => {
    let cancelled = false

    async function checkSession() {
      try {
        // Add a 5-second timeout so the login form shows even if Supabase is slow/unreachable
        const session = await Promise.race([
          apiGetSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ])
        if (cancelled) return

        if (session?.user?.email) {
          await resolveAndLogin(session.user.email)
        }
      } catch {
        // No valid session – stay on login
      } finally {
        if (!cancelled) setCheckingSession(false)
      }
    }

    checkSession()
    return () => { cancelled = true }
  }, [])

  /* ---- Match email to team role ---- */
  async function resolveAndLogin(userEmail: string) {
    const localPart = userEmail.split('@')[0]?.toLowerCase()
    if (!localPart) throw new Error('invalid email')

    // Try loading team from DB; fall back to DEFAULT_TEAM
    let team = DEFAULT_TEAM
    try {
      team = await apiGetTeam()
      store.setTeam(team)
    } catch {
      // use default
    }

    // Capitalise first letter for matching
    const capitalised = localPart.charAt(0).toUpperCase() + localPart.slice(1)

    let name = ''
    let role: 'tele' | 'sales' | 'admin' | null = null

    for (const member of team.admin) {
      if (member.toLowerCase() === localPart || member === capitalised) {
        name = member
        role = 'admin'
        break
      }
    }

    if (!role) {
      for (const member of team.sales) {
        if (member.toLowerCase() === localPart || member === capitalised) {
          name = member
          role = 'sales'
          break
        }
      }
    }

    if (!role) {
      for (const member of team.tele) {
        if (member.toLowerCase() === localPart || member === capitalised) {
          name = member
          role = 'tele'
          break
        }
      }
    }

    if (!role || !name) {
      // Fallback – if the email ends with @venom.local treat as tele
      if (userEmail.endsWith('@venom.local')) {
        name = capitalised
        role = 'tele'
      } else {
        throw new Error('user not found in team')
      }
    }

    store.login(name, role)
  }

  /* ---- Form submit ---- */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      if (!email.trim() || !password.trim()) {
        setError('الرجاء إدخال الإيميل والباسورد')
        return
      }

      // DEBUG: Allow direct login with format "username:role" (e.g., "Admin:admin")
      if (password.trim().startsWith('debug:')) {
        const role = password.trim().replace('debug:', '') as 'tele' | 'sales' | 'admin'
        if (['tele', 'sales', 'admin'].includes(role)) {
          store.login(email.trim(), role)
          return
        }
      }

      setLoading(true)
      try {
        const data = await apiLogin(email.trim(), password.trim())
        const userEmail = data.user?.email
        if (!userEmail) throw new Error('no user email returned')
        await resolveAndLogin(userEmail)
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل الدخول'
        // Translate common Supabase errors to Arabic
        if (message.includes('Invalid login credentials')) {
          setError('الإيميل أو الباسورد غير صحيح')
        } else if (message.includes('user not found')) {
          setError('المستخدم غير موجود في الفريق')
        } else {
          setError(message)
        }
      } finally {
        setLoading(false)
      }
    },
    [email, password]
  )

  /* ---- Session-checking spinner ---- */
  if (checkingSession) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050a08]">
        <Loader2 className="size-8 animate-spin text-venom" />
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#050a08]">
      {/* ---- Background radial glow ---- */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(94,184,166,0.06) 0%, transparent 70%)',
        }}
      />

      {/* ---- Animated particles ---- */}
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
              backgroundColor: `rgba(94,184,166,${p.opacity})`,
              animation: `venom-float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* ---- Login card ---- */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="venom-gradient venom-glow relative z-10 w-full max-w-[420px] rounded-2xl border border-venom/20 bg-card/85 px-8 py-10 backdrop-blur-xl sm:px-10"
      >
        {/* ---- Snake logo ---- */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-6 flex justify-center"
        >
          <span className="venom-pulse flex size-20 items-center justify-center rounded-full text-5xl">
            🐍
          </span>
        </motion.div>

        {/* ---- Title ---- */}
        <h1 className="venom-text-glow mb-1 text-center text-3xl font-bold tracking-tight text-venom">
          Venom CRM
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          نظام إدارة علاقات العملاء
        </p>

        {/* ---- Form ---- */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email */}
          <div className="relative">
            <Mail className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              dir="ltr"
              placeholder="الإيميل"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-lg border border-venom/25 bg-card pr-10 pl-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-venom focus:ring-2 focus:ring-venom/30"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              dir="ltr"
              placeholder="الباسورد"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-lg border border-venom/25 bg-card pr-10 pl-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-venom focus:ring-2 focus:ring-venom/30"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
            >
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="group relative mt-1 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg text-sm font-semibold text-[#050a08] transition-all disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #2a7d6e, #1f6357)',
            }}
          >
            {/* Hover glow layer */}
            <span
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                boxShadow:
                  '0 0 24px rgba(94,184,166,0.4), 0 0 64px rgba(94,184,166,0.15)',
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

        {/* ---- Bottom accent line ---- */}
        <div
          className="mt-8 h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(94,184,166,0.2), rgba(139,92,246,0.2), transparent)',
          }}
        />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          وكالة فينوم للتسويق &copy; {new Date().getFullYear()}
        </p>
      </motion.div>

    </div>
  )
}
