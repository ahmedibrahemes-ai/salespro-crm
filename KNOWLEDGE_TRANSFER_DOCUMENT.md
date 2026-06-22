# SalesPro CRM — Knowledge Transfer Document
### وثيقة انتقال معرفي للمراجع الخارجي (External Code Auditor)

> **تحذير للمراجع:** هذه الوثيقة شفافة بالكامل. تتضمن كل المشاكل السابقة، الديون التقنية، ونقاط الضعف الحالية. الهدف هو تقييم واقعي، ليس تسويق.

---

## 1. نظرة عامة على المنصة (Platform Overview)

### الهدف الأساسي
منصة **SalesPro CRM** (اسم داخلي في الكود: "Venom CRM") هي نظام لإدارة فِرق المبيعات الهاتفية (Tele Sales) وفِرق المبيعات الميدانية (Sales). الهدف: تتبع الـ leads من الإنشاء → التواصل → حجز اجتماع → تحويل للتلي→السيلز → حضور → تقفيل (closed-won).

### المستخدم النهائي
شركات مبيعات B2B في السوق السعودي (أرقام +966، RTL عربي، timezone Africa/Cairo). الفِرق من 3-10 موظفين لكل دور.

### الأدوار (User Roles)

| الدور | الصلاحيات (client-side) | القيود |
|-------|------------------------|--------|
| **tele** (تيلي سيلز) | إنشاء/تعديل/حذف leads الخاصة به؛ تحويل leads للسيلز؛ تعليم attendance على تحويلاته | لا يرى leads السيلز الأصلية؛ لا يرى شيت السيلز |
| **sales** (سيلز) | إنشاء/تعديل leads الخاصة به؛ استقبال تحويلات التلي؛ تعليم attendance على تحويلات التلي؛ تعليم closed-won | لا يرى leads التلي إلا المحوّلة ليه |
| **admin** | كل ما سبق + إدارة الفريق (add/remove/rename members) + إدارة المستخدمين (create/toggle/reset/delete) + إدارة الصلاحيات (access permissions) + viewing كل الـ leads | — |

**⚠️ تنبيه أمني (انظر §4):** صلاحيات الـ admin فقط مُطبّقة server-side. صلاحيات tele/sales مُطبّقة client-side فقط — يمكن تجاوزها بالـ API مباشرة.

### هيكل التنقل (Views)
- `dashboard` — الرئيسية (KPIs)
- `employee-profile` — صفحتي (إحصائيات شخصية)
- `my-sheet` — شيت التيلي (للتلي + الأدمن)
- `sales-sheet` — شيت السيلز (للسيلز + الأدمن)
- `my-meetings` — اجتماعات التلي (تحويلات التلي + attendance)
- `follow-up` — متابعة (للسيلز + الأدمن)
- `transfers` — التحويلات (للتلي)
- `my-archive`, `daily-report`, `bulk-add`, `admin`

---

## 2. التقنيات المستخدمة والبنية التحتية (Tech Stack & Architecture)

### Frontend
- **Next.js 16.1.3** (App Router, Turbopack, `output: 'standalone'`)
- **React 19**
- **TypeScript 5** (strict, `noImplicitAny: false`)
- **Tailwind CSS 4** + **shadcn/ui** (style: "new-york")
- **Zustand 5** (state management مع `persist` middleware)
- **lucide-react** (icons)
- **recharts** (charts)
- **xlsx** (Excel import في bulk-add)
- **date-fns** + **react-day-picker** (date pickers)
- **framer-motion** (animations — تم إزالته من معظم المكوّنات لأداء، لسه مستخدم في my-archive)

### Backend
- **Next.js API Routes** (App Router `/api/*`)
- **Supabase JS** (`@supabase/supabase-js` v2) — PostgreSQL + Realtime
- **bcryptjs** (password hashing)
- **HMAC-SHA256** مخصص للـ session tokens (WebCrypto، edge-compatible)
- **z-ai-web-dev-sdk** (ميزات AI: coaching, smart-reply, call analysis)

### ⚠️ ملاحظات تقنية مهمة
1. **لا يوجد Prisma.** `src/lib/db.ts` هو stub يرمي خطأ. المشروع يستخدم Supabase JS فقط. (كان Prisma مستخدم قديماً ثم تم الترحيل.)
2. **next-auth و next-intl و pg مُعلنة في package.json لكن غير مستخدمة** — dead dependencies.
3. **`requireRole` مُعرّفة في `auth-guard.ts` لكن غير مستدعاة في أي route** — dead code.

### Database Schema (Supabase PostgreSQL)

**الجداول الرئيسية:**
| الجدول | الوصف |
|--------|-------|
| `leads` | الجدول الرئيسي — كل العملاء/الاجتماعات |
| `lead_notes` | ملاحظات على كل lead |
| `team_members` | أعضاء الفريق (tele/sales/admin) مع soft-delete |
| `app_users` | حسابات الدخول (username, password_hash, role) |
| `access_permissions` | صلاحيات viewing (viewer_name → target_name) |
| `settings` | إعدادات (key-value JSONB) |
| `meetings` | (موجود لكن rarely used — الـ meetings فعلياً في `leads`) |
| `transfers` | سجل التحويلات (audit) |
| `daily_reports` | تقارير يومية manually-submitted |
| `whatsapp_messages` | (موجود لكن rarely used) |
| `notifications` | إشعارات الـ bell |
| `audit_log` | سجل التدقيق (admin-only read) |

**RLS (Row-Level Security):**
- مُفعّل على كل الجداول
- **لكن:** service-role key (server-side) يتخطى RLS تماماً
- `app_users` مقفول بالكامل (REVOKE ALL from anon/authenticated) — service-role فقط
- `leads`, `lead_notes` — SELECT عام (anon + authenticated) للحاجة Realtime؛ writes authenticated فقط

### التواصل بين المكونات (Architecture Flow)
```
Browser (Client)
  ├─ Zustand store (leads cache, auth, UI state)
  │   └─ persist → localStorage ['venom-crm-storage', 'venom-session', 'venom-auth']
  ├─ fetch /api/* (with Authorization: Bearer <HMAC token>)
  └─ Supabase Realtime subscription (anon key, postgres_changes)
       └─ INSERT/UPDATE/DELETE events → updateLeadInCache

Next.js API Routes (Server)
  ├─ requireAuth/requireAdmin (verify HMAC token)
  ├─ getSupabaseAdmin() (service-role, bypasses RLS)
  └─ PostgreSQL queries

External
  ├─ z-ai-web-dev-sdk (AI features, server-side only)
  └─ Google Sheets webhook (inbound → /api/sheets-sync)
```

### Environment Variables
| Variable | الاستخدام |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (client + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (browser + Realtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server, bypasses RLS) **+ يُستخدم كـ HMAC signing secret للـ session tokens** |
| `SHEETS_SYNC_SECRET` | Shared secret لـ Google Sheets webhook |

> **⚠️ تنبيه:** `SUPABASE_SERVICE_ROLE_KEY` يؤدي وظيفتين (DB + session signing). تدويره (rotating) يبطل جميع الـ sessions.

---

## 3. القواعد المنطقية الأساسية (Core Business Logic)

### دورة حياة الـ Lead (State Machine)

```
[إنشاء] → status=null
   ↓ (tele يختار status)
status='meeting' → meetingDate=اليوم (auto) + assignedAt=now (لو sales)
   ↓ (tele يحوّل للسيلز)
sales=الاسم, assignedAt=now, salesStatus='new'
   ↓ (سيلز يتابع)
status='followup-1' → 'followup-2' → 'followup-3'
   ↓ (سيلز يعلّم attendance)
attended='attended'|'no-show'|'pending'
   ↓ (سيلز يختار)
status='closed-won' → salesStatus='closed-won' (dual-write)
```

**قواعد الـ cascade (مهمة جداً للمراجع):**

| الحدث | الحقول المُحدّثة | الملف |
|-------|-----------------|------|
| tele: `status='meeting'` | `meetingDate=اليوم` (لو فاضي) | `tele-sheet.tsx:1313-1316` |
| tele: `status=أي شيء آخر` | يمسح `meetingDate/Time/Type/Link` | `tele-sheet.tsx:1320-1323` |
| tele: تحويل للسيلز | `sales=الاسم, assignedAt=now, salesStatus='new'` | `tele-sheet.tsx:1413-1427` |
| sales: `status='meeting'` | `meetingDate=اليوم` (لو فاضي) + `assignedAt=now` (لو فاضي) | `sales-sheet.tsx:801-810` |
| sales: `status='closed-won'` | `salesStatus='closed-won'` (dual-write) — **لا يمسح meeting fields** | `sales-sheet.tsx:815` |
| sales: `status=أي شيء آخر` | يمسح `meetingDate/Time/Type/Link` + يمسح `salesStatus` لو كان closed-won | `sales-sheet.tsx:820-827` |
| attendance: `attended=X` | `attended=X, attendanceMarkedAt=now, attendanceMarkedBy=currentUser` | `my-meetings.tsx:555-568` |

### القواعد الإحصائية (Statistical Rules) — **حرجة للمراجع**

#### 1. `isCallContactResult(value)` — `crm-utils.ts:125-131`
```
'' / 'none' / null → false
'whatsapp'         → false  (واتس فقط ≠ مكالمة)
كل شيء آخر         → true   (call, call-whatsapp, replied, no-reply, busy, ...)
```

#### 2. `isClosedWon(lead)` — `crm-utils.ts:168-170`
```js
lead.status === 'closed-won' || lead.salesStatus === 'closed-won'
```
**يفحص الحقلين** (يدافع عن البيانات التاريخية).

#### 3. KPIs في `dashboard.tsx` `kpiValues` (lines 382-453)
- **`meetingsBooked`** = leads في `myLeads` بـ `assignedAt` ضمن الشهر ← للسيلز: اجتماعاته الأصلية فقط
- **`teleTransferMeetings`** = leads في `teleTransferredLeads` بـ `assignedAt` ضمن الشهر
- **`pipelineMeetings`** = tele-transferred meetings (l.tele && l.sales && assignedAt)
- **`pipelineAttended`** = pipelineMeetings && attended='attended'
- **`attendedConfirmed`** = pipelineAttended
- **`conversionRate`** = `pipelineAttended / pipelineMeetings × 100`
- **`callsMonth`** = leads بـ `contactResultAt` ضمن الشهر AND `isCallContactResult`
- **`whatsappSent`** = `isWhatsappContactResult(contactResult)` — **ALL-TIME (لا date filter!)** ⚠️
- **`closedWon`** = `isClosedWon(l)` — **ALL-TIME (لا date filter!)** ⚠️

#### 4. `meetingStats` widget (dashboard.tsx:589-636)
- بيحسب `attended/pending/noShow` من **tele-transferred meetings فقط** (مش social-originated)

#### 5. `salesStats` (employee-profile.tsx:358-409)
- بيقسم `myLeads` إلى `salesOriginated` (no tele) و `teleTransferred` (tele set)
- `attended/noShow/pending` من `teleTransferred` فقط
- `attendanceRate = attended / (attended + noShow)` — **لا يشمل pending في المقام**

### قواعد attendance
- **attendance tracking للـ tele-transferred meetings فقط** — اجتماعات السيلز الأصلية ليس لها نظام حضور
- في `employee-profile.tsx` قائمة اجتماعات اليوم: social-originated → badge "📅 اجتماعي"، tele-transferred → أزرار/badges حضور

### الحالات الحدودية (Edge Cases) — **انظر §5 للتفاصيل**
1. الـ leads التاريخية بـ `status=null` (10,638 lead!)
2. `salesStatus` مستخدم كـ enum AND free-text notes في نفس الوقت
3. `assignedAt` vs `meetingDate` (timestamp vs string)
4. `status='whatsapp'` في tele `STATUSES` لكن `isCallContactResult('whatsapp')=false`

---

## 4. تاريخ المشاكل وحلولها (Historical Issues & Resolved Bugs)

> **هذا القسم شفاف بالكامل. المراجع يجب أن يعرف كل مشكلة وحلها وكل دين تقني.**

### 4.1 مشاكل Git حرجة (تكررت مرتين)

#### المشكلة: `git commit --amend` + `git push --force` ضيّع 11 commit
- **ما حدث:** تم عمل amend على commit متعمله push → خلق مسار تاريخ منفصل → force-push مسح 11 commit تحسينات
- **الحل:** استخدم `git reflog` للعثور على الـ commit المفقود (`11954ce`)، `git reset --hard` له، ثم push
- **تكرر:** حدث مرة ثانية في نفس الجلسة (Task 20) — تم إصلاحه بنفس الطريقة
- **الدين التقني:** لا يوجد git hooks تمنع `--force` على main. **يُنصح المراجع بتقييم هذا.**

### 4.2 مشاكل الإحصائيات (Statistical Bugs)

#### المشكلة 1: "مكالمات الشهر" بتحسب واتس كمكالمة
- **السبب:** الـ pattern `l.contactResult && !== 'none' && !== ''` كان بيشمل `'whatsapp'` و `'call-whatsapp'`
- **الحل:** إنشاء `isCallContactResult()` helper في `crm-utils.ts` — يستثني `'whatsapp'` فقط. تطبيقه في 8 ملفات (24 موقع)
- **الحالة:** ✅ مُصلح

#### المشكلة 2: "اجتماعات السيلز" + "نسبة التحويل" = 0 دائماً للسيلز
- **السبب:** `kpiValues` بتحسب من `myLeads`، وللسيلز `myLeads` = leads أصلية فقط (بدون tele). معظم اجتماعات السيلز من تحويلات التلي (في `teleTransferredLeads`). كمان `assignedAt` كان بيتـ set فقط لما التلي يحوّل.
- **الحل (Task 7):** Solution 1 + 2 — إضافة teleTransferredLeads للـ loop + set `assignedAt` لما السيلز يعمل اجتماع
- **التصحيح (Task 8):** المستخدم وضّح إن "اجتماعات السيلز" = اجتماعات السيلز الأصلية فقط (بدون تحويلات) → تم revert Solution 1
- **التصحيح (Task 9):** نسبة التحويل بقت = tele-transferred attended / tele-transferred total (مش اجتماعات السيلز)
- **الحالة:** ✅ مُصلح بعد 3 محاولات

#### المشكلة 3: `meetingStats` widget بيحسب اجتماعات السيلز الأصلية
- **السبب:** نفس السبب — widget بيلوب على `myLeads` كله
- **الحل (Task 13):** widget بقت تمسح بس tele-transferred meetings
- **الحالة:** ✅ مُصلح

#### المشكلة 4: `employee-profile` salesStats بتمزج sales + tele
- **السبب:** `myLeads` للسيلز = كل الـ leads المسنودة ليه (الاتنين)
- **الحل (Task 11):** تقسيم `myLeads` إلى `salesOriginated` + `teleTransferred`، attendance من tele فقط
- **الحالة:** ✅ مُصلح

### 4.3 مشاكل البيانات (Data Bugs)

#### المشكلة 5 (حرجة): 105 leads ظهرت في "اجتماعات التلي" بدل شيت السيلز
- **السبب:** `bulk-add.tsx` كان بيـ set `tele: currentUser || team.tele[0] || ''` لكل row جديد. للسيلز "Mahitab"، `tele` بقى `'Mahitab'` → الـ leads ظهرت كتحويلات تلي
- **الحل (Task 22):** تغيير إلى `tele: isTele ? (currentUser || '') : ''` + endpoint تنظيف `/api/fix-sales-leads-tele`
- **الحالة:** ✅ مُصلح + الداتا اتنظّفت (105 leads رجعت لشيت السيلز)

#### المشكلة 6: مستخدم جديد يرث leads قديمة
- **السبب:** `removeTeamMember` كان soft-delete فقط (is_active=false) — ما بيمسح `sales_name`/`tele_name` من الـ leads. لما الأدمن يعمل reactivation بنفس الاسم، الـ leads القديمة بتظهر
- **الحل (Task 18 + 19):** `removeTeamMember` بقى يمسح `sales_name`/`tele_name` من orphaned leads. `addTeamMember` reactivation بقى يمسح leads القديمة كمان
- **الحالة:** ✅ مُصلح

#### المشكلة 7: فلتر التاريخ في شيت السيلز بيظهر فاضي
- **السبب 1:** `follow-up-section.tsx` كان فيه `&&` بدل `||` (الفلتر ما كانش بيشتغل خالص)
- **السبب 2:** leads بـ `createdAt=0` (broken/missing) كانت بتـ filter out في كل فلتر
- **الحل (Task 23):** إصلاح `&&` → `||` + إضافة `l.createdAt &&` guard
- **الحالة:** ✅ مُصلح

#### المشكلة 8: الاجتماعات القديمة المحوّلة من التلي مش بتظهر في follow-up
- **السبب:** 10,638 lead عندها `status=null` (بيانات تاريخية قبل نظام الـ statuses). فلتر follow-up كان بيرفضها
- **الحل (Task 26):** إضافة `isOldTeleMeeting` condition — status=null + tele set + meetingDate set
- **الحالة:** ✅ مُصلح

### 4.4 الديون التقنية (Technical Debt)

#### 1. `salesStatus` مُحمّل بوظيفتين (CRITICAL DESIGN SMELL)
- **enum**: `'closed-won'`, `'new'`, `'followup'`, `'negotiation'`, ...
- **free-text notes**: `NotesCell` بيكتب نص حر في `salesStatus`
- **المشكلة:** لو المستخدم كتب "followup" أو "negotiation" كملاحظة، هيتعامل معها كـ enum. لو كتب "closed-won"، الـ lead هيتحسب تم تقفيل في الإحصائيات
- **الحالة:** ⚠️ **غير مُصلح — يجب فصل الحقلين**

#### 2. `SALES_STATUSES` في store.ts = dead code
- `store.ts:27-39` تعرّف 11 قيم (`new, contacted, followup, meeting-done, objection-price, ...`)
- لكن sales-sheet.tsx و follow-up-section.tsx كل واحد بيـ override بقائمته الخاصة (6 قيم فقط)
- **النتيجة:** `employee-profile.tsx:381` بيتفحص `salesStatus === 'negotiation'` (من الـ dead code) → دايماً = 0
- **الحالة:** ⚠️ **غير مُصلح**

#### 3. `closedWon` و `whatsappSent` = ALL-TIME (مش current month)
- باقي الـ KPIs بتعمل date filter (current month)، لكن دول لا
- **النتيجة:** أرقامهم مُضخّمة مقارنة بالباقي
- **الحالة:** ⚠️ **غير مُصلح — غير متسق مع باقي الـ KPIs**

#### 4. `cancelledFrom` / `cancelledAt` / `customerType` = dead fields
- موجودة في schema + Lead type لكن لا يوجد كود يـ setها
- **الحالة:** ⚠️ dead schema

#### 5. جدول `meetings` و `whatsapp_messages` = rarely used
- الـ meetings فعلياً في جدول `leads` (meetingDate, meetingTime, ...)
- `meetings` table موجود لكن غير مستخدم في الـ UI
- **الحالة:** ⚠️ dead tables

#### 6. لا يوجد database migration system
- التغييرات في schema بتعمل عبر SQL files يدوية (`supabase-schema.sql`, `supabase-migration-stage1.sql`)
- **النتيجة:** صعب تتبع التغييرات، صعب rollback
- **الحالة:** ⚠️ technical debt

#### 7. Typo status `'follow up-2'` (مسافة بدل -) في production data
- 1 lead في الـ DB بـ status `'follow up-2'` (مش `'followup-2'`)
- مش هتظهر في follow-up (الفلتر بيتفحص `'followup-2'`)
- **الحالة:** ⚠️ data quality issue — مش تستحق migration لـ 1 lead

---

## 5. نقاط الضعف الحالية (Current Suspected Issues)

> **هذه القائمة بصراحة كاملة. المراجع يجب فحص كل نقطة.**

### 5.1 ثغرة أمنية حرجة (CRITICAL SECURITY)

#### `/api/leads` POST handler لا يفحص الـ role
- **الملف:** `src/app/api/leads/route.ts:337`
- **المشكلة:** الـ handler كله بيستخدم `requireAuth` فقط (أي مستخدم authenticated). العمليات التالية مفتوحة لأي مستخدم:
  - `case 'update'` — أي مستخدم يقدر يعدّل أي lead بـ ID
  - `case 'delete'` — أي مستخدم يقدر يحذف أي lead
  - `case 'bulkDelete'` — أي مستخدم يقدر يحذف leads بالجملة
  - `case 'archive'` — أي مستخدم يقدر يأرشف
  - `case 'create'` — أي مستخدم يقدر ينشئ lead تحت أي اسم (tele/sales) بدون ownership check
  - **`case 'addTeamMember'`** — أي مستخدم يقدر يضيف/يـ reactivate عضو فريق
  - **`case 'removeTeamMember'`** — أي مستخدم يقدر يحذف عضو فريق
  - **`case 'renameTeamMember'`** — أي مستخدم يقدر ي renaming
  - **`case 'saveAccessPermissions'`** — أي مستخدم يقدر يعيد كتابة صلاحيات الوصول

- **التناقض:** `/api/team` route لنفس العمليات بيستخدم `requireAdmin` صح (`team/route.ts:98`)
- **التأثير:** tele/sales user يقدر يعمل عمليات admin كاملة عبر `/api/leads`
- **الإصلاح المقترح:** إضافة `requireAdmin` على cases: `addTeamMember, removeTeamMember, renameTeamMember, saveAccessPermissions`. وإضافة ownership check على `update/delete/archive` (الـ lead لازم يكون ملك المستخدم أو admin)

### 5.2 bugs منطقية (Logic Bugs)

#### Bug A: `tele-sheet.tsx:1179` فلتر التاريخ ناقص guard
- السطر: `if (dateRange && (l.createdAt < dateRange.from || l.createdAt >= dateRange.to)) continue`
- المشكلة: ناقص `l.createdAt &&` guard (موجود في sales-sheet و follow-up)
- التأثير: leads بـ `createdAt=0` (broken/legacy) بتختفي في كل فلتر تاريخ
- **الإصلاح:** إضافة `l.createdAt &&`

#### Bug B: `employee-profile.tsx:381` `inProgress` دايماً = 0
- السطر: `myLeads.filter((l) => l.salesStatus === 'followup' || l.salesStatus === 'negotiation').length`
- المشكلة: الـ UI dropdowns بيكتب `'followup-1/2/3'` في `status` (مش `salesStatus`). `salesStatus` بيتـ set بس لـ `'closed-won'` أو free-text notes
- التأثير: `inProgress` stat دايماً = 0
- **الإصلاح:** تغيير إلى `l.status === 'followup-1' || l.status === 'followup-2' || l.status === 'followup-3'`

#### Bug C: `my-meetings.tsx:475-478` month filter بيستخدم browser timezone
- المشكلة: بيستخدم `new Date()` (browser local) بدل Africa/Cairo لـ month preset
- التأثير: off-by-one-day errors حول month boundaries في non-Egypt timezones
- **الإصلاح:** استخدام `getDateRange('month')` من store

#### Bug D: `page.tsx:410-420` realtime INSERT hardcodes nulls
- المشكلة: الـ INSERT handler بـ hardcode `assignedAt: null, attended: null, ...` بدل قراءتها من payload
- التأثير: لو bulk-create عمل set لهذه الحقول server-side، بتختفي في الـ realtime event
- **الإصلاح:** قراءة من payload مع `'field' in newRow` guard

#### Bug E: `closedWon` و `whatsappSent` ALL-TIME
- `dashboard.tsx:428` — `closedWon` بيتحسب ALL-TIME (لا date filter)
- `dashboard.tsx:431-433` — `whatsappSent` بيتحسب ALL-TIME
- باقي الـ KPIs بتعمل current-month filter
- التأثير: أرقامهم مُضخّمة مقارنة بالباقي
- **الإصلاح:** إضافة date filter (current month) للحسابين

#### Bug F: Cancel transfer لا يمسح attendance
- `tele-sheet.tsx:1492-1500` — لما التلي يلغي تحويل، بيمسح `sales, assignedAt, meetingDate` لكن **لا يمسح** `attended, attendanceMarkedAt, attendanceMarkedBy`
- التأثير: لو التلي أعاد التحويل لسيلز تاني، الـ attendance القديمة بتفضل
- **الإصلاح:** مسح `attended, attendanceMarkedAt, attendanceMarkedBy` في cancel transfer

#### Bug G: `tele-sheet.tsx:1184` stats double-counting
- `if (l.status === 'meeting' || l.meetingDate) meetings++`
- المشكلة: `meetingDate` بيتـ set على transfer حتى لو status=null (legacy)
- التأثير: ممكن double-count أو يشمل non-meeting leads

### 5.3 مخاوف تصميمية (Design Concerns)

#### Concern 1: `salesStatus` overloaded (انظر §4.4 #1)
- enum + free-text notes في نفس الحقل — **خطر على الإحصائيات**

#### Concern 2: client-side role checks bypassable
- `canAccessTeleSheet`/`canAccessSalesSheet` في store.ts advisory فقط
- الـ API لا يفحص ownership
- أي مستخدم يقدر يشوف/يعدّل leads أي حد عبر `/api/leads`

#### Concern 3: Realtime لا يوجد conflict resolution
- لو user A عدّل field X و user B عدّل field Y في نفس الوقت، التحديثين بيتطبّقوا (merge)
- لكن لو عدّلوا نفس field، آخر تحديث بيفوز (last-write-wins) — مفيلاش optimistic locking

#### Concern 4: `assignedAt` vs `meetingDate` divergence
- `assignedAt` (timestamp) = وقت حجز/تحويل الاجتماع — يستخدم في كل KPIs
- `meetingDate` (string YYYY-MM-DD) = تاريخ الاجتماع الفعلي
- لو السيلز أعاد جدولة الاجتماع، `assignedAt` بيفضل ثابت لكن `meetingDate` بيتحرك
- **التأثير:** الـ KPIs بتحسب وقت الحجز، مش وقت الاجتماع الفعلي

#### Concern 5: Two parallel duplicate detection systems
- `store.ts:buildDuplicatesCache` (compact: originalId + duplicateIds)
- `tele-sheet.tsx:1218-1249` + `sales-sheet.tsx:718-740` local `duplicatePhoneMap` (richer info)
- مش بيتشاركوا state — **overhead + إمكانية عدم اتساق**

#### Concern 6: RLS permissive in practice
- service-role key (server) يتخطى RLS
- client-side anon key مع SELECT عام على `leads` (للحاجة Realtime)
- **التأثير:** أي حد عنده anon key (public في browser) يقدر يقرأ كل الـ leads عبر Supabase direct

### 5.4 ميزات تم تعطيلها/تجاوزها

#### 1. `requireRole` function — dead code
- معرّفة في `auth-guard.ts:46-54` لكن غير مستدعاة في أي route

#### 2. `next-auth`, `next-intl`, `pg` — unused dependencies
- مُعلنة في package.json لكن غير مستخدمة

#### 3. `meetings` table — rarely used
- الـ UI بيستخدم `leads` table لكل شيء meetings-related

#### 4. Framer Motion — تم إزالته من معظم المكوّنات
- لسه مستخدم في `my-archive.tsx` فقط

---

## ملخص للمراجع (Auditor's Quick Summary)

### أولويات الإصلاح (by severity)
1. **🔴 CRITICAL:** `/api/leads` POST لا يفحص role — ثغرة أمنية (§5.1)
2. **🔴 CRITICAL:** `salesStatus` overloaded كـ enum + notes — خطر على الإحصائيات (§4.4 #1)
3. **🟠 HIGH:** `closedWon` و `whatsappSent` ALL-TIME — أرقام مُضخّمة (§5.2 Bug E)
4. **🟠 HIGH:** `inProgress` stat دايماً = 0 (§5.2 Bug B)
5. **🟡 MEDIUM:** `tele-sheet.tsx` فلتر التاريخ ناقص guard (§5.2 Bug A)
6. **🟡 MEDIUM:** Cancel transfer لا يمسح attendance (§5.2 Bug F)
7. **🟡 MEDIUM:** `my-meetings` month filter timezone (§5.2 Bug C)
8. **🟡 MEDIUM:** realtime INSERT hardcodes nulls (§5.2 Bug D)
9. **🟢 LOW:** `SALES_STATUSES` dead code في store (§4.4 #2)
10. **🟢 LOW:** dead fields/tables (§4.4 #4, #5)
11. **🟢 LOW:** typo status `follow up-2` (1 lead)

### ما يعمل بشكل صحيح (Working Correctly)
- ✅ نظام الـ session tokens (HMAC-SHA256)
- ✅ bcrypt + legacy SHA-256 auto-upgrade
- ✅ Realtime subscriptions مع debounce + priority fields
- ✅ Duplicate detection (local in sheets)
- ✅ Date filter logic (بعد الإصلاحات)
- ✅ KPIs calculation (بعد الإصلاحات — ما عدا closedWon/whatsappSent)
- ✅ team member lifecycle (بعد إصلاح reactivation)
- ✅ bulk-add (بعد إصلاح tele field bug)

### الأدوات التشخيصية المتاحة (Diagnostic Endpoints)
- `POST /api/cleanup-orphaned-leads` (admin) — ينضّف orphaned leads
- `POST /api/fix-sales-leads-tele` (admin) — يصلح tele_name الغلط
- `GET/POST /api/diagnose-leads-dates` (admin) — يفحص/يصلح created_at

---

**نهاية الوثيقة.** هذا التقرير شفاف وكامل لأقصى درجة. المراجع الخارجي يجب أن يبدأ بـ §5.1 (الثغرة الأمنية) ثم §4.4 (الديون التقنية) ثم §5.2 (الـ bugs المنطقية).
