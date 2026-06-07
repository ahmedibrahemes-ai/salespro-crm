'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Archive,
  Search,
  RotateCcw,
  Trash2,
  FolderOpen,
  Eye,
  Info,
  RefreshCw,
  Loader2,
  ExternalLink,
  CalendarOff,
  CheckSquare,
  Square,
  X,
} from 'lucide-react'
import {
  useCrmStore,
  formatDate,
} from '@/lib/store'
import {
  apiUnarchiveLeads,
  apiDeleteLeadsBulk,
} from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'

// ===== Main Component =====
export function MyArchive() {
  const {
    currentUser,
    currentRole,
    archivedLeads,
    batchRemoveLeadsFromCache,
    unarchiveLeadsInCache,
    getAccessibleTeleSheets,
    getAccessibleSalesSheets,
    addToast,
    searchQueries,
    setSearchQuery,
  } = useCrmStore()

  const VIEW_KEY = 'my-archive'

  const [viewingSheet, setViewingSheet] = useState<string>(currentUser || '')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState(false)

  const isTele = currentRole === 'tele'

  // Accessible sheets
  const accessibleSheets = currentUser
    ? isTele
      ? getAccessibleTeleSheets(currentUser)
      : getAccessibleSalesSheets(currentUser)
    : []

  // Ensure viewingSheet is valid
  const validViewingSheet =
    accessibleSheets.map((s) => s.toLowerCase()).includes(viewingSheet.toLowerCase())
      ? viewingSheet
      : currentUser || ''

  const isViewingOwn = validViewingSheet.toLowerCase() === (currentUser || '').toLowerCase()

  // Filter archived leads by selected sheet
  const myArchived = useMemo(() => {
    const sheetLower = validViewingSheet.toLowerCase()
    return archivedLeads.filter((l) => {
      if (isTele) return l.tele && l.tele.toLowerCase() === sheetLower
      return l.sales && l.sales.toLowerCase() === sheetLower
    })
  }, [archivedLeads, validViewingSheet, isTele])

  // Search filter
  const searchQuery = searchQueries[VIEW_KEY] || ''
  const filtered = useMemo(() => {
    if (!searchQuery) return myArchived
    const q = searchQuery.toLowerCase()
    return myArchived.filter(
      (l) =>
        (l.customerName || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.storeUrl || '').toLowerCase().includes(q)
    )
  }, [myArchived, searchQuery])

  // ===== Selection logic =====
  const allFilteredIds = useMemo(() => filtered.map((l) => l.id), [filtered])
  const isAllSelected = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id))
  const isSomeSelected = !isAllSelected && filtered.some((l) => selectedIds.has(l.id))

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allFilteredIds))
    }
  }, [isAllSelected, allFilteredIds])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // ===== Bulk actions =====
  const handleBulkRestore = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`متأكد عايز ترجع ${ids.length} عميل للشيت الأساسي؟`)) return
    setBulkAction(true)
    try {
      // Optimistic: update cache immediately
      unarchiveLeadsInCache(ids)
      apiUnarchiveLeads(ids).catch((err) => {
        console.error('[my-archive] Bulk unarchive error (background):', err)
      })
      addToast('success', `✅ تم إرجاع ${ids.length} عميل للشيت الأساسي`)
      setSelectedIds(new Set())
    } catch {
      addToast('error', 'فشل في إلغاء الأرشفة')
    } finally {
      setBulkAction(false)
    }
  }, [selectedIds, addToast, unarchiveLeadsInCache])

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`⚠️ متأكد عايز تمسح ${ids.length} عميل نهائياً؟ ده مش هيرجع تاني!`)) return
    setBulkAction(true)
    try {
      // Optimistic: update cache immediately
      batchRemoveLeadsFromCache(ids)
      apiDeleteLeadsBulk(ids).catch((err) => {
        console.error('[my-archive] Bulk delete error (background):', err)
      })
      addToast('success', `🗑️ تم حذف ${ids.length} عميل نهائياً`)
      setSelectedIds(new Set())
    } catch {
      addToast('error', 'فشل الحذف')
    } finally {
      setBulkAction(false)
    }
  }, [selectedIds, addToast, batchRemoveLeadsFromCache])

  // Manual reload (for refresh button)
  const reloadData = useCallback(async () => {
    setLoading(true)
    try {
      // Force page reload to get fresh data
      window.location.reload()
    } catch {
      addToast('error', 'فشل في تحميل البيانات')
      setLoading(false)
    }
  }, [addToast])
  const truncate = (str: string, len: number) => {
    if (!str) return ''
    const cleaned = str.replace(/^https?:\/\//, '')
    return cleaned.length > len ? cleaned.slice(0, len) + '...' : cleaned
  }

  // Unarchive single
  const handleUnarchive = useCallback(
    async (id: string) => {
      try {
        // Optimistic: update cache immediately
        unarchiveLeadsInCache([id])
        apiUnarchiveLeads([id]).catch((err) => {
          console.error('[my-archive] Unarchive error (background):', err)
        })
        addToast('success', '✅ تم إرجاع العميل للشيت الأساسي')
      } catch {
        addToast('error', 'فشل في إلغاء الأرشفة')
      }
    },
    [addToast, unarchiveLeadsInCache]
  )

  // Delete permanently
  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('متأكد عايز تمسحه نهائي؟ ده مش هيرجع تاني!')) return
      setDeleting(id)
      try {
        // Optimistic: update cache immediately
        batchRemoveLeadsFromCache([id])
        apiDeleteLeadsBulk([id]).catch((err) => {
          console.error('[my-archive] Delete error (background):', err)
        })
        addToast('success', 'تم الحذف النهائي')
      } catch {
        addToast('error', 'فشل الحذف')
      } finally {
        setDeleting(null)
      }
    },
    [addToast, batchRemoveLeadsFromCache]
  )

  // Role guard: admin uses admin panel (AFTER all hooks)
  if (!currentUser || !currentRole || currentRole === 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Info className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <h3 className="text-lg font-semibold text-muted-foreground">الأدمن يستخدم تاب الأرشيف من الإدارة</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Sheet Selector */}
      {accessibleSheets.length > 1 && (
        <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl flex-wrap">
          <FolderOpen className="w-5 h-5 text-venom shrink-0" />
          <span className="text-xs text-muted-foreground font-medium">اختار الشيت:</span>
          <select
            value={validViewingSheet}
            onChange={(e) => setViewingSheet(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 border border-border rounded-lg bg-background text-sm cursor-pointer"
          >
            {accessibleSheets.map((name) => {
              const isOwn = name.toLowerCase() === currentUser.toLowerCase()
              return (
                <option key={name} value={name}>
                  {isOwn ? '👤 أرشيفي - ' : '👁️ أرشيف '}{name}
                </option>
              )
            })}
          </select>
          {!isViewingOwn && (
            <Badge className="bg-amber-500/15 text-amber-400 text-xs">
              <Eye className="w-3 h-3 ml-1" />
              بتشوف أرشيف {validViewingSheet}
            </Badge>
          )}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-xs text-amber-400 flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>الأرشيف:</strong> هنا الـ leads اللي اتأرشفوا. علم على اللي عايزه واعمل إرجاع أو مسح جماعي.
        </div>
      </div>

      {/* Search & Refresh */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث في الأرشيف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(VIEW_KEY, e.target.value)}
            className="pr-10 bg-background border-border focus:border-venom/50"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={reloadData}
          disabled={loading}
          className="border-border hover:border-venom/30"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin ml-1" />
          ) : (
            <RefreshCw className="w-4 h-4 ml-1" />
          )}
          تحديث
        </Button>
      </div>

      {/* ===== Bulk Actions Bar ===== */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-venom/10 border border-venom/30 rounded-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-venom text-sm font-medium">
            <CheckSquare className="w-4 h-4" />
            <span>تم اختيار <strong>{selectedIds.size}</strong> عميل</span>
          </div>
          <div className="flex-1" />
          <Button
            size="sm"
            className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 h-8 text-xs gap-1.5"
            onClick={handleBulkRestore}
            disabled={bulkAction}
          >
            {bulkAction ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            إرجاع المحدد
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 h-8 text-xs gap-1.5"
            onClick={handleBulkDelete}
            disabled={bulkAction}
          >
            {bulkAction ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            مسح المحدد
          </Button>
          <button
            onClick={clearSelection}
            className="p-1.5 rounded-lg hover:bg-venom/10 text-muted-foreground hover:text-venom transition-colors cursor-pointer"
            title="إلغاء الاختيار"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Archive List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-venom mb-3" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CalendarOff className="w-14 h-14 mx-auto text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">مفيش leads مؤرشفة</h3>
          <p className="text-sm text-muted-foreground mt-1">الأرشيف لسة فاضي</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-auto">
          {/* Count header */}
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border text-xs text-muted-foreground flex items-center gap-3">
            <Archive className="w-3.5 h-3.5" />
            <span><strong>{filtered.length}</strong> عميل في الأرشيف</span>
            {selectedIds.size > 0 && (
              <Badge className="bg-venom/15 text-venom text-xs">
                {selectedIds.size} محدد
              </Badge>
            )}
          </div>

          <ScrollArea className="max-h-[calc(100vh-380px)]">
            <div className="min-w-[850px]">
              <table className="w-full text-sm" dir="rtl">
                <thead className="bg-muted/30 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-2.5 text-center w-10">
                      <Checkbox
                        checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        className="border-muted-foreground/40 data-[state=checked]:bg-venom data-[state=checked]:border-venom"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">#</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">المتجر</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">الجوال</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">اسم العميل</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">تاريخ الإضافة</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">تاريخ الأرشفة</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l, idx) => {
                    const isSelected = selectedIds.has(l.id)
                    return (
                      <tr
                        key={l.id}
                        className={`border-b border-border/50 hover:bg-venom/5 transition-colors ${
                          isSelected ? 'bg-venom/8 border-r-2 border-r-venom/40' : ''
                        }`}
                      >
                        <td className="px-2 py-2.5 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(l.id)}
                            className="border-muted-foreground/40 data-[state=checked]:bg-venom data-[state=checked]:border-venom"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          {l.storeUrl ? (
                            <a
                              href={l.storeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-venom hover:underline flex items-center gap-1"
                            >
                              {truncate(l.storeUrl, 30)}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground" dir="ltr">
                          {l.phone || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {l.customerName || <span className="text-muted-foreground">بدون اسم</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">
                          {l.createdAt ? formatDate(l.createdAt) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">
                          {l.archivedAt ? formatDate(l.archivedAt) : '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 h-7 text-xs px-2"
                              onClick={() => handleUnarchive(l.id)}
                            >
                              <RotateCcw className="w-3 h-3 ml-1" />
                              إرجاع
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                              disabled={deleting === l.id}
                              onClick={() => handleDelete(l.id)}
                            >
                              {deleting === l.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
