'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useCrmStore, STATUSES, CONTACT_RESULTS } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiBulkCreateLeads } from '@/lib/supabase'
import {
  Plus, Trash2, Upload, Loader2, AlertTriangle, Check, FileSpreadsheet, ClipboardPaste,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
   Helpers for parsing pasted data
   ═══════════════════════════════════════════════════════ */
function looksLikePhone(s: string): boolean {
  return /^(\+966|966|05|5)\d/.test(s) || /^\d{8,}$/.test(s)
}

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s) || /\.(com|sa|net|org|io|store|shop)/i.test(s)
}

function parsePastedLine(line: string): { phone: string; storeUrl: string } {
  const trimmed = line.trim()
  if (!trimmed) return { phone: '', storeUrl: '' }

  // Try splitting by common separators (tab, comma, multiple spaces)
  const parts = trimmed.split(/[\t,]+/).map((p) => p.trim()).filter(Boolean)

  if (parts.length >= 2) {
    // Check each part
    const phonePart = parts.find((p) => looksLikePhone(p))
    const urlPart = parts.find((p) => looksLikeUrl(p))
    if (phonePart && urlPart) {
      return { phone: phonePart, storeUrl: urlPart }
    }
    if (phonePart) {
      // First phone, rest might be URL or name
      const nonPhoneParts = parts.filter((p) => p !== phonePart)
      const maybeUrl = nonPhoneParts.find((p) => looksLikeUrl(p))
      return { phone: phonePart, storeUrl: maybeUrl || '' }
    }
    if (urlPart) {
      const nonUrlParts = parts.filter((p) => p !== urlPart)
      const maybePhone = nonUrlParts.find((p) => looksLikePhone(p))
      return { phone: maybePhone || '', storeUrl: urlPart }
    }
    // Neither looks like phone or URL — try first as phone, second as URL
    return { phone: parts[0], storeUrl: parts.length > 1 ? parts[1] : '' }
  }

  // Single value
  if (looksLikePhone(trimmed)) {
    return { phone: trimmed, storeUrl: '' }
  }
  if (looksLikeUrl(trimmed)) {
    return { phone: '', storeUrl: trimmed }
  }

  // Default: treat as phone
  return { phone: trimmed, storeUrl: '' }
}

/* ═══════════════════════════════════════════════════════
   Bulk Add Component
   ═══════════════════════════════════════════════════════ */
export function BulkAdd() {
  const { team, currentUser, currentRole, addToast, batchAddLeadsToCache, leads } = useCrmStore()

  const isTele = currentRole === 'tele'

  /* ─── State ─── */
  const [rows, setRows] = useState<BulkRow[]>([
    createEmptyRow(),
  ])
  const [submitting, setSubmitting] = useState(false)
  const [submittedCount, setSubmittedCount] = useState(0)
  const [pastedData, setPastedData] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ─── Create empty row ─── */
  function createEmptyRow(): BulkRow {
    return {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      storeUrl: '',
      phone: '',
      customerName: '',
      customerType: isTele ? '' : 'business',
      brief: '',
      tele: currentUser || team.tele[0] || '',
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
    const hasPhone = row.phone.trim().length >= 8
    const hasUrl = row.storeUrl.trim().length > 0

    if (!hasPhone && !hasUrl) {
      errors.push('رقم الجوال أو رابط المتجر مطلوب')
    }
    if (hasPhone && row.phone.trim().length < 8 && row.phone.trim().length > 0) {
      errors.push('رقم قصير')
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
  }, [currentUser, currentRole])

  /* ─── Remove row ─── */
  const handleRemoveRow = useCallback((rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((r) => r.id !== rowId)
    })
  }, [])

  /* ─── Handle paste bulk add ─── */
  const handlePasteAdd = useCallback(() => {
    const lines = pastedData.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      addToast('warning', 'لا يوجد بيانات للصقها')
      return
    }

    const newRows: BulkRow[] = lines.map((line) => {
      const parsed = parsePastedLine(line)
      return {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        storeUrl: parsed.storeUrl,
        phone: parsed.phone,
        customerName: '',
        customerType: isTele ? '' : 'business',
        brief: '',
        tele: currentUser || team.tele[0] || '',
        sales: currentRole === 'sales' && currentUser ? currentUser : '',
        status: 'new',
        errors: [],
      }
    })

    setRows((prev) => [...prev, ...newRows])
    setPastedData('')
    addToast('success', `تم إضافة ${newRows.length} صف من اللصق`)
  }, [pastedData, addToast, isTele, currentUser, currentRole, team])

  /* ─── Handle Excel/CSV file import ─── */
  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileName = file.name.toLowerCase()
      let parsedRows: Array<{ phone: string; storeUrl: string; customerName: string }> = []

      if (fileName.endsWith('.csv')) {
        // Parse CSV with basic JS
        const text = await file.text()
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length === 0) {
          addToast('warning', 'الملف فارغ')
          return
        }

        // Try to detect header row
        const firstLine = lines[0].toLowerCase()
        let startIndex = 0
        if (firstLine.includes('phone') || firstLine.includes('رقم') || firstLine.includes('جوال') || firstLine.includes('url') || firstLine.includes('لينك') || firstLine.includes('متجر') || firstLine.includes('name') || firstLine.includes('اسم')) {
          startIndex = 1 // Skip header row
        }

        for (let i = startIndex; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''))
          const row: { phone: string; storeUrl: string; customerName: string } = { phone: '', storeUrl: '', customerName: '' }

          for (const col of cols) {
            if (!col) continue
            if (looksLikePhone(col) && !row.phone) {
              row.phone = col
            } else if (looksLikeUrl(col) && !row.storeUrl) {
              row.storeUrl = col
            } else if (!row.customerName) {
              row.customerName = col
            }
          }
          if (row.phone || row.storeUrl) {
            parsedRows.push(row)
          }
        }
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel with xlsx package
        const XLSX = await import('xlsx')
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        if (jsonData.length === 0) {
          addToast('warning', 'الملف فارغ')
          return
        }

        // Try to detect header row
        const firstRow = jsonData[0].map((c) => String(c).toLowerCase())
        let startIndex = 0
        if (firstRow.some((c) => c.includes('phone') || c.includes('رقم') || c.includes('جوال') || c.includes('url') || c.includes('لينك') || c.includes('متجر') || c.includes('name') || c.includes('اسم'))) {
          startIndex = 1
        }

        for (let i = startIndex; i < jsonData.length; i++) {
          const cols = jsonData[i].map((c) => String(c).trim())
          const row: { phone: string; storeUrl: string; customerName: string } = { phone: '', storeUrl: '', customerName: '' }

          for (const col of cols) {
            if (!col || col === 'undefined') continue
            if (looksLikePhone(col) && !row.phone) {
              row.phone = col
            } else if (looksLikeUrl(col) && !row.storeUrl) {
              row.storeUrl = col
            } else if (!row.customerName && !looksLikePhone(col) && !looksLikeUrl(col)) {
              row.customerName = col
            }
          }
          if (row.phone || row.storeUrl) {
            parsedRows.push(row)
          }
        }
      } else {
        addToast('warning', 'صيغة الملف غير مدعومة. استخدم xlsx أو csv')
        return
      }

      if (parsedRows.length === 0) {
        addToast('warning', 'لم يتم العثور على بيانات صالحة في الملف')
        return
      }

      const newRows: BulkRow[] = parsedRows.map((r) => ({
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        storeUrl: r.storeUrl,
        phone: r.phone,
        customerName: r.customerName,
        customerType: isTele ? '' : 'business',
        brief: '',
        tele: currentUser || team.tele[0] || '',
        sales: currentRole === 'sales' && currentUser ? currentUser : '',
        status: 'new',
        errors: [],
      }))

      setRows((prev) => [...prev, ...newRows])
      addToast('success', `تم استيراد ${newRows.length} صف من الملف`)
    } catch (err: unknown) {
      addToast('error', `فشل في استيراد الملف: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`)
    } finally {
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [addToast, isTele, currentUser, currentRole, team])

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

    const validRows = validatedRows.filter((r) => r.phone.trim() || r.storeUrl.trim())
    if (validRows.length === 0) {
      addToast('warning', 'لا يوجد بيانات للإضافة')
      return
    }

    setSubmitting(true)
    try {
      const leadsToCreate: Partial<Lead>[] = validRows.map((r) => ({
        storeUrl: r.storeUrl || undefined,
        phone: r.phone || undefined,
        customerName: r.customerName || (r.phone ? `عميل ${r.phone}` : r.storeUrl ? `متجر ${r.storeUrl.replace(/^https?:\/\//, '').split('/')[0]}` : 'عميل جديد'),
        customerType: r.customerType,
        brief: r.brief,
        tele: isTele ? currentUser! : r.tele,
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
  }, [rows, addToast, batchAddLeadsToCache, isTele, currentUser])

  /* ─── Valid rows count ─── */
  const validCount = useMemo(
    () => rows.filter((r) => r.phone.trim() || r.storeUrl.trim()).length,
    [rows]
  )

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-extrabold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            إضافة ليدز
          </h2>
          <p className="text-[13px] font-semibold text-[#8892b0] mt-0.5">
            {isTele ? 'أضف أرقام عملاء أو لينكات متاجر وهتنزل في شيتك مباشرة' : 'إضافة عدة عملاء دفعة واحدة'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {submittedCount > 0 && (
            <Badge className="bg-[#00d4aa]/15 text-[#00d4aa] text-[12px] font-bold border-0 gap-1">
              <Check size={10} />
              {submittedCount} تم إضافتها
            </Badge>
          )}
          {/* Excel import button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileImport}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#1c2234] hover:bg-[#252d42] text-[#8892b0] hover:text-[#f0f2ff] gap-1.5 text-[12px] h-9 border border-white/[0.06] cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            استيراد من إكسيل
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || validCount === 0}
            className="bg-[#6c63ff] hover:bg-[#5b54e6] text-white gap-1.5 text-[12px] h-9 cursor-pointer disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {submitting ? 'جاري الإضافة...' : `إضافة الكل (${validCount})`}
          </Button>
        </div>
      </div>

      {/* Paste bulk data section */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-[#f0f2ff] flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <ClipboardPaste size={16} className="text-[#6c63ff]" />
                  لصق بيانات مجمعة
                </div>
                <p className="text-[12px] font-medium text-[#8892b0] mt-0.5">
                  الصق أرقام الجوال أو لينكات المتاجر أو كليهما - كل سطر بيانات منفصل
                </p>
              </div>
              <Button
                onClick={handlePasteAdd}
                disabled={!pastedData.trim()}
                className="bg-[#6c63ff] hover:bg-[#5b54e6] text-white gap-1.5 text-[12px] h-8 cursor-pointer disabled:opacity-50"
              >
                <Plus size={14} />
                إضافة
              </Button>
            </div>
            <textarea
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              placeholder={"0512345678\nhttps://store.example.com\n0512345678, https://store.example.com"}
              className="w-full h-24 text-[13px] bg-[#0a0d14] border border-white/[0.08] rounded-lg px-3 py-2 text-[#f0f2ff] placeholder:text-[#4a5280] resize-none focus:outline-none focus:border-[#6c63ff]/40"
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      {/* Duplicate warning */}
      {duplicatePhones.size > 0 && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 transition-all duration-300">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-[14px] font-bold text-amber-400">أرقام مكررة</div>
            <div className="text-[12px] font-medium text-amber-400/80 mt-0.5">
              الأرقام التالية مكررة: {Array.from(duplicatePhones).join('، ')}
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[40px]">#</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">رابط المتجر</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">رقم الجوال</TableHead>
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">اسم العميل</TableHead>
                  {!isTele && (
                    <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">نوع العميل</TableHead>
                  )}
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">نبذة</TableHead>
                  {!isTele && (
                    <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">التيلي</TableHead>
                  )}
                  {!isTele && (
                    <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">السيلز</TableHead>
                  )}
                  {!isTele && (
                    <TableHead className="text-right text-[13px] font-bold text-[#4a5280]">الحالة</TableHead>
                  )}
                  <TableHead className="text-right text-[13px] font-bold text-[#4a5280] w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.id} className={`border-b border-white/[0.04] transition-colors duration-200 ${
                    row.errors.length > 0 ? 'bg-red-500/5' : duplicatePhones.has(row.phone.trim()) ? 'bg-amber-500/5' : 'hover:bg-[#1c2234]/30'
                  }`}>
                    <TableCell className="w-[40px] text-[12px] text-[#4a5280]">{idx + 1}</TableCell>
                    <TableCell>
                      <Input
                        placeholder="رابط المتجر"
                        value={row.storeUrl}
                        onChange={(e) => updateRow(row.id, 'storeUrl', e.target.value)}
                        className="h-7 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[130px]"
                        dir="ltr"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          placeholder="رقم الجوال"
                          value={row.phone}
                          onChange={(e) => updateRow(row.id, 'phone', e.target.value)}
                          className={`h-7 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[130px] ${
                            duplicatePhones.has(row.phone.trim()) ? 'border-amber-500/40' : ''
                          } ${row.errors.includes('رقم قصير') ? 'border-red-500/40' : ''}`}
                          dir="ltr"
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
                        className="h-7 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[130px]"
                      />
                    </TableCell>
                    {!isTele && (
                      <TableCell>
                        <Select value={row.customerType || 'business'} onValueChange={(v) => updateRow(row.id, 'customerType', v)}>
                          <SelectTrigger className="h-7 text-[13px] w-[100px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#111520] border-white/[0.08]">
                            <SelectItem value="business" className="text-[13px]">تجاري</SelectItem>
                            <SelectItem value="individual" className="text-[13px]">فرد</SelectItem>
                            <SelectItem value="enterprise" className="text-[13px]">مؤسسة</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    <TableCell>
                      <Input
                        placeholder="نبذة"
                        value={row.brief}
                        onChange={(e) => updateRow(row.id, 'brief', e.target.value)}
                        className="h-7 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[100px]"
                      />
                    </TableCell>
                    {!isTele && (
                      <TableCell>
                        <Select value={row.tele} onValueChange={(v) => updateRow(row.id, 'tele', v)}>
                          <SelectTrigger className="h-7 text-[13px] w-[90px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#111520] border-white/[0.08]">
                            {team.tele.map((n) => (
                              <SelectItem key={n} value={n} className="text-[13px]">{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    {!isTele && (
                      <TableCell>
                        <Select value={row.sales || 'none'} onValueChange={(v) => updateRow(row.id, 'sales', v === 'none' ? '' : v)}>
                          <SelectTrigger className="h-7 text-[13px] w-[90px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#111520] border-white/[0.08]">
                            <SelectItem value="none" className="text-[13px]">—</SelectItem>
                            {team.sales.map((n) => (
                              <SelectItem key={n} value={n} className="text-[13px]">{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    {!isTele && (
                      <TableCell>
                        <Select value={row.status} onValueChange={(v) => updateRow(row.id, 'status', v)}>
                          <SelectTrigger className="h-7 text-[13px] w-[90px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#111520] border-white/[0.08]">
                            {STATUSES.slice(0, 5).map((s) => (
                              <SelectItem key={s.key} value={s.key} className="text-[13px]">{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
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
            <span className="text-[12px] font-medium text-[#4a5280]">
              {rows.length} صف · {validCount} صالح للإضافة
              {isTele && currentUser && <span className="text-[#6c63ff] mr-2">→ شيت: {currentUser}</span>}
            </span>
            <Button
              onClick={handleAddRow}
              size="sm"
              className="h-7 text-[13px] font-bold bg-[#1c2234] text-[#8892b0] hover:text-[#f0f2ff] border-white/[0.06] gap-1 cursor-pointer"
            >
              <Plus size={12} />
              إضافة صف
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
