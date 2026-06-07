# 🐍 Venom CRM - دليل النشر على Vercel

## المتطلبات

- حساب GitHub
- حساب Vercel (مجاني)
- مشروع Supabase شغال

---

## خطوات النشر

### 1. رفع الكود على GitHub

```bash
# إنشاء repo جديد أو تحديث القديم
cd venom-crm

# إضافة الملفات
git add .
git commit -m "Venom CRM v11 - Next.js"
git push origin main
```

### 2. إعداد Vercel

1. ادخل على [vercel.com](https://vercel.com)
2. اضغط **"New Project"**
3. اختار الـ GitHub repo
4. الـ Framework هيختار **Next.js** تلقائياً

### 3. إضافة Environment Variables

في صفحة إعدادات المشروع على Vercel، أضف المتغيرات دي:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gopgmisvyvqdbgkfekuf.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (المفتاح الكامل) |

### 4. Deploy!

اضغط **"Deploy"** وهيمسك الباقي 🚀

---

## بعد النشر

- الرابط هيكون: `https://venom-crm.vercel.app`
- كل ماتعمل push على main، هيتم إعادة النشر تلقائياً

---

## هيكل المشروع

```
src/
├── app/
│   ├── page.tsx          # الصفحة الرئيسية
│   ├── layout.tsx        # Layout
│   └── globals.css       # Styles
├── components/
│   ├── crm/              # CRM components
│   │   ├── login-screen.tsx
│   │   ├── dashboard.tsx
│   │   ├── tele-sheet.tsx
│   │   ├── sales-sheet.tsx
│   │   ├── my-meetings.tsx
│   │   ├── sales-meetings.tsx
│   │   ├── customers-status.tsx
│   │   ├── daily-report.tsx
│   │   ├── my-archive.tsx
│   │   ├── bulk-add.tsx
│   │   ├── admin-panel.tsx
│   │   └── telegram-setup.tsx
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── topbar.tsx
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── supabase.ts       # Supabase API
│   ├── store.ts          # Zustand store
│   └── utils.ts          # Utility functions
└── hooks/
    └── use-mobile.ts     # Mobile detection
```

## الجداول المطلوبة في Supabase

### leads
```sql
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  store_url TEXT,
  phone TEXT,
  customer_name TEXT,
  customer_type TEXT,
  brief TEXT,
  contact_result TEXT,
  contact_result_at TIMESTAMPTZ,
  tele_name TEXT,
  sales_name TEXT,
  meeting_date TEXT,
  meeting_time TEXT,
  meeting_type TEXT,
  meeting_link TEXT,
  status TEXT DEFAULT 'new',
  sales_status TEXT,
  attended TEXT,
  attendance_marked_at TIMESTAMPTZ,
  attendance_marked_by TEXT,
  cancelled_from TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  archived_by TEXT
);
```

### lead_notes
```sql
CREATE TABLE lead_notes (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  by_name TEXT,
  category TEXT,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### team_members
```sql
CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE,
  role TEXT CHECK (role IN ('tele', 'sales', 'admin')),
  is_active BOOLEAN DEFAULT TRUE
);
```

### settings
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB
);
```
