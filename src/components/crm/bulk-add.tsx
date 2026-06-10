'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useCrmStore, STATUSES } from '@/lib/store'
import type { Lead } from '@/lib/supabase'
import { apiBulkCreateLeads } from '@/lib/supabase'
import { normalizePhone } from '@/lib/crm-utils'
import {
  Plus, Trash2, Upload, Loader2, Check, FileSpreadsheet, ClipboardPaste,
  Link, Copy, Code2, RefreshCw, ExternalLink, X, AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  included: boolean
  isDuplicate: boolean
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
   Bulk Add Component — REDESIGNED: Smart table-based paste
   ═══════════════════════════════════════════════════════ */
let bulkRowCounter = 0

export function BulkAdd() {
  const { team, currentUser, currentRole, addToast, batchAddLeadsToCache, leads } = useCrmStore()

  const isTele = currentRole === 'tele'

  /* ─── State ─── */
  const [rows, setRows] = useState<BulkRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submittedCount, setSubmittedCount] = useState(0)
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; field: 'phone' | 'storeUrl' } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
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
      id: `row-${++bulkRowCounter}`,
      storeUrl: '',
      phone: '',
      customerName: '',
      customerType: isTele ? '' : 'business',
      brief: '',
      tele: currentUser || team.tele[0] || '',
      sales: currentRole === 'sales' && currentUser ? currentUser : '',
      status: 'new',
      errors: [],
      included: true,
      isDuplicate: false,
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

  /* ─── Build set of existing normalized phone numbers ─── */
  const existingPhoneSet = useMemo(() => {
    const s = new Set<string>()
    for (const l of leads) {
      if (l.phone) {
        const norm = normalizePhone(l.phone)
        if (norm) s.add(norm)
      }
    }
    return s
  }, [leads])

  /* ─── Compute rows with duplicate status ─── */
  const rowsWithDuplicates = useMemo(() => {
    const normToIds = new Map<string, string[]>()
    // First pass: collect all norms
    for (const row of rows) {
      if (!row.phone) continue
      const norm = normalizePhone(row.phone)
      if (!norm) continue
      const arr = normToIds.get(norm) || []
      arr.push(row.id)
      normToIds.set(norm, arr)
    }
    // Second pass: mark duplicates (existing + intra-paste)
    return rows.map((row) => {
      if (!row.phone) return { ...row, isDuplicate: false }
      const norm = normalizePhone(row.phone)
      if (!norm) return { ...row, isDuplicate: false }
      const isExisting = existingPhoneSet.has(norm)
      const idsWithSameNorm = normToIds.get(norm) || []
      const isIntraDupe = idsWithSameNorm.length > 1
      return { ...row, isDuplicate: isExisting || isIntraDupe }
    })
  }, [rows, existingPhoneSet])

  /* ─── Selected valid rows (included + has data) ─── */
  const selectedValidRows = useMemo(
    () => rowsWithDuplicates.filter((r) => r.included && (r.phone.trim() || r.storeUrl.trim())),
    [rowsWithDuplicates]
  )

  /* ─── Duplicate count ─── */
  const duplicateCount = useMemo(
    () => rowsWithDuplicates.filter((r) => r.isDuplicate && r.included).length,
    [rowsWithDuplicates]
  )

  /* ─── Update a row field ─── */
  const updateRow = useCallback((rowId: string, field: keyof BulkRow, value: string | boolean) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const updated = { ...r, [field]: value }
        // Validate only for string fields
        if (typeof value === 'string') {
          updated.errors = validateRow(updated)
        }
        return updated
      })
    )
  }, [])

  /* ─── Remove row ─── */
  const handleRemoveRow = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId))
  }, [])

  /* ─── Add empty row ─── */
  const addEmptyRow = useCallback(() => {
    const newRow = createEmptyRow()
    setRows((prev) => [...prev, newRow])
    setTimeout(() => setFocusedCell({ rowId: newRow.id, field: 'phone' }), 50)
  }, [currentUser, currentRole])

  /* ─── Handle paste event on the table area ─── */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text.trim()) return

    // Check if it's multi-line data (bulk paste)
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return

    e.preventDefault()

    const newRows: BulkRow[] = lines.map((line) => {
      const parsed = parsePastedLine(line)
      return {
        id: `paste-${++bulkRowCounter}`,
        storeUrl: parsed.storeUrl,
        phone: parsed.phone,
        customerName: '',
        customerType: isTele ? '' : 'business',
        brief: '',
        tele: currentUser || team.tele[0] || '',
        sales: currentRole === 'sales' && currentUser ? currentUser : '',
        status: 'new',
        errors: [],
        included: true,
        isDuplicate: false,
      }
    })

    setRows((prev) => [...prev, ...newRows])
  }, [isTele, currentUser, currentRole, team])

  /* ─── Remove all duplicate rows from table ─── */
  const removeDuplicateRows = useCallback(() => {
    setRows((prev) => {
      const duplicateIds = new Set<string>()
      // First pass: identify all duplicate row IDs
      for (const r of prev) {
        if (!r.phone) continue
        const norm = normalizePhone(r.phone)
        if (!norm) continue
        const isExisting = existingPhoneSet.has(norm)
        const normCount = prev.filter((pr) => pr.phone && normalizePhone(pr.phone) === norm).length
        const isIntraDupe = normCount > 1
        if (isExisting || isIntraDupe) {
          duplicateIds.add(r.id)
        }
      }
      // Remove all duplicates from the table
      const kept = prev.filter((r) => !duplicateIds.has(r.id))
      return kept
    })
  }, [existingPhoneSet])

  /* ─── Select/Deselect all ─── */
  const toggleAll = useCallback((checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, included: checked })))
  }, [])

  /* ─── Clear all rows ─── */
  const clearAll = useCallback(() => {
    setRows([])
    setFocusedCell(null)
  }, [])

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
        id: `file-${++bulkRowCounter}`,
        storeUrl: r.storeUrl,
        phone: r.phone,
        customerName: r.customerName,
        customerType: isTele ? '' : 'business',
        brief: '',
        tele: currentUser || team.tele[0] || '',
        sales: currentRole === 'sales' && currentUser ? currentUser : '',
        status: 'new',
        errors: [],
        included: true,
        isDuplicate: false,
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

  /* ─── Submit included rows ─── */
  const handleSubmit = useCallback(async () => {
    // Get only included rows with valid data
    const includedRows = rowsWithDuplicates.filter((r) => r.included && (r.phone.trim() || r.storeUrl.trim()))

    // Validate all included rows
    const validatedRows = includedRows.map((r) => ({
      ...r,
      errors: validateRow(r),
    }))

    const hasErrors = validatedRows.some((r) => r.errors.length > 0)
    if (hasErrors) {
      // Update the rows with errors in state
      setRows((prev) =>
        prev.map((r) => {
          const validated = validatedRows.find((vr) => vr.id === r.id)
          return validated ? { ...r, errors: validated.errors } : r
        })
      )
      addToast('warning', 'يوجد أخطاء في بعض الصفوف. تأكد من البيانات.')
      return
    }

    if (validatedRows.length === 0) {
      addToast('warning', 'لا يوجد بيانات محددة للإضافة')
      return
    }

    setSubmitting(true)
    try {
      const leadsToCreate: Partial<Lead>[] = validatedRows.map((r) => ({
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

      setSubmittedCount(validatedRows.length)
      addToast('success', `تم إضافة ${validatedRows.length} عميل بنجاح 🎉`)
      setRows([])
      setFocusedCell(null)
    } catch (err: unknown) {
      addToast('error', `فشل في إضافة العملاء: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`)
    } finally {
      setSubmitting(false)
    }
  }, [rowsWithDuplicates, addToast, batchAddLeadsToCache, isTele, currentUser])

  /* ─── Valid included rows count ─── */
  const validCount = useMemo(
    () => selectedValidRows.length,
    [selectedValidRows]
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

  /* ─── Select/deselect all state ─── */
  const allIncluded = rows.length > 0 && rows.every((r) => r.included)
  const someIncluded = rows.some((r) => r.included) && !allIncluded

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
            {submitting ? 'جاري الإضافة...' : `إضافة المحدد (${validCount})`}
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

      {/* ═══════════ Smart Table — Paste Target ═══════════ */}
      <Card className="bg-[#111520] border-white/[0.06]">
        <CardContent className="p-0">
          <div className="flex flex-col">
            {/* Duplicate warning bar */}
            {duplicateCount > 0 && (
              <div className="flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-400 shrink-0" />
                  <div>
                    <span className="text-[13px] font-bold text-amber-400">{duplicateCount} بيانات مكررة</span>
                    <span className="text-[12px] font-medium text-amber-400/70 mr-2">— موجودة مسبقاً</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={removeDuplicateRows}
                    className="h-7 px-2.5 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-bold hover:bg-red-500/25 transition-colors cursor-pointer"
                  >
                    استبعاد المكرر
                  </button>
                </div>
              </div>
            )}

            {/* Table area — paste target */}
            <div
              ref={tableRef}
              onPaste={handlePaste}
              tabIndex={0}
              className="min-h-[200px] max-h-[60vh] overflow-y-auto custom-scrollbar focus:border-[#6c63ff]/30 focus:outline-none transition-colors"
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/[0.06] hover:bg-transparent sticky top-0 bg-[#111520] z-10">
                    <TableHead className="w-[36px] text-center text-[12px] font-bold text-[#4a5280]">
                      <Checkbox
                        checked={allIncluded}
                        ref={(el) => {
                          if (el) (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someIncluded
                        }}
                        onCheckedChange={(checked) => toggleAll(!!checked)}
                        className="border-white/20 data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]"
                      />
                    </TableHead>
                    <TableHead className="w-[36px] text-center text-[12px] font-bold text-[#4a5280]">#</TableHead>
                    <TableHead className="text-right text-[12px] font-bold text-[#4a5280] w-[160px]">رقم الجوال</TableHead>
                    <TableHead className="text-right text-[12px] font-bold text-[#4a5280]">لينك المتجر</TableHead>
                    {!isTele && (
                      <>
                        <TableHead className="text-right text-[12px] font-bold text-[#4a5280]">اسم العميل</TableHead>
                        <TableHead className="text-right text-[12px] font-bold text-[#4a5280]">نوع العميل</TableHead>
                        <TableHead className="text-right text-[12px] font-bold text-[#4a5280]">نبذة</TableHead>
                        <TableHead className="text-right text-[12px] font-bold text-[#4a5280]">التيلي</TableHead>
                        <TableHead className="text-right text-[12px] font-bold text-[#4a5280]">السيلز</TableHead>
                        <TableHead className="text-right text-[12px] font-bold text-[#4a5280]">الحالة</TableHead>
                      </>
                    )}
                    <TableHead className="w-[36px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsWithDuplicates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isTele ? 5 : 11} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <ClipboardPaste size={32} className="text-[#4a5280]/40" />
                          <div className="text-[#4a5280] text-[14px] font-semibold">الصق البيانات هنا (Ctrl+V)</div>
                          <div className="text-[#4a5280]/60 text-[12px]">الأرقام تنزل في عمود الرقم واللينكات في عمود المتجر</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rowsWithDuplicates.map((row, idx) => {
                      const isEmpty = !row.phone.trim() && !row.storeUrl.trim()
                      return (
                        <TableRow
                          key={row.id}
                          className={`border-b border-white/[0.04] transition-colors ${
                            !row.included
                              ? 'bg-red-500/[0.04] opacity-50'
                              : row.isDuplicate
                                ? 'bg-amber-500/[0.06]'
                                : isEmpty
                                  ? 'bg-white/[0.01]'
                                  : 'hover:bg-[#1c2234]/50'
                          }`}
                        >
                          {/* Include checkbox */}
                          <TableCell className="w-[36px] text-center">
                            <Checkbox
                              checked={row.included}
                              onCheckedChange={(checked) => updateRow(row.id, 'included', !!checked)}
                              className={`border-white/20 ${row.isDuplicate ? 'data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500' : 'data-[state=checked]:bg-[#6c63ff] data-[state=checked]:border-[#6c63ff]'}`}
                            />
                          </TableCell>

                          {/* Row number */}
                          <TableCell className="w-[36px] text-center text-[12px] font-bold text-[#4a5280]">
                            {idx + 1}
                          </TableCell>

                          {/* Phone number */}
                          <TableCell className="w-[160px]">
                            <div className="flex items-center gap-1">
                              {focusedCell?.rowId === row.id && focusedCell?.field === 'phone' ? (
                                <input
                                  type="text"
                                  value={row.phone}
                                  onChange={(e) => updateRow(row.id, 'phone', e.target.value)}
                                  onBlur={() => setFocusedCell(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') setFocusedCell(null)
                                    if (e.key === 'Tab') {
                                      e.preventDefault()
                                      setFocusedCell({ rowId: row.id, field: 'storeUrl' })
                                    }
                                  }}
                                  className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[13px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]"
                                  dir="ltr"
                                  autoFocus
                                />
                              ) : (
                                <span
                                  onClick={() => setFocusedCell({ rowId: row.id, field: 'phone' })}
                                  className={`cursor-pointer rounded px-1.5 py-0.5 text-[13px] font-medium min-h-[28px] inline-block truncate max-w-full transition-colors ${
                                    row.isDuplicate ? 'text-amber-400 hover:bg-amber-500/10' : row.phone ? 'text-[#f0f2ff] hover:bg-[#1c2234]' : 'text-[#4a5280] hover:bg-[#1c2234]'
                                  }`}
                                  dir="ltr"
                                >
                                  {row.phone || 'رقم الجوال...'}
                                </span>
                              )}
                              {row.isDuplicate && row.phone && (
                                <Badge className="bg-amber-500/15 text-amber-400 text-[9px] font-bold border-0 shrink-0">مكرر</Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Store URL */}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {focusedCell?.rowId === row.id && focusedCell?.field === 'storeUrl' ? (
                                <input
                                  type="text"
                                  value={row.storeUrl}
                                  onChange={(e) => updateRow(row.id, 'storeUrl', e.target.value)}
                                  onBlur={() => setFocusedCell(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') setFocusedCell(null)
                                    if (e.key === 'Tab' && !e.shiftKey) {
                                      e.preventDefault()
                                      // Focus phone of next row, or add new row
                                      const nextIdx = idx + 1
                                      if (nextIdx < rowsWithDuplicates.length) {
                                        setFocusedCell({ rowId: rowsWithDuplicates[nextIdx].id, field: 'phone' })
                                      } else {
                                        addEmptyRow()
                                      }
                                    }
                                  }}
                                  className="bg-[#0a0d14] border border-[#6c63ff]/40 rounded px-2 py-1 text-[13px] text-[#f0f2ff] w-full outline-none focus:border-[#6c63ff]"
                                  dir="ltr"
                                  autoFocus
                                />
                              ) : (
                                <span
                                  onClick={() => setFocusedCell({ rowId: row.id, field: 'storeUrl' })}
                                  className={`cursor-pointer rounded px-1.5 py-0.5 text-[13px] font-medium min-h-[28px] inline-block truncate max-w-full transition-colors ${
                                    row.storeUrl ? 'text-[#f0f2ff] hover:bg-[#1c2234]' : 'text-[#4a5280] hover:bg-[#1c2234]'
                                  }`}
                                  dir="ltr"
                                >
                                  {row.storeUrl || 'لينك المتجر...'}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Additional columns for non-tele roles */}
                          {!isTele && (
                            <>
                              {/* Customer Name */}
                              <TableCell>
                                <Input
                                  placeholder="اسم العميل"
                                  value={row.customerName}
                                  onChange={(e) => updateRow(row.id, 'customerName', e.target.value)}
                                  className="h-7 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[130px]"
                                />
                              </TableCell>

                              {/* Customer Type */}
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

                              {/* Brief */}
                              <TableCell>
                                <Input
                                  placeholder="نبذة"
                                  value={row.brief}
                                  onChange={(e) => updateRow(row.id, 'brief', e.target.value)}
                                  className="h-7 text-[13px] bg-[#0a0d14] border-white/[0.08] text-[#f0f2ff] w-[100px]"
                                />
                              </TableCell>

                              {/* Tele */}
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

                              {/* Sales */}
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

                              {/* Status */}
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
                            </>
                          )}

                          {/* Delete row */}
                          <TableCell className="w-[36px]">
                            <button
                              onClick={() => handleRemoveRow(row.id)}
                              className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors cursor-pointer"
                              title="حذف الصف"
                            >
                              <X size={10} />
                            </button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer bar */}
            <div className="border-t border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={addEmptyRow}
                  className="h-8 px-3 rounded-lg bg-[#6c63ff]/10 text-[#6c63ff] text-[12px] font-bold flex items-center gap-1.5 hover:bg-[#6c63ff]/20 transition-colors cursor-pointer"
                >
                  <Plus size={12} />
                  صف جديد
                </button>
                {rows.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="h-8 px-3 rounded-lg bg-red-500/10 text-red-400 text-[12px] font-bold flex items-center gap-1.5 hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    <Trash2 size={12} />
                    مسح الكل
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 text-[12px] font-medium">
                <span className="text-[#8892b0]">
                  {rows.length > 0 ? (
                    <>
                      <span className="text-[#f0f2ff] font-bold">{selectedValidRows.length}</span> محدد من <span className="text-[#f0f2ff] font-bold">{rows.length}</span>
                    </>
                  ) : (
                    'لا يوجد بيانات'
                  )}
                </span>
                {duplicateCount > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-400 text-[11px] font-bold border-0">
                    {duplicateCount} مكرر
                  </Badge>
                )}
                {isTele && currentUser && (
                  <span className="text-[#8892b0]">
                    → شيت: <span className="text-[#6c63ff]">{currentUser}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
