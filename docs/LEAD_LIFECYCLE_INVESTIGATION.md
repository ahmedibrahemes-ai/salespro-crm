# Lead Lifecycle Investigation — Production Symptoms

**Phase:** Audit — Symptom-Directed Investigation
**Status:** Read-only research. No code, schema, or configuration was modified to produce this document.
**Rule applied throughout:** every claim is anchored to a specific file and line, quoted or paraphrased directly from the source. No probability, severity, or root-cause ranking is assigned. Where the repository does not contain enough information to answer a question (in particular, anything about the actual state of production data, which this investigation has no access to), the text says so explicitly: **"Insufficient evidence."**

---

## 0. Symptoms Under Investigation

1. A new lead is imported. The UI reports success. The lead does not appear anywhere.
2. Importing the same lead again reports "Duplicate." Searching by phone finds nothing.
3. Existing lead fields sometimes disappear. Observed fields: Phone, Store URL, Customer Status, Notes.

---

## 1. Complete Lifecycle Trace (Import → Searchable)

### 1.1 UI (entry points)

Three distinct UI entry points create leads. All were located by tracing every call site of `apiCreateLead` and `apiBulkCreateLeads` (`src/lib/supabase.ts:433-445`) across `src/components`:

| Entry point | File | Function | Client function called |
|---|---|---|---|
| Single-row "+ إضافة" (tele sheet) | `src/components/crm/tele-sheet.tsx:1269-1310` | `handleAddLead` | `apiCreateLead` |
| Single-row "+ إضافة" (sales sheet) | `src/components/crm/sales-sheet.tsx:901-...` | `handleAddLead` | `apiCreateLead` |
| Quick Paste dialog (tele sheet) | `src/components/crm/tele-sheet.tsx:596-...` (component `QuickPasteDialog`), submit at `tele-sheet.tsx:754` | internal submit handler | `apiBulkCreateLeads` |
| Quick Paste dialog (sales sheet) | `src/components/crm/sales-sheet.tsx:416-...` (component `QuickPasteDialog`), submit at `sales-sheet.tsx:513` | internal submit handler | `apiBulkCreateLeads` |
| Bulk import page ("إضافة ليدز") | `src/components/crm/bulk-add.tsx:708-780` | `handleSubmit` | `apiBulkCreateLeads` |
| Google Sheets webhook | `src/app/api/sheets-sync/route.ts:45-271` | route handler itself (no client UI) | N/A — server-to-server |

### 1.2 Validation

- **`bulk-add.tsx`**: `validateRow()` (`bulk-add.tsx:434-446`) requires `phone.trim().length >= 8` OR a non-empty `storeUrl`; a phone between 1–7 characters produces a "رقم قصير" (short number) error; a row with neither is flagged `'رقم الجوال أو رابط المتجر مطلوب'`. Rows with errors block `handleSubmit` (`bulk-add.tsx:718-728`, `hasErrors` check).
- **Single-row add** (`tele-sheet.tsx:1270-1273`, `sales-sheet.tsx:902-905`): requires non-empty `customerName` AND non-empty `phone` client-side. No further validation.
- **`QuickPasteDialog`**: not separately re-verified line-by-line in this document beyond its shared use of `apiBulkCreateLeads`; its row-building logic mirrors `bulk-add.tsx`'s duplicate/validation pattern per the grep evidence in §1.1.
- **Server-side, `create`/`bulkCreate`** (`src/app/api/leads/route.ts:395-473`, `:475-581`): no field-level validation exists in either case beyond `bulkCreate`'s `leads.length > 500` cap (`route.ts:481-483`). Empty/malformed `phone`, `storeUrl`, or `customerName` values are accepted and inserted as-is (mapped through `leadToDb()`, `route.ts:52-81`, which converts falsy values to `null`).

### 1.3 Duplicate Detection

Two entirely separate, non-communicating duplicate-detection mechanisms exist:

**(a) Client-side, pre-submit (`bulk-add.tsx`):**
```
const existingPhoneSet = useMemo(() => {
  const s = new Set<string>()
  for (const l of leads) {              // <-- the Zustand store's `leads` array
    if (l.phone) {
      const norm = normalizePhone(l.phone)
      if (norm) s.add(norm)
    }
  }
  return s
}, [leads])
```
(`bulk-add.tsx:449-458`.) This is built exclusively from the client's already-loaded `leads` array in the Zustand store — **no server round-trip occurs**. `rowsWithDuplicates` (`bulk-add.tsx:461-482`) marks a pasted row `isDuplicate: true` if its normalized phone is in `existingPhoneSet` (`isExisting`) or repeats within the same paste batch (`isIntraDupe`). This drives the amber "Duplicate" badge shown to the user during import, and the "duplicateCount" summary (`bulk-add.tsx:490-494`).

Critically: `leads` (the array this check reads) is populated by `apiGetLeadsPage1`/`apiGetRemainingLeads` (`src/app/page.tsx:318-375`), which fetch **all non-archived leads regardless of `tele_name`/`sales_name`** — `GET /api/leads` has no owner filter (`route.ts:186-362`, the only filters applied are `is_archived`, `archived_only`, and pagination). So `existingPhoneSet` legitimately contains phone numbers belonging to **any** team member's leads, not just the importing user's own.

**(b) Server-side, at insert time (`create`/`bulkCreate`):**
```
// case 'create' (route.ts:403-427):
const phone = data?.phone as string | undefined
let duplicateWarning: {...} | null = null
if (phone && phone.trim()) {
  const norm = normalizePhone(phone)
  if (norm) {
    const variants = generatePhoneVariants(phone)
    const { data: existing } = await client
      .from('leads')
      .select('id, phone, tele_name, sales_name')
      .eq('is_archived', false)
      .in('phone', variants)
      .limit(1)
    if (existing && existing.length > 0) { duplicateWarning = {...} }
  }
}
```
This query is **also unfiltered by owner** — `.eq('is_archived', false).in('phone', variants)` only, no `tele_name`/`sales_name` condition. The insert proceeds regardless of a match — the code comment states explicitly: *"WARNING only — don't block creation"* (`route.ts:403`). `bulkCreate`'s equivalent (`route.ts:492-515`) is intra-batch only (checks for duplicate phones within the same paste, not against the DB) and is also non-blocking (`route.ts:513-517`, "don't filter/remove any leads").

**Client handling of the server's `duplicateWarning`:** `apiCreateLead()` (`src/lib/supabase.ts:433-439`) calls `serverOp<Lead | null>('create', lead)`. `serverOp()` (`supabase.ts:80-103`) returns `'data' in json ? json.data : json` (`supabase.ts:102`) — this extracts **only** the `data` field from the JSON response `{ data: leadFromDb(lead), duplicateWarning }` (`route.ts:472`). **The `duplicateWarning` value is discarded by the client wrapper and never reaches `handleAddLead` in either sheet.** Neither `tele-sheet.tsx:1279-1310` nor the equivalent in `sales-sheet.tsx` reads a `duplicateWarning` field from the return value of `apiCreateLead`.

### 1.4 Store

- Successful single create: `addLeadToCache(created)` (`tele-sheet.tsx:1291`, and the equivalent in `sales-sheet.tsx`) → `src/lib/store.ts:452-463`, which inserts the lead at the front of `state.leads` only if `lead.id` is not already a key in `state.leadsById` (`store.ts:455`).
- Successful bulk create: `batchAddLeadsToCache(created)` (`bulk-add.tsx:752`, `tele-sheet.tsx:1522` via `handlePasteSaved`, `sales-sheet.tsx` equivalent) → `store.ts:464-480`, same per-id dedup logic, prepending all new leads.
- Fallback path (server returned `null`/empty array — documented in the code as an "RLS read-back" scenario): both `handleAddLead` (`tele-sheet.tsx:1292-1300`) and `bulk-add.tsx:757-765` call `apiGetLeadsPage1()` and feed the result into `batchAddLeadsToCache`.

### 1.5 API Client

`src/lib/supabase.ts`:
- `apiCreateLead` (`:433-439`) → `serverOp('create', lead)`.
- `apiBulkCreateLeads` (`:441-445`) → `serverOp('bulkCreate', leadsArr)`.
- `serverOp()` (`:80-103`) issues `fetch('/api/leads', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ operation, data }) })`. `authHeaders()` (`:70-78`) attaches `Authorization: Bearer <token>` read from `localStorage.getItem('venom-session')`, with a fallback read from the persisted Zustand store (`:47-59`).

### 1.6 API Route

`POST /api/leads` (`route.ts:365-1113`):
1. `const session = await requireAuth(request); if (!session) return unauthorizedResponse()` (`route.ts:366-370`) — every write requires a valid, non-expired session token.
2. `getWriteClient(undefined)` (`route.ts:120-129,372`) — returns the Supabase **service-role** client if `SUPABASE_SERVICE_ROLE_KEY` is configured (`route.ts:121-122`), bypassing RLS entirely; otherwise 500.
3. Dispatch on `operation` via `switch` (`route.ts:394`).

### 1.7 Business Logic (ownership forcing — see §3 for full analysis)

```
case 'create': {                                          // route.ts:395-400
  if (session.role !== 'admin') {
    if (session.role === 'tele') data.tele = session.uname
    if (session.role === 'sales') data.sales = session.uname
  }
```
```
case 'bulkCreate': {                                       // route.ts:475,485-490
  ...
  if (session.role !== 'admin') {
    for (const lead of leads) {
      if (session.role === 'tele') lead.tele = session.uname
      if (session.role === 'sales') lead.sales = session.uname
    }
  }
```
`session.uname` is populated at login time from `user.username` (`src/app/api/auth/route.ts:88-92`, `createSessionToken({ uid: user.id, uname: user.username, role: user.role })`) — **the login username, not the display name.** This overwrite is unconditional for non-admin roles: it replaces whatever `tele`/`sales` value the client already sent (see §3.1 for what the client sends).

### 1.8 Supabase Query / Database

- `create`: `client.from('leads').insert(dbData).select().single()` (`route.ts:430-434`), `dbData` from `leadToDb()` (`route.ts:52-81`) — a **full-object** mapper; every `Lead` field is written, with any falsy client value converted to `null` (e.g. `store_url: lead.storeUrl || null`, `route.ts:56`).
- `bulkCreate`: batched (500 rows/insert, `route.ts:525-571`) `client.from('leads').insert(dbData).select()`; each row's `created_at` is synthetically set to `baseTime - index` rather than left to `DEFAULT NOW()` (`route.ts:526-539`), specifically so that all rows in one batch do not share an identical timestamp (comment at `route.ts:518-524`: "Postgres NOW() evaluates ONCE per INSERT statement, so all rows get the SAME timestamp").
- On error containing `contact_result_at` in the message, `create` retries once with that field stripped (`route.ts:437-449`).
- On `.select().single()` returning `null` with no error ("RLS read-back" scenario, per in-code comments at `route.ts:454-469` and `route.ts:549-569`), a fallback query re-fetches "the just-inserted row" by `ORDER BY created_at DESC LIMIT 1` (single-create) or by a `created_at` time-window (bulk-create). **This fallback has no way to distinguish the current request's insert from a concurrent insert by a different user landing in the same instant** — the query itself contains no session/request identifier, only a time ordering.

### 1.9 Cache

- On success, `invalidateAllCaches()` (`src/lib/api-cache.ts:118-122`) is called for both `create` and `bulkCreate` (`route.ts:389-392`, gated on `WRITE_OPERATIONS.has(operation)`, and both `'create'`/`'bulkCreate'` are present in that set — `route.ts:9-14`). This clears `statsCache` and every entry in `leadsCacheMap` (`api-cache.ts:118-122`).
- `POST /api/sheets-sync` (the webhook entry point) **does not import `src/lib/api-cache.ts`** (verified: no reference to `api-cache`/`invalidateAllCaches` anywhere in `src/app/api/sheets-sync/route.ts`). Leads created via this path are not reflected in the in-memory `leadsCacheMap`/`statsCache` until those caches' own 30-second TTL expires naturally (`api-cache.ts:66,84`).

### 1.10 Realtime

- `leads` is in the `supabase_realtime` publication (`supabase-schema.sql:160-177`). An `INSERT` fires a `postgres_changes` event to every subscribed client, including the one that performed the insert (`src/lib/supabase.ts:946-949`, `config: { broadcast: { self: false } }` — this option affects the separate `broadcast` feature, not `postgres_changes`; no code in `apiSubscribeToLeads` filters out self-originated `postgres_changes` events).
- Handler: `src/app/page.tsx:416-465` (`type === 'INSERT'`). Reads `newRow.id`, builds a full `Lead` object directly from the payload's snake_case fields, and calls `addLeadToCache(...)` (`page.tsx:425-463`) — subject to the same `lead.id in state.leadsById` dedup as §1.4.
- This event is independent of, and in addition to, the direct HTTP response already handled in §1.4/§1.9 — both write to the same store via the same `addLeadToCache`/`batchAddLeadsToCache` functions, whichever arrives first "wins" the dedup check (`store.ts:455,470`) and the second arrival is a no-op.

### 1.11 Search

A repository-wide search for every call site of `apiGetLeads`, `apiGetLeadsPage1`, and `apiGetRemainingLeads` (`src/lib/supabase.ts:324-345,352-378,385-413`) found that **none of the three ever appends a `search` query parameter** — the `search` parameter is only ever set for `apiGetTransfers` (`supabase.ts:647`) and `apiGetMeetings` (`supabase.ts:713`). `GET /api/leads`'s own server-side `search` handling (`route.ts:208`, `sanitizeSearch()` at `route.ts:181-183`, applied via `.or('phone.ilike...')` at `route.ts:274-276`) exists in the route but **is never invoked by any client code path that loads leads.**

Consequently, every "search" experience for leads in this application (tele-sheet `searchQuery`, sales-sheet `searchQuery`, `customers-status.tsx` `searchQuery`, bulk-add's `existingPhoneSet`) is a **client-side, in-memory filter over whatever is already present in the Zustand `leads` array**, applied **after** that same array has already been filtered down by role/ownership rules in the same component. See §3 for the exact filter chains and their order of operations.

### 1.12 Rendering

Once a lead survives every `continue`/filter condition in a component's `useMemo` (traced in full in §3 and §4), it is pushed into a `result` array and rendered via `.map()` in a `<Table>`/card layout. No additional rendering-stage filtering was found beyond the filter chains documented in §3/§4 (i.e., no separate "hide if X" check exists purely at JSX-render time in the files reviewed for this document).

---

## 2. Every Cache Involved

| Cache | Location | Scope | Invalidated by lead create/update? |
|---|---|---|---|
| `leadsCacheMap` | `src/lib/api-cache.ts:83-110` | In-memory, per Vercel serverless instance, keyed by `${includeArchived}\|${archivedOnly}\|${page}\|${limit}\|${search}` | Yes, via `invalidateAllCaches()`, for every operation in `WRITE_OPERATIONS` (`route.ts:9-14`) — see §4.3 for the two named exceptions relevant to this investigation |
| `statsCache` | `api-cache.ts:65-79` | In-memory, per instance | Same as above |
| Browser `fetch` cache / Vercel edge cache | `src/lib/supabase.ts:332-334` sets no `cache:` option (defaults to browser standard caching); `GET /api/leads` sets `Cache-Control: private, no-cache` on every response (`route.ts:224,355`) | N/A | Explicitly disabled — the route's own comment (`route.ts:219-223`) states this was changed from `s-maxage=30` specifically because auth is now required per-request, making edge caching both ineffective and risky |
| Zustand `leads`/`leadsById` (client-side store) | `src/lib/store.ts` | Per browser tab | This is not a "cache" in the invalidation sense — it is authoritative client state, updated only by the explicit actions traced in §1.4/§1.10 |

**No other numeric-column or lead-column cache exists.** `daily_reports`, `transfers`, `notifications`, `team_members`, `app_users`, `access_permissions`, `audit_log` are never cached in `api-cache.ts` (confirmed: that file is imported by exactly `src/app/api/leads/route.ts`, `src/app/api/monitor/route.ts`, `src/app/api/stats/route.ts`).

---

## 3. Symptom 1 & 2 Investigation: "Lead does not appear" / "Duplicate reported but search finds nothing"

These two symptoms are investigated together because every execution path found for one is also a precondition of the other: symptom 2 requires the lead to genuinely exist in the database (proven by the duplicate check finding it) while being invisible to the reporting user (identical precondition to symptom 1).

### 3.1 Finding: server-side ownership override does not match the client-side ownership filter's identity source

**Evidence — what the client sends:**
- `tele-sheet.tsx:1276-1287` (`handleAddLead`): `const teleName = selectedTele === 'all' ? (currentUser || '') : selectedTele` — for a tele-role user (where `isLockedToSelf` forces `selectedTele = currentUser`, `tele-sheet.tsx:1109-1110`), this resolves to `currentUser`.
- `bulk-add.tsx:744`: `tele: isTele ? currentUser! : r.tele` — again, `currentUser` for a tele-role user.
- `currentUser` (the Zustand store field read in both places) is set exactly once, at login: `login(data.user.displayName, data.user.role, data.user.id, data.user.username, data.token)` (`src/components/crm/login-screen.tsx:67`) → `store.ts:368-379` (`login` action) → `set({ currentUser: user, ... })` where the `user` parameter received is `data.user.displayName`. **`currentUser` is the account's display name.**

**Evidence — what the server writes, unconditionally overriding the above:**
- `route.ts:397-399` (single create): `if (session.role === 'tele') data.tele = session.uname`.
- `route.ts:487-489` (bulk create): `if (session.role === 'tele') lead.tele = session.uname` (applied to every row in the batch, in a `for` loop, replacing whatever `tele` value the client sent for every single row).
- `session.uname` originates from `user.username` at login (`auth/route.ts:88-92`, quoted in full in §1.7). **`session.uname` is the account's login username.**
- The identical pattern applies to `sales`/`session.role === 'sales'` on the same lines.

**Evidence — what the client-side "my sheet" filter checks against, immediately after import:**
- `tele-sheet.tsx:1218`: `if (isLockedToSelf && l.tele !== currentUser) continue` — inside the `filteredLeads` `useMemo` (`tele-sheet.tsx:1203-1245`) that produces every row shown in the tele sheet.
- `sales-sheet.tsx:798` (per the earlier full read of this file's filter block): the sales-sheet's equivalent role/ownership filter (`isLockedToSelf`-style check against `currentUser`) is applied inside its own `filteredLeads` computation before the search-query filter runs.
- `customers-status.tsx:76-79`: `if (currentRole === 'tele' && currentUser) { result = result.filter((l) => l.tele === currentUser) }` — same pattern, a third, independent implementation.

**Observed behavior:** for any account where `app_users.username !== app_users.display_name`, a lead created or bulk-imported by a `tele` or `sales` role user is written to the database with `tele_name`/`sales_name` = the account's **username**, while every client-side "leads belonging to me" filter compares the loaded lead's `tele`/`sales` field against the account's **display name**. Under this condition, the newly created lead is excluded by the `continue` statements quoted above in the tele sheet, the sales sheet, and `customers-status.tsx` — three independent, separately-coded filters, all keyed off the same mismatched identity source. Because the lead's row genuinely exists in `leads` with a non-null `tele_name`/`sales_name` (just not matching `currentUser`), the server-side duplicate check (§1.3(b), which queries by `phone` only, with no owner condition) correctly finds and reports it on a second import attempt — while the same account's own sheet, whose search box filters only *within* the already-owner-filtered array (§1.11), shows nothing for that phone number.

**Insufficient evidence:** this investigation has no access to the production `app_users` table and cannot state whether any account in the live deployment actually has `username !== display_name`. The mechanism above is fully evidenced from source code; whether it is currently *triggered* in production is not verifiable from this repository.

### 3.2 Finding: admin role is not subject to §3.1's override, but is subject to a different name-matching condition

For `session.role === 'admin'`, `route.ts:397,487` do not execute — the server inserts whatever `tele`/`sales` value the client sent, unmodified. `admin-panel.tsx`'s `UsersTab.handleCreateUser` (`admin-panel.tsx:786-801`) auto-creates a `team_members` row using `newUser.displayName.trim()` as the `name` (`admin-panel.tsx:791`) — i.e., team membership (and therefore what name appears in the tele/sales dropdowns used to assign ownership) is keyed to **display name**, consistently with the client-side filters in §3.1, for accounts created this way. **Insufficient evidence** on whether every account in the live database was created through this specific flow, or whether some were created by a different, unaudited process where `username` and the `team_members.name` used for assignment could diverge.

### 3.3 Finding: "search finds nothing" is true by construction, independent of §3.1, once a lead is outside a component's already-loaded/filtered set

Independent of the ownership-mismatch mechanism in §3.1, §1.11 establishes as a direct code fact: no search a user performs for a lead is ever sent to the server. If a lead is:
- Owned by a different team member and the searching user's role/ownership filter excludes it (as in §3.1, or simply because it legitimately belongs to a colleague), **or**
- Not yet loaded into the client's `leads` array because Phase 2 background loading (`page.tsx:344-363`, `apiGetRemainingLeads`) has not completed for that session,

then no client-side search box in this application can find it, because none of them query the server — they only filter the array already in memory, which is itself already reduced by ownership rules before the search predicate runs (`tele-sheet.tsx:1218` precedes `:1229`; `customers-status.tsx:76-80` precedes `:94-101`).

### 3.4 Finding: an "RLS read-back" `null` result and its fallback re-fetch is itself owner-blind

Documented in §1.8: when `.select().single()` returns `null` after a successful insert, the fallback re-fetch (`route.ts:456-469` for `create`; `route.ts:552-569` for `bulkCreate`) queries by `created_at` ordering/window only — it does not filter by `tele_name`/`sales_name`/session identity. If this fallback is triggered, the client then calls `addLeadToCache`/`batchAddLeadsToCache` with whatever row(s) that query returns. **Observed behavior:** if this fallback returns a row, it is still added to the local cache — this path does not, by itself, cause symptom 1. It is documented here because it is one of the two "the direct response path returned nothing usable" branches, and both branches (`created` truthy vs. falsy) converge on the same store-mutation functions already covered in §1.4 — so it does not introduce a *distinct* hiding mechanism beyond what §3.1/§3.3 already describe.

### 3.5 Finding: authorization failure on create is not a hiding mechanism for symptom 1/2 as reported

`create`/`bulkCreate` only require `requireAuth` (any authenticated role) — there is no ownership check that could *reject* a create the way `checkLeadOwnership`/`checkBulkOwnership` reject updates/deletes (`route.ts:135-175`). A create attempt by an authenticated user of any role cannot 403/401 for reasons related to the imported lead's content. **This path was checked and produces no matching evidence for symptom 1/2 — ruled out as a candidate for these two specific symptoms**, as distinct from an actual insert failure (network/DB error), which would not report success in the first place (contradicting the stated symptom that "the UI reports success").

### 3.6 Every condition that hides a newly imported lead — consolidated list, each with its evidence pointer

1. `tele_name`/`sales_name` written as `session.uname` (username) does not equal the viewing account's `currentUser` (display name) — §3.1, evidenced at `route.ts:397-399,487-489` vs. `login-screen.tsx:67`/`store.ts:368-379` vs. `tele-sheet.tsx:1218`/`sales-sheet.tsx` equivalent/`customers-status.tsx:76-79`.
2. The lead belongs to a different team member than the one currently viewing/searching (ordinary, intended ownership filtering — not by itself anomalous, but indistinguishable from condition 1 to an end user who only sees "it's not there") — same code locations as above.
3. The lead has not yet finished loading into the client's `leads` array (Phase 2 background load incomplete) at the moment the user searches — §1.11, §3.3, evidenced at `page.tsx:318-375`.
4. The lead is archived (`is_archived = true`) — every filter chain reviewed in this document begins with an archived-exclusion `continue`/`.filter()` (`tele-sheet.tsx:1217`, `sales-sheet.tsx`, `customers-status.tsx:73`). **No evidence was found in this investigation of a newly-created lead being archived at creation time** — `leadToDb()` (`route.ts:52-81`) sets `is_archived: lead.isArchived || false` (`route.ts:77`), and no create-path client code sets `isArchived: true`. This condition is listed for completeness of "every condition that archives/excludes," not because evidence ties it to symptom 1/2 specifically.

---

## 4. Symptom 3 Investigation: "Existing lead fields sometimes disappear" (Phone, Store URL, Customer Status, Notes)

### 4.1 Field-name mapping (evidence for what the UI labels mean)

- **"Phone"** → `leads.phone` / `Lead.phone`. Edited via `EditableCell` bound to `handleUpdateField(lead.id, 'phone', v)` (`sales-sheet.tsx:1203`, equivalent in `tele-sheet.tsx`).
- **"Store URL"** → `leads.store_url` / `Lead.storeUrl`. Edited via `EditableCell` bound to `handleUpdateField(lead.id, 'storeUrl', v)` (`sales-sheet.tsx:1180`, equivalent in `tele-sheet.tsx`).
- **"Notes"** → a repository-wide search for the Arabic string `ملاحظات` (notes) found it used exactly once as a data-bound label, always attached to the **`salesStatus`** field: `NotesCell value={lead.salesStatus || ''} onSave={(v) => handleUpdateField(lead.id, 'salesStatus', v)} placeholder="ملاحظات"` (`follow-up-section.tsx:470`; identical pattern at `sales-sheet.tsx:1248-1253`; read-only or editable display of the same field at `my-meetings.tsx:373-378`). **This document maps "Notes" to `leads.sales_status`** on this evidence. No other field in the reviewed components is labeled "ملاحظات."
- **"Customer Status"** → two candidate mappings were found, and the evidence does not disambiguate which the symptom report refers to:
  - (a) `leads.status`, tracked by the page literally titled "حالة العملاء" ("Customer(s) Status") — `customers-status.tsx:206-209` (page header), whose `statusBreakdown` (`customers-status.tsx:103-114`) is computed from `l.status`.
  - (b) `leads.sales_status`, which is also read as an enum-like "status" value in multiple places (e.g. `isClosedWon()`, `crm-utils.ts:217-219`) despite also being the free-text "Notes" field per the mapping above.
  - **Insufficient evidence to determine which of (a) or (b) — or whether an end user conflates the entire row disappearing from the "حالة العملاء" page with a specific cell going blank — the symptom report refers to.** Both are covered below.

### 4.2 `phone` / `store_url` — every write path

| Path | File:line | Guarded against null-wipe? |
|---|---|---|
| User edits the cell directly | `EditableCell` → `handleUpdateField(id, 'phone'/'storeUrl', v)` → `updates = { [field]: value \|\| null }` (`tele-sheet.tsx:1319`, `sales-sheet.tsx:837`) → `apiUpdateLead` → `POST /api/leads` `update` → `partialLeadToDb()` (`route.ts:86-87`: `if ('phone' in updates) dbData.phone = updates.phone \|\| null`) | N/A — this is the user's own, single-field, intentional edit. If the user submits an empty string, the field is genuinely, intentionally set to `null`. This is the only path in this document's evidence where `phone`/`store_url` can be set to `null` by explicit application logic other than a fresh row that never had a value. |
| Realtime `UPDATE` echo | `page.tsx:501,503` | **Yes.** `if (v || !existing?.phone) updates.phone = v` / `if (v || !existing?.storeUrl) updates.storeUrl = v` — an incoming `null`/empty value from the realtime payload is applied **only if** the client's currently cached value for that field is already falsy. A realtime event cannot overwrite a non-empty cached `phone`/`storeUrl` with `null`. |
| `create`/`bulkCreate` (`leadToDb`) | `route.ts:56` (`store_url: lead.storeUrl \|\| null`), similarly for `phone` at `route.ts:57` | N/A — only applies to a brand-new row, not an existing one. |
| `GET /api/leads` (full fetch / page reload / Phase 1/2 load) | `route.ts:16-50` (`leadFromDb`), `src/lib/supabase.ts:194-228` (client-side `leadFromDb`) | **No guard of any kind.** Both `leadFromDb()` implementations do `row.phone \|\| ''`/`row.store_url \|\| ''` directly from whatever the database currently holds, with no comparison to or merge with the client's prior in-memory value. If the database's `phone`/`store_url` column is `null` at the moment of any full fetch (initial load, `setLeads` full-array replacement, a manual refresh, or the Phase 2 background load), the field is rendered empty, **regardless of what value the same browser tab previously displayed.** |

**Observed behavior:** the only application-level write path in this codebase capable of setting `phone`/`store_url` to `null` on an *existing* row is the user's own direct edit of that specific cell to an empty value (or, structurally, any future code that calls `partialLeadToDb`/`leadToDb` with an empty value for these keys — none was found beyond the `EditableCell` binding in §4.1). The realtime path is explicitly guarded against doing this. **No evidence was found of any other write path (transfer, cancel-transfer, status cascade, team-member rename/remove, cleanup/diagnostic routes) ever including `phone` or `storeUrl` in its update payload** — a review of every `updates`-object literal in `tele-sheet.tsx`, `sales-sheet.tsx`, and `src/app/api/leads/route.ts`'s non-create/update cases found no assignment to `phone`/`storeUrl` outside the direct-edit path.

### 4.3 `sales_status` ("Notes", per §4.1) — every write path

| Path | File:line | Behavior |
|---|---|---|
| User edits the Notes cell directly | `NotesCell` → `handleUpdateField(id, 'salesStatus', v)` (`sales-sheet.tsx:1252`, `follow-up-section.tsx:470`) | Sets to the typed value, or `null` if cleared to empty — same single-field pattern as §4.2. |
| Status-cascade side effect, `sales-sheet.tsx` | `sales-sheet.tsx:841-863` (`handleUpdateField` for the `status` field, not `salesStatus`) — quoted in full in `docs/WRITE_PATH_ANALYSIS.md` §4.3: `if (value === CLOSED_WON_KEY) { updates.salesStatus = CLOSED_WON_KEY } else { ... if (oldLead.salesStatus === CLOSED_WON_KEY) { updates.salesStatus = null } ... }` | Editing the **`status`** dropdown (a different field) can overwrite `salesStatus` as a side effect: setting `status` to `closed-won` writes the literal string `'closed-won'` into `salesStatus`, **replacing whatever free-text note was previously there.** Changing `status` away from `closed-won` (to any other value) sets `salesStatus` to `null` **if** it was previously `'closed-won'` — this specific branch only nulls when the prior value was exactly the sentinel string, not for arbitrary free text, per the quoted condition. |
| Transfer creation, `tele-sheet.tsx` | `tele-sheet.tsx:1430-1440` (`handleTransferToSales`): `const updates: Partial<Lead> = { sales: formData.sales, ..., salesStatus: 'new', ... }` | Every transfer of a lead to sales unconditionally sets `salesStatus` to the literal string `'new'`, **replacing any existing content of the field** — including a human-written free-text note, if one was present before the transfer. |
| Cancel transfer, `tele-sheet.tsx` | `tele-sheet.tsx:1497-1505` (`handleCancelTransfer`): `const updates: Partial<Lead> = { sales: '', assignedAt: null, ..., salesStatus: null }` | Unconditionally sets `salesStatus` to `null`, again replacing any existing content, including free-text notes. |
| Realtime `UPDATE` echo | `page.tsx:514` | **Guarded**: `if (v || !existing?.salesStatus) updates.salesStatus = v ?? null` — a realtime-carried `null` is applied only if the client's cached value is already falsy. |

**Observed behavior:** because `salesStatus` serves as both an enum sentinel (`'new'`, `'closed-won'`) and a free-text "Notes" field (per §4.1's evidence), three of the five write paths above (`status`-cascade, transfer creation, cancel-transfer) can overwrite or clear this field **as a side effect of an action the user took on a different control** (the `status` dropdown, or the transfer/cancel-transfer buttons), not as a direct edit of the Notes cell itself. All three are unconditional, direct-API writes (not realtime-guarded — the guard in `page.tsx:514` only protects against the *realtime echo* of these same writes, not against the writes themselves reaching the database and the initiating user's own screen via the direct HTTP response or the next full fetch).

### 4.4 `status` ("Customer Status," candidate mapping (a) per §4.1) — every write path

- Direct edit: `handleUpdateField(id, 'status', v)` in both sheets, unconditional single-field write (`tele-sheet.tsx:1313-1354`, `sales-sheet.tsx:832-875`).
- Cascade side effects on `status` itself: both files' cascade blocks (`tele-sheet.tsx:1325-1337`, `sales-sheet.tsx:841-863`) modify *other* fields (`meetingDate`, `assignedAt`, `salesStatus`) in response to a `status` change — **neither file's cascade logic modifies `status` itself as a side effect of some other field being edited.** No evidence was found of `status` being cleared other than a direct, intentional edit of that field to an empty value.
- Realtime: guarded, same pattern as `phone`/`salesStatus` (`page.tsx:513`, `if (v || !existing?.status) updates.status = v || null`).
- **Row-level disappearance vs. field clearing:** as noted in §3.6 condition 4, `customers-status.tsx:73` (`leads.filter((l) => !l.isArchived)`) removes the entire row from the "حالة العملاء" page if `is_archived` becomes `true` — this would present to an end user as "the customer's status information is gone," though no individual field was cleared; the row itself is filtered out. `is_archived` is the one field in the entire realtime handler that is applied **unconditionally, with no null/falsy guard**: `if (has('is_archived')) { updates.isArchived = (newRow.is_archived as boolean) ?? false }` (`page.tsx:522`). Every other realtime-carried field reviewed in this document (§4.2, §4.3, and `status` itself) has a guard clause; `is_archived` and `sales_name` (`page.tsx:516`: `updates.sales = v ? String(v).trim() : null`, also unconditional) do not.

### 4.5 Consolidated: every condition found in this investigation that can clear or replace one of the four named fields on an *existing* lead

1. Direct user edit of the field's own cell to an empty value — applies to all four fields (`phone`, `storeUrl`, `status`, `salesStatus`) via their respective `EditableCell`/`NotesCell` bindings. Evidence: §4.2, §4.3, §4.4.
2. For `salesStatus` ("Notes") only: editing the separate `status` dropdown to `'closed-won'` overwrites it with the literal string `'closed-won'`; editing `status` away from `'closed-won'` nulls it if it was previously exactly `'closed-won'`. Evidence: §4.3, `sales-sheet.tsx:849-858`.
3. For `salesStatus` ("Notes") only: transferring the lead to sales unconditionally overwrites it with `'new'`. Evidence: §4.3, `tele-sheet.tsx:1435`.
4. For `salesStatus` ("Notes") only: cancelling a transfer unconditionally sets it to `null`. Evidence: §4.3, `tele-sheet.tsx:1504`.
5. For the entire row (all fields, including "Customer Status" if interpreted as row-visibility on the `customers-status.tsx` page): the realtime `UPDATE` handler applies an incoming `is_archived` value **unconditionally**, with no guard against a stale/out-of-order event. Evidence: §4.4, `page.tsx:522`.
6. For `sales_name` specifically (not one of the four named symptom fields, but included because it shares the "no realtime guard" property with `is_archived` and directly affects which sheet/filter a lead appears under): the realtime `UPDATE` handler applies an incoming `sales_name` value unconditionally. Evidence: §4.4, `page.tsx:516`.
7. A full re-fetch (`GET /api/leads`, triggered by initial login load, Phase 2 background load, or any code path that calls `setLeads`) renders whatever the database currently holds for `phone`/`storeUrl`/`status`/`sales_status` with **no merge against the client's current in-memory value** — if the database value is genuinely `null` at fetch time (regardless of *why*, including any of conditions 1–4 above having already happened via a different user's session), the field renders empty on this fetch, unconditionally. Evidence: §4.2 table, `route.ts:16-50`, `supabase.ts:194-228`.

**Insufficient evidence:** this investigation found no application code path, other than conditions 2–4 above (all specific to `salesStatus`), where editing one field's cell causes a *different* named field (`phone`, `storeUrl`, `status`) to be cleared as a side effect. No evidence was found of a full-object-replacement write (`leadToDb`, the non-partial mapper) ever being invoked against an *existing* row's `id` — every code path that could overwrite an existing row was confirmed in this and prior investigation phases to use `partialLeadToDb` (`route.ts:83-112`, `route.ts:626,698,1144`) or the standalone PATCH handler, both of which touch only the keys explicitly present in `updates`.

---

## 5. Every Realtime Event Involved (consolidated)

| Event | Subscribed? | Handler | Fields with no null-guard |
|---|---|---|---|
| `postgres_changes` INSERT on `leads` | Yes (`src/lib/supabase.ts:950-953`) | `page.tsx:416-465` | N/A (full-object build from payload, not a partial merge) |
| `postgres_changes` UPDATE on `leads` | Yes, with 50ms debounce for non-priority fields (`supabase.ts:954-970`) | `page.tsx:466-534` | `sales_name` (`page.tsx:516`), `is_archived` (`page.tsx:522`) — every other field listed at `page.tsx:501-529` has an explicit guard, quoted in full in §1 of `docs/WRITE_PATH_ANALYSIS.md` and re-verified in this document at §4.2–§4.4 |
| `postgres_changes` DELETE on `leads` | **No** — explicitly not subscribed to (`supabase.ts:971` comment: "DELETE event removed") | N/A | N/A |
| Any event on `lead_notes` | **No** — table is in the realtime publication (`supabase-schema.sql:170-176`) but no `.on('postgres_changes', ..., table: 'lead_notes', ...)` handler exists anywhere in `src/` | N/A | N/A |
| Any event on any other table (`team_members`, `app_users`, `transfers`, `notifications`, `daily_reports`, `access_permissions`, `audit_log`, `meetings`, `whatsapp_messages`, `settings`) | **No** — none of these tables is ever added to `supabase_realtime` in any `.sql` file in this repository | N/A | N/A |

---

## 6. Explicit "Insufficient Evidence" Register

The following questions were considered directly relevant to the three symptoms but could not be answered from this repository:

1. Whether any production `app_users` account has `username !== display_name` (the precondition for §3.1's mechanism to actually manifest).
2. Whether any production `team_members.name` value differs from the corresponding `app_users.display_name` (the precondition for §3.2).
3. Whether the deployed Supabase database's actual schema, RLS policies, and triggers match the `.sql` files in this repository (no live database connection was available for this or any prior phase of this audit).
4. Whether `get_duplicate_phones`, referenced at `src/app/api/duplicates/route.ts:85`, exists in the deployed database (its definition is absent from every `.sql` file in this repository — see `docs/NUMERIC_FIELD_WRITE_MATRIX.md` §5).
5. Whether Phase 2 background loading (`page.tsx:344-363`) reliably completes before a typical user begins searching, in production network conditions — this repository contains no timing/telemetry data.
6. Whether the specific field an end user calls "Customer Status" refers to `leads.status` or `leads.sales_status` (§4.1) — this requires product/UI-copy knowledge outside the source code.
7. Whether the reported "field disappears" incidents coincide, in production, with any of the seven conditions enumerated in §4.5 — this repository contains no logs, error-tracking data, or production event history; every finding in §3 and §4 documents a *possible* mechanism evidenced in the code, not a confirmed occurrence.

---

*End of Lead Lifecycle Investigation. No fixes were proposed or applied, no probabilities were assigned, and no root cause was declared. Per the audit workflow, this phase stops here for review.*
