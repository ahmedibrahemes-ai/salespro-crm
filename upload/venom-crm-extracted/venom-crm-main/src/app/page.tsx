'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCrmStore } from '@/lib/store'
import { apiGetLeads, apiGetArchivedLeads, apiGetTeam, apiSubscribeToLeads, apiUnsubscribe, migrateAttendedValues, normalizeAttended, isDuplicateToast } from '@/lib/supabase'
import type { BroadcastMessage } from '@/lib/supabase'
import { LoginScreen } from '@/components/crm/login-screen'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import Dashboard from '@/components/crm/dashboard'
import { TeleSheet } from '@/components/crm/tele-sheet'
import { SalesSheet } from '@/components/crm/sales-sheet'
import { MyMeetings } from '@/components/crm/my-meetings'
import { SalesMeetings } from '@/components/crm/sales-meetings'
import { CustomersStatus } from '@/components/crm/customers-status'
import { DailyReport } from '@/components/crm/daily-report'
import { MyArchive } from '@/components/crm/my-archive'
import { BulkAdd } from '@/components/crm/bulk-add'
import { AdminPanel } from '@/components/crm/admin-panel'
import { TelegramSetup } from '@/components/crm/telegram-setup'
import { RlsSetupBanner } from '@/components/crm/rls-setup-banner'
import { RealtimeStatusBadge } from '@/components/crm/realtime-status'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

function ViewRouter() {
  const { currentView } = useCrmStore()

  switch (currentView) {
    case 'dashboard': return <Dashboard />
    case 'my-sheet': return <TeleSheet />
    case 'sales-sheet': return <SalesSheet />
    case 'my-meetings': return <MyMeetings />
    case 'meetings': return <SalesMeetings />
    case 'customers-status': return <CustomersStatus />
    case 'daily-report': return <DailyReport />
    case 'my-archive': return <MyArchive />
    case 'bulk-add': return <BulkAdd />
    case 'admin': return <AdminPanel />
    case 'telegram': return <TelegramSetup />
    default: return <Dashboard />
  }
}

function ToastContainer() {
  const { toasts, removeToast } = useCrmStore()

  return (
    <div className="fixed bottom-5 left-5 z-[1000] flex flex-col gap-2">
      {toasts.map((t) => {
        const icons = {
          success: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
          error: <XCircle className="w-5 h-5 text-red-400 shrink-0" />,
          info: <Info className="w-5 h-5 text-venom shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
        }
        const borders = {
          success: 'border-emerald-500/50',
          error: 'border-red-500/50',
          info: 'border-venom/50',
          warning: 'border-amber-500/50',
        }
        return (
          <div
            key={t.id}
            className={`flex items-center gap-3 min-w-[280px] max-w-[400px] bg-card border ${borders[t.type]} rounded-lg px-4 py-3 shadow-lg animate-in slide-in-from-bottom-2 duration-200`}
          >
            {icons[t.type]}
            <span className="text-sm flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ===== Polling interval for background data sync (ms) =====
// This acts as a fallback when Supabase Realtime is not working
// 5 seconds for fast attendance sync; 15 seconds when realtime is connected
const POLL_INTERVAL_DISCONNECTED = 5_000
const POLL_INTERVAL_CONNECTED = 15_000

export default function Home() {
  const {
    isAuthenticated,
    dataLoaded,
    setLeads,
    setArchivedLeads,
    setTeam,
    setDataLoaded,
    updateLeadInCache,
    removeLeadFromCache,
    addLeadToCache,
    theme,
    buildDuplicatesCache,
    incrementDuplicatesVersion,
    leads,
    leadsVersion,
    duplicatesVersion,
    leadsById,
    setRealtimeStatus,
    setLastSyncAt,
    syncChangesToCache,
    realtimeStatus,
  } = useCrmStore(useShallow((s) => ({
    isAuthenticated: s.isAuthenticated,
    dataLoaded: s.dataLoaded,
    setLeads: s.setLeads,
    setArchivedLeads: s.setArchivedLeads,
    setTeam: s.setTeam,
    setDataLoaded: s.setDataLoaded,
    updateLeadInCache: s.updateLeadInCache,
    removeLeadFromCache: s.removeLeadFromCache,
    addLeadToCache: s.addLeadToCache,
    theme: s.theme,
    buildDuplicatesCache: s.buildDuplicatesCache,
    incrementDuplicatesVersion: s.incrementDuplicatesVersion,
    leads: s.leads,
    leadsVersion: s.leadsVersion,
    duplicatesVersion: s.duplicatesVersion,
    leadsById: s.leadsById,
    setRealtimeStatus: s.setRealtimeStatus,
    setLastSyncAt: s.setLastSyncAt,
    syncChangesToCache: s.syncChangesToCache,
    realtimeStatus: s.realtimeStatus,
  })))

  // Track if realtime has received at least one event (proof of connection)
  const realtimeEventReceived = useRef(false)

  // ===== Load initial data =====
  useEffect(() => {
    if (!isAuthenticated || dataLoaded) return

    const { addToast } = useCrmStore.getState()

    async function loadData() {
      try {
        const [active, archived, team] = await Promise.all([
          apiGetLeads(false),
          apiGetArchivedLeads().catch(() => []),
          apiGetTeam(),
        ])
        setLeads(active)
        setArchivedLeads(archived)
        setTeam(team)

        // Safety re-sort: ensure the leads array is in id ASC order.
        // This guards against race conditions where Supabase Realtime
        // INSERT/UPDATE events may have modified the leads array between
        // setLeads() and setDataLoaded(). Calling setLeads again with
        // the current store leads re-sorts them by id.
        const currentLeads = useCrmStore.getState().leads
        if (currentLeads.length > 0) {
          // Only re-sort if the array might be out of order
          let needsReSort = false
          for (let i = 1; i < currentLeads.length; i++) {
            if (currentLeads[i].id < currentLeads[i - 1].id) {
              needsReSort = true
              break
            }
          }
          if (needsReSort) {
            console.log('[loadData] Re-sorting leads array (detected out-of-order entries)')
            setLeads(currentLeads)
          }
        }

        setDataLoaded(true)
        setLastSyncAt(Date.now())

        // Show info toast if no data was loaded (possible RLS issue)
        if (active.length === 0 && archived.length === 0) {
          addToast('warning', '⚠️ لم يتم تحميل بيانات — تأكد من إعدادات RLS في Supabase', 8000)
        }

        // Run background migration for legacy attended values ('true'/'false' → 'attended'/'no-show')
        migrateAttendedValues().then(({ migrated }) => {
          if (migrated > 0) {
            console.log(`🔄 Migrated ${migrated} legacy attended values`)
          }
        }).catch(console.error)
      } catch (err) {
        console.error('Failed to load data:', err)
        addToast('error', '❌ فشل تحميل البيانات — حاول تحديث الصفحة', 8000)
        // Don't set dataLoaded so the effect can retry on next render
      }
    }

    loadData()
  }, [isAuthenticated, dataLoaded])

  // ===== Subscribe to real-time (separate from data loading) =====
  // This MUST be separate from the data loading effect so that
  // changing dataLoaded doesn't destroy the subscription!
  useEffect(() => {
    if (!isAuthenticated) return

    let channel: ReturnType<typeof apiSubscribeToLeads> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let isUnmounted = false
    const { addToast } = useCrmStore.getState()

    // Set initial status to connecting
    setRealtimeStatus('connecting')

    function subscribe() {
      if (isUnmounted) return

      channel = apiSubscribeToLeads((payload) => {
      const eventType = payload.eventType as string
      const table = payload.table as string

      // Mark that we've received at least one real-time event
      if (!realtimeEventReceived.current) {
        realtimeEventReceived.current = true
        if (useCrmStore.getState().realtimeStatus !== 'connected') {
          setRealtimeStatus('connected')
        }
        console.log('[realtime] ✅ First data event received — realtime is fully working')
      }

      // Handle BROADCAST events (cross-user notifications that bypass RLS)
      if (eventType === 'BROADCAST') {
        const broadcastMsg = payload.broadcastMessage as BroadcastMessage | undefined
        if (!broadcastMsg) return

        const { leadId, data, by, byRole, type: changeType } = broadcastMsg
        const currentUser = useCrmStore.getState().currentUser
        const currentRole = useCrmStore.getState().currentRole

        // Don't process our own broadcasts (self: false should prevent this, but be safe)
        if (by === currentUser) return

        // Check if lead exists in cache
        const currentLeadsById = useCrmStore.getState().leadsById
        const existingLead = currentLeadsById[leadId]

        if (!existingLead) {
          console.log(`[broadcast] Lead ${leadId} not in cache, skipping`)
          return
        }

        const leadName = existingLead.customerName || existingLead.phone || 'عميل'

        // Update the lead in cache
        updateLeadInCache(leadId, data)
        setLastSyncAt(Date.now())

        // Show toast notification (with dedup to prevent double toasts from postgres_changes + broadcast)
        if (!isDuplicateToast(leadId)) {
          if (changeType === 'attendance') {
            if (currentRole === 'tele' && existingLead.tele?.toLowerCase() === (currentUser || '').toLowerCase()) {
              if (data.attended === 'attended') {
                addToast('success', `✅ ${by} سجّل حضور ${leadName}`)
              } else if (data.attended === 'no-show') {
                addToast('warning', `❌ ${by} سجّل عدم حضور ${leadName}`)
              }
            }
            if (currentRole === 'sales' && existingLead.sales?.toLowerCase() === (currentUser || '').toLowerCase()) {
              if (data.attended === 'attended') {
                addToast('success', `✅ تم تأكيد حضور ${leadName}`)
              } else if (data.attended === 'no-show') {
                addToast('warning', `❌ ${leadName} لم يحضر`)
              }
            }
          } else if (changeType === 'reset-attendance') {
            if (currentRole === 'tele' && existingLead.tele?.toLowerCase() === (currentUser || '').toLowerCase()) {
              addToast('info', `🔄 ${by} إلغى تسجيل حضور ${leadName}`)
            }
          } else if (changeType === 'assignment') {
            if (currentRole === 'tele' && existingLead.tele?.toLowerCase() === (currentUser || '').toLowerCase()) {
              addToast('info', `🔄 تم تحويل ${leadName} لـ ${data.sales}`)
            }
          }
        }

        return // Done processing broadcast
      }

      // Handle lead_notes real-time events (add note to the lead's cache)
      if (table === 'lead_notes') {
        if (eventType === 'INSERT') {
          const newRow = payload.new as Record<string, unknown>
          const leadId = newRow?.lead_id as string | undefined
          if (leadId) {
            // Use getState() to get current leadsById (not stale closure)
            const currentLeadsById = useCrmStore.getState().leadsById
            const existingLead = currentLeadsById[leadId]
            if (existingLead) {
              const newNote = {
                id: String(newRow.id || Date.now()),
                by: (newRow.by_name as string) || '',
                cat: (newRow.category as string) || '',
                text: (newRow.text as string) || '',
                at: newRow.created_at ? new Date(newRow.created_at as string).getTime() : Date.now(),
              }
              updateLeadInCache(leadId, {
                notes: [...(existingLead.notes || []), newNote],
              })
            }
          }
        } else if (eventType === 'DELETE') {
          // Note deleted — we could remove it from cache, but it's simpler to just skip
          // The user who deleted it already updated their local state
        }
        return
      }

      if (eventType === 'INSERT') {
        const newRow = payload.new as Record<string, unknown>
        if (newRow?.id) {
          // Skip if lead already exists in cache (e.g., added by the current user's API call)
          const currentLeadsById = useCrmStore.getState().leadsById
          if ((String(newRow.id)) in currentLeadsById) {
            console.log(`[realtime] INSERT skipped (already in cache): id=${newRow.id}`)
            return
          }

          // Construct a lead from the payload and add to cache
          // Use normalizeAttended for backward compat and .trim() for name fields
          const lead: Partial<import('@/lib/supabase').Lead> = {
            id: String(newRow.id),
            storeUrl: (newRow.store_url as string) || '',
            phone: (newRow.phone as string) || '',
            customerName: (newRow.customer_name as string) || '',
            customerType: (newRow.customer_type as string) || '',
            brief: (newRow.brief as string) || '',
            contactResult: (newRow.contact_result as string) || '',
            contactResultAt: newRow.contact_result_at ? new Date(newRow.contact_result_at as string).getTime() : null,
            tele: ((newRow.tele_name as string) || '').trim(),
            sales: (newRow.sales_name as string) ? (newRow.sales_name as string).trim() : null,
            meetingDate: (newRow.meeting_date as string) || '',
            meetingTime: (newRow.meeting_time as string) || '',
            meetingType: (newRow.meeting_type as string) || '',
            meetingLink: (newRow.meeting_link as string) || '',
            status: (newRow.status as string) || 'new',
            salesStatus: (newRow.sales_status as string) || null,
            attended: normalizeAttended(newRow.attended as string | null),
            attendanceMarkedAt: newRow.attendance_marked_at ? new Date(newRow.attendance_marked_at as string).getTime() : null,
            attendanceMarkedBy: (newRow.attendance_marked_by as string) || null,
            cancelledFrom: (newRow.cancelled_from as string) || null,
            cancelledAt: newRow.cancelled_at ? new Date(newRow.cancelled_at as string).getTime() : null,
            createdAt: newRow.created_at ? new Date(newRow.created_at as string).getTime() : 0,
            assignedAt: newRow.assigned_at ? new Date(newRow.assigned_at as string).getTime() : null,
            isArchived: (newRow.is_archived as boolean) || false,
            archivedAt: newRow.archived_at ? new Date(newRow.archived_at as string).getTime() : null,
            archivedBy: (newRow.archived_by as string) || null,
            notes: [],
          }
          console.log(`[realtime] INSERT adding to cache: id=${newRow.id}, tele=${(newRow.tele_name as string) || ''}, sales=${(newRow.sales_name as string) || ''}`)
          addLeadToCache(lead as import('@/lib/supabase').Lead)
        }
      } else if (eventType === 'UPDATE') {
        const newRow = payload.new as Record<string, unknown>
        if (newRow?.id) {
          // Preserve existing createdAt from cache to prevent row jumping.
          const existingLead = useCrmStore.getState().leadsById[String(newRow.id)]
          const preservedCreatedAt = existingLead?.createdAt

          // Detect important cross-user changes and show toast notification
          const currentUser = useCrmStore.getState().currentUser
          const currentRole = useCrmStore.getState().currentRole
          const oldAttended = existingLead?.attended
          const newAttended = normalizeAttended(newRow.attended as string | null)
          const oldSales = existingLead?.sales
          const newSales = (newRow.sales_name as string) ? (newRow.sales_name as string).trim() : null
          const leadTele = ((newRow.tele_name as string) || '').trim()
          const leadName = (newRow.customer_name as string) || (newRow.phone as string) || 'عميل'

          // Toast: attendance changed by someone else (with dedup to prevent double toasts)
          if (oldAttended !== newAttended && newAttended && !isDuplicateToast(String(newRow.id))) {
            const markerName = (newRow.attendance_marked_by as string) || 'السيلز'
            // Notify tele if this is their lead
            if (currentRole === 'tele' && leadTele.toLowerCase() === (currentUser || '').toLowerCase()) {
              if (newAttended === 'attended') {
                addToast('success', `✅ ${markerName} سجّل حضور ${leadName}`)
              } else if (newAttended === 'no-show') {
                addToast('warning', `❌ ${markerName} سجّل عدم حضور ${leadName}`)
              }
            }
            // Notify sales if this lead is assigned to them
            if (currentRole === 'sales' && newSales?.toLowerCase() === (currentUser || '').toLowerCase()) {
              if (newAttended === 'attended') {
                addToast('success', `✅ تم تأكيد حضور ${leadName}`)
              } else if (newAttended === 'no-show') {
                addToast('warning', `❌ ${leadName} لم يحضر`)
              }
            }
          }

          // Toast: lead assigned to sales (for tele's own leads) (with dedup)
          if (!oldSales && newSales && currentRole === 'tele' && leadTele.toLowerCase() === (currentUser || '').toLowerCase() && !isDuplicateToast(String(newRow.id))) {
            addToast('info', `🔄 تم تحويل ${leadName} لـ ${newSales}`)
          }

          // Convert snake_case DB row to camelCase Lead format (same as INSERT handler)
          // Use normalizeAttended for backward compat and .trim() for name fields
          const updates: Partial<import('@/lib/supabase').Lead> = {
            id: String(newRow.id),
            storeUrl: (newRow.store_url as string) || '',
            phone: (newRow.phone as string) || '',
            customerName: (newRow.customer_name as string) || '',
            customerType: (newRow.customer_type as string) || '',
            brief: (newRow.brief as string) || '',
            contactResult: (newRow.contact_result as string) || '',
            contactResultAt: newRow.contact_result_at ? new Date(newRow.contact_result_at as string).getTime() : null,
            tele: ((newRow.tele_name as string) || '').trim(),
            sales: (newRow.sales_name as string) ? (newRow.sales_name as string).trim() : null,
            meetingDate: (newRow.meeting_date as string) || '',
            meetingTime: (newRow.meeting_time as string) || '',
            meetingType: (newRow.meeting_type as string) || '',
            meetingLink: (newRow.meeting_link as string) || '',
            status: (newRow.status as string) || 'new',
            salesStatus: (newRow.sales_status as string) || null,
            attended: newAttended,
            attendanceMarkedAt: newRow.attendance_marked_at ? new Date(newRow.attendance_marked_at as string).getTime() : null,
            attendanceMarkedBy: (newRow.attendance_marked_by as string) || null,
            cancelledFrom: (newRow.cancelled_from as string) || null,
            cancelledAt: newRow.cancelled_at ? new Date(newRow.cancelled_at as string).getTime() : null,
            createdAt: preservedCreatedAt || (newRow.created_at ? new Date(newRow.created_at as string).getTime() : 0),
            assignedAt: newRow.assigned_at ? new Date(newRow.assigned_at as string).getTime() : null,
            isArchived: (newRow.is_archived as boolean) || false,
            archivedAt: newRow.archived_at ? new Date(newRow.archived_at as string).getTime() : null,
            archivedBy: (newRow.archived_by as string) || null,
          }

          // Check if archive status changed — need to move between arrays
          const newIsArchived = (newRow.is_archived as boolean) || false
          const archiveStatusChanged = existingLead && existingLead.isArchived !== newIsArchived

          if (archiveStatusChanged) {
            // Archive status changed — move the lead between active/archived arrays
            const fullLead = { ...existingLead, ...updates } as import('@/lib/supabase').Lead
            const leadId = String(newRow.id)
            if (newIsArchived) {
              // Lead was archived: remove from active, add to archived
              const newActive = useCrmStore.getState().leads.filter(l => l.id !== leadId)
              const newArchived = [...useCrmStore.getState().archivedLeads, fullLead]
              const newById = { ...useCrmStore.getState().leadsById }
              delete newById[leadId]
              useCrmStore.setState({ leads: newActive, archivedLeads: newArchived, leadsById: newById, leadsVersion: useCrmStore.getState().leadsVersion + 1 })
            } else {
              // Lead was unarchived: remove from archived, add to active
              const newArchived = useCrmStore.getState().archivedLeads.filter(l => l.id !== leadId)
              const newActive = [fullLead, ...useCrmStore.getState().leads]
              const newById = { ...useCrmStore.getState().leadsById, [leadId]: fullLead }
              useCrmStore.setState({ leads: newActive, archivedLeads: newArchived, leadsById: newById, leadsVersion: useCrmStore.getState().leadsVersion + 1 })
            }
          } else {
            updateLeadInCache(String(newRow.id), updates)
          }
          setLastSyncAt(Date.now())

          // If phone number changed, invalidate duplicates cache
          if (existingLead && existingLead.phone !== updates.phone) {
            useCrmStore.getState().incrementDuplicatesVersion()
          }

          // If phone number changed, invalidate duplicates cache
          if (currentLead && currentLead.phone !== updates.phone) {
            useCrmStore.getState().incrementDuplicatesVersion()
          }
        }
      } else if (eventType === 'DELETE') {
        const old = payload.old as Record<string, unknown>
        if (old?.id) removeLeadFromCache(String(old.id))
      }
    }, (status) => {
      // Handle subscription status changes
      if (status === 'SUBSCRIBED') {
        // WebSocket is connected — broadcast channel is working
        // Set to 'connected' since the broadcast channel (our primary cross-user
        // notification mechanism) works as soon as the WebSocket is subscribed.
        const current = useCrmStore.getState().realtimeStatus
        if (current === 'connecting' || current === 'disconnected') {
          setRealtimeStatus('connected')
          console.log('[realtime] ✅ WebSocket connected — broadcast channel is ready for cross-user notifications')
        }
      } else if (status === 'CLOSED') {
        console.warn('[realtime] WebSocket closed — will try to reconnect in 3 seconds')
        setRealtimeStatus('disconnected')
        // Auto-reconnect after 3 seconds
        if (!isUnmounted) {
          reconnectTimer = setTimeout(() => {
            console.log('[realtime] 🔄 Attempting to reconnect...')
            setRealtimeStatus('connecting')
            subscribe()
          }, 3000)
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[realtime] ❌ Channel error — will try to reconnect in 5 seconds')
        setRealtimeStatus('error')
        // Auto-reconnect after 5 seconds
        if (!isUnmounted) {
          reconnectTimer = setTimeout(() => {
            console.log('[realtime] 🔄 Attempting to reconnect after error...')
            setRealtimeStatus('connecting')
            subscribe()
          }, 5000)
        }
      }
    })
    } // end of subscribe()

    // Start the initial subscription
    subscribe()

    return () => {
      isUnmounted = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (channel) apiUnsubscribe(channel)
    }
  }, [isAuthenticated])

  // ===== Polling Fallback =====
  // Periodically fetch fresh data and merge changes into cache.
  // This ensures tele users see attendance changes even if Supabase Realtime isn't working.
  // Uses faster polling (5s) when realtime is disconnected, slower (15s) when connected.
  useEffect(() => {
    if (!isAuthenticated || !dataLoaded) return

    let pollTimer: ReturnType<typeof setInterval> | null = null
    let isPolling = false

    const pollFreshData = async () => {
      if (isPolling) return
      isPolling = true

      try {
        const [freshActive, freshArchived] = await Promise.all([
          apiGetLeads(false),
          apiGetArchivedLeads().catch(() => []),
        ])

        const changedCount = syncChangesToCache(freshActive, freshArchived)
        if (changedCount > 0) {
          console.log(`[poll] 🔄 Synced ${changedCount} changed leads from server`)
          setLastSyncAt(Date.now())
        }

        // If realtime was disconnected but polling is working, update status
        const status = useCrmStore.getState().realtimeStatus
        if (status === 'disconnected' || status === 'error') {
          // Polling is working — keep disconnected status but update lastSyncAt
          setLastSyncAt(Date.now())
        }
      } catch (err) {
        console.warn('[poll] Failed to fetch fresh data:', err)
      } finally {
        isPolling = false
      }
    }

    // Start polling after initial data is loaded
    // Use faster interval when realtime is disconnected
    const interval = realtimeStatus === 'connected'
      ? POLL_INTERVAL_CONNECTED
      : POLL_INTERVAL_DISCONNECTED
    pollTimer = setInterval(pollFreshData, interval)

    return () => {
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [isAuthenticated, dataLoaded, syncChangesToCache, setLastSyncAt, realtimeStatus])

  // Build duplicate cache when leads structure changes (add/remove) or when phone-related changes occur
  // Runs immediately (no delay) so duplicate indicators appear right away after adding data
  useEffect(() => {
    if (leads.length === 0) return
    buildDuplicatesCache(leads)
  }, [leadsVersion, duplicatesVersion, leads.length, buildDuplicatesCache])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  if (!isAuthenticated) return <LoginScreen />

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir="rtl">
      <RlsSetupBanner />
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar />
        <div className="flex-1 overflow-y-auto">
          <ViewRouter />
        </div>
      </main>
      <ToastContainer />
      <RealtimeStatusBadge />
    </div>
  )
}
