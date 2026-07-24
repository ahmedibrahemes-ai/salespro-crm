# SalesPro CRM — خريطة العمل والـ Architecture Map

---

## 1. خريطة العمل (Business Flow)

### 1.1 دورة حياة الـ Lead الكاملة

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  الإنشاء    │────▶│  التواصل    │────▶│  الاجتماع   │────▶│  التحويل    │
│  (tele)     │     │  (tele)     │     │  (tele)     │     │  (tele→sales)│
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
                    ┌─────────────┐     ┌─────────────┐     ┌───────▼──────┐
                    │  التقفيل    │◀────│  المتابعة   │◀────│  الحضور     │
                    │  (sales)    │     │  (sales)    │     │  (sales)    │
                    └─────────────┘     └─────────────┘     └─────────────┘
```

### 1.2 تتبع الحالة (State Machine)

```
                ┌──────────┐
                │  null    │ ← الإنشاء (tele أو sales)
                └────┬─────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌───▼────┐ ┌───▼────────┐
    │ meeting │ │ not-   │ │ contactRes │
    │         │ │intere- │ │ (replied,  │
    │         │ │ sted   │ │ no-reply,  │
    └────┬────┘ └────────┘ │ busy, ...) │
         │                 └────────────┘
         │
    ┌────▼────┐
    │transfer │ ← tele يحوّل لـ sales
    │to sales │   (set: sales, assignedAt)
    └────┬────┘
         │
    ┌────▼─────────────────────────────────┐
    │ sales يستلم → يعلم attendance:       │
    │   attended / no-show / pending       │
    └────┬─────────────────────────────────┘
         │
    ┌────▼──────────────────────┐
    │ sales يتابع → status:     │
    │   followup-1 → followup-2 │
    │   → followup-3            │
    └────┬──────────────────────┘
         │
    ┌────▼──────────┐
    │ closed-won    │ ← sales يُقفّل
    │ (تم التقفيل)  │   (set: status + salesStatus)
    └───────────────┘
```

### 1.3 الأدوار والمسؤوليات

```
┌─────────────────────────────────────────────────────────────────┐
│                        TELE SALES                               │
├─────────────────────────────────────────────────────────────────┤
│ المسؤوليات:                                                     │
│ • إنشاء leads جديدة (يدوي / Quick Paste / bulk add)             │
│ • التواصل مع العملاء (تعليم contactResult)                      │
│ • حجز اجتماعات (status='meeting' → set meetingDate)             │
│ • تحويل الاجتماعات للسيلز (set sales + assignedAt)              │
│ • متابعة حضور الاجتماعات المحوّلة                                │
│                                                                 │
│ ما يراه:                                                        │
│ • شيت التلي (كل leads بتاعته)                                   │
│ • اجتماعات التلي (تحويلاته + حالتها)                            │
│ • الداشبورد (KPIs + مركزك)                                      │
│ • صفحتي (إحصائيات شخصية)                                        │
│                                                                 │
│ KPIs:                                                           │
│ • مكالمات الشهر (isCallContactResult)                           │
│ • اجتماعاتي = كل تحويلاته في الشهر                              │
│ • حضور مؤكد = attended بين تحويلاته                             │
│ • نسبة التحويل = attended / total transfers                     │
│ • مركزك = avg(mrank_calls + rank_transfers + rank_attendance)   │
├─────────────────────────────────────────────────────────────────┤
│                          SALES                                   │
├─────────────────────────────────────────────────────────────────┤
│ المسؤوليات:                                                     │
│ • استقبال تحويلات التلي                                          │
│ • إنشاء leads أصلية (بدون tele)                                 │
│ • تعليم attendance (attended/no-show)                           │
│ • متابعة العملاء (followup-1/2/3)                               │
│ • تقفيل الصفقات (closed-won)                                    │
│                                                                 │
│ ما يراه:                                                        │
│ • شيت السيلز (leads أصلية فقط)                                  │
│ • اجتماعات التلي (تحويلات التلي + attendance)                   │
│ • Follow-up (اجتماعات + متابعة + مقفّلة)                         │
│ • الداشبورد (KPIs + مركزك)                                      │
│ • صفحتي (إحصائيات شخصية)                                        │
│                                                                 │
│ KPIs:                                                           │
│ • مكالمات الشهر (isCallContactResult)                           │
│ • اجتماعاتي = status='meeting' + assignedAt في الشهر            │
│ • اجتماعات التلي = تحويلات التلي في الشهر                        │
│ • حضور مؤكد = attended بين تحويلات التلي                        │
│ • نسبة التحويل = attended / total tele-transferred              │
│ • مركزك = avg(meetings + answered_calls + closings)             │
├─────────────────────────────────────────────────────────────────┤
│                          ADMIN                                   │
├─────────────────────────────────────────────────────────────────┤
│ المسؤوليات:                                                     │
│ • كل صلاحيات tele + sales                                       │
│ • إدارة الفريق (add/remove/rename members)                      │
│ • إدارة المستخدمين (create/toggle/reset/delete)                 │
│ • إدارة الصلاحيات (access permissions)                          │
│ • مراقبة النظام (monitoring + audit log)                        │
│ • رؤية كل leads كل الفريق                                        │
│                                                                 │
│ ما يراه:                                                        │
│ • كل الصفحات (tele + sales)                                     │
│ • لوحة التحكم (إدارة كاملة)                                     │
│ • AI panel (كل الفريق)                                          │
│ • يمكن فلترة بالـ member selector                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. الـ Architecture Map

### 2.1 نظرة عامة على المعمارية

```
┌─────────────────────────────────────────────────────────────┐
│                        المتصفح (Client)                      │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ React 19    │  │ Zustand     │  │ Supabase Realtime   │ │
│  │ Components  │  │ Store       │  │ (postgres_changes)  │ │
│  │ (shadcn/ui) │  │ (persist)   │  │ INSERT + UPDATE     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────┬───────┘                     │            │
│                  │                             │            │
│         ┌────────▼────────┐                    │            │
│         │ fetch /api/*    │◀───────────────────┘            │
│         │ (Authorization: │                                 │
│         │  Bearer token)  │                                 │
│         └────────┬────────┘                                 │
└──────────────────┼──────────────────────────────────────────┘
                   │
                   │ HTTPS
                   │
┌──────────────────┼──────────────────────────────────────────┐
│                  ▼           Vercel (Serverless)             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Vercel Edge Cache                       │    │
│  │  /api/leads (s-maxage=30, swr=120)                  │    │
│  │  /api/team (max-age=300, swr=600)                   │    │
│  │  /api/notifications (max-age=10, swr=30)            │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │ (cache miss)                         │
│  ┌────────────────────▼────────────────────────────────┐    │
│  │           Next.js API Routes                         │    │
│  │                                                     │    │
│  │  /api/leads    → CRUD + 17 operations               │    │
│  │  /api/auth     → login, validate, create-user       │    │
│  │  /api/meetings → GET + PATCH (attendance)           │    │
│  │  /api/team     → GET + POST (add/remove/rename)     │    │
│  │  /api/ai       → AI analysis (z-ai-web-dev-sdk)     │    │
│  │  /api/notifications → GET + POST + PATCH            │    │
│  │  /api/transfers → GET + POST                        │    │
│  │  /api/daily-reports → GET + POST                    │    │
│  │  /api/audit-log → GET + POST                        │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │                                     │
│           ┌───────────┼───────────┐                         │
│           │           │           │                         │
│  ┌────────▼───┐ ┌────▼────┐ ┌───▼──────────┐               │
│  │ auth-guard │ │ session │ │ api-cache    │               │
│  │ requireAuth│ │ HMAC    │ │ TTL=30s      │               │
│  │ requireAdm │ │ verify  │ │ in-memory    │               │
│  └────────────┘ └─────────┘ └──────────────┘               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Supabase JS (service role key)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Supabase (PostgreSQL)                     │
│                                                             │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │
│  │  leads   │ │ team_members│ │ app_users  │ │access_perms│  │
│  │ (10,736) │ │            │ │            │ │           │  │
│  └──────────┘ └────────────┘ └────────────┘ └───────────┘  │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │
│  │ lead_notes│ │transfers   │ │notifications│ │ audit_log │  │
│  │          │ │            │ │            │ │           │  │
│  └──────────┘ └────────────┘ └────────────┘ └───────────┘  │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ daily_   │ │ whatsapp_  │ │  settings  │                 │
│  │ reports  │ │ messages   │ │            │                 │
│  └──────────┘ └────────────┘ └────────────┘                 │
│                                                             │
│  RLS: app_users locked, leads anon SELECT (realtime)        │
│  Realtime: leads (INSERT + UPDATE events)                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 تدفق البيانات (Data Flow)

```
                    ┌──────────────┐
                    │  المستخدم    │
                    │  يفتح الصفحة │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  hydrateAuth │ ← localStorage (venom-auth)
                    │  (فوري)      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐ ┌─────▼────┐ ┌────▼─────────┐
     │ Phase 1    │ │ validate │ │ apiGetTeam   │
     │ GET leads  │ │ Session  │ │ + permissions│
     │ ?page=1    │ │ (bg)     │ │              │
     │ &limit=200 │ │          │ │              │
     └────────┬───┘ └──────────┘ └──────┬───────┘
              │                         │
     ┌────────▼─────────────────────────▼───────┐
     │        setLeads(200) + setTeam +         │
     │        setDataLoaded(true)               │
     │        ← UI يعرض فوراً (<1s)              │
     └────────┬─────────────────────────────────┘
              │
     ┌────────▼───────────────────┐
     │ Phase 2 (background)       │
     │ GET leads?page=2&limit=500 │
     │ → batchAddLeadsToCache()   │
     │ ←Stats تتحدث تلقائياً       │
     └────────────────────────────┘
              │
     ┌────────▼───────────────────┐
     │ Realtime Subscription      │
     │ INSERT → addLeadToCache    │
     │ UPDATE → updateLeadInCache │
     │   (with null guard)        │
     │ (50ms debounce non-priority│
     │  + immediate for priority) │
     └────────────────────────────┘
              │
     ┌────────▼───────────────────┐
     │ Session Validation         │
     │ كل 5 دقايق → validateSession│
     │ لو invalid → logout        │
     └────────────────────────────┘
```

### 2.3 تدفق التعديلات (Edit Flow)

```
                    ┌──────────────┐
                    │  المستخدم    │
                    │  يعدّل حقل   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ oldLead =    │ ← حفظ الحالة القديمة
                    │ leads.find() │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ updateLead   │ ← Optimistic update (فوري)
                    │ InCache()    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ apiUpdateLead│ ← POST /api/leads
                    │ (await)      │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   نجاح؟      │
                    └──────┬───────┘
                     ┌─────┴─────┐
                     │           │
                ┌────▼───┐  ┌───▼────────┐
                │  نعم   │  │    لا      │
                │        │  │            │
                │  ✅    │  │ 401?       │
                │  تم    │  │ ├─نعم→     │
                │ الحفظ  │  │ │ rollback │
                └────────┘  │ │ + logout │
                            │ └─لا→      │
                            │   rollback │
                            │   + toast  │
                            └────────────┘
```

### 2.4 تدفق الكاش (Cache Layers)

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: Vercel Edge Cache                          │
│                                                     │
│  GET /api/leads?page=1&limit=200                    │
│  Cache-Control: public, s-maxage=30, swr=120       │
│                                                     │
│  → أول request: يـ hit origin (Supabase)            │
│  → باقي requests خلال 30s: edge cache HIT (0 origin)│
│  → بعد 30s: stale-while-revalidate (يـ serve قديم    │
│    + يجيب جديد في الخلفية)                           │
│  → بعد 120s: cache miss → يـ hit origin              │
└──────────────────────┬──────────────────────────────┘
                       │ (cache miss)
┌──────────────────────▼──────────────────────────────┐
│ Layer 2: In-Memory Cache (api-cache.ts)             │
│                                                     │
│  TTL: 30s (leads + stats)                           │
│  → نفس الـ instance: cache HIT (0 Supabase)         │
│  → instance مختلف: cache miss → Supabase            │
│  → invalidated على أي write operation              │
└──────────────────────┬──────────────────────────────┘
                       │ (cache miss)
┌──────────────────────▼──────────────────────────────┐
│ Layer 3: Supabase (PostgreSQL)                      │
│                                                     │
│  → SELECT with pagination (.range(from, to))        │
│  → ORDER BY created_at DESC, id DESC                │
│  → 23 columns (removed 3 dead columns)              │
└─────────────────────────────────────────────────────┘
```

---

## 3. خريطة الصفحات (View Router)

```
┌─────────────────────────────────────────────────────────────┐
│                    ViewName → Component                      │
├──────────────────┬────────────────────┬──────────────────────┤
│ ViewName         │ Component          │ الأدوار المسموح       │
├──────────────────┼────────────────────┼──────────────────────┤
│ login            │ LoginScreen        │ الكل (قبل الدخول)     │
│ dashboard        │ Dashboard          │ tele, sales, admin    │
│ employee-profile │ EmployeeProfile    │ tele, sales, admin    │
│ my-sheet         │ TeleSheet          │ tele, admin           │
│ sales-sheet      │ SalesSheet         │ sales, admin          │
│ my-meetings      │ MyMeetings         │ tele, sales, admin    │
│ follow-up        │ FollowUpSection    │ sales, admin          │
│ transfers        │ TransfersPage      │ tele                  │
│ my-archive       │ MyArchive          │ tele, sales, admin    │
│ daily-report     │ DailyReport        │ tele, sales, admin    │
│ bulk-add         │ BulkAdd            │ tele, sales, admin    │
│ admin            │ AdminPanel         │ admin                 │
└──────────────────┴────────────────────┴──────────────────────┘
```

### 3.1 Sidebar Navigation

```
الرئيسية (dashboard)          ← tele, sales, admin
صفحتي (employee-profile)      ← tele, sales, admin
شيت التيلي (my-sheet)         ← tele, admin
شيت السيلز (sales-sheet)      ← sales, admin
اجتماعات التلي (my-meetings)  ← tele, sales, admin
Follow-Up (follow-up)         ← sales, admin
التحويلات (transfers)         ← tele
أرشيفي (my-archive)           ← tele, sales, admin
تقرير يومي (daily-report)     ← tele, sales, admin
إضافة ليدز (bulk-add)         ← tele, sales, admin
لوحة التحكم (admin)           ← admin
```

---

## 4. خريطة قاعدة البيانات (DB Schema)

```
┌─────────────────────────────────────────────────────────────┐
│                         leads                               │
├──────────────────┬────────────┬─────────────────────────────┤
│ Column           │ Type       │ Description                 │
├──────────────────┼────────────┼─────────────────────────────┤
│ id               │ BIGSERIAL  │ PK                          │
│ store_url        │ TEXT       │ لينك المتجر                  │
│ phone            │ TEXT       │ رقم الجوال                   │
│ customer_name    │ TEXT       │ اسم العميل                   │
│ brief            │ TEXT       │ البريف                      │
│ contact_result   │ TEXT       │ نتيجة التواصل                │
│ contact_result_at│ TIMESTAMPTZ│ وقت التواصل                  │
│ tele_name        │ TEXT       │ اسم التلي                    │
│ sales_name       │ TEXT       │ اسم السيلز                   │
│ meeting_date     │ TEXT       │ تاريخ الاجتماع (YYYY-MM-DD)  │
│ meeting_time     │ TEXT       │ وقت الاجتماع (HH:MM)        │
│ meeting_type     │ TEXT       │ online/offline              │
│ meeting_link     │ TEXT       │ رابط الاجتماع                │
│ status           │ TEXT       │ meeting, followup-1/2/3,    │
│                  │            │ closed-won, not-interested  │
│ sales_status     │ TEXT       │ closed-won أو ملاحظات حرة    │
│ attended         │ TEXT       │ attended, no-show, pending  │
│ attendance_marked_at│TIMESTAMPTZ│ وقت تعليم الحضور           │
│ attendance_marked_by│TEXT     │ من علّم الحضور               │
│ assigned_at      │ TIMESTAMPTZ│ وقت التحويل/الحجز            │
│ created_at       │ TIMESTAMPTZ│ وقت الإنشاء                  │
│ is_archived      │ BOOLEAN    │ مؤرشف؟                      │
│ archived_at      │ TIMESTAMPTZ│ وقت الأرشفة                 │
│ archived_by      │ TEXT       │ من أرشف                      │
└──────────────────┴────────────┴─────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│    team_members       │  │      app_users        │
├──────────┬────────────┤  ├──────────┬────────────┤
│ id       │ BIGSERIAL  │  │ id       │ BIGSERIAL  │
│ name     │ TEXT       │  │ username │ TEXT (UQ)  │
│ role     │ tele/sales/│  │ password │ TEXT       │
│          │ admin     │  │ _hash    │            │
│ is_active│ BOOLEAN    │  │ display  │ TEXT       │
│ created_at│TIMESTAMPTZ│  │ role     │ tele/sales/│
│          │            │  │          │ admin     │
│          │            │  │ is_active│ BOOLEAN    │
└──────────┴────────────┘  └──────────┴────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│  access_permissions   │  │    notifications      │
├──────────┬────────────┤  ├──────────┬────────────┤
│ viewer   │ TEXT       │  │ target   │ TEXT       │
│ target   │ TEXT       │  │ role     │ TEXT       │
│ role     │ tele/sales │  │ type     │ TEXT       │
│ is_active│ BOOLEAN    │  │ message  │ TEXT       │
│          │            │  │ lead_id  │ BIGINT     │
│          │            │  │ read_at  │ TIMESTAMPTZ│
└──────────┴────────────┘  └──────────┴────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│     transfers         │  │     audit_log         │
├──────────┬────────────┤  ├──────────┬────────────┤
│ lead_id  │ BIGINT     │  │ actor    │ TEXT       │
│ from_name│ TEXT       │  │ action   │ TEXT       │
│ to_name  │ TEXT       │  │ target   │ TEXT       │
│ from_role│ TEXT       │  │ metadata │ JSONB      │
│ to_role  │ TEXT       │  │ created  │ TIMESTAMPTZ│
│ transferr│ TIMESTAMPTZ│  │          │            │
│ ed_at    │            │  │          │            │
└──────────┴────────────┘  └──────────┴────────────┘
```

---

## 5. خريطة الـ API

```
┌──────────────────────────────────────────────────────────────┐
│                      API Routes Map                          │
├────────────────────┬──────────┬──────────┬───────────────────┤
│ Route              │ Method   │ Auth     │ Operations        │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/leads         │ GET      │ paginated│ Read leads        │
│                    │          │  (anon)  │ (page+limit)      │
│                    ├──────────┼──────────┼───────────────────┤
│                    │ POST     │ requireAuth│ 17 operations:  │
│                    │          │          │ create, bulkCreate│
│                    │          │          │ update, delete    │
│                    │          │          │ bulkDelete, archive│
│                    │          │          │ addNote, etc.     │
│                    │          │ +admin for│ addTeamMember    │
│                    │          │ team ops │ removeTeamMember  │
│                    │          │          │ renameTeamMember  │
│                    │          │          │ saveAccessPerms   │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/auth          │ POST     │ mixed    │ login (anon)      │
│                    │          │          │ validate (anon)   │
│                    │          │          │ change-pw (auth)  │
│                    │          │ +admin   │ create-user       │
│                    │          │          │ list-users        │
│                    │          │          │ toggle-user       │
│                    │          │          │ reset-password    │
│                    │          │          │ delete-user       │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/meetings      │ GET      │ auth     │ List meetings     │
│                    │ PATCH    │ auth+own │ Mark attendance   │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/team          │ GET      │ auth     │ List team members │
│                    │ POST     │ admin    │ Add/remove/rename │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/ai            │ POST     │ auth     │ 5 analysis types   │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/notifications │ GET      │ auth     │ List notifications│
│                    │ POST     │ auth     │ Create            │
│                    │ PATCH    │ auth     │ Mark read         │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/transfers     │ GET      │ auth     │ List transfers    │
│                    │ POST     │ auth     │ Create transfer   │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/daily-reports │ GET      │ auth     │ List reports      │
│                    │ POST     │ auth     │ Submit report     │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/audit-log     │ GET      │ admin    │ Read audit log    │
│                    │ POST     │ admin    │ Write audit event │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/duplicates    │ GET      │ admin    │ Duplicate report  │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/stats         │ GET      │ auth     │ Aggregate stats   │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/seed          │ POST     │ admin    │ Seed DB           │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/sheets-sync   │ POST     │ secret   │ Google Sheets     │
├────────────────────┼──────────┼──────────┼───────────────────┤
│ /api/cleanup-*     │ POST     │ admin    │ Maintenance       │
│ /api/fix-*         │ POST     │ admin    │ Data repair       │
│ /api/diagnose-*    │ GET/POST │ admin    │ Diagnostics       │
└────────────────────┴──────────┴──────────┴───────────────────┘
```

---

## 6. خريطة الـ Realtime

```
┌──────────────────────────────────────────────────────────────┐
│                   Realtime Subscription                       │
│                                                              │
│  Channel: 'leads_changes'                                    │
│  Events: INSERT + UPDATE (DELETE removed for egress)        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  INSERT event                                        │   │
│  │  → addLeadToCache(newLead)                          │   │
│  │  → dedup by id (skip if already in store)           │   │
│  │  → addNotification('new-lead')                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  UPDATE event                                        │   │
│  │  → check priority fields (attended, sales_name,     │   │
│  │    sales_status, assigned_at, is_archived)           │   │
│  │    → if priority changed: fire IMMEDIATELY           │   │
│  │    → if non-priority: debounce 50ms                  │   │
│  │  → build updates object (only fields in payload)     │   │
│  │  → NULL GUARD: skip null if current value is non-null│   │
│  │  → updateLeadInCache(id, updates)                   │   │
│  │  → check for attendance/transfer notifications       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Retry: exponential backoff (1s, 2s, 4s, 8s, max 30s)      │
│  Debounce: Map<leadId, Timer> with LRU cap (1000)           │
│  Batch: 100ms flush timer (applied before unsubscribing)    │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. خريطة الأمان (Security Map)

```
┌──────────────────────────────────────────────────────────────┐
│                     Security Layers                          │
│                                                              │
│  Layer 1: Session Token (HMAC-SHA256)                        │
│  ├── Payload: { uid, uname, role, iat, exp }                │
│  ├── TTL: 7 days                                            │
│  ├── Secret: SESSION_HMAC_SECRET (fallback: SERVICE_ROLE)   │
│  └── Stored: localStorage 'venom-session' + Zustand persist │
│                                                              │
│  Layer 2: API Route Guards                                   │
│  ├── requireAuth: كل الـ routes (except paginated GET)       │
│  ├── requireAdmin: team ops, user management, audit          │
│  └── Ownership: /api/meetings PATCH (lead owner or admin)  │
│                                                              │
│  Layer 3: RLS (Row-Level Security)                           │
│  ├── app_users: REVOKE ALL (service role only)              │
│  ├── leads: anon SELECT (for realtime), auth writes         │
│  ├── lead_notes: authenticated only (anon SELECT dropped)   │
│  └── Other tables: authenticated only                       │
│                                                              │
│  Layer 4: Session Protection (Client-side)                   │
│  ├── validateSession كل 5 دقايق                              │
│  ├── 401 → rollback optimistic update + logout              │
│  └── Periodic check prevents stale session edits            │
│                                                              │
│  Layer 5: Data Protection                                    │
│  ├── Optimistic update rollback on ANY error                │
│  ├── Realtime null guard (don't wipe fields with null)      │
│  ├── Phase 2 merge guard (batchAdd, not setLeads)           │
│  └── Password: bcrypt (with legacy SHA-256 auto-upgrade)    │
└──────────────────────────────────────────────────────────────┘
```
