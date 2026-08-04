# Lead Replay Investigation — Single Lead, Full Execution Trace

**Phase:** Audit — Single-Lead Replay
**Status:** Read-only research. No code, schema, or configuration was modified to produce this document.
**Method note:** No live database or production session was available to this investigation. The **field values** below (customer name, phone, store URL, account names) are a synthetic example constructed for this replay so a concrete trace can be shown. The **execution path, function calls, object shapes, and transformation logic at every step are not synthetic** — each is quoted or paraphrased directly from the current repository source, with file:line citations, and reflects this session's already-committed fixes (`632a814`, `0f1992e`, `6c2c73c`, `d3d6328`). Nothing about "what the code does" in this document is inferred or guessed.

---

## 0. The Selected Lead

| Field | Value used for this replay |
|---|---|
| Customer name | "أحمد للتجارة" |
| Phone (as pasted) | `0512345678` |
| Store URL | `https://ahmed-store.sa` |
| Brief | *(left empty)* |
| Entry point | `bulk-add.tsx` ("إضافة ليدز" page), pasted as one row among a small batch |
| Creating account | role `sales`, `username = "sara_sales"`, `display_name = "Sara Ahmed"`, freshly logged in (a session token issued under the **current**, already-fixed `POST /api/auth` login handler) |

Because this session is freshly issued under current code, `session.uname` is populated from `user.display_name` (`src/app/api/auth/route.ts:88-99`, this session's commit `632a814`), i.e. `session.uname = "Sara Ahmed"`. The client's `currentUser` (Zustand store) is also `"Sara Ahmed"` (`src/components/crm/login-screen.tsx:67`, `data.user.displayName`). **These two identities are equal for this replay** — this is stated explicitly because §1.5 of `docs/DATA_VISIBILITY_INVESTIGATION.md` establishes that when they are *not* equal, the lead is hidden; this replay shows the mainline case where the fix already applies, and a second, separately-labeled replay in §12 shows a still-current disappearance mechanism unrelated to that fix.

---

## 1. User Clicks Import

**File:** `src/components/crm/bulk-add.tsx`
**Function:** the paste/file-import handlers that populate `rows` state (e.g. the paste handler around `bulk-add.tsx:680-696`, `newRows` construction), followed by the "حفظ"/submit button's `onClick={handleSubmit}` (`bulk-add.tsx:708`).

**Input:** the raw pasted text/row containing the three field values in §0, arriving into a new `BulkRow` object:
```ts
{
  id: 'file-1' /* or 'paste-1', synthetic counter */,
  storeUrl: 'https://ahmed-store.sa',
  phone: '0512345678',
  customerName: 'أحمد للتجارة',
  customerType: 'business',       // bulk-add.tsx:685: isTele ? '' : 'business' — role is 'sales', so 'business'
  brief: '',
  tele: '',                        // bulk-add.tsx:687: isTele ? (currentUser||'') : '' — role is 'sales', so ''
  sales: 'Sara Ahmed',             // bulk-add.tsx:688: currentRole==='sales' && currentUser ? currentUser : ''
  status: null,
  errors: [],
  included: true,
  isDuplicate: false,
}
```
**Output:** this object is appended to component state: `setRows((prev) => [...prev, ...newRows])` (`bulk-add.tsx:695`).

**Data before:** `rows` state array does not contain this row.
**Data after:** `rows` state array contains this `BulkRow` object.

**Objects:** `BulkRow` (`bulk-add.tsx:27-40`).
**State changes:** React component state `rows` (`useState<BulkRow[]>`) gains one element. No network call yet, no Zustand store change yet.

---

## 2. Validation

**File:** `src/components/crm/bulk-add.tsx`
**Function:** `validateRow(row: BulkRow): string[]` (`bulk-add.tsx:434-446`).

**Input:** the `BulkRow` from §1.
**Logic executed:**
```ts
const hasPhone = row.phone.trim().length >= 8   // '0512345678'.trim().length === 10 → true
const hasUrl = row.storeUrl.trim().length > 0   // true
if (!hasPhone && !hasUrl) errors.push(...)      // not reached — hasPhone is true
if (hasPhone && row.phone.trim().length < 8 && row.phone.trim().length > 0) errors.push(...) // not reached — length is 10, not < 8
```
**Output:** `errors: []` (empty array — this row is valid).

**Data before:** `row.errors = []` (initial state from §1).
**Data after:** `row.errors = []` (unchanged — validation passed). This function is invoked again at submit time (`bulk-add.tsx:713-716`, `validatedRows = includedRows.map((r) => ({ ...r, errors: validateRow(r) }))`) with the same result.

**State changes:** none observable — validation only annotates `errors`; for this row it stays empty, so `hasErrors` (`bulk-add.tsx:718`) is `false` and submission is not blocked.

---

## 3. Duplicate Detection

Two independent checks run, per this session's commit `d3d6328`.

### 3a. Client-side, instant (`existingPhoneSet`)

**File:** `src/components/crm/bulk-add.tsx`
**Function:** `existingPhoneSet` useMemo (`bulk-add.tsx:449-462`).
**Input:** the Zustand store's `leads` array (whatever is currently loaded in this browser tab).
**Logic:** `normalizePhone('0512345678')` — traced through `src/lib/crm-utils.ts:18-27`: does not start with `+966`/`00966`/`966`; starts with `'05'` and length ≥ 10 → returns `'+966' + p.substring(1)` = `'+966512345678'`. This normalized value is checked against every already-loaded lead's normalized phone.
**Output (assumed for this replay):** no match — this is a genuinely new phone number. `existingPhoneSet.has('+966512345678') === false`.

### 3b. Server-side, debounced, authoritative (`serverDuplicatePhones`)

**File:** `src/components/crm/bulk-add.tsx`
**Function:** the `useEffect` at `bulk-add.tsx:465-489` (this session's commit `d3d6328`), calling `apiCheckDuplicatePhones(['0512345678'])` (`src/lib/supabase.ts:518-527`) 400ms after the last `rows` change.
**Execution path:** `apiCheckDuplicatePhones` → `serverOp('checkDuplicatePhones', phones)` (`supabase.ts:80-103`) → `POST /api/leads {operation:'checkDuplicatePhones', data:['0512345678']}` → `requireAuth` (`route.ts:366-370`) → `case 'checkDuplicatePhones'` (`route.ts:991-1072`, now shifted further down file by this session's earlier `bulkCreate` edits but logic unchanged) → normalizes, generates phone variants (`generatePhoneVariants('0512345678')`, `src/lib/crm-utils.ts:37-60`, producing `['0512345678', '+966512345678', '512345678', '0512345678', '966512345678', '00966512345678']`-shaped set) → `client.from('leads').select('id,phone,tele_name,sales_name').eq('is_archived', false).in('phone', variantsBatch)`.
**Output (assumed for this replay):** no existing row matches any variant → `{ duplicates: {} }` → `apiCheckDuplicatePhones` returns `{}` → `setServerDuplicatePhones(new Set())` (`bulk-add.tsx:485`).

**Data before:** `row.isDuplicate` (via `rowsWithDuplicates`, `bulk-add.tsx:497-520`) evaluates `isExisting = existingPhoneSet.has(norm) || serverDuplicatePhones.has(norm)` = `false || false` = `false`; `isIntraDupe` = `false` (only one row with this phone in the current paste). `isDuplicate = false`.
**Data after:** unchanged, `isDuplicate = false`. The row is not shown with the amber "Duplicate" badge (`bulk-add.tsx:1160,1167`).

**State changes:** `serverDuplicatePhones` React state set to an empty `Set`. No Zustand store change. No database write yet.

---

## 4. Bulk Create

**File:** `src/components/crm/bulk-add.tsx`
**Function:** `handleSubmit` (`bulk-add.tsx:708-780`).

**Input:** `validatedRows` (this row, with `errors: []`, `included: true`).
**Transformation** (`bulk-add.tsx:738-748`):
```ts
const leadsToCreate: Partial<Lead>[] = validatedRows.map((r) => ({
  storeUrl: r.storeUrl || undefined,        // 'https://ahmed-store.sa'
  phone: r.phone || undefined,              // '0512345678'
  customerName: r.customerName || undefined,// 'أحمد للتجارة'
  customerType: r.customerType,             // 'business'
  brief: r.brief,                           // ''
  tele: isTele ? currentUser! : r.tele,     // role is 'sales' → r.tele → ''
  sales: r.sales || null,                   // 'Sara Ahmed'
  status: r.status || '',                   // ''
  contactResult: '',
}))
```
**Output:** `leadsToCreate = [{ storeUrl: 'https://ahmed-store.sa', phone: '0512345678', customerName: 'أحمد للتجارة', customerType: 'business', brief: '', tele: '', sales: 'Sara Ahmed', status: '', contactResult: '' }]`.

**Call:** `const { data: created, duplicateWarnings } = await apiBulkCreateLeads(leadsToCreate)` (`bulk-add.tsx:785`, this session's commit `d3d6328`).

**File:** `src/lib/supabase.ts`
**Function:** `apiBulkCreateLeads` (`supabase.ts:491-517`).
**Execution:** `fetch('/api/leads', { method:'POST', headers: authHeaders(), body: JSON.stringify({ operation:'bulkCreate', data: leadsToCreate }) })`. `authHeaders()` (`supabase.ts:70-78`) reads the session token from `localStorage.getItem('venom-session')` and attaches `Authorization: Bearer <token>`.

**Objects:** `BulkRow` → `Partial<Lead>` (client shape) is the object crossing the network boundary.
**State changes:** none in the client store yet — this is purely the outbound HTTP request construction.

---

## 5. Database INSERT

**File:** `src/app/api/leads/route.ts`
**Function:** `case 'bulkCreate'` (`route.ts:475` onward, this session's commit `d3d6328` inserted the DB-existing-duplicate check but did not change the insert logic itself).

**Step 5.1 — Auth:** `requireAuth(request)` (`route.ts:366-370`) verifies the bearer token via `verifySessionToken` (`src/lib/session.ts:105-148`), returning `session = { uid: <app_users.id>, uname: 'Sara Ahmed', role: 'sales', iat, exp }`.

**Step 5.2 — Ownership force-assignment:**
```ts
if (session.role !== 'admin') {
  for (const lead of leads) {
    if (session.role === 'tele') lead.tele = session.uname
    if (session.role === 'sales') lead.sales = session.uname
  }
}
```
(`route.ts:485-490`.) `session.role === 'sales'` → `lead.sales = 'Sara Ahmed'`. **Data before:** `lead.sales = 'Sara Ahmed'` (already, from §4's client-side assignment). **Data after:** `lead.sales = 'Sara Ahmed'` (unchanged — the client-sent value and the server-forced value are identical in this replay, because `currentUser` and `session.uname` are the same string per §0). This is the exact point where, if this account's `username != display_name`, the value would instead become `session.uname` = the login username, diverging from what every client-side filter later compares against (`docs/DATA_VISIBILITY_INVESTIGATION.md` §1.5) — **not the case in this replay**, stated here only to mark the precise line where that divergence would occur if it were.

**Step 5.3 — Intra-batch duplicate check** (`route.ts:492-511`): only one row, `seenPhones` starts empty, no match — `duplicateWarnings = []`.

**Step 5.4 — DB-existing duplicate check** (`route.ts:518-575`, added by commit `d3d6328`): queries `leads` for `phone IN (<variants>)` — matches §3b's assumption of no existing row — `duplicateWarnings` remains `[]`.

**Step 5.5 — Insert:**
```ts
const dbData = { ...leadToDb(lead), created_at: new Date(rowTime).toISOString() }
```
`leadToDb()` (`route.ts:52-81`):
```ts
{
  store_url: 'https://ahmed-store.sa',
  phone: '0512345678',
  customer_name: 'أحمد للتجارة',
  customer_type: 'business',
  brief: null,                    // '' || null → null
  contact_result: null,           // '' || null → null
  contact_result_at: null,        // no contactResult, no contactResultAt
  tele_name: null,                // '' || null → null
  sales_name: 'Sara Ahmed',
  meeting_date: null,             // safeDate(undefined) → null
  meeting_time: null,
  meeting_type: null,
  meeting_link: null,
  status: null,                   // '' || null → null
  sales_status: null,
  attended: null,                 // undefined === undefined → null
  attendance_marked_at: null,
  attendance_marked_by: null,
  cancelled_from: null,
  cancelled_at: null,
  assigned_at: null,
  is_archived: false,             // undefined || false → false
  archived_at: null,
  archived_by: null,
}
```
plus `created_at` set to the synthetic single-row batch timestamp (`baseTime - 0`, i.e. "now", since this is the only/first row — `route.ts:526,535,538`).

**SQL statement executed:** `INSERT INTO leads (store_url, phone, customer_name, ..., created_at) VALUES (...) RETURNING *` via `client.from('leads').insert(dbData).select()` (`route.ts:541`).

**Data before (database):** no row with this phone exists.
**Data after (database):** one new row exists, e.g. `id = 10741` (illustrative — the actual `BIGSERIAL` value depends on the live sequence, which this investigation cannot query), with the column values enumerated above, `is_archived = false`.

**Objects:** `DbLead` (snake_case row shape, `src/app/api/leads/route.ts` implicit via Supabase's typed response, cross-referenced with `src/lib/crm-utils.ts:237-264`).

---

## 6. API Response

**File:** `src/app/api/leads/route.ts`
**Function:** end of `case 'bulkCreate'` (`route.ts:572-582`).

**Transformation:** `allCreated` (array of raw DB rows) → `allCreated.map(leadFromDb)` (`route.ts:16-50`):
```ts
{
  id: '10741',
  storeUrl: 'https://ahmed-store.sa',
  phone: '0512345678',
  customerName: 'أحمد للتجارة',
  brief: '',
  contactResult: '',
  contactResultAt: null,
  tele: '',
  sales: 'Sara Ahmed',
  meetingDate: '', meetingTime: '', meetingType: '', meetingLink: '',
  status: null, salesStatus: null,
  attended: null, attendanceMarkedAt: null, attendanceMarkedBy: null,
  cancelledFrom: null, cancelledAt: null,
  createdAt: <ms epoch for the insert instant>,
  assignedAt: null,
  isArchived: false, archivedAt: null, archivedBy: null,
  notes: [],
}
```
**Response body:** `success({ data: [<above object>], duplicateWarnings: [] })` (`route.ts:581`). `success()` (`route.ts:389-392`) checks `WRITE_OPERATIONS.has('bulkCreate')` — **true** (`route.ts:9-14`, `'bulkCreate'` is listed) — and calls `invalidateAllCaches()` (`src/lib/api-cache.ts:118-122`) **before** returning, clearing `statsCache` and every entry of `leadsCacheMap` on this serverless instance.

**HTTP status:** 200.

**Data before (server in-memory cache):** whatever `leadsCacheMap`/`statsCache` entries existed from prior `GET` requests on this instance.
**Data after:** both cleared (empty).

---

## 7. Store Update

**File:** `src/components/crm/bulk-add.tsx` → `src/lib/store.ts`
**Function:** `bulk-add.tsx:786-790` receives `{ data: created, duplicateWarnings }`; since `created.length > 0`, calls `batchAddLeadsToCache(created)`.

**File:** `src/lib/store.ts`
**Function:** `batchAddLeadsToCache` (`store.ts:464-480`).
```ts
batchAddLeadsToCache: (newLeads) => {
  set((state) => {
    const leadsToAdd = []
    let newLeadsById = { ...state.leadsById }
    for (const lead of newLeads) {
      if (!lead || lead.id == null) continue
      if (lead.id in state.leadsById) continue   // dedup check
      leadsToAdd.push(lead)
      newLeadsById[lead.id] = lead
    }
    if (leadsToAdd.length === 0) return state
    const updatedLeads = [...leadsToAdd, ...state.leads]   // PREPENDED
    return { leads: updatedLeads, leadsById: newLeadsById, leadsVersion: state.leadsVersion + 1 }
  })
}
```
**Input:** `newLeads = [<the Lead object from §6>]`.
**Check:** `'10741' in state.leadsById` — `false` (first time this lead is added to this tab's store) — passes the dedup check.

**Data before:** `state.leads` does not contain id `'10741'`; `state.leadsById['10741']` is `undefined`.
**Data after:** `state.leads = [<lead 10741>, ...previousLeads]` (prepended, newest-first order preserved); `state.leadsById['10741'] = <lead 10741>`; `state.leadsVersion` incremented by 1.

**Objects:** Zustand `CrmStore.leads: Lead[]`, `CrmStore.leadsById: Record<string, Lead>`.
**State changes:** this is the point at which the lead becomes visible to any component subscribed to `useCrmStore((s) => s.leads)` in **this browser tab** — including `sales-sheet.tsx`, whose `filteredLeads` `useMemo` (§10 below) is keyed on `[leads, ...]` and will recompute on the next render.

---

## 8. Realtime Event

**Trigger:** the `INSERT INTO leads` executed in §5.5 fires a `postgres_changes` event on the `supabase_realtime` publication (`leads` is a publication member per `supabase-schema.sql:160-177`).

**File:** `src/app/page.tsx`
**Function:** the `apiSubscribeToLeads` INSERT handler (`page.tsx:416-465`).

**Input:** `payload.new` = the same row inserted in §5.5, delivered via the anon-key realtime channel.
**Execution:**
```ts
const leadId = String(newRow.id)   // '10741'
addLeadToCache({ id: leadId, storeUrl: ..., phone: ..., /* full object built from newRow */, notes: [] })
```
(`page.tsx:419-463`.)

**File:** `src/lib/store.ts`
**Function:** `addLeadToCache` (`store.ts:452-463`):
```ts
addLeadToCache: (lead) => {
  set((state) => {
    if (lead.id in state.leadsById) return state   // dedup — ALREADY TRUE, see below
    ...
  })
}
```

**Data before this call:** `'10741' in state.leadsById` is **already `true`**, because §7 already inserted it (the direct HTTP response from the creating tab's own request arrives and is processed before, or independently of, this realtime echo — both ultimately reach the same store, and whichever arrives first wins the dedup check).
**Data after:** **unchanged** — `addLeadToCache` returns `state` as-is (`store.ts:455`, the `if` short-circuits the `set` call to a no-op).

**Confirms:** for the creating tab, this stage does not add anything new — it is a redundant, deduplicated echo of information the store already has from §7. For any *other* connected tab (a different user's session), this is the **first** time that tab learns of the lead, provided that tab's realtime channel is currently connected (`docs/DATA_VISIBILITY_INVESTIGATION.md` §1.10 — a disconnected channel would mean this event never arrives to that other tab).

---

## 9. Cache

**Server-side (`src/lib/api-cache.ts`):** already invalidated in §6 as a direct effect of the successful `bulkCreate`. The next `GET /api/leads` request (from any tab, including the creating one, if it performs one) will miss the in-memory cache (`isLeadsCacheValid()` returns `false` for every cache key, since `leadsCacheMap` was cleared) and re-query the database directly, which now includes lead `10741`.

**Client-side:** the creating tab does not issue a fresh `GET /api/leads` at all after a bulk-create — §7 already updated the store directly from the mutation response. No cache stage intervenes between §7 and §10 for this tab.

**Data before/after:** covered in §6; no further change at this stage.

---

## 10. Rendering

**File:** `src/components/crm/sales-sheet.tsx`
**Function:** `filteredLeads` `useMemo` (`sales-sheet.tsx:776-816`), then `paginatedLeads` (`sales-sheet.tsx:818-822`), then the table `.map()`.

**Input:** `leads` (from the store, now containing lead `10741`, per §7), `isLockedToSelf = (currentRole === 'sales')` = `true` for this account, `currentUser = 'Sara Ahmed'`, `selectedSales`, `searchQuery = ''` (not yet typed), `dateFilter = { preset: 'all' }` (default), `currentFilter = ''` (no toggle active).

**Execution, in order, for lead `10741`:**
```ts
if (l.isArchived) continue                                    // false — not archived — PASSES
if (isLockedToSelf && l.sales !== currentUser) continue        // 'Sara Ahmed' !== 'Sara Ahmed' → false — PASSES
if (!isLockedToSelf && ...) continue                            // isLockedToSelf is true — this branch skipped
if (q && !(...)) continue                                       // q is '' (falsy) — PASSES
if (dateRange && ...) continue                                  // dateFilter.preset === 'all' → dateRange is null — PASSES
if (l.tele && l.tele.trim() !== '') continue                    // l.tele === '' → false — PASSES (not tele-transferred)
if (currentFilter === 'duplicates') { ... }                     // currentFilter is '' — this branch skipped
result.push(l)                                                  // lead 10741 is added to filteredLeads
```
(Line numbers per `sales-sheet.tsx:789-813`, cross-referenced against the exact block re-read in this investigation.)

**Output:** `filteredLeads` includes lead `10741`. `paginatedLeads` includes it as well, since it is the newest lead (prepended in §7) and therefore first in `filteredLeads`, well within `paginatedLeads = filteredLeads.slice(0, PAGE_SIZE)` (`PAGE_SIZE = 50`) on page 1.

**Data before:** the sales sheet's table did not have a row for "أحمد للتجارة".
**Data after:** the table renders a row for it — `<EditableCell value={lead.phone} .../>` etc. (`sales-sheet.tsx:1203` and neighboring lines) display `0512345678`, `https://ahmed-store.sa`, `أحمد للتجارة`.

**Conclusion for this stage:** the lead is rendered. **It does not disappear here.**

---

## 11. Search

**File:** `src/components/crm/sales-sheet.tsx`
**Trigger:** the user types `0512345678` (or a substring) into the sheet's search box, which calls `setSearchQuery(viewKey, e.target.value)` (store action, `store.ts:667-669`).

**Execution:** `searchQuery` (now `'0512345678'`) flows into the same `useMemo` from §10. The predicate:
```ts
if (q && !(l.customerName?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q) || l.storeUrl?.toLowerCase().includes(q))) continue
```
`l.phone = '0512345678'`, `q = '0512345678'` → `l.phone.toLowerCase().includes(q)` = `true` → the negation is `false` → `continue` is **not** executed → the row **passes** this filter.

**Important, explicitly re-verified per `docs/LEAD_LIFECYCLE_INVESTIGATION.md` §1.11 and `docs/DATA_VISIBILITY_INVESTIGATION.md` §1.7:** this search predicate runs entirely client-side, over the array that already survived §10's ownership/archive/date/tele-transfer filters. No network request is made for this search (`apiGetLeads`/`apiGetLeadsPage1`/`apiGetRemainingLeads` never accept a `search` parameter from any call site — re-confirmed by repository search in this investigation).

**Data before:** search box empty, all of `filteredLeads` (including lead `10741`) shown.
**Data after:** search box contains `'0512345678'`; `filteredLeads` is recomputed and **still contains** lead `10741` (it is, in this synthetic example, the only or one of few rows matching), rendered identically to §10.

**Conclusion for this stage:** the search finds the lead. **It does not disappear here.**

---

## 12. Overall Conclusion for This Replay

**The lead, as replayed under the concrete conditions in §0 (fresh session issued under current code, viewed on the sales rep's own sheet), does not disappear at any stage.** Every step from §1 through §11 was traced with the lead present in the relevant data structure at the "Data after" point, using only logic and object shapes read directly from the current source.

This directly demonstrates, for this specific execution path, that this session's commit `632a814` (aligning `session.uname` with `display_name`) closes the disappearance mechanism that was the dominant finding of `docs/LEAD_LIFECYCLE_INVESTIGATION.md` — **provided the session token was issued after that fix, and the account is viewed on its own sheet.**

### 12.1 Same Lead, Different Search Context — Where It Does Disappear

To fully answer "if the lead disappears, identify the exact step" (not just "under the exact same conditions as the main replay"), the **same lead object** (`id='10741'`, `status=null`, `sales='Sara Ahmed'`, `tele=''`) is now traced into a second, distinct context: the same account navigates to the **Follow-Up** page (`VIEW_PERMISSIONS['follow-up'] = ['sales','admin']`, `src/lib/store.ts:84` — reachable by this `sales`-role account) and searches there instead of on the sales sheet.

**File:** `src/components/crm/follow-up-section.tsx`
**Function:** the `filteredLeads` `useMemo` (`follow-up-section.tsx:205-249`).

**Exact disappearing step:**
```ts
const VALID_FOLLOWUP_STATUSES = new Set(['meeting', 'followup-1', 'followup-2', 'followup-3', CLOSED_WON_KEY])
...
for (const l of leads) {
  if (l.isArchived) continue                                          // false — PASSES
  const hasValidStatus = l.status && VALID_FOLLOWUP_STATUSES.has(l.status)   // l.status is null → hasValidStatus = null (falsy)
  const isOldTeleMeeting = !l.status && !!l.tele && l.tele.trim() !== '' && !!l.meetingDate && l.meetingDate.trim() !== ''
    // !l.status → true; !!l.tele → !!'' → false
    // isOldTeleMeeting = true && false && ... = false
  if (!hasValidStatus && !isOldTeleMeeting) continue                   // !falsy && !false → true && true → true → CONTINUE EXECUTES
  ...
}
```
(`follow-up-section.tsx:216-225`.) **The `continue` on line 225 executes for this lead.** It is never pushed into `result`, never reaches the `q` (search) predicate at `follow-up-section.tsx:229`, and is absent from `filteredLeads`.

**Data before this step:** lead `10741` is present in the store's `leads` array (unchanged from §7 — no write happened between the two replays).
**Data after this step:** lead `10741` is present in `state.leads` (the Zustand store is untouched — this is a *view-local* filter, not a data mutation) but **absent from `follow-up-section.tsx`'s `filteredLeads`, `paginatedLeads`, and therefore absent from what is rendered on that page.**

**Search on this page:** irrelevant — the search predicate at `follow-up-section.tsx:229` is never reached for this lead, because the `continue` at line 225 already excluded it from the loop before the search check runs. Typing `0512345678` into the Follow-Up page's search box returns nothing for this lead, **not because the search logic failed, but because the lead was already removed from consideration two lines earlier by the status filter.**

**Exact step where the lead disappears, stated precisely:** `follow-up-section.tsx:225`, inside the `filteredLeads` `useMemo` (`follow-up-section.tsx:205-249`), the line `if (!hasValidStatus && !isOldTeleMeeting) continue`, evaluated with `l.status === null` and `l.tele === ''`.

---

*End of Lead Replay Investigation. No fixes were proposed or applied. Per the audit workflow, this phase stops here for review.*
