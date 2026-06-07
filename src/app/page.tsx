'use client'

import { useEffect } from 'react'
import { useCrmStore, type ViewName } from '@/lib/store'
import { Sidebar } from '@/components/crm/sidebar'
import { Topbar } from '@/components/crm/topbar'
import { DashboardOverview } from '@/components/crm/dashboard-overview'
import { LeadsManagement } from '@/components/crm/leads-management'
import { SalesPipeline } from '@/components/crm/sales-pipeline'
import { FollowupCenter } from '@/components/crm/followup-center'
import { WhatsAppSection } from '@/components/crm/whatsapp-section'
import { AIFeatures } from '@/components/crm/ai-features'
import { TeamSection } from '@/components/crm/team-section'
import { Client360 } from '@/components/crm/client360'
import { ReportsSection } from '@/components/crm/reports-section'
import { Loader2 } from 'lucide-react'

function ViewRouter({ currentView }: { currentView: ViewName }) {
  switch (currentView) {
    case 'overview': return <DashboardOverview />
    case 'leads': return <LeadsManagement />
    case 'pipeline': return <SalesPipeline />
    case 'followup': return <FollowupCenter />
    case 'whatsapp': return <WhatsAppSection />
    case 'ai': return <AIFeatures />
    case 'team': return <TeamSection />
    case 'client360': return <Client360 />
    case 'reports': return <ReportsSection />
    default: return <DashboardOverview />
  }
}

function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#6c63ff] to-[#00d4aa] animate-pulse opacity-20" />
          <div className="absolute inset-1 rounded-[10px] bg-[#111520] flex items-center justify-center">
            <span className="text-lg font-black bg-gradient-to-br from-[#6c63ff] to-[#00d4aa] bg-clip-text text-transparent">SP</span>
          </div>
        </div>
        <Loader2 size={24} className="animate-spin text-[#6c63ff] mx-auto mb-3" />
        <p className="text-[14px] text-[#8892b0]">جاري تحميل البيانات...</p>
        <p className="text-[11px] text-[#4a5280] mt-1">SalesPro CRM</p>
      </div>
    </div>
  )
}

export default function Home() {
  const { currentView, loading, dataLoaded, setDataLoaded, setLeads, setTeam, setStats, setLoading } = useCrmStore()

  useEffect(() => {
    if (dataLoaded) return

    async function loadData() {
      setLoading(true)
      try {
        await fetch('/api/seed', { method: 'POST' }).catch(() => {})

        const [leadsRes, statsRes, teamRes] = await Promise.all([
          fetch('/api/leads'),
          fetch('/api/stats'),
          fetch('/api/team'),
        ])

        if (leadsRes.ok) {
          const leads = await leadsRes.json()
          setLeads(leads)
        }

        if (statsRes.ok) {
          const stats = await statsRes.json()
          setStats(stats)
        }

        if (teamRes.ok) {
          const team = await teamRes.json()
          setTeam(team)
        }

        setDataLoaded(true)
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [dataLoaded, setDataLoaded, setLeads, setStats, setTeam, setLoading])

  return (
    <div className="flex min-h-screen bg-[#0a0d14]">
      {/* Sidebar - hidden on mobile, shown as overlay */}
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
          <div className="flex items-center justify-between text-[11px] md:text-[12px] text-[#4a5280]">
            <span>SalesPro CRM © 2025 — منصة المبيعات الذكية</span>
            <span className="hidden sm:inline">مدعوم بالذكاء الاصطناعي 🤖</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
