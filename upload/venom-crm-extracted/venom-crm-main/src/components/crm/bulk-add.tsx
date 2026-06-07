'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Loader2,
  CloudUpload,
  Info,
  ShieldCheck,
  X,
  AlertTriangle,
  CheckCircle,
  Eraser,
} from 'lucide-react'
import {
  useCrmStore,
  normalizePhone,
  isValidSaudiPhone,
} from '@/lib/store'
import { apiBulkCreateLeads, apiCheckDuplicatePhones } from '@/lib/supabase'
import type { Lead } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ===== Row type =====
interface BulkRow {
  id: number
  storeUrl: string
  phone: string
  notes: string
  phoneError: boolean
}

interface DuplicateEntry {
  row: BulkRow
  normalizedPhone: string
  existingOwner: string
}

function createEmptyRow(id: number): BulkRow {
  return { id, storeUrl: '', phone: '', notes: '', phoneError: false }
}

// ===== Grid column template (RTL) =====
const GRID_COLS = 'grid-cols-[40px_1.5fr_1.3fr_1fr_50px]'

// ===== Draft helpers =====
function getDraftKey(role: string | null, user: string | null): string {
  return `venom_bulk_draft_${role}_${user}`
}

function loadDraft(role: string | null, user: string | null): BulkRow[] | null {
  try {
    const raw = localStorage.getItem(getDraftKey(role, user))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((r: Omit<BulkRow, 'id' | 'phoneError'>, i: number) => ({
        ...r,
        id: i,
        phoneError: r.phone ? !isValidSaudiPhone(normalizePhone(r.phone)) : false,
      }))
    }
    return null
  } catch {
    return null
  }
}

function saveDraft(role: string | null, user: string | null, rows: BulkRow[]) {
  try {
    const hasData = rows.some((r) => r.storeUrl || r.phone || r.notes)
    if (hasData) {
      const stripped = rows.map((r) => ({ storeUrl: r.storeUrl, phone: r.phone, notes: r.notes }))
      localStorage.setItem(getDraftKey(role, user), JSON.stringify(stripped))
    } else {
      localStorage.removeItem(getDraftKey(role, user))
    }
  } catch {
    // ignore quota errors
  }
}

function clearDraftStorage(role: string | null, user: string | null) {
  try {
    localStorage.removeItem(getDraftKey(role, user))
  } catch {
    // ignore
  }
}

// ===== Smart paste detection =====
function looksLikeUrl(v: string): boolean {
  if (!v) return false
  const s = v.trim()
  return /^https?:\/\//i.test(s) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(s) || s.includes('/')
}

function looksLikePhone(v: string): boolean {
  if (!v) return false
  const digits = v.replace(/[\s\-()/+]/g, '')
  return /^\d{8,15}$/.test(digits)
}

// ===== Main Component =====
export function BulkAdd() {
  const {
    currentUser,
    currentRole,
    team,
    leads,
    addToast,
    batchAddLeadsToCache,
    getAccessibleTeleSheets,
    getAccessibleSalesSheets,
  } = useCrmStore()

  const [submitting, setSubmitting] = useState(false)
  const [nextId, setNextId] = useState(100)
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // ===== Draft state =====
  const [rows, setRows] = useState<BulkRow[]>(() => {
    const draft = loadDraft(currentRole, currentUser)
    if (draft) return draft
    return Array.from({ length: 8 }, (_, i) => createEmptyRow(i))
  })
  const [hasDraft, setHasDraft] = useState(() => {
    try {
      return !!localStorage.getItem(getDraftKey(currentRole, currentUser))
    } catch {
      return false
    }
  })

  // ===== Duplicate dialog =====
  const [dupDialogOpen, setDupDialogOpen] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([])
  const [freshRows, setFreshRows] = useState<BulkRow[]>([])

  // ===== Selected sheet =====
  const [selectedSheet, setSelectedSheet] = useState(currentUser || '')

  // ===== Determine accessible sheets using store permissions =====
  const teleAccessibleSheets = useMemo(() => {
    if (currentRole !== 'tele' || !currentUser) return []
    return getAccessibleTeleSheets(currentUser)
  }, [currentRole, currentUser, getAccessibleTeleSheets])

  const salesAccessibleSheets = useMemo(() => {
    if (currentRole !== 'sales' || !currentUser) return []
    return getAccessibleSalesSheets(currentUser)
  }, [currentRole, currentUser, getAccessibleSalesSheets])

  // ===== Keep selectedSheet in sync =====
  useEffect(() => {
    if (currentRole === 'tele' && teleAccessibleSheets.length > 0) {
      if (!teleAccessibleSheets.includes(selectedSheet)) {
        setSelectedSheet(currentUser || teleAccessibleSheets[0])
      }
    }
    if (currentRole === 'sales' && salesAccessibleSheets.length > 0) {
      if (!salesAccessibleSheets.includes(selectedSheet)) {
        setSelectedSheet(currentUser || salesAccessibleSheets[0])
      }
    }
  }, [currentRole, teleAccessibleSheets, salesAccessibleSheets, selectedSheet, currentUser])

  // ===== Save draft helper =====
  const persistDraft = useCallback((newRows: BulkRow[]) => {
    saveDraft(currentRole, currentUser, newRows)
    setHasDraft(newRows.some((r) => r.storeUrl || r.phone || r.notes))
  }, [currentRole, currentUser])

  // ===== Row operations =====
  const addRows = useCallback((n: number) => {
    setRows((prev) => {
      const newRows = Array.from({ length: n }, (_, i) => createEmptyRow(nextId + i))
      const updated = [...prev, ...newRows]
      setNextId((p) => p + n)
      persistDraft(updated)
      return updated
    })
  }, [nextId, persistDraft])

  const removeRow = useCallback((id: number) => {
    setRows((prev) => {
      const filtered = prev.filter((r) => r.id !== id)
      if (filtered.length === 0) {
        const newRow = createEmptyRow(nextId)
        setNextId((p) => p + 1)
        persistDraft([newRow])
        return [newRow]
      }
      persistDraft(filtered)
      return filtered
    })
  }, [nextId, persistDraft])

  const updateRow = useCallback((id: number, field: 'storeUrl' | 'phone' | 'notes', value: string) => {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== id) return r
        const u = { ...r, [field]: value }
        if (field === 'phone' && value) {
          const norm = normalizePhone(value)
          u.phoneError = !isValidSaudiPhone(norm)
        } else if (field === 'phone') {
          u.phoneError = false
        }
        return u
      })
      persistDraft(updated)
      return updated
    })
  }, [persistDraft])

  // ===== Status calculation =====
  const stats = useMemo(() => {
    const valid = rows.filter((r) => {
      if (r.phone && isValidSaudiPhone(normalizePhone(r.phone))) return true
      if (r.storeUrl && r.storeUrl.trim()) return true
      return false
    })
    const invalid = rows.filter((r) => r.phone && !isValidSaudiPhone(normalizePhone(r.phone)) && !r.storeUrl)
    const empty = rows.filter((r) => !r.phone && !r.storeUrl)
    return { valid: valid.length, invalid: invalid.length, empty: empty.length }
  }, [rows])

  // ===== Paste handling =====
  const handlePaste = useCallback((text: string, startIdx: number, startField: string) => {
    const lines = text.split('\n').filter((l) => l.trim())
    const fields: ('storeUrl' | 'phone' | 'notes')[] = ['storeUrl', 'phone', 'notes']
    const startFieldIdx = fields.indexOf(startField as typeof fields[0])

    let pasted = 0
    const newRows = [...rows]

    lines.forEach((line, lineIdx) => {
      const cells = line.split('\t')
      const targetRowIdx = startIdx + lineIdx

      while (newRows.length <= targetRowIdx) {
        newRows.push(createEmptyRow(nextId + newRows.length))
      }

      if (cells.length === 1) {
        // Single-cell smart paste: detect if it's URL or phone
        const v = cells[0].trim()
        if (looksLikeUrl(v)) {
          newRows[targetRowIdx] = { ...newRows[targetRowIdx], storeUrl: v }
        } else if (looksLikePhone(v)) {
          const norm = normalizePhone(v)
          newRows[targetRowIdx] = { ...newRows[targetRowIdx], phone: norm, phoneError: !isValidSaudiPhone(norm) }
        } else {
          // Fallback: put it in the field where the cursor was
          const f = fields[startFieldIdx] || 'storeUrl'
          newRows[targetRowIdx] = {
            ...newRows[targetRowIdx],
            [f]: f === 'phone' ? normalizePhone(v) : v,
            phoneError: f === 'phone' && v ? !isValidSaudiPhone(normalizePhone(v)) : newRows[targetRowIdx].phoneError,
          }
        }
      } else {
        // Multi-cell paste (from Excel) - distribute across fields
        cells.forEach((val, cellIdx) => {
          const fIdx = startFieldIdx + cellIdx
          if (fIdx < fields.length) {
            const f = fields[fIdx]
            let v = val.trim()
            if (f === 'phone' && v) {
              v = normalizePhone(v)
              newRows[targetRowIdx] = {
                ...newRows[targetRowIdx],
                [f]: v,
                phoneError: !isValidSaudiPhone(v),
              }
            } else {
              newRows[targetRowIdx] = { ...newRows[targetRowIdx], [f]: v }
            }
          }
        })
      }
      pasted++
    })

    setRows(newRows)
    setNextId((prev) => prev + Math.max(0, newRows.length - rows.length))
    persistDraft(newRows)
    if (pasted > 0) addToast('success', `✅ تم لصق ${pasted} صف`)
  }, [rows, nextId, persistDraft, addToast])

  // ===== Keyboard navigation =====
  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIdx: number, field: string) => {
    const fields = ['storeUrl', 'phone', 'notes']
    const fIdx = fields.indexOf(field)

    if (e.key === 'Enter') {
      e.preventDefault()
      if (rowIdx === rows.length - 1) {
        addRows(1)
        setTimeout(() => {
          const ref = inputRefs.current.get(`${rowIdx + 1}-${field}`)
          if (ref) ref.focus()
        }, 10)
      } else {
        const ref = inputRefs.current.get(`${rowIdx + 1}-${field}`)
        if (ref) ref.focus()
      }
    }

    if (e.key === 'Tab' && !e.shiftKey && fIdx === fields.length - 1 && rowIdx === rows.length - 1) {
      e.preventDefault()
      addRows(1)
      setTimeout(() => {
        const ref = inputRefs.current.get(`${rowIdx + 1}-storeUrl`)
        if (ref) ref.focus()
      }, 10)
    }
  }, [rows.length, addRows])

  // ===== Phone blur normalization =====
  const handlePhoneBlur = useCallback((id: number, value: string) => {
    if (!value) return
    const norm = normalizePhone(value)
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== id) return r
        return { ...r, phone: norm, phoneError: !isValidSaudiPhone(norm) }
      })
      persistDraft(updated)
      return updated
    })
  }, [persistDraft])

  // ===== Clear draft =====
  const handleClearDraft = useCallback(() => {
    const defaultRows = Array.from({ length: 8 }, (_, i) => createEmptyRow(i + nextId))
    setRows(defaultRows)
    setNextId((p) => p + 8)
    clearDraftStorage(currentRole, currentUser)
    setHasDraft(false)
    addToast('info', 'تم مسح المسودة')
  }, [currentRole, currentUser, nextId, addToast])

  // ===== Submit logic =====
  const doSave = useCallback(async (fresh: BulkRow[], dups: DuplicateEntry[]) => {
    // Merge fresh and dup rows in their ORIGINAL order (using BulkRow.id which reflects insertion order).
    // Previously: [...fresh, ...dups.map(d => d.row)] put all fresh first, then all dups — breaking user's order.
    const allToAdd = [...fresh, ...dups.map((d) => d.row)].sort((a, b) => a.id - b.id)
    const isSalesAdd = currentRole === 'sales'

    setSubmitting(true)
    try {
      const leadsArr: Partial<Lead>[] = allToAdd.map((r) => {
        if (isSalesAdd) {
          return {
            sales: selectedSheet || currentUser || '',
            tele: '',
            storeUrl: r.storeUrl || '',
            phone: r.phone ? normalizePhone(r.phone) : '',
            customerName: '',
            customerType: '',
            brief: r.notes || '',
            salesStatus: 'new',
            status: 'new',
            contactResult: '',
            meetingDate: '',
            meetingTime: '',
            meetingType: '',
            meetingLink: '',
            attended: null,
            isArchived: false,
          } as Partial<Lead>
        }
        return {
          tele: selectedSheet || currentUser || '',
          sales: null,
          storeUrl: r.storeUrl || '',
          phone: r.phone ? normalizePhone(r.phone) : '',
          customerName: '',
          customerType: '',
          brief: r.notes || '',
          status: 'new',
          contactResult: '',
          meetingDate: '',
          meetingTime: '',
          meetingType: '',
          meetingLink: '',
          attended: null,
          isArchived: false,
        } as Partial<Lead>
      })

      const created = await apiBulkCreateLeads(leadsArr)

      // Add ALL created leads to cache in a single batch update.
      // batchAddLeadsToCache skips duplicates internally (e.g., if real-time already added some).
      // This is faster and more reliable than calling addLeadToCache one by one.
      batchAddLeadsToCache(created)

      // SAFETY NET: Verify all created leads are now in the cache.
      // If any are missing (e.g., race condition with real-time subscription),
      // add them individually. This prevents the "8 out of 10" bug.
      if (created.length > 0) {
        const store = useCrmStore.getState()
        const missing = created.filter((l) => l.id != null && !(l.id in store.leadsById))
        if (missing.length > 0) {
          console.warn(`[bulk-add] ${missing.length} leads missing from cache after batchAdd, adding individually`)
          for (const lead of missing) {
            store.addLeadToCache(lead)
          }
        }
      }

      let msg = `✅ تم إضافة ${created.length} عميل`
      if (isSalesAdd) msg += ` في شيت ${selectedSheet || currentUser}`
      if (dups.length > 0) msg += ` (منهم ${dups.length} مكرر)`
      addToast('success', msg)

      // Reset rows and clear draft - ALWAYS do this on API success
      const defaultRows = Array.from({ length: 8 }, (_, i) => createEmptyRow(i + nextId))
      setRows(defaultRows)
      setNextId((p) => p + 8)
      clearDraftStorage(currentRole, currentUser)
      setHasDraft(false)
    } catch (err) {
      console.error('[bulk-add] Save error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      addToast('error', `فشل الإضافة: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }, [currentRole, selectedSheet, currentUser, nextId, batchAddLeadsToCache, addToast])

  const handleSubmit = useCallback(async () => {
    const isSalesAdd = currentRole === 'sales'

    // Validate sheet access
    if (!isSalesAdd && currentRole === 'tele') {
      const sel = selectedSheet.toLowerCase()
      const me = (currentUser || '').toLowerCase()
      if (sel !== me) {
        const allowed = teleAccessibleSheets.map((t) => t.toLowerCase())
        if (!allowed.includes(sel) && !allowed.includes('*')) {
          addToast('error', `مفيش صلاحية للإضافة في شيت ${selectedSheet}`)
          return
        }
      }
    }

    const validRows = rows.filter((r) => {
      const hasPhone = r.phone && r.phone.length >= 8
      const hasUrl = r.storeUrl && r.storeUrl.trim()
      return hasPhone || hasUrl
    })

    if (validRows.length === 0) {
      addToast('error', 'مفيش بيانات للحفظ - أضف رقم جوال أو لينك متجر على الأقل')
      return
    }

    // Check duplicates against existing leads
    // Use targeted server-side API for reliable cross-sheet detection (bypasses RLS)
    // Fall back to client-side `leads` array if API fails
    const phoneSet = new Map<string, string>()

    // Collect phones to check
    const phonesToCheck = validRows
      .map(r => r.phone ? normalizePhone(r.phone) : '')
      .filter(p => p)

    // Server-side check (fast, targeted - only checks specific phones)
    if (phonesToCheck.length > 0) {
      try {
        const serverDups = await apiCheckDuplicatePhones(phonesToCheck)
        for (const [norm, info] of Object.entries(serverDups)) {
          phoneSet.set(norm, info.existingOwner)
        }
      } catch {
        // Fallback to client-side data
      }
    }

    // Also add leads from client-side store (covers any that server missed)
    leads.forEach((l) => {
      if (l.phone) {
        const norm = normalizePhone(l.phone)
        if (!phoneSet.has(norm)) {
          phoneSet.set(norm, l.tele || l.sales || '—')
        }
      }
    })

    const fresh: BulkRow[] = []
    const dups: DuplicateEntry[] = []
    const batchPhones = new Map<string, string>() // Track phones within this batch

    validRows.forEach((r) => {
      const phone = r.phone ? normalizePhone(r.phone) : ''
      if (!phone) {
        fresh.push(r)
        return
      }
      // Check against existing leads in the database
      const existing = phoneSet.get(phone)
      if (existing) {
        dups.push({ row: r, normalizedPhone: phone, existingOwner: existing })
        return
      }
      // Check against other rows in the same batch
      const batchExisting = batchPhones.get(phone)
      if (batchExisting) {
        dups.push({ row: r, normalizedPhone: phone, existingOwner: 'داخل المجموعة نفسها' })
        return
      }
      // Not a duplicate — add to fresh and track in batch
      fresh.push(r)
      batchPhones.set(phone, '—')
    })

    if (dups.length > 0) {
      setFreshRows(fresh)
      setDuplicates(dups)
      setDupDialogOpen(true)
    } else {
      doSave(fresh, [])
    }
  }, [rows, leads, doSave, currentRole, selectedSheet, currentUser, teleAccessibleSheets, addToast])

  // Add all leads including duplicates
  const handleIncludeDuplicates = useCallback(() => {
    setDupDialogOpen(false)
    doSave(freshRows, duplicates)
  }, [freshRows, duplicates, doSave])

  // Add only fresh leads (exclude duplicates)
  const handleExcludeDuplicates = useCallback(() => {
    setDupDialogOpen(false)
    doSave(freshRows, [])
  }, [freshRows, doSave])

  // When dialog is dismissed without clicking a button, default to saving ALL data
  const handleDupDialogClose = useCallback((open: boolean) => {
    if (!open && dupDialogOpen) {
      // Dialog is being closed (X, outside click, Escape) — save all by default
      setDupDialogOpen(false)
      doSave(freshRows, duplicates)
    }
  }, [dupDialogOpen, freshRows, duplicates, doSave])

  // ===== Admin restriction (after all hooks) =====
  if (currentRole === 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" dir="rtl">
        <div className="text-6xl">🔒</div>
        <h2 className="text-xl font-bold text-muted-foreground">الأدمن يستخدم تاب الإدارة</h2>
        <p className="text-sm text-muted-foreground/60">ادخل على الإدارة &gt; كل الـ Leads لإدارة البيانات</p>
      </div>
    )
  }

  if (!currentUser) return null

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* ===== Bulk Toolbar ===== */}
      <div
        className="flex items-center gap-2 flex-wrap p-3 bg-card border border-border rounded-xl"
      >
        <label className="text-xs text-muted-foreground">إضافة لـ:</label>

        {currentRole === 'tele' ? (
          <>
            {teleAccessibleSheets.length === 1 ? (
              <span
                className="px-3 py-1.5 bg-venom/10 border border-venom/30 rounded-md text-venom text-[13px] font-medium inline-flex items-center gap-1.5"
              >
                👤 {currentUser} (شيتك)
              </span>
            ) : (
              <>
                <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger className="w-[170px] h-8 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teleAccessibleSheets.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === currentUser ? '👤 ' : '👁️ '}{t}{t === currentUser ? ' (شيتي)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-xs px-2 py-1 font-semibold">
                  <ShieldCheck className="w-3 h-3 inline ml-1" />
                  عندك صلاحية على {teleAccessibleSheets.length} شيت
                </Badge>
              </>
            )}
            <span className="text-xs text-muted-foreground">
              <Info className="w-3 h-3 inline ml-1" />
              البيانات هتنزل في الشيت المختار
            </span>
          </>
        ) : currentRole === 'sales' ? (
          <>
            {salesAccessibleSheets.length === 1 ? (
              <span
                className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-emerald-400 text-[13px] font-medium inline-flex items-center gap-1.5"
              >
                👤 {currentUser} (شيتك)
              </span>
            ) : (
              <>
                <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger className="w-[170px] h-8 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {salesAccessibleSheets.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === currentUser ? '👤 ' : '👁️ '}{s}{s === currentUser ? ' (شيتي)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-xs px-2 py-1 font-semibold">
                  <ShieldCheck className="w-3 h-3 inline ml-1" />
                  عندك صلاحية على {salesAccessibleSheets.length} شيت
                </Badge>
              </>
            )}
            <span className="text-xs text-muted-foreground">
              <Info className="w-3 h-3 inline ml-1" />
              البيانات هتنزل في شيت السيلز (مش هتتحول لتيلي)
            </span>
          </>
        ) : null}

        {/* Paste hint */}
        <span className="text-xs text-venom bg-venom/10 px-2 py-1 rounded-lg">
          💡 يمكنك لصق Excel/Sheets بـ Ctrl+V
        </span>

        {/* Status indicator */}
        <span className="mr-auto text-xs text-muted-foreground">
          {stats.valid > 0 && <span className="text-emerald-400 ml-1">{stats.valid} صحيح</span>}
          {stats.valid > 0 && stats.invalid > 0 && <span className="text-muted-foreground/30 ml-1"> · </span>}
          {stats.invalid > 0 && <span className="text-red-400 ml-1">{stats.invalid} رقم خطأ</span>}
          {(stats.valid > 0 || stats.invalid > 0) && stats.empty > 0 && <span className="text-muted-foreground/30 ml-1"> · </span>}
          {stats.empty > 0 && (stats.valid > 0 || stats.invalid > 0) && <span className="text-muted-foreground/40 ml-1">{stats.empty} فاضي</span>}
          {stats.valid === 0 && stats.invalid === 0 && 'جاهز للإضافة'}
        </span>

        {/* Save button */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || stats.valid === 0}
          className="bg-gradient-to-l from-venom to-emerald-500 text-[#050a08] font-semibold hover:shadow-lg hover:shadow-venom/20"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin ml-1" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <CloudUpload className="w-4 h-4 ml-1" />
              حفظ الكل
            </>
          )}
        </Button>
      </div>

      {/* ===== Entry Table ===== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Info banner */}
        <div className="bg-venom/5 border-b border-venom/20 px-4 py-2.5 text-xs text-venom flex items-center gap-2 flex-wrap">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <strong>تقدر تضيف:</strong>
          <span>لينك متجر فقط ✅</span>
          <span className="text-venom/30">·</span>
          <span>رقم جوال فقط ✅</span>
          <span className="text-venom/30">·</span>
          <span>الاتنين مع بعض ✅</span>
          <span className="text-venom/40 mr-2">— الـ paste الذكي بيكتشف لوحده هو لينك ولا رقم</span>
        </div>

        {/* Draft saved banner */}
        {hasDraft && (
          <div className="bg-amber-500/5 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-400 flex items-center justify-between gap-2 flex-wrap">
            <span>
              ☁️ <strong>مسودة محفوظة:</strong> البيانات هتفضل موجودة لحد ما تحفظها أو تمسحها
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
              onClick={handleClearDraft}
            >
              <Eraser className="w-3 h-3 ml-1" />
              مسح المسودة
            </Button>
          </div>
        )}

        {/* Scrollable table area for mobile */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header Row */}
            <div className={`grid ${GRID_COLS} bg-muted/30 border-b border-border`}>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground text-center">#</div>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">رابط المتجر</div>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">رقم الجوال</div>
              <div className="px-2 py-2.5 text-xs font-medium text-muted-foreground">ملاحظات (اختياري)</div>
              <div className="px-2 py-2.5" />
            </div>

            {/* Data Rows */}
            <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
              {rows.map((row, i) => (
                <div
                  key={row.id}
                  className={`grid ${GRID_COLS} border-b border-border/30 hover:bg-venom/[0.02] transition-colors`}
                >
                  {/* # */}
                  <div className="px-2 py-0 text-xs text-muted-foreground/50 flex items-center justify-center">
                    {i + 1}
                  </div>

                  {/* Store URL */}
                  <div className="px-0.5 py-0.5">
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(`${i}-storeUrl`, el)
                      }}
                      type="text"
                      value={row.storeUrl}
                      onChange={(e) => updateRow(row.id, 'storeUrl', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i, 'storeUrl')}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData('text')
                        if (text.includes('\t') || text.includes('\n')) {
                          e.preventDefault()
                          handlePaste(text, i, 'storeUrl')
                        }
                      }}
                      placeholder="https://..."
                      dir="ltr"
                      className="w-full px-2 py-2 text-xs bg-transparent border-0 outline-none focus:bg-venom/5 focus:ring-1 focus:ring-venom/30 rounded transition-colors placeholder:text-muted-foreground/30"
                    />
                  </div>

                  {/* Phone */}
                  <div className="px-0.5 py-0.5">
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(`${i}-phone`, el)
                      }}
                      type="text"
                      value={row.phone}
                      onChange={(e) => updateRow(row.id, 'phone', e.target.value)}
                      onBlur={() => handlePhoneBlur(row.id, row.phone)}
                      onKeyDown={(e) => handleKeyDown(e, i, 'phone')}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData('text')
                        if (text.includes('\t') || text.includes('\n')) {
                          e.preventDefault()
                          handlePaste(text, i, 'phone')
                        }
                      }}
                      placeholder="05XXXXXXXX"
                      dir="ltr"
                      className={`w-full px-2 py-2 text-xs bg-transparent border-0 outline-none focus:bg-venom/5 focus:ring-1 focus:ring-venom/30 rounded transition-colors placeholder:text-muted-foreground/30 font-mono ${
                        row.phoneError ? 'bg-red-500/10 ring-1 ring-red-500/40 focus:bg-red-500/15 focus:ring-red-500/50' : ''
                      }`}
                    />
                  </div>

                  {/* Notes */}
                  <div className="px-0.5 py-0.5">
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(`${i}-notes`, el)
                      }}
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateRow(row.id, 'notes', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i, 'notes')}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData('text')
                        if (text.includes('\t') || text.includes('\n')) {
                          e.preventDefault()
                          handlePaste(text, i, 'notes')
                        }
                      }}
                      placeholder=""
                      className="w-full px-2 py-2 text-xs bg-transparent border-0 outline-none focus:bg-venom/5 focus:ring-1 focus:ring-venom/30 rounded transition-colors placeholder:text-muted-foreground/30"
                    />
                  </div>

                  {/* Delete */}
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground/30 hover:text-red-400 transition-all cursor-pointer"
                      title="حذف الصف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-t border-border">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-border hover:border-venom/30 hover:text-venom"
              onClick={() => addRows(1)}
            >
              <Plus className="w-3 h-3 ml-1" />
              +1
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-border hover:border-venom/30 hover:text-venom"
              onClick={() => addRows(10)}
            >
              +10
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-border hover:border-venom/30 hover:text-venom"
              onClick={() => addRows(50)}
            >
              +50
            </Button>
          </div>
          <div className="text-xs text-muted-foreground/40">
            <kbd className="px-1.5 py-0.5 bg-muted/50 border border-border rounded text-xs">Tab</kbd>
            <span className="mx-1">للتنقل</span>
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 bg-muted/50 border border-border rounded text-xs">Enter</kbd>
            <span className="mx-1">صف جديد</span>
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 bg-muted/50 border border-border rounded text-xs">Ctrl+V</kbd>
            <span className="mx-1">لصق</span>
          </div>
        </div>
      </div>

      {/* ===== Duplicate Confirmation Dialog ===== */}
      <Dialog open={dupDialogOpen} onOpenChange={handleDupDialogClose}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              أرقام مكررة
            </DialogTitle>
            <DialogDescription className="text-right">
              لقيت {duplicates.length} رقم مكرر في قاعدة البيانات — عايز تعمل إيه؟
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-48 overflow-y-auto space-y-1.5 my-2">
            {duplicates.slice(0, 5).map((d, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                <span className="font-mono text-amber-400" dir="ltr">{d.normalizedPhone}</span>
                <span className="text-muted-foreground">(موجود عند {d.existingOwner || '—'})</span>
              </div>
            ))}
            {duplicates.length > 5 && (
              <p className="text-xs text-muted-foreground/60 text-center">
                ... و {duplicates.length - 5} رقم تاني
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={handleExcludeDuplicates}
            >
              <X className="w-4 h-4 ml-1" />
              تجاهل المكرر
            </Button>
            <Button
              className="flex-1 bg-venom text-[#050a08] hover:bg-venom/80"
              onClick={handleIncludeDuplicates}
            >
              <CheckCircle className="w-4 h-4 ml-1" />
              أضفهم كمان
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
