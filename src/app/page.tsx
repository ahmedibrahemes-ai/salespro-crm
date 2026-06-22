'use client'

import { useEffect, Component, lazy, Suspense, useMemo } from 'react'
import { useCrmStore, hydrateAuth, canAccessView, getDefaultViewForRole, type ViewName } from '@/lib/store'
import { apiGetLeads, apiGetArchivedLeads, apiGetTeam, apiGetAccessPermissions, apiSubscribeToLeads, apiUnsubscribe, type BroadcastMessage, type Lead } from '@/lib/supabase'
import { LoginScreen } from '@/components/crm/login-screen'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { Loader2, RefreshCw } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Lazy-loaded view components — only load when the view is active     */
/* ------------------------------------------------------------------ */
const Dashboard = lazy(() => import('@/components/crm/dashboard').then(m => ({ default: m.Dashboard })))
const TeleSheet = lazy(() => import('@/components/crm/tele-sheet').then(m => ({ default: m.TeleSheet })))
const SalesSheet = lazy(() => import('@/components/crm/sales-sheet').then(m => ({ default: m.SalesSheet })))
const AdminPanel = lazy(() => import('@/components/crm/admin-panel').then(m => ({ default: m.AdminPanel })))
const MyMeetings = lazy(() => import('@/components/crm/my-meetings').then(m => ({ default: m.MyMeetings })))
const BulkAdd = lazy(() => import('@/components/crm/bulk-add').then(m => ({ default: m.BulkAdd })))
const MyArchive = lazy(() => import('@/components/crm/my-archive').then(m => ({ default: m.MyArchive })))
const DailyReport = lazy(() => import('@/components/crm/daily-report').then(m => ({ default: m.DailyReport })))
// MeetingsPage removed — merged into MyMeetings (same functionality)
const CustomersStatus = lazy(() => import('@/components/crm/customers-status').then(m => ({ default: m.CustomersStatus })))
const EmployeeProfile = lazy(() => import('@/components/crm/employee-profile').then(m => ({ default: m.EmployeeProfile })))
const TransfersPage = lazy(() => import('@/components/crm/transfers-page').then(m => ({ default: m.TransfersPage })))
const FollowUpSection = lazy(() => import('@/components/crm/follow-up-section').then(m => ({ default: m.FollowUpSection })))

/* ------------------------------------------------------------------ */
/*  Error Boundary to prevent component crashes from hanging the app   */
/* ------------------------------------------------------------------ */
interface ErrorBoundaryProps {
  children: React.ReactNode
  viewName?: string
}
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ViewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary] View "${this.props.viewName}" crashed:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[40vh]">
          <div className="text-center max-w-md">
            <div className="text-[42px] mb-3">⚠️</div>
            <h2
              className="text-[19px] font-extrabold text-[#f0f2ff] mb-2"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              حدث خطأ في هذه الصفحة
            </h2>
            <p
              className="text-[14px] font-medium text-[#8892b0] mb-4"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {this.state.error?.message || 'خطأ غير معروف'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6c63ff]/15 text-[#6c63ff] text-[13px] font-medium hover:bg-[#6c63ff]/25 transition-colors cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <RefreshCw size={14} />
              إعادة المحاولة
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/* ------------------------------------------------------------------ */
/*  Fallback view for unknown views                                    */
/* ------------------------------------------------------------------ */
function FallbackView({ view }: { view: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="text-[42px] mb-3">🔍</div>
        <h2
          className="text-[19px] font-extrabold text-[#f0f2ff] mb-1"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          الصفحة غير موجودة
        </h2>
        <p
          className="text-[14px] font-medium text-[#8892b0]"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          عرض غير معروف: {view}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Suspense fallback while lazy component loads                       */
/* ------------------------------------------------------------------ */
function ViewLoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <Loader2 size={28} className="animate-spin text-[#6c63ff] mx-auto mb-3" />
        <p className="text-[14px] font-semibold text-[#8892b0]" style={{ fontFamily: 'Cairo, sans-serif' }}>جاري تحميل الصفحة...</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  View Router (wrapped with Error Boundary + Suspense)               */
/*  KEY FIX: Only render the ACTIVE view — don't mount others          */
/* ------------------------------------------------------------------ */
function ViewRouter({ currentView }: { currentView: ViewName }) {
  const viewComponent = useMemo(() => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />
      case 'my-sheet':
        return <TeleSheet />
      case 'sales-sheet':
        return <SalesSheet />
      case 'my-meetings':
        return <MyMeetings />
      case 'bulk-add':
        return <BulkAdd />
      case 'my-archive':
        return <MyArchive />
      case 'admin':
        return <AdminPanel />
      case 'daily-report':
        return <DailyReport />
      case 'customers-status':
        return <CustomersStatus />
      case 'transfers':
        return <TransfersPage />
      case 'follow-up':
        return <FollowUpSection />
      case 'employee-profile':
        return <EmployeeProfile />
      default:
        return <FallbackView view={currentView} />
    }
  }, [currentView])

  return (
    <ViewErrorBoundary viewName={currentView}>
      <Suspense fallback={<ViewLoadingFallback />}>
        {viewComponent}
      </Suspense>
    </ViewErrorBoundary>
  )
}

/* ------------------------------------------------------------------ */
/*  Loading Screen                                                     */
/* ------------------------------------------------------------------ */
function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#6c63ff] to-[#00d4aa] animate-pulse opacity-20" />
          <div className="absolute inset-1 rounded-[10px] bg-[#111520] flex items-center justify-center">
            <span className="text-lg font-black bg-gradient-to-br from-[#6c63ff] to-[#00d4aa] bg-clip-text text-transparent">VN</span>
          </div>
        </div>
        <Loader2 size={24} className="animate-spin text-[#6c63ff] mx-auto mb-3" />
        <p className="text-[14px] text-[#8892b0]" style={{ fontFamily: 'Cairo, sans-serif' }}>جاري تحميل البيانات...</p>
        <p className="text-[11px] text-[#4a5280] mt-1" style={{ fontFamily: 'Cairo, sans-serif' }}>Venom CRM</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Data Error Banner — shown when data load fails                     */
/* ------------------------------------------------------------------ */
function DataErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex-1 flex items-center justify-center min-h-[60vh] px-4"
    >
      <div className="text-center max-w-md">
        <div className="text-[42px] mb-3">⚠️</div>
        <h2
          className="text-[19px] font-extrabold text-[#f0f2ff] mb-2"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          فشل تحميل البيانات
        </h2>
        <p
          className="text-[14px] font-medium text-[#8892b0] mb-6 break-words"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {message}
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6c63ff]/15 text-[#6c63ff] text-[13px] font-medium hover:bg-[#6c63ff]/25 transition-colors cursor-pointer"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <RefreshCw size={14} />
          إعادة المحاولة
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Toast Container                                                    */
/* ------------------------------------------------------------------ */
function ToastContainer() {
  const toasts = useCrmStore((s) => s.toasts)
  const removeToast = useCrmStore((s) => s.removeToast)

  return (
    <div className="fixed bottom-5 left-5 z-[1000] flex flex-col gap-2">
      {toasts.map((t) => {
        const colors = {
          success: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
          error: 'border-red-500/50 bg-red-500/10 text-red-400',
          info: 'border-[#6c63ff]/50 bg-[#6c63ff]/10 text-[#6c63ff]',
          warning: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
        }
        return (
          <div
            key={t.id}
            className={`flex items-center gap-3 min-w-[280px] max-w-[400px] border rounded-lg px-4 py-3 shadow-lg animate-in slide-in-from-bottom-2 duration-200 ${colors[t.type]}`}
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <span className="text-[13px] font-medium flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="opacity-60 hover:opacity-100 shrink-0">
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function Home() {
  const isAuthenticated = useCrmStore((s) => s.isAuthenticated)
  const hydrating = useCrmStore((s) => s.hydrating)
  const currentView = useCrmStore((s) => s.currentView)
  const currentRole = useCrmStore((s) => s.currentRole)
  const setCurrentView = useCrmStore((s) => s.setCurrentView)
  const loading = useCrmStore((s) => s.loading)
  const dataLoaded = useCrmStore((s) => s.dataLoaded)
  const setLeads = useCrmStore((s) => s.setLeads)
  const setArchivedLeads = useCrmStore((s) => s.setArchivedLeads)
  const setTeam = useCrmStore((s) => s.setTeam)
  const setTeleAccess = useCrmStore((s) => s.setTeleAccess)
  const setSalesAccess = useCrmStore((s) => s.setSalesAccess)
  const setDataLoaded = useCrmStore((s) => s.setDataLoaded)
  const setLoading = useCrmStore((s) => s.setLoading)
  const archivedLoaded = useCrmStore((s) => s.archivedLoaded)
  const setArchivedLoaded = useCrmStore((s) => s.setArchivedLoaded)
  const dataError = useCrmStore((s) => s.dataError)
  const setDataError = useCrmStore((s) => s.setDataError)

  // Hydrate auth from localStorage on first mount
  useEffect(() => {
    hydrateAuth()

    // Hydrate theme from localStorage
    try {
      const savedTheme = localStorage.getItem('venom-theme')
      if (savedTheme === 'light' || savedTheme === 'dark') {
        useCrmStore.setState({ theme: savedTheme })
        const html = document.documentElement
        if (savedTheme === 'dark') {
          html.classList.add('dark')
        } else {
          html.classList.remove('dark')
        }
      }
    } catch { /* ignore */ }
  }, [])

  // Protect views based on role permissions
  useEffect(() => {
    if (!isAuthenticated || !currentRole) return
    if (currentView === 'login') return

    if (!canAccessView(currentView, currentRole)) {
      setCurrentView(getDefaultViewForRole(currentRole))
    }
  }, [currentView, currentRole, isAuthenticated, setCurrentView])

  // Load data when authenticated
  // SIMPLE & RELIABLE: load everything together (team + permissions + leads)
  // No sessionStorage cache, no background loading — just fetch from API.
  useEffect(() => {
    if (!isAuthenticated || dataLoaded) return

    async function loadData() {
      setLoading(true)
      setDataError(null)
      try {
        const [active, team, permissions] = await Promise.all([
          apiGetLeads(false),
          apiGetTeam().catch(() => ({ tele: [], sales: [], admin: [] })),
          apiGetAccessPermissions().catch(() => ({ teleAccess: {}, salesAccess: {} })),
        ])

        setLeads(active)
        setTeam(team)
        setTeleAccess(permissions.teleAccess)
        setSalesAccess(permissions.salesAccess)
        setDataLoaded(true)
      } catch (err) {
        console.error('Failed to load data:', err)
        const msg = err instanceof Error ? err.message : 'فشل تحميل البيانات'
        setDataError(msg)
        setDataLoaded(true)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [isAuthenticated, dataLoaded, setLeads, setTeam, setDataLoaded, setLoading, setDataError])

  // Lazy-load archived leads when user navigates to archive view
  useEffect(() => {
    if (!isAuthenticated || !dataLoaded || archivedLoaded) return
    if (currentView !== 'my-archive' && currentView !== 'admin') return

    async function loadArchived() {
      try {
        const archived = await apiGetArchivedLeads()
        setArchivedLeads(archived)
        setArchivedLoaded(true)
      } catch (err) {
        console.error('Failed to load archived leads:', err)
        const msg = err instanceof Error ? err.message : 'فشل تحميل الأرشيف'
        const { addToast } = useCrmStore.getState()
        addToast('error', `فشل تحميل الأرشيف: ${msg}`)
        // Mark as loaded to prevent retry loop
        setArchivedLoaded(true)
      }
    }

    loadArchived()
  }, [isAuthenticated, dataLoaded, archivedLoaded, currentView, setArchivedLeads, setArchivedLoaded])

  // Subscribe to real-time updates (with debounce to prevent flickering)
  useEffect(() => {
    if (!isAuthenticated || !dataLoaded) return

    // Debounce: collect updates and apply them in a batch to prevent UI flickering
    let pendingUpdates: Array<{ type: string; payload: unknown }> = []
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    function flushPending() {
      const updates = pendingUpdates
      pendingUpdates = []
      flushTimer = null

      for (const { type, payload } of updates) {
        const { addLeadToCache, updateLeadInCache, removeLeadFromCache, addToast, addNotification } = useCrmStore.getState()

        if (type === 'INSERT') {
          const newRow = (payload as Record<string, unknown>).new as Record<string, unknown>
          if (newRow?.id) {
            const leadId = String(newRow.id)
            const customerName = (newRow.customer_name as string) || ''
            // Read fields from the payload instead of hardcoding nulls.
            // If the server-side INSERT set these fields (e.g. bulk-create with
            // assignedAt), the realtime INSERT event now preserves them.
            // (audit §3 row 4 — previously hardcoded null, causing data loss.)
            addLeadToCache({
              id: leadId,
              storeUrl: (newRow.store_url as string) || '',
              phone: (newRow.phone as string) || '',
              customerName: customerName,
              customerType: (newRow.customer_type as string) || '',
              brief: (newRow.brief as string) || '',
              contactResult: (newRow.contact_result as string) || '',
              contactResultAt: newRow.contact_result_at
                ? new Date(newRow.contact_result_at as string).getTime()
                : null,
              tele: ((newRow.tele_name as string) || '').trim(),
              sales: (newRow.sales_name as string) ? (newRow.sales_name as string).trim() : null,
              meetingDate: (newRow.meeting_date as string) || '',
              meetingTime: (newRow.meeting_time as string) || '',
              meetingType: (newRow.meeting_type as string) || '',
              meetingLink: (newRow.meeting_link as string) || '',
              status: (newRow.status as string) || '',
              salesStatus: (newRow.sales_status as string) || null,
              attended: (newRow.attended as string) ?? null,
              attendanceMarkedAt: newRow.attendance_marked_at
                ? new Date(newRow.attendance_marked_at as string).getTime()
                : null,
              attendanceMarkedBy: (newRow.attendance_marked_by as string) ?? null,
              cancelledFrom: (newRow.cancelled_from as string) ?? null,
              cancelledAt: newRow.cancelled_at
                ? new Date(newRow.cancelled_at as string).getTime()
                : null,
              createdAt: newRow.created_at ? new Date(newRow.created_at as string).getTime() : 0,
              assignedAt: newRow.assigned_at
                ? new Date(newRow.assigned_at as string).getTime()
                : null,
              isArchived: (newRow.is_archived as boolean) ?? false,
              archivedAt: newRow.archived_at
                ? new Date(newRow.archived_at as string).getTime()
                : null,
              archivedBy: (newRow.archived_by as string) ?? null,
              notes: [],
            })
            addNotification('new-lead', `عميل جديد: ${customerName || 'بدون اسم'}`, leadId)
          }
        } else if (type === 'UPDATE') {
          const newRow = (payload as Record<string, unknown>).new as Record<string, unknown>
          const oldRow = (payload as Record<string, unknown>).old as Record<string, unknown>
          if (newRow?.id) {
            const leadId = String(newRow.id)
            const state = useCrmStore.getState()
            const existingLead = state.leadsById[leadId]

            // Check attendance change
            const newAttended = newRow.attended as string | undefined
            const oldAttended = oldRow?.attended as string | undefined
            if (newAttended !== undefined && newAttended !== oldAttended && existingLead) {
              const customerName = existingLead.customerName || (newRow.customer_name as string) || ''
              if (newAttended === 'attended') {
                addNotification('attendance', `حضر العميل: ${customerName}`, leadId)
              } else if (newAttended === 'no-show') {
                addNotification('attendance', `لم يحضر العميل: ${customerName}`, leadId)
              }
            }

            // Check transfer (sales_name changed from null/empty to a value)
            const newSalesName = newRow.sales_name as string | undefined
            const oldSalesName = oldRow?.sales_name as string | undefined
            if (newSalesName && newSalesName.trim() && (!oldSalesName || !oldSalesName.trim())) {
              const customerName = existingLead?.customerName || (newRow.customer_name as string) || ''
              addNotification('transfer', `تحويل جديد لـ ${newSalesName.trim()}: ${customerName}`, leadId)
            }

            // Build updates object — only include fields that are present in the
            // realtime payload. Supabase UPDATE payloads contain ONLY the changed
            // columns, so we must NOT spread `undefined` values (which would
            // overwrite existing data with null/undefined and "wipe" fields).
            const updates: Record<string, unknown> = {}
            if ('phone' in newRow) updates.phone = (newRow.phone as string) ?? ''
            if ('customer_name' in newRow) updates.customerName = (newRow.customer_name as string) ?? ''
            if ('store_url' in newRow) updates.storeUrl = (newRow.store_url as string) ?? ''
            if ('brief' in newRow) updates.brief = (newRow.brief as string) ?? ''
            if ('contact_result' in newRow) updates.contactResult = (newRow.contact_result as string) ?? ''
            if ('status' in newRow) updates.status = (newRow.status as string) ?? ''
            if ('sales_status' in newRow) updates.salesStatus = (newRow.sales_status as string) ?? null
            if ('attended' in newRow) updates.attended = (newRow.attended as string) ?? null
            if ('sales_name' in newRow) updates.sales = newRow.sales_name ? String(newRow.sales_name).trim() : null
            if ('meeting_date' in newRow) updates.meetingDate = (newRow.meeting_date as string) ?? ''
            if ('meeting_time' in newRow) updates.meetingTime = (newRow.meeting_time as string) ?? ''
            if ('meeting_type' in newRow) updates.meetingType = (newRow.meeting_type as string) ?? ''
            if ('meeting_link' in newRow) updates.meetingLink = (newRow.meeting_link as string) ?? ''
            if ('assigned_at' in newRow) updates.assignedAt = newRow.assigned_at ? new Date(newRow.assigned_at as string).getTime() : null
            if ('is_archived' in newRow) updates.isArchived = (newRow.is_archived as boolean) ?? false
            if ('archived_at' in newRow) updates.archivedAt = newRow.archived_at ? new Date(newRow.archived_at as string).getTime() : null
            if ('archived_by' in newRow) updates.archivedBy = (newRow.archived_by as string) ?? null
            if ('cancelled_from' in newRow) updates.cancelledFrom = (newRow.cancelled_from as string) ?? null
            if ('cancelled_at' in newRow) updates.cancelledAt = newRow.cancelled_at ? new Date(newRow.cancelled_at as string).getTime() : null
            if ('attendance_marked_at' in newRow) updates.attendanceMarkedAt = newRow.attendance_marked_at ? new Date(newRow.attendance_marked_at as string).getTime() : null
            if ('attendance_marked_by' in newRow) updates.attendanceMarkedBy = (newRow.attendance_marked_by as string) ?? null
            if ('contact_result_at' in newRow) updates.contactResultAt = newRow.contact_result_at ? new Date(newRow.contact_result_at as string).getTime() : null

            if (Object.keys(updates).length > 0) {
              updateLeadInCache(leadId, updates)
            }
          }
        } else if (type === 'DELETE') {
          const old = (payload as Record<string, unknown>).old as Record<string, unknown>
          if (old?.id) removeLeadFromCache(String(old.id))
        } else if (type === 'BROADCAST') {
          const msg = (payload as { broadcastMessage?: BroadcastMessage }).broadcastMessage
          if (!msg) return
          if (msg.type === 'assignment') {
            const { currentUser, currentRole, addToast: toast } = useCrmStore.getState()
            if (currentRole === 'sales' && msg.data.sales === currentUser) {
              toast('info', `🔄 اجتماع جديد من ${msg.by} — ${msg.data.customerName || 'عميل'}`)
            }
          }
        }
      }
    }

    const channel = apiSubscribeToLeads(
      (payload) => {
        const eventType = payload.eventType as string
        // Batch updates with 100ms debounce to prevent flickering
        pendingUpdates.push({ type: eventType, payload })
        if (!flushTimer) {
          flushTimer = setTimeout(flushPending, 100)
        }
      },
      (status) => {
        const { setRealtimeStatus } = useCrmStore.getState()
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        else if (status === 'CLOSED') setRealtimeStatus('disconnected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
      }
    )

    return () => {
      // Flush any pending realtime updates before unsubscribing.
      // Without this, updates received during the 100ms debounce window
      // would be lost on unmount (audit §3 row 7).
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushPending()
      }
      if (channel) apiUnsubscribe(channel)
    }
  }, [isAuthenticated, dataLoaded])

  // Show loading screen while hydrating auth from localStorage
  if (hydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0d14]" dir="rtl">
        <LoadingScreen />
      </div>
    )
  }

  // Show login screen if not authenticated (after hydration complete)
  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <div className="flex min-h-screen bg-[#0a0d14]" dir="rtl">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 mr-0 md:mr-[72px] transition-all duration-300">
        {/* Topbar */}
        <div className="p-4 md:p-6 md:pb-0">
          <Topbar />
        </div>

        {/* Content */}
        <div className="flex-1 px-4 md:px-6 pb-6">
          {loading && !dataLoaded ? (
            <LoadingScreen />
          ) : dataError ? (
            <DataErrorBanner
              message={dataError}
              onRetry={() => {
                setDataError(null)
                setDataLoaded(false)
              }}
            />
          ) : (
            <ViewRouter currentView={currentView} />
          )}
        </div>

        {/* Footer - sticky to bottom */}
        <footer className="mt-auto border-t border-white/[0.06] bg-[#111520] px-4 md:px-6 py-3">
          <div className="flex items-center justify-between text-[12px] md:text-[13px] font-semibold text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <span>Venom CRM &copy; 2025 — منصة المبيعات الذكية</span>
            <span className="hidden sm:inline">مدعوم بالذكاء الاصطناعي 🤖</span>
          </div>
        </footer>
      </main>

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  )
}
