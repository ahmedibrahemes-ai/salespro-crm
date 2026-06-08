'use client'

import { useEffect, Component, lazy, Suspense, useMemo } from 'react'
import { useCrmStore, hydrateAuth, canAccessView, getDefaultViewForRole, type ViewName } from '@/lib/store'
import { apiGetLeads, apiGetArchivedLeads, apiGetTeam, apiSubscribeToLeads, apiUnsubscribe, type BroadcastMessage } from '@/lib/supabase'
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
const MeetingsPage = lazy(() => import('@/components/crm/meetings-page').then(m => ({ default: m.MeetingsPage })))
const CustomersStatus = lazy(() => import('@/components/crm/customers-status').then(m => ({ default: m.CustomersStatus })))
const EmployeeProfile = lazy(() => import('@/components/crm/employee-profile').then(m => ({ default: m.EmployeeProfile })))
const TransfersPage = lazy(() => import('@/components/crm/transfers-page').then(m => ({ default: m.TransfersPage })))

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
      case 'meetings':
        return <MeetingsPage />
      case 'customers-status':
        return <CustomersStatus />
      case 'transfers':
        return <TransfersPage />
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
  const currentView = useCrmStore((s) => s.currentView)
  const currentRole = useCrmStore((s) => s.currentRole)
  const setCurrentView = useCrmStore((s) => s.setCurrentView)
  const loading = useCrmStore((s) => s.loading)
  const dataLoaded = useCrmStore((s) => s.dataLoaded)
  const setLeads = useCrmStore((s) => s.setLeads)
  const setArchivedLeads = useCrmStore((s) => s.setArchivedLeads)
  const setTeam = useCrmStore((s) => s.setTeam)
  const setDataLoaded = useCrmStore((s) => s.setDataLoaded)
  const setLoading = useCrmStore((s) => s.setLoading)

  // Hydrate auth from localStorage on first mount
  useEffect(() => {
    hydrateAuth()
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
  useEffect(() => {
    if (!isAuthenticated || dataLoaded) return

    async function loadData() {
      setLoading(true)
      try {
        const [active, archived, team] = await Promise.all([
          apiGetLeads(false).catch(() => []),
          apiGetArchivedLeads().catch(() => []),
          apiGetTeam().catch(() => ({ tele: [], sales: [], admin: [] })),
        ])

        setLeads(active)
        setArchivedLeads(archived)
        setTeam(team)
        setDataLoaded(true)
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [isAuthenticated, dataLoaded, setLeads, setArchivedLeads, setTeam, setDataLoaded, setLoading])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isAuthenticated || !dataLoaded) return

    const channel = apiSubscribeToLeads(
      (payload) => {
        const eventType = payload.eventType as string
        const { addLeadToCache, updateLeadInCache, removeLeadFromCache, addToast } = useCrmStore.getState()

        if (eventType === 'INSERT') {
          const newRow = payload.new as Record<string, unknown>
          if (newRow?.id) {
            addLeadToCache({
              id: String(newRow.id),
              storeUrl: (newRow.store_url as string) || '',
              phone: (newRow.phone as string) || '',
              customerName: (newRow.customer_name as string) || '',
              customerType: (newRow.customer_type as string) || '',
              brief: (newRow.brief as string) || '',
              contactResult: (newRow.contact_result as string) || '',
              contactResultAt: null,
              tele: ((newRow.tele_name as string) || '').trim(),
              sales: (newRow.sales_name as string) ? (newRow.sales_name as string).trim() : null,
              meetingDate: (newRow.meeting_date as string) || '',
              meetingTime: (newRow.meeting_time as string) || '',
              meetingType: (newRow.meeting_type as string) || '',
              meetingLink: (newRow.meeting_link as string) || '',
              status: (newRow.status as string) || 'new',
              salesStatus: (newRow.sales_status as string) || null,
              attended: null,
              attendanceMarkedAt: null,
              attendanceMarkedBy: null,
              cancelledFrom: null,
              cancelledAt: null,
              createdAt: newRow.created_at ? new Date(newRow.created_at as string).getTime() : 0,
              assignedAt: null,
              isArchived: false,
              archivedAt: null,
              archivedBy: null,
              notes: [],
            })
          }
        } else if (eventType === 'UPDATE') {
          const newRow = payload.new as Record<string, unknown>
          if (newRow?.id) {
            updateLeadInCache(String(newRow.id), {
              phone: (newRow.phone as string) ?? undefined,
              customerName: (newRow.customer_name as string) ?? undefined,
              storeUrl: (newRow.store_url as string) ?? undefined,
              brief: (newRow.brief as string) ?? undefined,
              contactResult: (newRow.contact_result as string) ?? undefined,
              status: (newRow.status as string) ?? undefined,
              salesStatus: (newRow.sales_status as string) ?? undefined,
              attended: (newRow.attended as string) ?? undefined,
              sales: newRow.sales_name ? String(newRow.sales_name).trim() : null,
              meetingDate: (newRow.meeting_date as string) ?? undefined,
              meetingTime: (newRow.meeting_time as string) ?? undefined,
              meetingType: (newRow.meeting_type as string) ?? undefined,
              meetingLink: (newRow.meeting_link as string) ?? undefined,
              assignedAt: newRow.assigned_at ? new Date(newRow.assigned_at as string).getTime() : null,
              isArchived: (newRow.is_archived as boolean) ?? undefined,
            })
          }
        } else if (eventType === 'BROADCAST') {
          const msg = payload.broadcastMessage as BroadcastMessage | undefined
          if (!msg) return
          if (msg.type === 'assignment') {
            const { currentUser, currentRole, addToast } = useCrmStore.getState()
            if (currentRole === 'sales' && msg.data.sales === currentUser) {
              addToast('info', `🔄 اجتماع جديد من ${msg.by} — ${msg.data.customerName || 'عميل'}`)
            }
          }
          return
        } else if (eventType === 'DELETE') {
          const old = payload.old as Record<string, unknown>
          if (old?.id) removeLeadFromCache(String(old.id))
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
      if (channel) apiUnsubscribe(channel)
    }
  }, [isAuthenticated, dataLoaded])

  // Show login screen if not authenticated
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
          {loading && !dataLoaded ? <LoadingScreen /> : <ViewRouter currentView={currentView} />}
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
