# Numeric Field Write Matrix — SalesPro CRM ("Venom CRM")

**Phase:** Audit — Numeric Field Write Matrix
**Status:** Read-only research. No code, schema, or configuration was modified to produce this document.
**Rule applied throughout:** every claim below is anchored to a specific file and line. Where no such anchor could be produced, the text says so explicitly: **"Insufficient evidence."** No probability, severity, or root-cause judgment is made anywhere in this document.

---

## 1. Method

1. Every `CREATE TABLE` statement in every `*.sql` file at the repository root was read in full (`supabase-schema.sql`, `supabase-migration-existing.sql`, `supabase-migration-stage1.sql`, `supabase-migration-audit-fixes.sql`, `supabase-rpc-migration.sql`).
2. A repository-wide search for the PostgreSQL numeric type keywords `BIGSERIAL`, `BIGINT`, `INT`, `INTEGER`, `NUMERIC`, `DECIMAL`, `SMALLINT`, `REAL`, `DOUBLE`, `FLOAT`, `GENERATED ALWAYS AS IDENTITY` was run against every `*.sql` file to enumerate every numeric-typed column with certainty (command executed: `grep -inE` over the SQL file set — full output reproduced in §2).
3. For every numeric column found, the repository was searched for every call site that could write to it: every `.from('<table>')` chain in `src/`, every `client.rpc(...)` call, every `fetch(...)` to an API route, every Zustand store action, and every component handler that references the field by its camelCase or snake_case name.
4. A repository-wide search for `CREATE TRIGGER` was run against every `*.sql` file. **Zero matches were found.** This document therefore states, per field, "No trigger exists (verified: zero `CREATE TRIGGER` statements found in any `.sql` file in this repository)" rather than "no evidence of a trigger."
5. This analysis is static (source-code and migration-file based). **No live database connection was available.** If the deployed Supabase schema has diverged from the checked-in `.sql` files (e.g. via manual dashboard edits, migrations applied but not committed, or triggers/RPCs created directly in the Supabase SQL editor and never saved to this repository), this document cannot detect that. Every table/column claim below is scoped to *what is present in this repository*, and this limitation is restated at point of use where relevant.

---

## 2. Complete Numeric Column Inventory (raw evidence)

Grep evidence (`grep -inE "BIGSERIAL|BIGINT|\bINT\b|INTEGER|NUMERIC|DECIMAL|SMALLINT|REAL\b|DOUBLE|FLOAT|GENERATED ALWAYS AS IDENTITY"` over all `*.sql` files):

```
supabase-schema.sql:26:            leads.id                  BIGSERIAL PRIMARY KEY
supabase-schema.sql:108:           lead_notes.id              BIGSERIAL PRIMARY KEY
supabase-schema.sql:109:           lead_notes.lead_id         BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE
supabase-schema.sql:122:           team_members.id            BIGSERIAL PRIMARY KEY
supabase-schema.sql:144:           app_users.id                BIGSERIAL PRIMARY KEY
supabase-schema.sql:297:           access_permissions.id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
supabase-migration-stage1.sql:189: meetings.id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
supabase-migration-stage1.sql:190: meetings.lead_id            BIGINT NOT NULL
supabase-migration-stage1.sql:214: transfers.id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
supabase-migration-stage1.sql:215: transfers.lead_id            BIGINT NOT NULL
supabase-migration-stage1.sql:232: daily_reports.id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
supabase-migration-stage1.sql:236: daily_reports.calls_made     INT DEFAULT 0
supabase-migration-stage1.sql:237: daily_reports.meetings_done  INT DEFAULT 0
supabase-migration-stage1.sql:238: daily_reports.deals_closed   INT DEFAULT 0
supabase-migration-stage1.sql:239: daily_reports.revenue        NUMERIC(12,2) DEFAULT 0
supabase-migration-stage1.sql:254: whatsapp_messages.id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
supabase-migration-stage1.sql:255: whatsapp_messages.lead_id    BIGINT NOT NULL
supabase-migration-stage1.sql:270: notifications.id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
supabase-migration-stage1.sql:275: notifications.lead_id        BIGINT
supabase-migration-stage1.sql:291: audit_log.id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
supabase-migration-stage1.sql:292: audit_log.actor_id           BIGINT
```

(`supabase-migration-existing.sql:91-92` restates `lead_notes.id`/`lead_notes.lead_id` identically to `supabase-schema.sql`; it is the same table, not a distinct one.)

**No other numeric-typed column exists in any `CREATE TABLE` statement in this repository.** Every other column in every table is `TEXT`, `TIMESTAMPTZ`, `DATE`, `BOOLEAN`, `JSONB`, or `INET`. This includes every field on `leads` other than `id` — `leads` has no `INT`/`NUMERIC` business-metric column of any kind (no quantity, amount, score, or count column exists on `leads`).

One additional numeric location exists **inside a JSONB column, with no SQL type of its own**: the `settings.value` (JSONB) column is used, at application level, to store an object `{ type: string, value: number }` under the row `key = 'target'`. This is documented in §3.12 as a JSONB-embedded numeric value, distinct from a typed SQL column.

RPC-function-only numeric outputs (not stored in any table — see §4) also exist and are documented in §5.

---

## 3. Per-Field Write Matrix

### 3.1 `leads.id` (BIGSERIAL PRIMARY KEY)

**Written by (INSERT — auto-generated, never explicitly supplied by application code):**
- `POST /api/leads` operation `create` — `src/app/api/leads/route.ts:395-473`, `INSERT INTO leads` via `client.from('leads').insert(dbData).select().single()` (`route.ts:430-434`). `dbData` is built by `leadToDb()` (`route.ts:52-81`), which does not set an `id` key.
- `POST /api/leads` operation `bulkCreate` — `route.ts:475-581`, batched `client.from('leads').insert(dbData).select()` (`route.ts:541`). No `id` key set.
- `POST /api/sheets-sync` (webhook ingest) — `src/app/api/sheets-sync/route.ts:226-239`, `client.from('leads').insert(batch)`. No `id` key set.

**Never UPDATEd.** No file in this repository issues `UPDATE leads SET id = ...` or includes `id` in any `partialLeadToDb()`/`leadToDb()` output object (`src/app/api/leads/route.ts:52-112`; `src/lib/supabase.ts:243-300`). Both mapping functions explicitly omit `id` from every constructed payload.

**Deleted (row removed, not the numeric value zeroed):**
- `DELETE /api/leads?id=` — `route.ts:1167-1208`, `client.from('leads').delete().eq('id', id)` (`route.ts:1195`).
- `POST /api/leads` operation `delete` — `route.ts:650-665`, same `.delete().eq('id', id)` pattern (`route.ts:659`).
- `POST /api/leads` operation `bulkDelete` — `route.ts:667-686`, `client.from('leads').delete().in('id', batch)` (`route.ts:679`), batched 100 rows at a time (`route.ts:676-677`).
- Deleting a `leads` row cascades to `lead_notes` via the foreign-key clause `ON DELETE CASCADE` declared on `lead_notes.lead_id` (`supabase-schema.sql:109`). This is a database-level foreign-key action, not an application statement and not a trigger.

**Type handling on read (client-side):**
- `leadFromDb()` server-side (`src/app/api/leads/route.ts:18`) — `id: String(row.id)`.
- `leadFromDb()` client-side (`src/lib/supabase.ts:200`) — `id: String(row.id)`.
- The TypeScript `Lead` interface (`src/lib/supabase.ts:154`) declares `id: string`. The numeric BIGINT value is converted to a JS string on every single read path; it is never held as a JS `number` in the `Lead` object.
- `src/lib/store.ts:276-281` (`compareIds`) explicitly re-parses the string id back to a number for sort comparisons: `const numA = Number(a); const numB = Number(b); if (!isNaN(numA) && !isNaN(numB)) return numA - numB; return a.localeCompare(b)`.

**Store actions referencing this field (as a lookup/sort key, not as a value being "changed"):**
`addLeadToCache` (`store.ts:452-463`), `batchAddLeadsToCache` (`store.ts:464-480`), `updateLeadInCache` (`store.ts:418-435`), `revertLeadInCache` (`store.ts:436-451`), `removeLeadFromCache` (`store.ts:481-498`), `batchRemoveLeadsFromCache` (`store.ts:499-509`), `archiveLeadsInCache` (`store.ts:510-536`), `unarchiveLeadsInCache` (`store.ts:537-578`, uses `compareIds` for binary-search insertion at `store.ts:558-568`).

**Realtime propagation:**
- `leads` is added to the `supabase_realtime` publication (`supabase-schema.sql:160-177`, `supabase-migration-existing.sql:131-148`). INSERT and UPDATE events are subscribed to client-side; DELETE is explicitly not subscribed to (`src/lib/supabase.ts:904-986`, comment at `:971` — "DELETE event removed").
- On receipt, `id` is again coerced to a string: `page.tsx:419` (`const leadId = String(newRow.id)` inside the INSERT handler) and `page.tsx:470` (same pattern inside the UPDATE handler).

**Cache update:**
- `POST/PATCH/DELETE /api/leads` all call `invalidateAllCaches()` (`src/lib/api-cache.ts:118-122`) on success for the operations listed in `WRITE_OPERATIONS` (`route.ts:9-14`) plus the standalone PATCH/DELETE handlers (`route.ts:1158`, `route.ts:1202`), which clears both the `leadsCacheMap` and `statsCache` in-memory caches. `id` values are present inside the cached JSON payloads (`leadsCacheMap` stores whole `GET /api/leads` response bodies keyed by a `page|limit|search` string, not by `id` — `src/lib/api-cache.ts:83-110`).
- `POST /api/sheets-sync` does not import `src/lib/api-cache.ts` (verified: no `invalidateAllCaches`/`api-cache` reference anywhere in `src/app/api/sheets-sync/route.ts`). Leads created through this route are not reflected in the in-memory cache until the cache's own TTL (30s, `src/lib/api-cache.ts:84`) expires naturally.

**Partial vs. full / null vs. undefined / merge vs. replace:** not applicable — this field is set exactly once (at row creation, by the database's own `BIGSERIAL` sequence) and is never subsequently written to by any code path in this repository.

**Independent writers:** three INSERT paths (`create`, `bulkCreate`, `sheets-sync`) each generate a new value via the same underlying `BIGSERIAL` sequence; they do not write to the same row concurrently, so this field does not have multiple independent writers to the *same* value — each insert produces a distinct id.

---

### 3.2 `lead_notes.id` (BIGSERIAL PRIMARY KEY)

**Written by (INSERT, auto-generated, id never explicitly supplied):**
- `POST /api/leads` operation `addNote` — `route.ts:764-780`, `client.from('lead_notes').insert({ lead_id: leadId, by_name: by, category: cat, text }).select().single()` (`route.ts:770-774`).
- `POST /api/chat` — `src/app/api/chat/route.ts:84-93`, `client.from('lead_notes').insert({ lead_id: body.leadId, by_name: byName, category: fromMe ? 'whatsapp-outgoing' : 'whatsapp-incoming', text }).select().single()`.

**Call-site count for these two write paths, verified by repository-wide search:**
- `apiAddNote()` (`src/lib/supabase.ts:479-481`, the only client wrapper for the `addNote` operation) has **zero call sites** anywhere under `src/components` or `src/app` (search pattern `apiAddNote\(` matched only its own definition).
- No component or page under `src/` issues a `fetch` to `/api/chat` (search pattern `fetch\(['"]\/api\/chat` matched zero occurrences outside the route file itself).
- Both write paths to `lead_notes.id` exist, are reachable by any authenticated user (`requireAuth` at `route.ts:367-370` for `/api/leads`; `requireAuth` at `src/app/api/chat/route.ts:57-58` for `/api/chat`), and are exercised by no UI code found in this repository.

**Read/reference (not a write to `id` itself) via `deleteNote`/`updateNote`:**
- `POST /api/leads` operation `deleteNote` (`route.ts:782-802`) — `.eq('id', noteId)` where `noteId` is destructured as `data as string` (`route.ts:783`), i.e. no `Number()` coercion is applied before use in the filter.
- `POST /api/leads` operation `updateNote` (`route.ts:804-832`) — same pattern, `noteId` used directly (`route.ts:805,807,821`).
- `apiDeleteNote()` (`src/lib/supabase.ts:483-485`) has zero call sites (search pattern `apiDeleteNote\(` matched only its own definition).

**Cache update:** `deleteNote` is present in `WRITE_OPERATIONS` (`route.ts:11`) and triggers `invalidateAllCaches()` on success. `addNote` is also present in `WRITE_OPERATIONS` (`route.ts:11`) and triggers it. `updateNote` returns `NextResponse.json({ data: note })` directly at `route.ts:826-831` **without ever calling the `success()` wrapper** that checks `WRITE_OPERATIONS` — no cache invalidation call exists anywhere in the `updateNote` case block.

**Realtime propagation:** `lead_notes` was previously added to the realtime publication in `supabase-schema.sql:170-176`, but the client-side subscription in `src/lib/supabase.ts:904-986` subscribes only to the `leads` table's channel — no `.on('postgres_changes', ..., table: 'lead_notes', ...)` handler exists anywhere in `src/`.

---

### 3.3 `lead_notes.lead_id` (BIGINT NOT NULL, FK → leads.id, ON DELETE CASCADE)

**Written by:**
- `addNote` (`route.ts:764-780`) — `lead_id: leadId`, where `leadId` is destructured as `data as { leadId: string; ... }` (`route.ts:765`). **No `Number()` coercion is applied.** (Dead path — see §3.2.)
- `/api/chat` POST (`route.ts:84-93`) — `lead_id: body.leadId`, where `body` is the parsed JSON request body with no type assertion applied to `leadId` prior to this assignment (only a truthiness check `if (!body.leadId)` at `route.ts:71-73`). **No `Number()` coercion is applied.** (Dead path — see §3.2.)

**Contrast with other tables' FK-to-`leads.id` columns (documented for comparison, not judgment):**
- `POST /api/transfers` — `lead_id: Number(lead_id)` (`src/app/api/transfers/route.ts:221`) — explicit coercion.
- `POST /api/notifications` — `lead_id: lead_id ? Number(lead_id) : null` (`src/app/api/notifications/route.ts:146`) — explicit coercion.
- `POST /api/leads` operation `update`, server-side attendance-notification insert — `lead_id: Number(id)` (`route.ts:617`) — explicit coercion.
- `POST /api/transfers`, its own server-side transfer-notification insert — `lead_id: Number(lead_id)` (`route.ts:244`) — explicit coercion.

`lead_notes.lead_id` is the only FK-to-`leads.id` numeric column in this repository where both write paths omit the `Number()` coercion applied everywhere else.

**Realtime/cache:** same as §3.2.

---

### 3.4 `team_members.id` (BIGSERIAL PRIMARY KEY)

**Written by (INSERT, auto-generated):**
- `POST /api/leads` operation `addTeamMember` — `route.ts:869-914`, `client.from('team_members').insert({ name, role }).select().single()` (`route.ts:904-908`), or, on the reactivation branch, `client.from('team_members').update({ is_active: true, role }).eq('id', existing.id).select().single()` (`route.ts:891-896`) — this branch references `existing.id` in a `WHERE` clause but does not write a new value to it.
- `POST /api/team` operation `add` — `src/app/api/team/route.ts:109-152`, same insert/reactivate pattern (`route.ts:142-146`, `route.ts:129-134`).

**Call-site count:**
- `apiAddTeamMember()` (`src/lib/supabase.ts:487-489`) is called from `src/components/crm/admin-panel.tsx:517` (`TeamTab.handleAdd`) and `admin-panel.tsx:791` (`UsersTab.handleCreateUser`, auto-add-to-team branch). Both route through `serverOp('addTeamMember', ...)` (`supabase.ts:80-103`), which posts to `POST /api/leads`, **not** `POST /api/team`.
- No call site anywhere in `src/components` or `src/app` issues a `fetch` to `/api/team` with any HTTP method (search pattern `fetch\(['"]\/api\/team` and `/api/team` matched only the route file's own internal comments/JSDoc, e.g. `route.ts:6,11`, and one comment inside `src/app/api/leads/route.ts:871`). `POST /api/team` (all three of its operations — `add`, `remove`, `rename`) is unreached by any client code in this repository.

**Never UPDATEd beyond `is_active`/`role`/`name` (TEXT/BOOLEAN fields) — `id` itself is never written after creation** in either route.

**Cache update:** neither `/api/team` nor the `addTeamMember` operation inside `/api/leads` (`route.ts:869-914`) is followed by any statement that would leave `id` in a stale cache state distinct from the rest of the row — `addTeamMember` is in `WRITE_OPERATIONS` (`route.ts:12`) and triggers `invalidateAllCaches()`; `/api/team/route.ts` does not import `src/lib/api-cache.ts` at all (verified: no reference to `api-cache` anywhere in that file).

**Realtime propagation:** `team_members` is never added to `supabase_realtime` in any `.sql` file in this repository (only `leads` and `lead_notes` are, per §3.1/§3.2). No realtime path exists for this field.

---

### 3.5 `app_users.id` (BIGSERIAL PRIMARY KEY)

**Written by (INSERT, auto-generated):**
- `POST /api/auth` operation `create-user` — `src/app/api/auth/route.ts:197-244`, `client.from('app_users').insert({ username, password_hash, password_salt: '', display_name, role, is_active: true }).select('id, username, display_name, role, is_active, created_at').single()` (`route.ts:223-234`). No `id` key set in the insert payload.

**Referenced (WHERE-clause use, not a write to `id`) by:**
- `toggle-user` — `.eq('id', userId)` (`route.ts:274`).
- `reset-password` — `.eq('id', userId)` (`route.ts:301`).
- `delete-user` — `.eq('id', userId)` (`route.ts:323`), a hard `DELETE`.
- `change-password` — `.eq('id', session.uid)` (`route.ts:167,184`).
- `login` — `.eq('id', user.id)` for the `last_login_at` update (`route.ts:83`).

**Downstream use of this value once read:** `session.uid` (`src/lib/session.ts:41`, typed `string | number`) is populated from `user.id` at token-issuance time (`route.ts:88-92`, `createSessionToken({ uid: user.id, uname: user.username, role: user.role })`). No explicit `Number()`/`String()` coercion is applied to `user.id` before it is embedded in the signed session payload — its JS runtime type is whatever the Supabase client library returned for that `BIGSERIAL` column value.

**Realtime propagation:** `app_users` is never added to `supabase_realtime` in any `.sql` file in this repository. No realtime path exists.

**Cache update:** `/api/auth` does not import `src/lib/api-cache.ts` (verified: no reference in `src/app/api/auth/route.ts`). This is consistent with `api-cache.ts` only ever caching `leads`/`stats` response bodies (`src/lib/api-cache.ts` is imported by exactly three files: `src/app/api/leads/route.ts`, `src/app/api/monitor/route.ts`, `src/app/api/stats/route.ts` — verified by repository search).

---

### 3.6 `access_permissions.id` (BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY)

**Written by (INSERT, auto-generated) and (DELETE, whole-table):**
- `POST /api/leads` operation `saveAccessPermissions` — `route.ts:1074-1104`.
  - `DELETE`: `client.from('access_permissions').delete().neq('id', 0)` (`route.ts:1080`) — deletes every row (all `id` values are `> 0` from `GENERATED ALWAYS AS IDENTITY`, so `id <> 0` is true for every existing row).
  - `INSERT`: `client.from('access_permissions').insert(rows)` (`route.ts:1096`), where `rows` is freshly built from the `teleAccess`/`salesAccess` objects (`route.ts:1083-1093`); no `id` key is set — each surviving row receives a newly generated `id`, distinct from whatever `id` value the equivalent logical permission had before the delete.

**Call site:** `apiSaveAccessPermissions()` (`src/lib/supabase.ts:527-533`) is called once, from `src/components/crm/admin-panel.tsx:1611` (`SettingsTab.handleSave`).

**Cache update:** `saveAccessPermissions` is present in `WRITE_OPERATIONS` (`route.ts:13`) and triggers `invalidateAllCaches()` on success (`route.ts:1103`).

**Realtime propagation:** `access_permissions` is never added to `supabase_realtime` in any `.sql` file in this repository. No realtime path exists.

---

### 3.7 `meetings.id`, `meetings.lead_id` (BIGINT / BIGINT NOT NULL)

**Insufficient evidence of any application-level write to this table.** A repository-wide search for `.from('meetings')` inside `src/` returned zero matches. `src/app/api/meetings/route.ts` — the only route whose name references "meetings" — reads from and writes to the **`leads`** table exclusively (`client.from('leads')` at `route.ts:56,183`); it never references a `meetings`-named table. The `meetings` table is created by `supabase-migration-stage1.sql:188-210` (including its own `id`/`lead_id` columns and RLS policies) but no `INSERT`, `UPDATE`, or `SELECT` against it exists anywhere in `src/`.

---

### 3.8 `transfers.id`, `transfers.lead_id` (BIGINT / BIGINT NOT NULL)

**`id`:** written by INSERT only, auto-generated — `POST /api/transfers` (`src/app/api/transfers/route.ts:186-257`), `client.from('transfers').insert({ lead_id: Number(lead_id), from_name, to_name, from_role: from_role || session.role, to_role: to_role || 'sales', reason: reason || null, transferred_by: session.uname }).select('*').single()` (`route.ts:218-230`). No `id` key set; never subsequently updated (no `UPDATE transfers` statement exists anywhere in this repository).

**`lead_id`:** written once, at INSERT, as `Number(lead_id)` (`route.ts:221`) where `lead_id` is destructured from the request body as `string | number` (`route.ts:197-198`, no type-narrowing beyond the object-literal annotation) and validated only for truthiness (`if (!lead_id) return ... 400`, `route.ts:207-209`) — no check that `Number(lead_id)` is not `NaN`.

**Call site:** `apiCreateTransfer()` (`src/lib/supabase.ts:662-681`) is called from `src/components/crm/tele-sheet.tsx:1454-1461` (inside `handleTransferToSales`, after the corresponding `leads` row has already been updated — `tele-sheet.tsx:1448`). This is the only call site found for `apiCreateTransfer()` in `src/components`.

**Read (not write) of `lead_id`:** `GET /api/transfers` (`route.ts:43-183`) reads `transfer.lead_id` values already stored (`route.ts:118`) and uses them to build a second query, `client.from('leads').select(...).in('id', leadIds)` (`route.ts:122-124`) — `leadIds` is passed as `.filter(Boolean)` on the array of `transfer.lead_id` numeric values (`route.ts:118`), with no additional coercion (they are already numbers as returned from the prior `SELECT`).

**Cache update:** `/api/transfers` does not import `src/lib/api-cache.ts` (verified). No cache invalidation call exists in this file for either `id` or `lead_id`.

**Realtime propagation:** `transfers` is never added to `supabase_realtime` in any `.sql` file in this repository. No realtime path exists.

---

### 3.9 `daily_reports.id`, `.calls_made`, `.meetings_done`, `.deals_closed`, `.revenue` (BIGINT IDENTITY / INT / INT / INT / NUMERIC(12,2))

**Written by (single UPSERT statement covering all five columns at once):**
`POST /api/daily-reports` (`src/app/api/daily-reports/route.ts:88-169`):
```
client.from('daily_reports').upsert(
  {
    employee_name,
    employee_role,
    report_date,
    calls_made: Math.max(0, Number(calls_made) || 0),
    meetings_done: Math.max(0, Number(meetings_done) || 0),
    deals_closed: Math.max(0, Number(deals_closed) || 0),
    revenue: Math.max(0, Number(revenue) || 0),
    notes: notes ? String(notes).slice(0, 2000) : null,
  },
  { onConflict: 'employee_name,report_date' }
)
```
(`route.ts:141-155`). `id` is not set in this payload — on first insert for a given `(employee_name, report_date)` pair it is auto-generated; on conflict (same employee + date), the `UNIQUE (employee_name, report_date)` constraint (`supabase-migration-stage1.sql:242`) causes PostgREST's `upsert` to update the existing row's `id`-bearing record in place (the `id` value of an already-existing row is preserved across the upsert; a genuinely new `(employee_name, report_date)` pair receives a new `id`).

**Coercion behavior, observed directly from the code above:**
- `Number(x) || 0` — if `x` is `undefined`, `null`, an empty string, or a non-numeric string, `Number(x)` produces `NaN` or `0`/`null`-coerced-to-`0`, and `NaN || 0` evaluates to `0`; a valid numeric string or number passes through unchanged (unless it is exactly `0`, in which case `0 || 0` is also `0` — behaviorally identical to any falsy numeric input).
- `Math.max(0, ...)` — any negative input, after the `Number(...) || 0` step, is clamped to `0` if the coercion already produced a non-negative number; a genuinely negative *valid* number (e.g. `-5`) passed through `Number(-5) || 0` yields `-5` (a nonzero, truthy value is preserved by `||`), and `Math.max(0, -5)` then clamps it to `0`.
- These four fields are always written as JS `number` values in the outbound Supabase client call — the raw request-body values (`calls_made?`, `meetings_done?`, `deals_closed?`, `revenue?`, all typed optional in the destructuring at `route.ts:109-118`) are never passed through to the database uncoerced.

**Call-site count for the client wrapper:**
- `apiSubmitDailyReport()` (`src/lib/supabase.ts:769-790`) — a repository-wide search for `apiSubmitDailyReport` matched only its own definition (`supabase.ts:769`) and its own type/JSDoc reference; **zero call sites exist under `src/components`.**
- `apiGetDailyReports()` (`supabase.ts:750-767`) — same search pattern, zero call sites under `src/components`.
- The routed component named `daily-report.tsx` (`src/components/crm/daily-report.tsx`) contains zero occurrences of the strings `revenue`, `deals`, `calls_made`, `meetings_done`, or `deals_closed` (verified by direct search of that file). It computes its own, differently-sourced statistics from the `leads`/`archivedLeads` Zustand state, unrelated to the `daily_reports` table.
- `src/components/crm/ai/ai-panel.tsx:235,282` sends a literal `revenue: 0, // not tracked yet` value to `POST /api/ai` (an AI-prompt-construction endpoint, not a database write — see `src/app/api/ai/route.ts:112-113`, which reads `Number(data.revenue) || 0` purely to interpolate into an LLM prompt string). This is not a read from, or write to, `daily_reports.revenue`.

**Conclusion of this subsection (observed, not inferred):** all five numeric columns on `daily_reports` have one fully implemented, reachable, authenticated write path (`POST /api/daily-reports`, `requireAuth` at `route.ts:90-91`, with an additional same-user-or-admin check at `route.ts:131-137`), and zero call sites for that path's client wrapper anywhere in the UI code in this repository.

**Cache update:** `/api/daily-reports` does not import `src/lib/api-cache.ts` (verified). No cache invalidation call exists in this file.

**Realtime propagation:** `daily_reports` is never added to `supabase_realtime` in any `.sql` file in this repository. No realtime path exists.

---

### 3.10 `whatsapp_messages.id`, `whatsapp_messages.lead_id` (BIGINT IDENTITY / BIGINT NOT NULL)

**Insufficient evidence of any application-level write to this table.** A repository-wide search for `.from('whatsapp_messages')` inside `src/` returned zero matches. The table is created by `supabase-migration-stage1.sql:253-266` (including RLS policies for `whatsapp_messages_select_authenticated`/`whatsapp_messages_insert_authenticated`) but no route, component, or store action in `src/` references it. The application's actual "WhatsApp-style" messaging feature (`/api/chat`, §3.2/§3.3) writes to `lead_notes`, not to this table.

---

### 3.11 `notifications.id`, `notifications.lead_id` (BIGINT IDENTITY / BIGINT)

**`id`:** written by INSERT only, auto-generated, from three independent locations:
1. `POST /api/notifications` (client-triggerable) — `src/app/api/notifications/route.ts:100-162`, `client.from('notifications').insert({ target_user: target_user || null, target_role: target_role || null, type, message: message.slice(0, 500), lead_id: lead_id ? Number(lead_id) : null }).select('*').single()` (`route.ts:139-149`).
2. `POST /api/leads` operation `update`, server-side, only when `'attended' in updates && updates.attended` is true — `src/app/api/leads/route.ts:598-624`, `client.from('notifications').insert({ target_user: leadForNotif.tele_name, target_role: 'tele', type: 'attendance', message, lead_id: Number(id) })` (`route.ts:612-618`).
3. `POST /api/transfers`, server-side, always attempted after a successful transfer insert — `src/app/api/transfers/route.ts:238-249`, `client.from('notifications').insert({ target_user: to_name, target_role: to_role || 'sales', type: 'transfer', message: ..., lead_id: Number(lead_id) })` (`route.ts:239-245`), wrapped in its own `try/catch` (`route.ts:238,246-249`) — a failure here does not roll back the already-created `transfers` row.

**`lead_id`:** in all three insert locations above, an explicit `Number(...)` coercion (or a `lead_id ? Number(lead_id) : null` guard, in the client-facing route) is applied before the value reaches the Supabase client call.

**Call site for the client-facing path (#1):** no client wrapper for `POST /api/notifications` (creating a notification) was found in `src/lib/supabase.ts` — only `apiGetNotifications`, `apiMarkNotificationRead`, and `apiMarkAllNotificationsRead` are exported (`supabase.ts:566,583,595`). A repository-wide search for a raw `fetch('/api/notifications'` with `method: 'POST'` under `src/components` returned zero matches. Path #1 (`POST /api/notifications`) is, like the routes documented in §3.7/§3.10, reachable and authenticated (`requireAuth` at `route.ts:101-102`) but not exercised by any UI code found in this repository. Paths #2 and #3 are exercised, as side effects of the live `update`/transfer-creation flows documented in `docs/WRITE_PATH_ANALYSIS.md` §4.3 and §4.5.

**Realtime propagation:** `notifications` is never added to `supabase_realtime` in any `.sql` file in this repository. The client instead polls `GET /api/notifications` every 60 seconds (`src/components/layout/topbar.tsx`, `setInterval(loadNotificationsFromServer, 60000)`, confirmed in prior audit work on this repository — file re-verified present in this session's search results for `apiMarkNotificationRead`/`apiMarkAllNotificationsRead` call sites, both at `src/components/layout/topbar.tsx:128,139`).

**Cache update:** `/api/notifications` does not import `src/lib/api-cache.ts` (verified). No cache invalidation call exists in this file.

---

### 3.12 `audit_log.id`, `audit_log.actor_id` (BIGINT IDENTITY / BIGINT)

**`id`:** written by INSERT only, auto-generated, from two independent locations:
1. `logAuditEvent()` helper — `src/app/api/audit-log/helpers.ts:27-63`, `client.from('audit_log').insert({ actor_id: session.uid, actor_username: session.uname, actor_role: session.role, action, target_type: targetType || null, target_id: targetId ? String(targetId) : null, metadata: metadata || null, ip_address: ipAddress })` (`helpers.ts:45-54`). Called from `src/app/api/auth/route.ts` at five sites: `change-password` (`route.ts:187`), `create-user` (`route.ts:242`), `toggle-user` (`route.ts:282`), `reset-password` (`route.ts:305`), `delete-user` (`route.ts:336`).
2. `POST /api/audit-log` (direct HTTP route) — `src/app/api/audit-log/route.ts:96-153`, `client.from('audit_log').insert({ actor_id: session.uid, actor_username: session.uname, actor_role: session.role, action, target_type: target_type || null, target_id: target_id ? String(target_id) : null, metadata: metadata || null, ip_address: ip })` (`route.ts:127-138`).

**`actor_id`:** in both locations, the value written is `session.uid` directly, with **no explicit type coercion** (`SessionPayload.uid` is typed `string | number`, `src/lib/session.ts:41`). No call site in either `helpers.ts:45` or `route.ts:130` applies `Number()`, `String()`, or any other conversion before the value is handed to the Supabase client's `insert()` call.

**`metadata` (JSONB, documented for completeness — not itself a numeric column):** a review of every call to `logAuditEvent()` in this repository found the following `metadata` payloads: `{ username, role }` (`auth/route.ts:242`, both strings), `{ isActive }` (`auth/route.ts:282`, boolean), and no `metadata` argument at all for `change-password`, `reset-password`, `delete-user` (`auth/route.ts:187,305,336`). **No call site was found that places a numeric value inside `audit_log.metadata`.**

**Call site (direct route, #2):** no client wrapper or raw `fetch('/api/audit-log'` with `method: 'POST'` was found anywhere under `src/components`. Path #2 is reachable and `requireAdmin`-gated (`route.ts:100-103`) but not exercised by any UI code found in this repository; in practice, every audit-log write observed in this codebase happens through path #1 (the in-process helper, called directly by `/api/auth`, with no HTTP round-trip).

**Cache update:** neither `helpers.ts` nor `audit-log/route.ts` imports `src/lib/api-cache.ts` (verified).

**Realtime propagation:** `audit_log` is never added to `supabase_realtime` in any `.sql` file in this repository. No realtime path exists.

---

### 3.13 `settings.value` → embedded numeric `target.value` (JSONB column; the numeric member has no independent SQL type)

This is not a SQL-typed numeric column — `settings.value` is declared `JSONB DEFAULT '{}'` (`supabase-schema.sql:136`). It is documented here because the application stores a JS object containing a `number` field inside it, under the row `settings.key = 'target'`.

**Client-side type:** `interface TargetSettings { type: 'meetings' | 'money' | 'closings'; value: number }` (`src/components/crm/dashboard.tsx:24-27`).

**Write path — exactly one, defined locally inside `dashboard.tsx`, not via `src/lib/supabase.ts`:**
```
async function apiSaveTarget(settings: TargetSettings): Promise<boolean> {
  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'saveSetting', data: { key: 'target', value: settings } }),
  })
  return res.ok
}
```
(`dashboard.tsx:220-232`.) Called once, from `handleSaveTarget` (`dashboard.tsx:910-919`), itself invoked by a "Save" button in the target-setting dialog (`dashboard.tsx:1674-1680`).

**Server-side handling:**
`POST /api/leads` operation `saveSetting` (`route.ts:834-846`):
```
case 'saveSetting': {
  if (session.role !== 'admin') return forbiddenResponse('...')
  const { key, value } = data as { key: string; value: unknown }
  const { error } = await client.from('settings').upsert({ key, value }, { onConflict: 'key' })
  ...
  return success({ success: true })
}
```
The entire `value` JSONB column is replaced wholesale by the upsert — there is no `jsonb_set`/partial-path update anywhere in this repository; the previous JSON object at `key='target'` is fully overwritten by whatever object the client sent, and any field previously present in the JSON that is not present in the new object is lost (e.g. if a future caller sent `{ value: 10 }` without `type`, the stored `type` would be gone — not observed to happen in current code, documented as a structural fact of `upsert({key, value})` replacing the whole column).

**Read path:**
```
async function apiGetTarget(): Promise<TargetSettings | null> {
  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'getSetting', data: 'target' }),
  })
  ...
}
```
(`dashboard.tsx:201-218`), calling `POST /api/leads` operation `getSetting` (`route.ts:848-867`): `client.from('settings').select('value').eq('key', key).single()` (`route.ts:853-857`), returning `row?.value ?? null` (`route.ts:866`) with no role restriction (any `requireAuth`-passing session may call `getSetting` for any key).

**Authorization/authentication, observed directly from the code:**
- Neither `apiGetTarget()` nor `apiSaveTarget()` sets an `Authorization` header on its `fetch()` call (`dashboard.tsx:203-207`, `dashboard.tsx:222-226`) — both build the request with only `{ 'Content-Type': 'application/json' }`. This is a different code path from every other write function in `src/lib/supabase.ts`, all of which route through `serverOp()` (`supabase.ts:80-103`), which calls `authHeaders()` (`supabase.ts:70-78`) to attach `Authorization: Bearer <token>` from `localStorage`.
- `POST /api/leads`'s handler requires a valid session for every operation before the `switch` statement is reached: `const session = await requireAuth(request); if (!session) { return unauthorizedResponse() }` (`route.ts:366-370`). `requireAuth()` (`src/lib/auth-guard.ts:101-110`) calls `extractTokenFromRequest(request)` (`src/lib/session.ts:152-159`), which reads the `authorization` header and returns `null` if absent (`session.ts:153-154`).
- `saveSetting` additionally requires `session.role === 'admin'` (`route.ts:835`, `if (session.role !== 'admin') return forbiddenResponse(...)`).

**Store persistence:** `setTargetSettings()` (`src/lib/store.ts:265-266,779-780`) updates the Zustand store's `targetSettings` field in memory. The Zustand `persist` middleware's `partialize` function (`store.ts:851-861`) enumerates the fields that survive to `localStorage['venom-crm-storage']`: `currentUser, currentRole, isAuthenticated, userId, username, selectedTeleMember, selectedSalesMember, theme, sessionToken`. **`targetSettings` is not among them** — it is not persisted by the Zustand middleware and is re-fetched from the server on every mount via the `useEffect` at `dashboard.tsx:307-317` (`apiGetTarget()`).

**Empty-string / NaN / null handling, observed directly from the code:**
- The numeric input is bound as `<input type="number" value={editTargetValue} onChange={(e) => setEditTargetValue(Number(e.target.value))} min={1} dir="ltr" />` (`dashboard.tsx:1657-1664`).
- `Number('')` evaluates to `0`. `Number()` on a non-numeric string evaluates to `NaN`.
- The Save button's disabled condition is `disabled={savingTarget || editTargetValue < 1}` (`dashboard.tsx:1676`). In JavaScript, any comparison with `NaN` (including `NaN < 1`) evaluates to `false`.
- `JSON.stringify(NaN)` produces the JSON literal `null` (per the ECMAScript `JSON.stringify` specification for non-finite numbers) inside the request body constructed at `dashboard.tsx:222-226`.
- These three facts are stated as directly observed properties of the code and the JavaScript/JSON specifications; no claim is made here about whether the `type="number"` input element's own browser-level input filtering can produce a value for which `Number(e.target.value)` is `NaN` in practice — that depends on browser behavior not present in this repository's source and is not verified here. **Insufficient evidence to state whether this code path is reachable in any specific browser.**

**Cache update:** `saveSetting` is **not invalidated**. `WRITE_OPERATIONS` (`route.ts:9-14`) contains the string `'setSetting'`; the `switch` case is named `'saveSetting'` (`route.ts:834`). `isWriteOp = WRITE_OPERATIONS.has(operation)` (`route.ts:388`) evaluates to `false` for `operation === 'saveSetting'`, so `success()` (`route.ts:389-392`) does not call `invalidateAllCaches()` for this operation. `getSetting` does not call `success()` at all — it returns `NextResponse.json({ data: row?.value ?? null })` directly (`route.ts:866`) and is a read, not a write.

**Realtime propagation:** `settings` is never added to `supabase_realtime` in any `.sql` file in this repository. No realtime path exists.

**Independent writers:** exactly one write path was found (`saveSetting` via `apiSaveTarget()`), so this field does not have multiple independent writers in the current codebase.

---

## 4. Triggers

A repository-wide search for `CREATE TRIGGER` across every `*.sql` file in this repository returned **zero matches**. No trigger of any kind — for any table, for any column, numeric or otherwise — exists in this repository's SQL files.

Per the scope limitation stated in §1.5: this cannot rule out a trigger existing in the live, deployed Supabase database that was created outside of these checked-in files (e.g. directly in the Supabase SQL editor and never exported to this repository). **Insufficient evidence to state whether the deployed database contains a trigger not present in this repository.**

---

## 5. RPCs

Four RPC functions are defined in this repository, all in `supabase-rpc-migration.sql`, all declared `LANGUAGE sql STABLE` (a PostgreSQL `STABLE` function is prohibited by the database from modifying the database — it may only read):

| RPC | Definition | Returns (all numeric) | Called from |
|---|---|---|---|
| `get_per_tele_stats()` | `supabase-rpc-migration.sql:13-32` | `total, attended, no_show, meetings, closed_won` (all `BIGINT`) | `src/app/api/stats/route.ts:136` |
| `get_per_sales_stats()` | `supabase-rpc-migration.sql:35-54` | same shape | `src/app/api/stats/route.ts:137` |
| `get_call_analytics()` | `supabase-rpc-migration.sql:57-69` | `total_calls, success_count, fail_count` (all `BIGINT`) | `src/app/api/stats/route.ts:138` |
| `get_weekly_calls(days_ago TIMESTAMPTZ)` | `supabase-rpc-migration.sql:73-85` | `day_of_week INTEGER, count BIGINT` | `src/app/api/stats/route.ts:192` |

All four are `SELECT ... FROM leads ... GROUP BY ...` aggregations (`supabase-rpc-migration.sql:21-32,43-54,62-69,77-85`). None of them write to any table, and none of them read or write any of the numeric columns enumerated in §2 (`leads` has no numeric business column other than `id`, and these RPCs aggregate over `tele_name`, `sales_name`, `attended`, `meeting_date`, `sales_status`, `status`, `contact_result`, `created_at` — none of which is numeric). Their numeric outputs (`total`, `attended`, `no_show`, etc.) are computed at query time and are **not stored in any table** — they exist only in the JSON response of `GET /api/stats`, which is cached in `src/lib/api-cache.ts`'s `statsCache` for up to the TTL defined at `src/lib/api-cache.ts:66` (`STATS_CACHE_TTL = 30_000`, i.e. 30 seconds) and served from `GET /api/stats`'s own `Cache-Control: private, max-age=300, stale-while-revalidate=600` response header (`src/app/api/stats/route.ts:261,456` — note the in-memory TTL constant and the HTTP header's `max-age` value are different numbers, 30s vs. 300s; both are present in the code as separate, independent values, without further comment here on which one governs actual client behavior).

**A fifth RPC name, `get_duplicate_phones`, is referenced in application code** (`src/app/api/duplicates/route.ts:85`, `client.rpc('get_duplicate_phones')`) but **no `CREATE FUNCTION get_duplicate_phones` statement exists in any `.sql` file in this repository.** The calling code at `route.ts:81-97` treats a `.rpc()` error as "RPC not available" and falls back to a different, in-application computation path (`fetchDuplicatesViaTwoPass`, `route.ts:148-240`) — this fallback behavior is present in the code regardless of whether `get_duplicate_phones` is actually defined in the live database. **Insufficient evidence to state whether `get_duplicate_phones` exists in the deployed database** — its SQL definition is simply absent from this repository.

No RPC in this repository writes any numeric field, or any field of any kind, to any table.

---

## 6. Summary Table

| Field | SQL Type | Live write path(s) exist? | Dead write path(s) exist? | Trigger | Realtime | Cache invalidated on write? |
|---|---|---|---|---|---|---|
| `leads.id` | BIGSERIAL | Yes (`create`, `bulkCreate`, sheets-sync) | — | None (§4) | Yes (`leads` table) | Yes, except sheets-sync (§3.1) |
| `lead_notes.id` | BIGSERIAL | No confirmed live UI path | Yes (`addNote`, `/api/chat`) | None | No | `addNote` yes; `updateNote` no (`success()` never called) |
| `lead_notes.lead_id` | BIGINT | No confirmed live UI path | Yes (`addNote`, `/api/chat`) — no `Number()` coercion at either site | None | No | Same as `.id` |
| `team_members.id` | BIGSERIAL | Yes (`addTeamMember` via `/api/leads`) | Yes (`/api/team` POST `add`) | None | No | `/api/leads` path: yes. `/api/team` path: no (no cache import) |
| `app_users.id` | BIGSERIAL | Yes (`create-user`) | — | None | No | N/A (no cache import) |
| `access_permissions.id` | BIGINT IDENTITY | Yes (`saveAccessPermissions`) | — | None | No | Yes |
| `meetings.id` / `.lead_id` | BIGINT IDENTITY / BIGINT | Insufficient evidence of any write path (§3.7) | — | None | No | N/A |
| `transfers.id` / `.lead_id` | BIGINT IDENTITY / BIGINT | Yes (`POST /api/transfers`) | — | None | No | No (no cache import) |
| `daily_reports.*` (4 numeric cols) | BIGINT IDENTITY / INT×3 / NUMERIC(12,2) | Route exists and is reachable | Yes — zero UI call sites for the entire feature (§3.9) | None | No | No (no cache import) |
| `whatsapp_messages.id` / `.lead_id` | BIGINT IDENTITY / BIGINT | Insufficient evidence of any write path (§3.10) | — | None | No | N/A |
| `notifications.id` / `.lead_id` | BIGINT IDENTITY / BIGINT | Yes, 2 of 3 insert sites are exercised (`/api/leads` update, `/api/transfers`) | Yes, `POST /api/notifications` direct-create has no client caller | None | No | No (no cache import) |
| `audit_log.id` / `.actor_id` | BIGINT IDENTITY / BIGINT | Yes (`logAuditEvent()` helper, 5 call sites) | Yes (`POST /api/audit-log` direct route has no client caller) | None | No | N/A (no cache import) |
| `settings.value` → `target.value` (JSONB-embedded) | JSONB (numeric member untyped) | Route exists (`saveSetting`) and is called (`apiSaveTarget`) | — | None | No | No (`WRITE_OPERATIONS` set contains `'setSetting'`, case is named `'saveSetting'`) |

Per the task instructions, no entry in this table, and no statement in this document, characterizes any of the above as correct, incorrect, intentional, or defective — each entry states only what was directly observed in the source.

---

*End of Numeric Field Write Matrix. No fixes were proposed or applied, no probabilities were assigned, and no root causes were inferred. Per the audit workflow, this phase stops here for review.*
