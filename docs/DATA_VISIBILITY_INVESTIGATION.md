# Data Visibility Investigation — "Created Successfully, Cannot Be Found"

**Phase:** Audit — Visibility Path Investigation
**Status:** Read-only research. No code, schema, or configuration was modified to produce this document.
**Scope note:** This investigation is against the repository's **current** state, which includes fixes committed earlier in this session (`632a814`, `0f1992e`, `6c2c73c`, `d3d6328`). Where a finding's severity or presence changed because of those commits, this document says so explicitly — it does not silently describe pre-fix behavior as current.
**Rule applied throughout:** every "yes" answer is backed by a file:line quote or paraphrase. Where the repository does not contain enough information to answer, the text says **"Insufficient evidence."** No fix is proposed anywhere in this document.

---

## 0. Symptom Restated

1. The system reports the lead was created successfully.
2. The lead cannot be found afterward.
3. Searching by phone returns nothing.
4. Re-importing sometimes reports "Duplicate."

---

## 1. Stage-by-Stage Trace

For each stage: **Can it hide / exclude / filter / replace / overwrite / archive an existing lead?**

### 1.1 Database

- **Hide/Exclude via RLS:** No. `leads_select_authenticated` and `leads_select_anon` (`supabase-migration-stage1.sql:124-127`) are both `USING (true)` — unconditional SELECT for any authenticated or anon role. RLS does not filter rows by owner, archive state, or any other predicate. **No.**
- **Filter:** No. There is no `CHECK` constraint, generated column, or default that would cause a row to fail to persist or to persist in a form different from what was inserted. **No.**
- **Replace:** No full-row replacement mechanism exists at the DB layer — every write is a targeted `UPDATE`/`INSERT`, never a `TRUNCATE`+reload of `leads`. **No.**
- **Overwrite:** N/A at this stage — covered under "Ownership filtering" and "Status filtering" below, since the only overwrites that matter for visibility happen through the API layer, not the database layer itself.
- **Archive:** The database can *store* `is_archived = true`, but nothing at the database layer sets it autonomously — **zero `CREATE TRIGGER` statements exist in any `.sql` file in this repository** (verified by repository-wide search, consistent with `docs/NUMERIC_FIELD_WRITE_MATRIX.md` §4). Every `is_archived` write is issued by application code (traced in §1.5/§1.6). **No, not at this stage — only via application code writes, covered below.**

### 1.2 API GET (`GET /api/leads`)

- **Hide via required auth:** `route.ts:192-193`: `const session = await requireAuth(request); if (!session) return unauthorizedResponse()`. If the requesting browser's stored token is expired/invalid, the entire lead list — not just the new lead — returns 401 and the client shows nothing. **Yes**, but this hides the *whole list*, not selectively the new lead; noted for completeness.
- **Filter by archive state:** `route.ts:268-272` (paginated branch) / `route.ts:306-310` (full-load branch): `if (archivedOnly) { dataQuery = dataQuery.eq('is_archived', true) } else if (!includeArchived) { dataQuery = dataQuery.eq('is_archived', false) }`. The default call (`includeArchived=false`, used by every normal sheet load) excludes any lead with `is_archived = true`. **Yes — if the lead is archived, this endpoint's default query excludes it.**
- **Filter by server-side `search`:** `route.ts:274-276`: `if (search) { dataQuery = dataQuery.or(\`phone.ilike.%${search}%,...\`) }`. This parameter exists but, per `docs/LEAD_LIFECYCLE_INVESTIGATION.md` §1.11 (re-verified in this session: no client function passes a `search` param to any lead-loading call), **is never invoked by any client code path that loads leads.** **No effective impact today, since it's unreachable — but the mechanism itself would filter if it were ever wired up.**
- **Cache HIT serving stale data:** `route.ts:215-227`: `if (isLeadsCacheValid(cacheKey)) { ... return cached }`. If a request lands on the same cache key (same `includeArchived|archivedOnly|page|limit|search` combination) within 30 seconds (`src/lib/api-cache.ts:84`) of a prior miss, it returns the previously-cached JSON body, which will not include a lead created after that cache entry was populated — **unless** the write that created the lead itself called `invalidateAllCaches()` first. **Yes, conditionally** — see §1.9 for exactly which write paths do and do not invalidate this cache.

### 1.3 Pagination

- **Hide via page window:** Paginated `GET /api/leads?page=N&limit=M` (`route.ts:257-289`) returns only rows `[from, to]` of the `ORDER BY created_at DESC, id DESC` result set (`route.ts:263-265`). A newly created lead is the newest row (or, for `bulkCreate`, one of the newest — see below), so under normal single-create it lands at position 0 of page 1. **However:** if enough *other* leads are created by anyone, anywhere, between this lead's creation and the moment a given browser tab performs its **initial** page-1 fetch, this lead's rank shifts past the 200-row Phase-1 window (`page.tsx:352-356`, `limit=200`). It becomes visible in that tab only once Phase 2's background loop (`page.tsx:344-363`, up to 50 pages / 25,000 leads, `apiGetRemainingLeads`, `src/lib/supabase.ts:385-413`) reaches it. **Yes, as a delay** — not a permanent hide, since Phase 2 always eventually loads it (unless the safety cap at `supabase.ts:409` — 50 pages — is hit on an exceptionally large dataset, in which case remaining leads are never loaded in that session; **insufficient evidence on whether the current lead volume in production exceeds that cap**).
- **Bulk-create specific:** `bulkCreate`'s synthetic timestamps (`route.ts:526-539`, `baseTime - globalIdx`) mean that for a single large paste, only the *first* pasted rows get the newest timestamps; rows deep in a >200-row paste can already be outside a fresh page-1 window immediately after their own creation, before any other user has created anything. **Yes** — this is a direct, self-contained mechanism (no other user's activity required) by which a subset of a large bulk import is not on page 1 at the moment of creation.
- **Filter/Replace/Overwrite/Archive:** N/A — pagination only slices an already-correct result set; it does not alter row content.

### 1.4 Filters (component-level `activeFilter` / view toggles)

Every sheet component that renders leads applies its own additional, independently-coded `useMemo` filter chain on top of the raw `leads` array. None of these are default-on unless stated:

- `tele-sheet.tsx:1220` — `if (currentFilter === 'uncontacted' && isCallContactResult(l.contactResult)) continue`. Only active when the user has explicitly selected the "uncontacted" widget (`activeFilter[viewKey]`); default `currentFilter` is `''`, so this does not fire by default. **No, not by default; yes, if the user has that filter selected** and the new lead already has a contact result recorded (unlikely immediately after creation).
- `tele-sheet.tsx:1223-1228` / `sales-sheet.tsx` equivalent — `currentFilter === 'duplicates'` shows *only* leads whose phone appears 2+ times; **inverted** relative to most filters — a brand-new, non-duplicate lead would be *excluded* from this specific view, which is filtering by design (view name is literally "duplicates").
- `admin-panel.tsx` `AllLeadsTab` — `filterStatus !== 'all' && l.status !== filterStatus && l.salesStatus !== filterStatus` (`admin-panel.tsx:223`). Default `filterStatus = 'all'` (`admin-panel.tsx:213`), so no hiding by default; **yes, if an admin has a specific status filter selected**, since a freshly created lead has `status: null` (every create call site in this repo sends `status: null` or `''`) and would not match any specific non-null filter value.
- `follow-up-section.tsx` — see §1.6 (documented there since it is a *status*-driven filter, not a toggle).

### 1.5 Ownership Filtering

This is the mechanism investigated in depth in `docs/LEAD_LIFECYCLE_INVESTIGATION.md` §3 and partially addressed by this session's commit `632a814`. Restated and re-verified against current code:

**Every independent implementation found, current state:**
- `tele-sheet.tsx:1218`: `if (isLockedToSelf && l.tele !== currentUser) continue`
- `sales-sheet.tsx` equivalent (same pattern, `l.sales !== currentUser`)
- `customers-status.tsx:76-79`: `if (currentRole === 'tele' && currentUser) { result = result.filter((l) => l.tele === currentUser) } else if (currentRole === 'sales' && currentUser) { result = result.filter((l) => l.sales === currentUser) }`
- `dashboard.tsx:335-353` (`myLeads`, re-verified in this session): tele → `leads.filter((l) => l.tele === currentUser && !l.isArchived)`; sales → `leads.filter((l) => l.sales === currentUser && !l.isArchived && (!l.tele || l.tele.trim() === ''))` (sales-originated only — tele-transferred leads are read from a *separate* `teleTransferredLeads` computation, `dashboard.tsx:359`, not `myLeads`)
- `follow-up-section.tsx:227-228`: `if (isLockedToSelf && l.sales !== currentUser) continue`
- `admin-panel.tsx` `AllLeadsTab`: **not locked to self** — admin sees all non-archived leads by default (`filterTele`/`filterSales` default to `'all'`, `admin-panel.tsx:211-212`), consistent with `session.role === 'admin'` never being forced-owner at write time either (`route.ts:397,487`, unaffected by admin).

**All of the above compare against `currentUser`**, which is the Zustand store's `currentUser` field, set exactly once at login from `data.user.displayName` (`login-screen.tsx:67`). **As of commit `632a814`, the server issues `session.uname` (used to force-assign `tele_name`/`sales_name` on create/bulkCreate, `route.ts:397-399,487-489`) from `user.display_name` as well** — so for any session token issued **after** that fix was deployed, the two identities are the same value and every filter above matches correctly.

**Residual "yes" conditions, evidenced from the current code, not resolved by the fix:**
1. **Stale tokens.** Session tokens are valid for 3 days (`src/lib/session.ts:19`, `SESSION_TTL_SECONDS`). Any browser tab holding a token issued **before** the fix was deployed still carries the old `uname = username` value until that user logs out and back in (or the token expires). A create/bulkCreate performed with such a token still writes `tele_name`/`sales_name = username`, mismatching `currentUser = display_name` in that same tab's (and every tab's) filters. **Yes**, for the remaining lifetime of any pre-fix token.
2. **Historical rows.** Every lead created before this fix, with an account where `username != display_name`, still has `tele_name`/`sales_name = username` in the database. No migration was run (none was possible from this environment — no live DB credentials). **Yes**, for any such pre-existing row, indefinitely, until manually reconciled.
3. **Un-set precondition.** All of this only manifests for accounts where `app_users.username != app_users.display_name`. **Insufficient evidence** on whether any production account currently has this property — this repository has no access to production `app_users` data (same limitation stated in the prior investigation).

### 1.6 Status Filtering

- `follow-up-section.tsx:203-225` (re-read in full for this investigation):
  ```
  const VALID_FOLLOWUP_STATUSES = new Set(['meeting', 'followup-1', 'followup-2', 'followup-3', CLOSED_WON_KEY])
  ...
  const hasValidStatus = l.status && VALID_FOLLOWUP_STATUSES.has(l.status)
  const isOldTeleMeeting = !l.status && !!l.tele && l.tele.trim() !== '' && !!l.meetingDate && l.meetingDate.trim() !== ''
  if (!hasValidStatus && !isOldTeleMeeting) continue
  ```
  **Yes** — a freshly created lead has `status: null` (every create call site in `tele-sheet.tsx`, `sales-sheet.tsx`, `bulk-add.tsx` sends `status: null` or `status: ''`/`r.status || ''`). Such a lead is excluded from the Follow-Up page **unless** it also already has both a non-empty `tele` and a non-empty `meetingDate` (the `isOldTeleMeeting` escape hatch, which a brand-new lead does not yet have). This exclusion is stated as intentional in the code's own comment (`follow-up-section.tsx:199-200`: "Hides: ... status=null leads that are NOT tele-transferred meetings"), not attributed here as a defect — documented because it is a real, evidenced condition under which a newly created, valid lead does not appear on a specific page.
- `admin-panel.tsx` `AllLeadsTab` — covered in §1.4 (status filter is a `useState`, not default-on).
- `customers-status.tsx` — re-verified in this session: its base `filteredLeads` computation (`customers-status.tsx:71-101`) applies **no status-based exclusion at all** — only archive state, role/ownership, member-filter, and search. A `status: null` lead is fully visible here (it simply falls into the `''` bucket of `statusBreakdown`, `customers-status.tsx:107-108`). **No**, for this specific page.
- `tele-sheet.tsx` / `sales-sheet.tsx` main table views — **no status-based exclusion** in their base filter chains (`tele-sheet.tsx:1216-1237`, `sales-sheet.tsx` equivalent); a `status: null` lead is shown normally. **No.**

### 1.7 Search

Re-verified in this session (unchanged since the prior investigation, and unaffected by this session's fixes): a repository-wide search for every call site of `apiGetLeads`/`apiGetLeadsPage1`/`apiGetRemainingLeads` found none of them ever append a `search` parameter. Every "search box" in the application (`tele-sheet.tsx` `searchQuery`, `sales-sheet.tsx`, `customers-status.tsx`, `follow-up-section.tsx:229`, `admin-panel.tsx` `AllLeadsTab:224`) is a client-side `.toLowerCase().includes()` predicate applied to whatever survived every earlier filter stage (§1.4–§1.6) in that specific component's `useMemo`.

- **Can search hide an existing, already-visible-by-filters lead?** Only if the typed query genuinely does not match `customerName`/`phone`/`storeUrl`/`brief` (component-dependent field list) — a correctness non-issue for a matching query.
- **Can search "find" a lead that was excluded by an earlier stage (ownership, archive, status)?** **No** — search is the last predicate applied in every reviewed component's filter chain; it operates on an already-reduced array and cannot re-include a row an earlier `continue`/`.filter()` already dropped. This directly explains the "searching by phone returns nothing" half of the symptom whenever any earlier stage (most centrally, §1.5's ownership mismatch) has already excluded the row — the search box never had a chance to find it, because it never received it as a candidate.

### 1.8 Store (Zustand)

- **Replace:** `setLeads()` (`src/lib/store.ts:340-354`) replaces the entire `state.leads` array. Called on initial data load (`page.tsx:334`) and on any code path that resets `dataLoaded` to trigger a reload (`page.tsx:631-634`, the "retry" button on the data-error banner). If this fires while a lead exists only in optimistic/unconfirmed client state (not yet echoed back by the server), that optimistic lead is discarded. **Yes, but only for the narrow window described** — not applicable to a lead that already received a server-confirmed response (the normal "created successfully" case in the symptom).
- **Merge/Append, not hide:** `addLeadToCache`/`batchAddLeadsToCache` (`store.ts:452-480`) only add; they dedupe by `lead.id in state.leadsById` (`store.ts:455,470`) and never remove or overwrite an existing entry. **No** hiding mechanism here.
- **Archive (client-side mirror):** `archiveLeadsInCache` (`store.ts:510-536`) moves a lead from `state.leads` to `state.archivedLeads` client-side, in response to a user action or (transitively) a realtime `UPDATE` carrying `is_archived: true` being applied via `updateLeadInCache`. **Yes** — covered fully in §1.9 (realtime) since that is the non-obvious trigger path.
- **Overwrite via realtime UPDATE merge:** `updateLeadInCache` (`store.ts:418-435`) does `{ ...existing, ...updates }` — a shallow merge, not a full replace, so only the keys present in `updates` change. Whether a given realtime-sourced `updates` object can contain a value that effectively hides the row (e.g., `isArchived: true`, or `sales: null` moving it out of a "my transferred leads" view) is a realtime-stage question, answered in §1.9.

### 1.9 Cache (`src/lib/api-cache.ts`)

Re-verified in this session, cross-checked against every route file for an `api-cache` import:

| Route | Writes `leads`? | Calls `invalidateAllCaches()`? |
|---|---|---|
| `POST /api/leads` — `create`, `bulkCreate`, `update`, `delete`, `bulkDelete`, `archive`, `unarchive`, `addNote`, `deleteNote`, `addTeamMember`, `removeTeamMember`, `renameTeamMember`, `saveAccessPermissions` | Yes (leads-affecting subset) | **Yes** — all of these operation names are present in `WRITE_OPERATIONS` (`route.ts:9-14`), including `'bulkCreate'` |
| `POST /api/leads` — `bulkUpdate`, `updateNote` | Yes (`bulkUpdate`) | **No** — `'bulkUpdate'` is absent from `WRITE_OPERATIONS`; `updateNote`'s case block never calls `success()` at all |
| `POST /api/leads` — `saveSetting` | No (writes `settings`, not `leads`) | N/A to lead visibility |
| `PATCH /api/leads`, `DELETE /api/leads` | Yes | **Yes** — both call `invalidateAllCaches()` directly (`route.ts:1158,1202`), independent of the `WRITE_OPERATIONS` set |
| `PATCH /api/meetings` | Yes (`leads.attended` etc.) | **No** — file never imports `src/lib/api-cache.ts` |
| `POST /api/team` | Yes (`leads.tele_name`/`sales_name`, via rename/remove) | **No** — same, no import |
| `POST /api/sheets-sync` | Yes (webhook lead creation) | **No** — same, no import |
| `POST /api/cleanup-orphaned-leads`, `/api/fix-sales-leads-tele`, `/api/diagnose-leads-dates` | Yes | **No** — none import `api-cache` |

**Answering the stage questions:**
- **Hide:** **Yes, temporarily.** Any `GET /api/leads` request whose cache key (`includeArchived|archivedOnly|page|limit|search`) was already populated **before** an uninvalidated write (any row in the "No" column above) will continue to serve the pre-write snapshot for up to 30 seconds (`api-cache.ts:84`) after that write, on the same serverless instance. For the specific symptom of "created successfully, cannot be found," this table's relevant row is `create`/`bulkCreate`, both of which **do** invalidate — so this specific cache is not implicated for a lead created through the normal UI paths. It **is** implicated if the lead arrived via `/api/sheets-sync` (uncached) or if the visibility-checking request happens to hit a *different* Vercel serverless instance than the one whose in-memory cache was invalidated (the cache is explicitly per-instance, not shared/distributed — `api-cache.ts` uses plain in-memory `Map`/module-level variables, no external cache store). **Insufficient evidence on how many concurrent serverless instances production runs**, which determines how often this cross-instance staleness would actually occur.
- **Overwrite/Replace:** No — this cache stores/returns previously-computed response bodies; it does not mutate lead field values.
- **Archive:** No — not a write path.

### 1.10 Realtime

- **INSERT event:** `page.tsx:416-465`. Subscribed (`supabase.ts:950-953`). If the browser tab's realtime channel is in a `disconnected`/`error` state (`store.ts` `realtimeStatus`, surfaced via `apiSubscribeToLeads`'s `onStatusChange`, `supabase.ts:973-986`) at the moment another user's create fires, this tab never receives that INSERT event and will not show the new lead until either (a) reconnection succeeds and a *subsequent* live event arrives for that same row (e.g., any later UPDATE), or (b) a full re-fetch happens (page reload / re-login). **Yes** — a disconnected realtime channel is a documented, handled state in this codebase (retry/backoff logic exists, `supabase.ts:915-944`), meaning it is expected to occur, not a hypothetical.
- **UPDATE event, `is_archived`:** `page.tsx:522`: `if (has('is_archived')) { updates.isArchived = (newRow.is_archived as boolean) ?? false }` — **applied unconditionally, no null/falsy guard**, unlike every other field in this handler except `sales_name` (`page.tsx:516`, also unconditional). **Yes** — any realtime UPDATE payload carrying `is_archived: true` for a given lead immediately archives it client-side in every connected tab, regardless of that tab's current cached value, moving it out of every "active leads" view via `updateLeadInCache` → the component-level `if (l.isArchived) continue` filters documented across every sheet in §1.4-§1.6.
- **UPDATE event, `sales_name`:** `page.tsx:516`: `if (has('sales_name')) { const v = val('sales_name'); updates.sales = v ? String(v).trim() : null }` — also unconditional. A stale/out-of-order event carrying a null or different `sales_name` would change which "my leads" ownership filter (§1.5) the row matches in every connected tab. **Yes**, by the same mechanism.
- **Every other field** (`phone`, `customer_name`, `store_url`, `brief`, `contact_result`, `status`, `sales_status`, `attended`, `meeting_date/time/type/link`, `assigned_at`, `archived_at`, `archived_by`, `cancelled_from/at`, `attendance_marked_at/by`, `contact_result_at`) is **guarded**: `if (v || !existing?.<field>) updates.<field> = v` — an incoming falsy value is applied only if the client's current cached value is already falsy (`page.tsx:501-529`, quoted in full in `docs/WRITE_PATH_ANALYSIS.md` §1 and `docs/LEAD_LIFECYCLE_INVESTIGATION.md` §4.2-§4.4). **No**, these specific fields cannot be nulled by a realtime echo while a non-empty value is already cached in that tab.
- **DELETE event:** Not subscribed at all (`supabase.ts:971`, comment: "DELETE event removed"). A hard delete of a lead is invisible to realtime; the row would only disappear from a tab's view on that tab's next full re-fetch. **No** effect on the "cannot be found" symptom (a delete would make the row genuinely gone, not a visibility bug), included here for completeness of "every realtime event."

### 1.11 Rendering

- **Client-side render pagination:** every sheet paginates its already-filtered array before rendering rows: `tele-sheet.tsx:35,1251-1254` (`PAGE_SIZE = 50`), `sales-sheet.tsx` equivalent, `follow-up-section.tsx:251-254` (same `PAGE_SIZE` pattern), `admin-panel.tsx` `AllLeadsTab:215,237-241` (`PAGE_SIZE = 50`). A lead that passed every filter stage but is not among the newest 50 (or whichever page size) results in that view is not rendered on the currently-displayed page — it requires the user to navigate to a later page number. **Yes**, technically — the row is in the filtered `Array`, just not on-screen without further pagination action. This is standard pagination behavior, not a defect, and is included here because the task explicitly asks whether rendering "can hide" a lead — by this literal definition, yes.
- **No other exclusion found at the rendering stage itself** — every reviewed component's final `.map()` renders every item in its paginated slice unconditionally; no additional conditional `return null`/hidden-row logic was found gating an individual row's visibility beyond what earlier stages already decided.

---

## 2. Consolidated Answer Table

| Stage | Can hide? | Can exclude? | Can filter? | Can replace? | Can overwrite? | Can archive? |
|---|---|---|---|---|---|---|
| Database | No (§1.1) | No | No | No | N/A (via app code only) | No (no triggers) |
| API GET | Yes — cache staleness, auth failure (§1.2) | Yes — `is_archived` default filter | Yes — unreachable `search` param | No | No | No |
| Pagination | Yes — window/Phase-2 delay (§1.3) | Yes — same | N/A | No | No | No |
| Filters (view toggles) | No by default; yes if user-selected (§1.4) | Yes, conditionally | Yes | No | No | No |
| Ownership filtering | Yes — stale tokens / historical rows (§1.5) | Yes | Yes | No | No | No |
| Archived filtering | Yes — is_archived (§1.1/§1.6/§1.9/§1.10) | Yes | Yes | No | No | Yes — via realtime, team-member removal, cleanup routes |
| Status filtering | Yes — follow-up page only (§1.6) | Yes | Yes | No | No | No |
| Search | No — operates after all other stages (§1.7) | No | Yes (component-scoped) | No | No | No |
| Store | Yes — `setLeads` replace window (§1.8) | No (add-only functions) | No | Yes — `setLeads` | Yes — realtime-sourced `updateLeadInCache` merges | Yes — `archiveLeadsInCache` |
| Cache | Yes — uninvalidated routes, cross-instance (§1.9) | No | No | No | No | No |
| Realtime | Yes — disconnected channel (§1.10) | No | No | No | Yes — `is_archived`, `sales_name` unconditional (§1.10) | Yes — `is_archived` unconditional |
| Rendering | Yes — page-size slicing (§1.11) | No | No | No | No | No |

---

## 3. Direct Answer to the Symptom, With Evidence Chain

Given the current state of the code (post this session's fixes), the following evidenced chains each independently produce "created successfully, then cannot be found, search finds nothing, re-import says duplicate":

**Chain A — residual ownership mismatch (§1.5):**
`session.uname` (from a pre-fix or not-yet-refreshed token) != `currentUser` (display name) → `create`/`bulkCreate` writes `tele_name`/`sales_name` = the mismatched value (`route.ts:397-399,487-489`) → every ownership filter in §1.5 excludes the row from that user's own view → the same user's search box never receives the row as a candidate (§1.7) → re-import's DB-level duplicate check (`route.ts:403-427` for single create; the DB-existing check added to `bulkCreate` in this session's commit `d3d6328`) has no owner condition and correctly reports the phone already exists.

**Chain B — status filtering on Follow-Up specifically (§1.6):**
A newly created, sales-originated lead has `status: null` and no `tele`/`meetingDate` yet → `follow-up-section.tsx`'s `VALID_FOLLOWUP_STATUSES`/`isOldTeleMeeting` check excludes it → not found on that page → search on that page finds nothing (§1.7) — while the lead is fully visible on `tele-sheet.tsx`/`sales-sheet.tsx`/`customers-status.tsx`, which do not apply this status filter. **This chain depends on which page the user is searching from**, not evidenced here as depending on any particular account property.

**Chain C — realtime-driven unconditional archive/ownership-field write (§1.10):**
A stale or out-of-order realtime `UPDATE` event (any cause of staleness — reconnect after a drop, replication lag, or any other write to the same row racing with the one under investigation) carrying `is_archived: true` or a changed `sales_name` is applied unconditionally (`page.tsx:516,522`) → the row moves to `archivedLeads` or a different ownership bucket client-side → every active-leads filter stage excludes it → search finds nothing. **This chain requires a second, unrelated write to the same lead's `is_archived`/`sales_name` columns to have occurred** (e.g., a team-member rename/removal, or an admin archiving action) — **insufficient evidence, from this repository alone, on how frequently such a second write coincides with a user's search attempt in production.**

**Chain D — pagination/cache window for a different viewer (§1.3, §1.9):**
A different user than the one who created the lead searches for it before that second user's Phase 2 background load completes, or while an in-memory server cache entry (populated before the create, on a route that does not call `invalidateAllCaches()` — `PATCH /api/meetings`, `POST /api/team`, `POST /api/sheets-sync`, or a cross-instance cache miss for `create`/`bulkCreate` itself) is still within its TTL. **Does not apply to the creating user's own immediate search**, since that tab's store already has the lead via the direct HTTP response — applies only to a second viewer or a delayed re-check.

No chain in this document requires modifying, speculating about, or assuming production data beyond what is explicitly flagged as **Insufficient evidence**.

---

*End of Data Visibility Investigation. No fixes were proposed or applied. Per the audit workflow, this phase stops here for review.*
