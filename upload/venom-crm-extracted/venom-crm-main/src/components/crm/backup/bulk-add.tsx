'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  UserPlus,
} from 'lucide-react'
import {
  useCrmStore,
  CONTACT_RESULTS,
  SALES_STATUSES,
  ATTENDANCE_STATUSES,
  normalizePhone,
  isValidSaudiPhone,
} from '@/lib/store'
import { apiBulkCreateLeads } from '@/lib/supabase'
import type { Lead } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

// ===== Row type =====
interface BulkRow {
  id: number
  customerName: string
  phone: string
  storeUrl: string
  notes: string
  errors: { field: string; message: string }[]
}

function createEmptyRow(id: number): BulkRow {
  return { id, customerName: '', phone: '', storeUrl: '', notes: '', errors: [] }
}

// ===== Main Component =====
export function BulkAdd() {
  const { currentUser, addLeadToCache } = useCrmStore()
  const [rows, setRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 5 }, (_, i) => createEmptyRow(i))
  )
  const [submitting, setSubmitting] = useState(false)
  const [nextId, setNextId] = useState(5)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')

  // Add row
  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow(nextId)])
    setNextId((prev) => prev + 1)
  }

  // Remove row
  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  // Update row field
  const updateRow = (id: number, field: keyof BulkRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: value }
        // Clear errors for this field
        updated.errors = updated.errors.filter((e) => e.field !== field)
        return updated
      })
    )
  }

  // Validate
  const validate = useCallback((): BulkRow[] => {
    const validated = rows.map((row) => {
      const errors: { field: string; message: string }[] = []

      if (!row.customerName.trim()) {
        errors.push({ field: 'customerName', message: 'الاسم مطلوب' })
      }

      if (!row.phone.trim()) {
        errors.push({ field: 'phone', message: 'الموبايل مطلوب' })
      } else {
        const normalized = normalizePhone(row.phone)
        if (!isValidSaudiPhone(normalized)) {
          errors.push({ field: 'phone', message: 'رقم موبايل غير صحيح' })
        }
      }

      return { ...row, errors }
    })

    setRows(validated)
    return validated
  }, [rows])

  // Submit
  const handleSubmit = useCallback(async () => {
    const validated = validate()
    const hasErrors = validated.some((r) => r.errors.length > 0)
    if (hasErrors) {
      toast.error('يرجى تصحيح الأخطاء قبل الإرسال')
      return
    }

    const validRows = validated.filter((r) => r.customerName.trim() || r.phone.trim())
    if (validRows.length === 0) {
      toast.error('لا توجد بيانات للإرسال')
      return
    }

    setSubmitting(true)
    try {
      const leadsArr: Partial<Lead>[] = validRows.map((row) => ({
        customerName: row.customerName.trim(),
        phone: normalizePhone(row.phone.trim()),
        storeUrl: row.storeUrl.trim(),
        brief: row.notes.trim(),
        tele: currentUser || '',
        status: 'new',
        contactResult: '',
        meetingDate: '',
        meetingTime: '',
        meetingType: '',
        meetingLink: '',
        attended: null,
        isArchived: false,
      }))

      const created = await apiBulkCreateLeads(leadsArr)

      // Add to cache
      const store = useCrmStore.getState()
      created.forEach((lead) => store.addLeadToCache(lead))

      toast.success(`تم إضافة ${created.length} عميل بنجاح 🎉`)

      // Reset form
      setRows(Array.from({ length: 5 }, (_, i) => createEmptyRow(i + nextId)))
      setNextId((prev) => prev + 5)
    } catch {
      toast.error('فشل في إضافة العملاء')
    } finally {
      setSubmitting(false)
    }
  }, [validate, currentUser, nextId, addLeadToCache])

  // Parse paste
  const handlePasteParse = () => {
    const lines = pasteText.trim().split('\n').filter((l) => l.trim())
    const parsed: BulkRow[] = []

    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 1) continue

      parsed.push({
        id: nextId + parsed.length,
        customerName: (parts[0] || '').trim(),
        phone: (parts[1] || '').trim(),
        storeUrl: (parts[2] || '').trim(),
        notes: (parts[3] || '').trim(),
        errors: [],
      })
    }

    if (parsed.length > 0) {
      setRows(parsed)
      setNextId((prev) => prev + parsed.length)
      setPasteMode(false)
      setPasteText('')
      toast.success(`تم استيراد ${parsed.length} صف`)
    } else {
      toast.error('لم يتم العثور على بيانات صالحة')
    }
  }

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
          <h1 className="text-2xl font-bold venom-text-glow text-venom">إضافة بيانات</h1>
          <p className="text-muted-foreground mt-1">إضافة عملاء جديد بالجملة</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-venom/30 text-venom hover:bg-venom/10"
            onClick={() => setPasteMode(!pasteMode)}
          >
            <FileSpreadsheet className="w-4 h-4 ml-2" />
            لصق من إكسل
          </Button>
          <Button
            onClick={addRow}
            variant="outline"
            className="border-venom/30 text-venom hover:bg-venom/10"
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة صف
          </Button>
        </div>
      </motion.div>

      {/* Paste from Excel */}
      {pasteMode && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Card className="bg-card border border-venom/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-venom" />
                لصق من إكسل
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                انسخ من إكسل والصق هنا - كل صف: الاسم (Tab) الموبايل (Tab) المتجر (Tab) ملاحظات
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="الصق البيانات هنا..."
                className="bg-background border-border min-h-[150px] font-mono text-sm"
                dir="ltr"
              />
              <div className="flex gap-2">
                <Button onClick={handlePasteParse} className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30">
                  <Upload className="w-4 h-4 ml-2" />
                  استيراد
                </Button>
                <Button variant="outline" onClick={() => setPasteMode(false)}>
                  إلغاء
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Rows count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserPlus className="w-4 h-4 text-venom" />
        <span>عدد الصفوف: <span className="text-venom font-bold">{rows.length}</span></span>
      </div>

      {/* Data Entry Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="bg-card border border-border overflow-hidden">
          <ScrollArea className="max-h-[calc(100vh-320px)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground w-10">#</th>
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground min-w-[160px]">اسم العميل</th>
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground min-w-[140px]">الموبايل</th>
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground min-w-[140px]">المتجر</th>
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground min-w-[160px]">ملاحظات</th>
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground w-16">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                      className="border-b border-border/50"
                    >
                      <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.customerName}
                          onChange={(e) => updateRow(row.id, 'customerName', e.target.value)}
                          placeholder="اسم العميل"
                          className={`h-8 text-xs bg-background ${
                            row.errors.some((e) => e.field === 'customerName')
                              ? 'border-red-500/50 focus:border-red-500'
                              : 'border-border focus:border-venom/50'
                          }`}
                        />
                        {row.errors
                          .filter((e) => e.field === 'customerName')
                          .map((e, idx) => (
                            <p key={idx} className="text-[10px] text-red-400 mt-0.5">{e.message}</p>
                          ))}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.phone}
                          onChange={(e) => updateRow(row.id, 'phone', e.target.value)}
                          placeholder="05XXXXXXXX"
                          dir="ltr"
                          className={`h-8 text-xs bg-background font-mono ${
                            row.errors.some((e) => e.field === 'phone')
                              ? 'border-red-500/50 focus:border-red-500'
                              : 'border-border focus:border-venom/50'
                          }`}
                        />
                        {row.errors
                          .filter((e) => e.field === 'phone')
                          .map((e, idx) => (
                            <p key={idx} className="text-[10px] text-red-400 mt-0.5">{e.message}</p>
                          ))}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.storeUrl}
                          onChange={(e) => updateRow(row.id, 'storeUrl', e.target.value)}
                          placeholder="رابط المتجر"
                          className="h-8 text-xs bg-background border-border focus:border-venom/50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.notes}
                          onChange={(e) => updateRow(row.id, 'notes', e.target.value)}
                          placeholder="ملاحظات"
                          className="h-8 text-xs bg-background border-border focus:border-venom/50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length <= 1}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </Card>
      </motion.div>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="flex justify-end"
      >
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-gradient-to-l from-venom to-venom-dark text-[#050a08] font-semibold px-8 h-11 hover:shadow-lg hover:shadow-venom/20"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
              جاري الإرسال...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 ml-2" />
              إرسال الكل ({rows.length})
            </>
          )}
        </Button>
      </motion.div>
    </div>
  )
}
