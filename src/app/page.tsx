'use client'

import { useEffect } from 'react'
import { useCrmStore, hydrateAuth, type ViewName } from '@/lib/store'
import { apiGetLeads, apiGetArchivedLeads, apiGetTeam, apiSubscribeToLeads, apiUnsubscribe } from '@/lib/supabase'
import { LoginScreen } from '@/components/crm/login-screen'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { Dashboard } from '@/components/crm/dashboard'
import { TeleSheet } from '@/components/crm/tele-sheet'
import { SalesSheet } from '@/components/crm/sales-sheet'
import { AdminPanel } from '@/components/crm/admin-panel'
import { MyMeetings } from '@/components/crm/my-meetings'
import { BulkAdd } from '@/components/crm/bulk-add'
import { MyArchive } from '@/components/crm/my-archive'
import { DailyReport } from '@/components/crm/daily-report'
import { MeetingsPage } from '@/components/crm/meetings-page'
import { CustomersStatus } from '@/components/crm/customers-status'
import { Loader2 } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Fallback view for unknown views                                    */
/* ------------------------------------------------------------------ */
function FallbackView({ view }: { view: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="text-[48px] mb-3">🔍</div>
        <h2
          className="text-[18px] font-bold text-[#f0f2ff] mb-1"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          الصفحة غير موجودة
        </h2>
        <p
          className="text-[13px] text-[#8892b0]"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          عرض غير معروف: {view}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  View Router                                                        */
/* ------------------------------------------------------------------ */
function ViewRouter({ currentView }: { currentView: ViewName }) {
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
    default:
      return <FallbackView view={currentView} />
  }
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
  const { toasts, removeToast } = useCrmStore()

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
            <span className="text-sm flex-1">{t.message}</span>
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
  const {
    isAuthenticated,
    currentView,
    loading,
    dataLoaded,
    setLeads,
    setArchivedLeads,
    setTeam,
    setDataLoaded,
    setLoading,
  } = useCrmStore()

  // Hydrate auth from localStorage on first mount
  useEffect(() => {
    hydrateAuth()
  }, [])

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
              phone: (newRow.phone as string) || undefined,
              customerName: (newRow.customer_name as string) || undefined,
              status: (newRow.status as string) || undefined,
              attended: (newRow.attended as string) || undefined,
              sales: (newRow.sales_name as string) ? (newRow.sales_name as string).trim() : undefined,
              meetingDate: (newRow.meeting_date as string) || undefined,
              meetingTime: (newRow.meeting_time as string) || undefined,
            })
          }
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
          <div className="flex items-center justify-between text-[11px] md:text-[12px] text-[#4a5280]" style={{ fontFamily: 'Cairo, sans-serif' }}>
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
