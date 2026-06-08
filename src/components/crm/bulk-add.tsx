'use client'

import { useState, useCallback, useMemo } from 'react'
import { useCrmStore, STATUSES, CONTACT_RESULTS } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiBulkCreateLeads } from '@/lib/supabase'
import { motion } from 'framer-motion'
import {
  Plus, Trash2, Upload, Loader2, AlertTriangle, Check, FileSpreadsheet,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */
interface BulkRow {
  id: string
  storeUrl: string
  phone: string
  customerName: string
  customerType: string
  brief: string
  tele: string
  sales: string
  status: string
  errors: string[]
}

/* ═══════════════════════════════════════════════════════
   Animation variants
   ═══════════════════════════════════════════════════════ */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

/* ═══════════════════════════════════════════════════════
   Bulk Add Component
   ═══════════════════════════════════════════════════════ */
export function BulkAdd() {
  const { team, currentUser, currentRole, addToast, batchAddLeadsToCache, leads } = useCrmStore()

  /* ─── State ─── */
  const [rows, setRows] = useState<BulkRow[]>([
    createEmptyRow(),
  ])
  const [submitting, setSubmitting] = useState(false)
  const [submittedCount, setSubmittedCount] = useState(0)

  /* ─── Create empty row ─── */
  function createEmptyRow(): BulkRow {
    return {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      storeUrl: '',
      phone: '',
      customerName: '',
      customerType: '',
      brief: '',
      tele: currentRole === 'tele' && currentUser ? currentUser : team.tele[0] || '',
      sales: currentRole === 'sales' && currentUser ? currentUser : '',
      status: 'new',
      errors: [],
    }
  }

  /* ─── Update a row field ─── */
  const updateRow = useCallback((rowId: string, field: keyof BulkRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const updated = { ...r, [field]: value }
        // Validate
        updated.errors = validateRow(updated)
        return updated
      })
    )
  }, [])

  /* ─── Validate row ─── */
  function validateRow(row: BulkRow): string[] {
    const errors: string[] = []
    if (!row.phone.trim()) {
      errors.push('الرقم مطلوب')
    } else if (row.phone.trim().length < 8) {
      errors.push('رقم قصير')
    }
    if (!row.customerName.trim()) {
      errors.push('الاسم مطلوب')
    }
    return errors
  }

  /* ─── Check for duplicate phones ─── */
  const duplicatePhones = useMemo(() => {
    const phoneMap: Record<string, number> = {}
    for (const row of rows) {
      const p = row.phone.trim()
      if (!p) continue
      phoneMap[p] = (phoneMap[p] || 0) + 1
    }

    const existingPhones = new Set(leads.map((l) => l.phone?.trim()).filter(Boolean))
    const duplicates: Set<string> = new Set()

    for (const [phone, count] of Object.entries(phoneMap)) {
      if (count > 1) duplicates.add(phone)
      if (existingPhones.has(phone)) duplicates.add(phone)
    }

    return duplicates
  }, [rows, leads])

  /* ─── Add new row ─── */
  const handleAddRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()])
  }, [])

  /* ─── Remove row ─── */
  const handleRemoveRow = useCallback((rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((r) => r.id !== rowId)
    })
  }, [])

  /* ─── Submit all ─── */
  const handleSubmit = useCallback(async () => {
    // Validate all rows
    const validatedRows = rows.map((r) => ({
      ...r,
      errors: validateRow(r),
    }))

    const hasErrors = validatedRows.some((r) => r.errors.length > 0)
    if (hasErrors) {
      setRows(validatedRows)
      addToast('warning', 'يوجد أخطاء في بعض الصفوف. تأكد من البيانات.')
      return
    }

    const validRows = validatedRows.filter((r) => r.phone.trim() && r.customerName.trim())
    if (validRows.length === 0) {
      addToast('warning', 'لا يوجد بيانات للإضافة')
      return
    }

    setSubmitting(true)
    try {
      const leadsToCreate: Partial<Lead>[] = validRows.map((r) => ({
        storeUrl: r.storeUrl,
        phone: r.phone,
        customerName: r.customerName,
        customerType: r.customerType,
        brief: r.brief,
        tele: r.tele,
        sales: r.sales || null,
        status: r.status || 'new',
        contactResult: '',
      }))

      const created = await apiBulkCreateLeads(leadsToCreate)
      if (Array.isArray(created) && created.length > 0) {
        batchAddLeadsToCache(created)
      }

      setSubmittedCount(validRows.length)
      addToast('success', `تم إضافة ${validRows.length} عميل بنجاح 🎉`)
      setRows([createEmptyRow()])
    } catch (err: unknown) {
      addToast('error', `فشل في إضافة العملاء: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`)
    } finally {
      setSubmitting(false)
    }
  }, [rows, addToast, batchAddLeadsToCache])

  /* ─── Valid rows count ─── */
  const validCount = useMemo(
    () => rows.filter((r) => r.phone.trim() && r.customerName.trim()).length,
    [rows]
  )

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            إضافة مجموعة عملاء
          </h2>
          <p className="text-[15px] font-semibold text-[#8892b0] mt-0.5">إضافة عدة عملاء دفعة واحدة</p>
        </div>
        <div className="flex items-center gap-2">
          {submittedCount > 0 && (
            <Badge className="bg-[#00d4aa]/15 text-[#00d4aa] text-[14px] font-bold border-0 gap-1">
              <Check size={10} />
              {submittedCount} تم إضافتها
            </Badge>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting || validCount === 0}
            className="bg-[#6c63ff] hover:bg-[#5b54e6] text-white gap-1.5 text-[14px] h-9 cursor-pointer disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {submitting ? 'جاري الإضافة...' : `إضافة الكل (${validCount})`}
          </Button>
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicatePhones.size > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[16px] font-bold text-amber-400">أرقام مكررة</div>
              <div className="text-[14px] font-medium text-amber-400/80 mt-0.5">
                الأرقام التالية مكررة: {Array.from(duplicatePhones).join('، ')}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Table */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280] w-[40px]">#</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">رابط المتجر</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">رقم التليفون *</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">اسم العميل *</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">نوع العميل</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">نبذة</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">التيلي</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">السيلز</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280]">الحالة</TableHead>
                  <TableHead className="text-right text-[15px] font-bold text-[#4a5280] w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.id} className={`border-b border-white/[0.04] ${
                    row.errors.length > 0 ? 'bg-red-500/5' : duplicatePhones.has(row.phone.trim()) ? 'bg-amber-500/5' : 'hover:bg-[#1c2234]/30'
                  }`}>
                    <TableCell className="w-[40px] text-[14px] text-[#4a5280]">{idx + 1}</TableCell>
                    <TableCell>
                      <Input
                        placeholder="رابط المتجر"
                        value={row.storeUrl}
                        onChange={(e) => updateRow(row.id, 'storeUrl', e.target.value)}
                        className="h-7 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[130px]"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          placeholder="رقم التليفون"
                          value={row.phone}
                          onChange={(e) => updateRow(row.id, 'phone', e.target.value)}
                          className={`h-7 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[130px] ${
                            duplicatePhones.has(row.phone.trim()) ? 'border-amber-500/40' : ''
                          }`}
                        />
                        {duplicatePhones.has(row.phone.trim()) && (
                          <AlertTriangle size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-amber-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="اسم العميل"
                        value={row.customerName}
                        onChange={(e) => updateRow(row.id, 'customerName', e.target.value)}
                        className="h-7 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[130px]"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={row.customerType || 'business'} onValueChange={(v) => updateRow(row.id, 'customerType', v)}>
                        <SelectTrigger className="h-7 text-[15px] w-[100px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111520] border-white/[0.08]">
                          <SelectItem value="business" className="text-[15px]">تجاري</SelectItem>
                          <SelectItem value="individual" className="text-[15px]">فرد</SelectItem>
                          <SelectItem value="enterprise" className="text-[15px]">مؤسسة</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="نبذة"
                        value={row.brief}
                        onChange={(e) => updateRow(row.id, 'brief', e.target.value)}
                        className="h-7 text-[15px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[100px]"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={row.tele} onValueChange={(v) => updateRow(row.id, 'tele', v)}>
                        <SelectTrigger className="h-7 text-[15px] w-[90px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111520] border-white/[0.08]">
                          {team.tele.map((n) => (
                            <SelectItem key={n} value={n} className="text-[15px]">{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={row.sales || 'none'} onValueChange={(v) => updateRow(row.id, 'sales', v === 'none' ? '' : v)}>
                        <SelectTrigger className="h-7 text-[15px] w-[90px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111520] border-white/[0.08]">
                          <SelectItem value="none" className="text-[15px]">—</SelectItem>
                          {team.sales.map((n) => (
                            <SelectItem key={n} value={n} className="text-[15px]">{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={row.status} onValueChange={(v) => updateRow(row.id, 'status', v)}>
                        <SelectTrigger className="h-7 text-[15px] w-[90px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111520] border-white/[0.08]">
                          {STATUSES.slice(0, 5).map((s) => (
                            <SelectItem key={s.key} value={s.key} className="text-[15px]">{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={rows.length <= 1}
                        className="w-7 h-7 rounded-md bg-red-500/10 text-red-400/60 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={12} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.06] px-4 py-3 flex items-center justify-between">
            <span className="text-[14px] font-medium text-[#4a5280]">
              {rows.length} صف · {validCount} صالح للإضافة
            </span>
            <Button
              onClick={handleAddRow}
              size="sm"
              className="h-7 text-[15px] font-bold bg-[#1c2234] text-[#8892b0] hover:text-[#f0f2ff] border-white/[0.06] gap-1 cursor-pointer"
            >
              <Plus size={12} />
              إضافة صف
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
