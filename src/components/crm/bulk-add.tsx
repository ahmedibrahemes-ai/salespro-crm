'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useCrmStore, STATUSES, CONTACT_RESULTS } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiBulkCreateLeads } from '@/lib/supabase'
import {
  Plus, Trash2, Upload, Loader2, AlertTriangle, Check, FileSpreadsheet, ClipboardPaste,
  Link, Copy, Code2, RefreshCw, ExternalLink, X,
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

interface SyncInfo {
  webhookPath: string
  secretConfigured: boolean
  recentSyncs: Array<{
    id: string
    timestamp: number
    received: number
    created: number
    skipped: number
    errorCount: number
  }>
  lastSync: {
    timestamp: number
    received: number
    created: number
    skipped: number
  } | null
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
   Google Apps Script Template
   ═══════════════════════════════════════════════════════ */
function generateAppsScriptCode(webhookUrl: string, secret: string): string {
  const secretLine = secret ? `  var SECRET = "${secret}";` : '  var SECRET = ""; // Leave empty if no secret is configured'
  return `// ═══════════════════════════════════════════════════
// SalesPro CRM - Google Sheets Auto-Sync
// ═══════════════════════════════════════════════════
//
// تعليمات الإعداد:
// 1. افتح Google Sheet الخاص بك
// 2. اذهب إلى Extensions > Apps Script
// 3. الصق هذا الكود بالكامل
// 4. عدّل SHEET_NAME واسماء الأعمدة حسب شيتك
// 5. اضغط Save ثم Run > syncToCRM
// 6. عند اول تشغيل ستطلب صلاحيات - وافق عليها
// 7. لتفعيل المزامنة التلقائية: اضغط على أيقونة الترigger
//    في الشريط الجانبي وأضف trigger جديد:
//    - Event: From spreadsheet > On edit
//    أو استخدم installTrigger() من Run

var WEBHOOK_URL = "${webhookUrl}";
${secretLine}

// اسم الشيت (التاب) - غيّره حسب اسم الشيت عندك
var SHEET_NAME = "Sheet1";

// أرقام الأعمدة (تبدأ من 1) - غيّرها حسب ترتيب الأعمدة عندك
var COL_PHONE = 1;         // عمود رقم الجوال
var COL_STORE_URL = 2;     // عمود رابط المتجر
var COL_CUSTOMER_NAME = 3; // عمود اسم العميل
var COL_EMPLOYEE_NAME = 4; // عمود اسم الموظف

/**
 * مزامنة البيانات إلى CRM
 * يرسل جميع الصفوف التي تحتوي بيانات
 */
function syncToCRM() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("Sheet not found: " + SHEET_NAME);
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No data rows found");
    return;
  }

  var data = sheet.getRange(2, 1, lastRow - 1, Math.max(COL_PHONE, COL_STORE_URL, COL_CUSTOMER_NAME, COL_EMPLOYEE_NAME)).getValues();
  var payload = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var phone = String(row[COL_PHONE - 1] || "").trim();
    var storeUrl = String(row[COL_STORE_URL - 1] || "").trim();
    var customerName = String(row[COL_CUSTOMER_NAME - 1] || "").trim();
    var employeeName = String(row[COL_EMPLOYEE_NAME - 1] || "").trim();

    // تخطي الصفوف الفارغة
    if (!phone && !storeUrl) continue;

    payload.push({
      phone: phone,
      storeUrl: storeUrl,
      customerName: customerName,
      employeeName: employeeName
    });
  }

  if (payload.length === 0) {
    Logger.log("No valid data to sync");
    return;
  }

  var body = {
    data: payload
  };

  if (SECRET) {
    body.secret = SECRET;
  }

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    var result = JSON.parse(response.getContentText());
    Logger.log("Sync result: " + JSON.stringify(result));

    if (result.success) {
      Logger.log("Created: " + result.created + ", Skipped: " + result.skipped);
    } else {
      Logger.log("Sync error: " + (result.error || "Unknown error"));
    }
  } catch (e) {
    Logger.log("Request failed: " + e.message);
  }
}

/**
 * يتم تشغيله تلقائياً عند تعديل أي خلية
 * يزامن فقط الصف المعدّل
 */
function onEdit(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  var row = e.range.getRow();
  if (row < 2) return; // تخطي صف العناوين

  var col = e.range.getColumn();
  var relevantCols = [COL_PHONE, COL_STORE_URL, COL_CUSTOMER_NAME, COL_EMPLOYEE_NAME];
  if (relevantCols.indexOf(col) === -1) return;

  var rowData = sheet.getRange(row, 1, 1, Math.max(COL_PHONE, COL_STORE_URL, COL_CUSTOMER_NAME, COL_EMPLOYEE_NAME)).getValues()[0];

  var phone = String(rowData[COL_PHONE - 1] || "").trim();
  var storeUrl = String(rowData[COL_STORE_URL - 1] || "").trim();

  if (!phone && !storeUrl) return;

  var customerName = String(rowData[COL_CUSTOMER_NAME - 1] || "").trim();
  var employeeName = String(rowData[COL_EMPLOYEE_NAME - 1] || "").trim();

  var body = {
    data: [{
      phone: phone,
      storeUrl: storeUrl,
      customerName: customerName,
      employeeName: employeeName
    }]
  };

  if (SECRET) {
    body.secret = SECRET;
  }

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };

  try {
    UrlFetchApp.fetch(WEBHOOK_URL, options);
  } catch (e) {
    Logger.log("Auto-sync failed: " + e.message);
  }
}

/**
 * تثبيت trigger تلقائي للمزامنة كل 5 دقائق
 */
function installTrigger() {
  // حذف الترigger القديم أولاً
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  // إضافة ترigger جديد - كل 5 دقائق
  ScriptApp.newTrigger("syncToCRM")
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("Auto-sync trigger installed (every 5 minutes)");
}

/**
 * إزالة الترigger
 */
function uninstallTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log("All triggers removed");
}
`
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

  /* ─── Sheets Sync State ─── */
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null)
  const [showScriptDialog, setShowScriptDialog] = useState(false)
  const [syncTesting, setSyncTesting] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [copied, setCopied] = useState(false)

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

  /* ─── Load sync info ─── */
  const loadSyncInfo = useCallback(async () => {
    setSyncLoading(true)
    try {
      const res = await fetch('/api/sheets-sync')
      if (res.ok) {
        const data = await res.json()
        setSyncInfo(data as SyncInfo)
      }
    } catch (err) {
      console.warn('[bulk-add] Failed to load sync info:', err)
    } finally {
      setSyncLoading(false)
    }
  }, [])

  // Load sync info on mount
  useState(() => {
    loadSyncInfo()
  })

  /* ─── Get webhook URL ─── */
  const getWebhookUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/sheets-sync`
    }
    return '/api/sheets-sync'
  }, [])

  /* ─── Copy webhook URL ─── */
  const handleCopyUrl = useCallback(async () => {
    const url = getWebhookUrl()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      addToast('success', 'تم نسخ رابط الـ Webhook')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('error', 'فشل في نسخ الرابط')
    }
  }, [getWebhookUrl, addToast])

  /* ─── Copy Apps Script code ─── */
  const handleCopyScript = useCallback(async () => {
    const code = generateAppsScriptCode(getWebhookUrl(), '')
    try {
      await navigator.clipboard.writeText(code)
      addToast('success', 'تم نسخ كود Apps Script')
    } catch {
      addToast('error', 'فشل في نسخ الكود')
    }
  }, [getWebhookUrl, addToast])

  /* ─── Test connection ─── */
  const handleTestConnection = useCallback(async () => {
    setSyncTesting(true)
    try {
      const res = await fetch('/api/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [{
            phone: `test-${Date.now()}`,
            storeUrl: 'https://test.example.com',
            customerName: 'اختبار اتصال',
            employeeName: '',
          }],
        }),
      })

      const result = await res.json()
      if (res.ok && result.success) {
        addToast('success', `الاتصال ناجح! تم إنشاء ${result.created} سجل تجريبي`)
      } else {
        addToast('warning', `الاتصال يعمل ولكن: ${result.error || `${result.skipped} مكرر`}`)
      }
      // Reload sync info after test
      loadSyncInfo()
    } catch (err) {
      addToast('error', `فشل الاتصال: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`)
    } finally {
      setSyncTesting(false)
    }
  }, [addToast, loadSyncInfo])

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

  /* ─── Format timestamp ─── */
  const formatSyncTime = useCallback((ts: number) => {
    const d = new Date(ts)
    return d.toLocaleString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    })
  }, [])

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

      {/* ═══════════ Google Sheets Sync Section ═══════════ */}
      <Card className="bg-[#111520] border-white/[0.06] overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Section Title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/15 flex items-center justify-center">
                  <Link size={16} className="text-[#6c63ff]" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[#f0f2ff] flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    مزامنة Google Sheets
                  </div>
                  <p className="text-[11px] font-medium text-[#8892b0] mt-0.5">
                    اربط شيت Google مع CRM لمزامنة البيانات تلقائياً
                  </p>
                </div>
              </div>
              <Button
                onClick={loadSyncInfo}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-[#4a5280] hover:text-[#f0f2ff] hover:bg-[#1c2234]"
              >
                <RefreshCw size={12} className={syncLoading ? 'animate-spin' : ''} />
              </Button>
            </div>

            {/* Webhook URL */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[#0a0d14] border border-white/[0.08] rounded-lg px-3 py-2">
                <ExternalLink size={12} className="text-[#4a5280] shrink-0" />
                <span className="text-[12px] text-[#8892b0] font-mono truncate" dir="ltr">
                  {getWebhookUrl()}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCopyUrl}
                  className="bg-[#1c2234] hover:bg-[#252d42] text-[#8892b0] hover:text-[#f0f2ff] gap-1.5 text-[12px] h-8 border border-white/[0.06] cursor-pointer whitespace-nowrap"
                >
                  {copied ? <Check size={12} className="text-[#00d4aa]" /> : <Copy size={12} />}
                  {copied ? 'تم النسخ!' : 'نسخ الرابط'}
                </Button>
                <Button
                  onClick={() => setShowScriptDialog(true)}
                  className="bg-[#6c63ff]/15 hover:bg-[#6c63ff]/25 text-[#6c63ff] gap-1.5 text-[12px] h-8 border border-[#6c63ff]/20 cursor-pointer whitespace-nowrap"
                >
                  <Code2 size={12} />
                  عرض كود Apps Script
                </Button>
              </div>
            </div>

            {/* Sync Status Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Last Sync Info */}
              {syncInfo?.lastSync ? (
                <div className="flex items-center gap-1.5 bg-[#00d4aa]/8 border border-[#00d4aa]/15 rounded-lg px-2.5 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
                  <span className="text-[11px] font-medium text-[#00d4aa]">
                    آخر مزامنة: {formatSyncTime(syncInfo.lastSync.timestamp)}
                  </span>
                  <span className="text-[10px] text-[#00d4aa]/60">
                    ({syncInfo.lastSync.created} إنشاء · {syncInfo.lastSync.skipped} تخطي)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-[#4a5280]/8 border border-[#4a5280]/15 rounded-lg px-2.5 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4a5280]" />
                  <span className="text-[11px] font-medium text-[#4a5280]">
                    لا توجد مزامنات سابقة
                  </span>
                </div>
              )}

              {/* Secret indicator */}
              {syncInfo?.secretConfigured && (
                <Badge className="bg-amber-500/10 text-amber-400 text-[10px] font-bold border-0 gap-1 px-2 py-0.5">
                  🔒 حماية مفعّلة
                </Badge>
              )}

              {/* Test button */}
              <Button
                onClick={handleTestConnection}
                disabled={syncTesting}
                className="bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 text-[#00d4aa] gap-1.5 text-[11px] h-7 border border-[#00d4aa]/15 cursor-pointer disabled:opacity-50 mr-auto"
              >
                {syncTesting ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                اختبار الاتصال
              </Button>
            </div>

            {/* Recent Syncs */}
            {syncInfo && syncInfo.recentSyncs && syncInfo.recentSyncs.length > 0 && (
              <div className="border-t border-white/[0.04] pt-3 mt-1">
                <div className="text-[11px] font-bold text-[#4a5280] mb-2">آخر المزامنات</div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                  {syncInfo.recentSyncs.map((sync) => (
                    <div key={sync.id} className="flex items-center gap-2 text-[11px]">
                      <span className="text-[#8892b0]">{formatSyncTime(sync.timestamp)}</span>
                      <span className="text-[#00d4aa]">✓ {sync.created}</span>
                      {sync.skipped > 0 && (
                        <span className="text-amber-400">⊘ {sync.skipped}</span>
                      )}
                      {sync.errorCount > 0 && (
                        <span className="text-red-400">✗ {sync.errorCount}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════ Apps Script Dialog ═══════════ */}
      {showScriptDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col shadow-2xl">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Code2 size={18} className="text-[#6c63ff]" />
                <h3 className="text-[15px] font-bold text-[#f0f2ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  كود Google Apps Script
                </h3>
              </div>
              <button
                onClick={() => setShowScriptDialog(false)}
                className="w-8 h-8 rounded-lg bg-[#1c2234] hover:bg-[#252d42] flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff] transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Instructions */}
            <div className="px-5 py-3 border-b border-white/[0.04] bg-[#0a0d14]/50">
              <div className="text-[12px] font-bold text-[#6c63ff] mb-1.5">📌 تعليمات الإعداد:</div>
              <ol className="text-[11px] text-[#8892b0] space-y-1 list-decimal list-inside">
                <li>افتح Google Sheet الخاص بك</li>
                <li>اذهب إلى <span className="text-[#f0f2ff] font-medium">Extensions → Apps Script</span></li>
                <li>امسح أي كود موجود والصق الكود أدناه</li>
                <li>عدّل <span className="text-[#f0f2ff] font-medium">SHEET_NAME</span> وأرقام الأعمدة حسب شيتك</li>
                <li>اضغط <span className="text-[#f0f2ff] font-medium">Save</span> ثم <span className="text-[#f0f2ff] font-medium">Run → syncToCRM</span></li>
                <li>وافق على الصلاحيات عند أول تشغيل</li>
                <li>للمزامنة التلقائية: شغّل <span className="text-[#f0f2ff] font-medium">installTrigger()</span> من Run</li>
              </ol>
            </div>

            {/* Script Code */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <pre
                className="text-[11px] leading-relaxed text-[#8892b0] font-mono whitespace-pre-wrap bg-[#0a0d14] border border-white/[0.06] rounded-xl p-4"
                dir="ltr"
              >
                {generateAppsScriptCode(getWebhookUrl(), '')}
              </pre>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
              <div className="text-[10px] text-[#4a5280]">
                Webhook URL: <span className="text-[#8892b0] font-mono" dir="ltr">{getWebhookUrl()}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCopyScript}
                  className="bg-[#6c63ff] hover:bg-[#5b54e6] text-white gap-1.5 text-[12px] h-8 cursor-pointer"
                >
                  <Copy size={12} />
                  نسخ الكود
                </Button>
                <Button
                  onClick={() => setShowScriptDialog(false)}
                  className="bg-[#1c2234] hover:bg-[#252d42] text-[#8892b0] hover:text-[#f0f2ff] text-[12px] h-8 border border-white/[0.06] cursor-pointer"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
