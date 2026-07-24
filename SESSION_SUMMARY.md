# SalesPro CRM — ملخص شامل للنقل إلى AI جديد

## 1. نظرة عامة على المنصة

**اسم المشروع:** SalesPro CRM (اسم داخلي: Venom CRM)
**الـ URL:** https://salespro-crm-six.vercel.app/
**GitHub:** salespro-crm تحت user ahmedibrahemes-ai
**Supabase:** gopgmisvyvqdbgkfekuf.supabase.co (Pro plan)

### الهدف
نظام إدارة مبيعات (Tele Sales + Sales) لتتبع الـ leads من الإنشاء → التواصل → اجتماع → تحويل → حضور → تقفيل.

### الأدوار
- **tele (تلي سيلز):** إنشاء/تعديل leads، تحويل للسيلز، تعليم attendance
- **sales (سيلز):** استقبال تحويلات، إنشاء leads، تعليم attendance + closed-won
- **admin:** كل الصلاحيات + إدارة فريق + إدارة مستخدمين

---

## 2. التقنيات

| المكون | التقنية |
|--------|---------|
| Frontend | Next.js 16.1.3 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui (new-york) |
| State | Zustand 5 (persist middleware) |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Auth | HMAC-SHA256 session tokens (مخصص، مش next-auth) |
| Password | bcryptjs + legacy SHA-256 auto-upgrade |
| AI | z-ai-web-dev-sdk |
| Realtime | Supabase postgres_changes (INSERT + UPDATE) |
| Deploy | Vercel (Pro plan مطلوب لـ CPU) |

---

## 3. أهم الملفات

### Core Libraries
| الملف | السطور | الوصف |
|------|--------|-------|
| `src/lib/store.ts` | 992 | Zustand store: leads, auth, team, filters, toasts, realtime status |
| `src/lib/supabase.ts` | 1020 | Client-side Supabase + API helpers + realtime subscription |
| `src/lib/crm-utils.ts` | 215 | Helpers: normalizePhone, isCallContactResult, isWhatsappContactResult, isClosedWon, CLOSED_WON_KEY |
| `src/lib/session.ts` | 149 | HMAC-SHA256 session tokens (WebCrypto, edge-compatible) |
| `src/lib/auth-guard.ts` | 68 | requireAuth, requireAdmin, requireRole |
| `src/lib/supabase-admin.ts` | 77 | Server-side Supabase admin client (service role) |
| `src/lib/api-cache.ts` | 115 | In-memory cache (TTL=30s for leads + stats) |

### Main Components
| الملف | السطور | الوصف |
|------|--------|-------|
| `src/app/page.tsx` | 658 | Main page: 2-phase loading, realtime subscriptions, session validation |
| `src/components/crm/dashboard.tsx` | 1646 | KPIs, meetingStats, rankInfo (مركزك), AI panel, pending clients |
| `src/components/crm/tele-sheet.tsx` | 2180 | Tele sheet: CRUD, Quick Paste, transfer to sales, duplicate filter |
| `src/components/crm/sales-sheet.tsx` | 1285 | Sales sheet: CRUD, Quick Paste, status editing, duplicate filter |
| `src/components/crm/follow-up-section.tsx` | 496 | Follow-up: editable status, attendance column, closed-won highlight |
| `src/components/crm/my-meetings.tsx` | 768 | اجتماعات التلي: cards, attendance, notes, transfer date/time |
| `src/components/crm/employee-profile.tsx` | 1127 | صفحتي: personal stats, today's meetings, KPIs |
| `src/components/crm/ai/ai-panel.tsx` | 396 | AI insights: team analysis, coaching, smart reply |
| `src/components/crm/bulk-add.tsx` | 1348 | إضافة ليدز: paste, Excel import, code/link sharing |

### API Routes
| الملف | السطور | الوصف |
|------|--------|-------|
| `src/app/api/leads/route.ts` | 1008 | CRUD + 17 operations (create, bulkCreate, update, delete, archive, team ops) |
| `src/app/api/auth/route.ts` | 303 | Login, validate-session, create-user, change-password, reset-password |
| `src/app/api/meetings/route.ts` | 209 | GET meetings + PATCH attendance (with ownership check) |
| `src/app/api/team/route.ts` | 241 | GET team + POST add/remove/rename |
| `src/app/api/ai/route.ts` | ~200 | AI analysis (performance, coaching, smart-reply) |

---

## 4. القواعد المنطقية الأساسية

### 4.1 أدوار المستخدمين وتصفية البيانات
- **tele:** `myLeads = leads.filter(l => l.tele === currentUser && !l.isArchived)`
- **sales:** `myLeads = leads.filter(l => l.sales === currentUser && !l.isArchived && (!l.tele || l.tele.trim() === ''))` (سيلز أصلي فقط)
- **sales teleTransferred:** `leads.filter(l => l.sales === currentUser && l.tele && l.tele.trim() !== '')` (تحويلات التلي)
- **admin (all):** كل الـ leads غير المؤرشفة
- **admin (tele selected):** `l.tele === selectedName`
- **admin (sales selected):** `l.sales === selectedName`

### 4.2 KPIs (كلها للشهر الحالي)
- **ليدز جديدة الشهر:** `createdAt` في الشهر
- **مكالمات الشهر:** `contactResultAt` في الشهر + `isCallContactResult` (يستثني واتس بس)
- **اجتماعاتي (تلي):** كل التحويلات (`assignedAt` في الشهر) — مش بيتفحص status
- **اجتماعاتي (سيلز):** `status='meeting'` + `assignedAt` في الشهر
- **اجتماعات التلي:** تحويلات التلي (`assignedAt` في الشهر)
- **حضور مؤكد:** `attended='attended'` بين التحويلات في الشهر
- **واتس:** `isWhatsappContactResult(contactResult)` + `contactResultAt` في الشهر
- **تم التقفيل:** `isClosedWon(l)` + `assignedAt` في الشهر
- **نسبة التحويل:** `pipelineAttended / pipelineMeetings × 100` (tele-transferred فقط)

### 4.3 مركزك (Rank)
- **تلي:** متوسط 3 مراكز (مكالمات مجابة + تحويلات + نسبة حضور) — للشهر الحالي
- **سيلز:** متوسط 3 قيم (اجتماعات + مكالمات مجابة + تقفيلات) — للشهر الحالي

### 4.4 Helpers في crm-utils.ts
```js
isCallContactResult(value)     // true لكل القيم ما عدا '', 'none', 'whatsapp'
isWhatsappContactResult(value) // true لـ 'whatsapp' + 'call-whatsapp'
isClosedWon(lead)              // true لو status='closed-won' أو salesStatus='closed-won'
CLOSED_WON_KEY = 'closed-won'
```

### 4.5 Attendance
- attendance tracking للـ tele-transferred meetings فقط
- social-originated meetings مش ليها attendance
- القيم: 'attended', 'no-show', 'pending' (أو null)

### 4.6 Status cascade (handleUpdateField)
- `status='meeting'` → set `meetingDate=اليوم` (لو فاضي) + `assignedAt=now` (لو فاضي)
- `status='closed-won'` → set `salesStatus='closed-won'` (dual-write) + لا يمسح meeting fields
- أي status تاني → مسح `meetingDate/Time/Type/Link` + مسح `assignedAt` (للسيلز الأصلي فقط) + مسح `salesStatus` لو كان closed-won

---

## 5. أهم المشاكل والحلول (مرتبة زمنياً)

### 5.1 مشاكل الإحصائيات
| المشكلة | الحل |
|---------|------|
| مكالمات بتحسب واتس كمكالمة | `isCallContactResult()` helper يستثني 'whatsapp' |
| اجتماعات السيلز + نسبة التحويل = 0 دائماً | set `assignedAt` لما السيلز يعمل اجتماع + إصلاح kpiValues |
| نسبة التحويل بتحسب اجتماعات السيلز الأصلية | تغييرها لتعتمد على tele-transferred فقط |
| meetingStats widget بيحسب اجتماعات السيلز | بيحسب من tele-transferred فقط |
| employee-profile بيمزج sales + tele | تقسيم salesOriginated + teleTransferred |
| closedWon + whatsappSent ALL-TIME | إضافة date filter (current month) |
| inProgress stat دائماً = 0 | تغيير من salesStatus إلى status='followup-1/2/3' |
| AI panel إحصائيات غلط | محاذاة مع dashboard logic (current month + helpers) |
| اجتماعاتي للتلي بتحسب بس status='meeting' | تغيير لتعد كل التحويلات في الشهر |
| مركزك all-time | تغيير للشهر الحالي |
| مركزك تلي بتحسب بس التحويلات | تغيير لمتوسط 3 مراكز (مكالمات مجابة + تحويلات + نسبة حضور) |
| مركزك سيلز calls بتحسب كل المكالمات | تغيير للمكالمات المجابة بس (replied) |

### 5.2 مشاكل البيانات
| المشكلة | الحل |
|---------|------|
| 105 leads ظهرت في اجتماعات التلي بدل شيت السيلز | إصلاح `bulk-add.tsx`: tele field للسيلز يبقى فاضي |
| مستخدم جديد يرث leads قديمة | `removeTeamMember` + `addTeamMember` reactivation بمسح leads |
| فلتر التاريخ بيظهر فاضي | إصلاح `&&` → `||` + إضافة `createdAt` guard |
| الاجتماعات القديمة مش بتظهر في follow-up | إضافة `isOldTeleMeeting` condition |
| بيانات بتختفي بعد refresh | Phase 2: استبدال `setLeads` بـ `batchAddLeadsToCache` |
| leads ممسوحة بترجع بعد المسح | نفس الإصلاح — batchAddLeadsToCache مش بيعمل replace |
| realtime UPDATE بيمسح حقول بـ null | إضافة null guard للحقول النصية |
| "فشل التحديث" + بيانات بتضيع | session expiry protection: rollback + auto-logout + periodic validation |

### 5.3 مشاكل الأمان
| المشكلة | الحل |
|---------|------|
| /api/leads لا يفحص role على team ops | إضافة `requireAdmin` على 4 cases |
| /api/meetings PATCH بدون ownership check | إضافة ownership check |
| SUPABASE_SERVICE_ROLE_KEY كـ HMAC secret | دعم SESSION_HMAC_SECRET منفصل (مع fallback) |
| endpoints silent failure | إضافة error صريح بدل fallback لـ anon client |

### 5.4 مشاكل الأداء
| المشكلة | الحل |
|---------|------|
| Vercel Fast Origin Transfer 100% | edge caching (`s-maxage=30`) — تقليل 90% |
| Supabase egress exceeded | إلغاء DELETE realtime + تقليل columns + تقليل polling |
| Vercel Fluid CPU 75% | 2-phase loading + skip count query + non-blocking auth |
| بطء تحميل أولي (3-5s) | 2-phase: 200 lead للعرض + باقي في الخلفية |
| Quick Paste تكرار البيانات | إزالة onPaste المكرر من DialogContent |
| Quick Paste تبديل phone/URL | تحسين `looksLikePhone` + `looksLikeUrl` regex |

### 5.5 ميزات جديدة
| الميزة | الوصف |
|--------|-------|
| فلتر "المكرر" | في شيت التلي + شيت السيلز |
| عمود "الحضور" في follow-up | badge ملون (attended/no-show/انتظار) |
| "تم التقفيل" في follow-up | editable + dark emerald highlight |
| بطاقة اجتماعات التلي | اسم التلي + لينك المتجر + رقم الجوال + بريف popover |
| تاريخ ووقت التحويل | ظاهر في بطاقة الاجتماعات |
| Sort الأحدث أولاً | في اجتماعات التلي |
| AI panel role-dependent | تلي بيشوف "لم يحضروا" بدل "تقفيل" |
| AI panel team filtering | كل دور بيشوف فريقه بس |

---

## 6. المشاكل المتبقية (غير مُصلحة)

### 6.1 تحتاج نقاش
| # | المشكلة | الوصف |
|---|---------|-------|
| 1 | `/api/leads` ownership check على create/update/delete | أي مستخدم يقدر يعدّل أي lead بـ ID |
| 2 | leads anon SELECT مفتوح | data leak — أي زائر يقدر يقرأ كل leads |
| 3 | salesStatus overloaded | enum + free-text notes في نفس الحقل |
| 4 | cancel transfer لا يمسح attendance | attendance القديمة بتفضل |
| 5 | tele-sheet meetings double-counting | `status='meeting' OR meetingDate` |
| 6 | api-cache useless على Vercel | TTL قصير + multi-instance |
| 7 | dead code | SALES_STATUSES في store، requireRole، dead tables |

### 6.2 Data Quality
- 10,638 lead عندها `status=null` (بيانات تاريخية)
- 1 lead بـ status `'follow up-2'` (typo — تم إصلاحها بـ SQL migration)
- typo status `'whatsapp'` في tele STATUSES (مكرر مع contactResult)

---

## 7. SQL Migrations المطلوبة

### مُطبقة على production:
```sql
-- supabase-migration-audit-fixes.sql
DROP POLICY IF EXISTS "lead_notes_select_anon" ON lead_notes;
UPDATE leads SET status = 'followup-2' WHERE status = 'follow up-2';
```

### غير مُطبقة (محتاجة تشغيل يدوي):
- `SESSION_HMAC_SECRET` في Vercel env vars (اختياري — fallback شغال)

---

## 8. بنية قاعدة البيانات

### الجداول الرئيسية
| الجدول | الأعمدة المهمة |
|--------|----------------|
| `leads` | id, store_url, phone, customer_name, brief, contact_result, contact_result_at, tele_name, sales_name, meeting_date, meeting_time, status, sales_status, attended, attendance_marked_at, created_at, assigned_at, is_archived |
| `team_members` | id, name, role (tele/sales/admin), is_active |
| `app_users` | id, username, password_hash, password_salt, display_name, role, is_active |
| `access_permissions` | viewer_name, target_name, role, is_active |
| `notifications` | target_user, target_role, type, message, lead_id, read_at |
| `transfers` | lead_id, from_name, to_name, from_role, to_role, transferred_at |
| `audit_log` | actor_username, action, target_type, target_id, metadata |

### RLS
- `app_users`: مقفول بالكامل (REVOKE ALL from anon/authenticated)
- `leads`, `lead_notes`: SELECT عام (للـ realtime)، writes authenticated
- باقي الجداول: authenticated فقط

---

## 9. تكوين النظام

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://gopgmisvyvqdbgkfekuf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SESSION_HMAC_SECRET= (optional — falls back to SERVICE_ROLE_KEY)
SHEETS_SYNC_SECRET= (optional — for Google Sheets webhook)
```

### Vercel Config (vercel.json)
- Region: iad1
- /api/leads: 30s maxDuration, 1024MB memory
- /api/ai: 60s maxDuration, 1024MB memory
- Edge cache: /api/leads (s-maxage=30), /api/team (max-age=300), /api/notifications (max-age=10)

### Default Team
```js
tele: ['Amira', 'Neveen', 'Sara', 'Esraa', 'Rahma']
sales: ['Rania', 'Alaa', 'Samar']
admin: ['Admin']
```

### Default Admin Login
- Username: `admin`
- Password: `SalesPro@2026!`

---

## 10. ملاحظات للـ AI الجديد

1. **لا تستخدم `setLeads()` في Phase 2** — استخدم `batchAddLeadsToCache()` دائماً
2. **كل التعديلات على leads لازم تعمل rollback** لو فشل الـ API call
3. **كل الإحصائيات للشهر الحالي** (ما عدا rankInfo اللي للشهر الحالي برضو)
4. **attendance للـ tele-transferred فقط** — social-originated مش ليها attendance
5. **`isClosedWon()` بتفحص status OR salesStatus** — يدافع عن البيانات التاريخية
6. **`assignedAt`** = تاريخ التحويل/الحجز — بيتبعت في status='meeting' و transfer to sales
7. **Realtime UPDATE فيه null guard** — لو القيمة null والحالية مش null → سيب الحالية
8. **Session validation كل 5 دقايق** — لو invalid → logout
9. **Edge cache 30s على /api/leads** — لو ضافت leads وعملت refresh سريع، مش هتظهر لحد 30s
10. **لا تعدّل `salesStatus` بدون فهم** — الحقل ده overloaded (enum + notes)
