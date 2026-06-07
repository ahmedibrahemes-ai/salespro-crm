'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Archive,
  Search,
  RotateCcw,
  CheckSquare,
  Square,
  Loader2,
  Trash2,
} from 'lucide-react'
import {
  useCrmStore,
  CONTACT_RESULTS,
  SALES_STATUSES,
  ATTENDANCE_STATUSES,
  formatDate,
  formatRelativeTime,
} from '@/lib/store'
import { apiUnarchiveLeads, apiGetLeads, apiGetArchivedLeads } from '@/lib/supabase'
import type { Lead } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

// ===== Main Component =====
export function MyArchive() {
  const { currentUser, currentRole, archivedLeads, setLeads, setArchivedLeads } = useCrmStore()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [unarchiving, setUnarchiving] = useState(false)

  // Filter archived leads for current user
  const myArchived = useMemo(() => {
    if (!currentUser || !currentRole) return []
    if (currentRole === 'admin') return archivedLeads
    if (currentRole === 'tele') return archivedLeads.filter((l) => l.tele === currentUser)
    if (currentRole === 'sales') return archivedLeads.filter((l) => l.sales === currentUser)
    return []
  }, [archivedLeads, currentUser, currentRole])

  // Search filter
  const filtered = useMemo(() => {
    if (!search) return myArchived
    const q = search.toLowerCase()
    return myArchived.filter(
      (l) =>
        (l.customerName || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.storeUrl || '').toLowerCase().includes(q)
    )
  }, [myArchived, search])

  // Toggle selection
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Toggle all
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)))
    }
  }

  // Unarchive single
  const handleUnarchive = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return
      setUnarchiving(true)
      try {
        await apiUnarchiveLeads(ids)
        // Reload data
        const [active, archived] = await Promise.all([
          apiGetLeads(false),
          apiGetArchivedLeads().catch(() => []),
        ])
        setLeads(active)
        setArchivedLeads(archived)
        setSelectedIds(new Set())
        toast.success(`تم إلغاء أرشفة ${ids.length} عنصر بنجاح`)
      } catch {
        toast.error('فشل في إلغاء الأرشفة')
      } finally {
        setUnarchiving(false)
      }
    },
    [setLeads, setArchivedLeads]
  )

  if (!currentUser) return null

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold venom-text-glow text-venom">الأرشيف</h1>
          <p className="text-muted-foreground mt-1">
            العملاء المؤرشفين ({myArchived.length})
          </p>
        </div>
        {selectedIds.size > 0 && (
          <Button
            onClick={() => handleUnarchive(Array.from(selectedIds))}
            disabled={unarchiving}
            className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30"
          >
            {unarchiving ? (
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
            ) : (
              <RotateCcw className="w-4 h-4 ml-2" />
            )}
            إلغاء أرشفة ({selectedIds.size})
          </Button>
        )}
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="relative max-w-md"
      >
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث في الأرشيف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10 bg-background border-border focus:border-venom/50"
        />
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="bg-card border border-border overflow-hidden">
          <ScrollArea className="max-h-[calc(100vh-280px)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-right w-10">
                      <button onClick={toggleAll} className="cursor-pointer">
                        {selectedIds.size === filtered.length && filtered.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-venom" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">#</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">العميل</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">الموبايل</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">المتجر</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">التلي</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">السيلز</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">تاريخ الأرشفة</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        <Archive className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                        <p>لا توجد بيانات مؤرشفة</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((lead, i) => (
                      <motion.tr
                        key={lead.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.5) }}
                        className={`border-b border-border/50 transition-colors ${
                          selectedIds.has(lead.id) ? 'bg-venom/5' : 'hover:bg-venom/5'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button onClick={() => toggleSelect(lead.id)} className="cursor-pointer">
                            {selectedIds.has(lead.id) ? (
                              <CheckSquare className="w-4 h-4 text-venom" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3 font-medium truncate max-w-[150px]">
                          {lead.customerName || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs" dir="ltr">
                          {lead.phone || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">
                          {lead.storeUrl || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.tele || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.sales || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {lead.archivedAt ? formatDate(lead.archivedAt) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-venom hover:text-venom hover:bg-venom/10 h-7"
                            disabled={unarchiving}
                            onClick={() => handleUnarchive([lead.id])}
                          >
                            <RotateCcw className="w-3.5 h-3.5 ml-1" />
                            استعادة
                          </Button>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </Card>
      </motion.div>
    </div>
  )
}
