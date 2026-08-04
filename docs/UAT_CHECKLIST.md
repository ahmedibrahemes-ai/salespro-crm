# UAT / Manual Regression Test Checklist — SalesPro CRM

**Purpose:** manual verification checklist covering every business workflow, written after a full audit and stabilization pass (see `docs/WRITE_PATH_ANALYSIS.md`, `docs/NUMERIC_FIELD_WRITE_MATRIX.md`, `docs/LEAD_LIFECYCLE_INVESTIGATION.md`, `docs/DATA_VISIBILITY_INVESTIGATION.md`, `docs/LEAD_REPLAY_INVESTIGATION.md` for the underlying evidence). No code was changed to produce this document.

**How to use this document:** each test case has an ID, Preconditions, numbered Test Steps, an Expected Result, and Failure Conditions (what to look for that indicates a regression). Run cases in order within a section where they depend on state from a prior case (noted explicitly). Log the actual result, pass/fail, browser, and account used for every case.

---

## 0. Test Environment Setup

### 0.1 Required test accounts

| Role | Suggested username | Suggested display name | Notes |
|---|---|---|---|
| Tele | `tele_test1` | `TestTele1` | Username and display name **intentionally different** — see 0.2 |
| Tele (matched) | `testtele2` | `TestTele2` | Username matches display name — the "clean" baseline account |
| Sales | `sales_test1` | `TestSales1` | Username and display name **intentionally different** |
| Sales (matched) | `testsales2` | `TestSales2` | Username matches display name |
| Admin | `admin_test` | `AdminTest` | For all admin-only workflows |

### 0.2 Why two account shapes per role

An earlier production defect caused newly created/imported leads to become invisible to the very user who created them whenever their login `username` differed from their `display_name`. This was fixed in code, but the fix only applies to **sessions started after the fix was deployed** and does **not** retroactively correct historical data. Testing with **both** a matched and a mismatched account on each role lets you confirm:
- The mismatched account, logged in **fresh** (after the fix), behaves identically to the matched account (this is the expected, correct state).
- If it does *not* behave identically, that is the specific regression to report first — see test case **I2**.

### 0.3 Multi-tab / multi-browser requirement

Several workflows (Realtime Synchronization, Notifications, Transfer/Attendance) require **two simultaneous logged-in sessions** — use two different browsers, or one normal + one private/incognito window, so cookies/localStorage don't collide.

### 0.4 General preconditions for every section below

- The application is deployed with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` configured (not in "demo mode").
- At least the five test accounts in 0.1 exist and are active.
- Browser DevTools Network/Console tabs are available for cases that ask you to inspect requests or simulate failures (e.g. via "offline" throttling).

---

## 1. Authentication

### AUTH-1 — Successful login
**Preconditions:** a valid, active account exists.
**Test Steps:**
1. Open the app (logged out state — login screen shown).
2. Enter valid username and password.
3. Submit.
**Expected Result:** redirected to the dashboard; sidebar/topbar show the correct display name and role-appropriate menu items; session token stored (check `localStorage['venom-session']` is set).
**Failure Conditions:** login hangs, wrong user's data appears, wrong role's menu items appear, or the token is missing from localStorage after a successful login.

### AUTH-2 — Invalid credentials
**Preconditions:** none.
**Test Steps:**
1. Enter a valid username with a wrong password.
2. Submit.
**Expected Result:** a generic Arabic error message ("اسم المستخدم أو كلمة المرور غير صحيحة") is shown; no token is stored; the app stays on the login screen.
**Failure Conditions:** the error message reveals whether the username or the password specifically was wrong (an information-disclosure regression); the app navigates away from login.

### AUTH-3 — Rate limiting / lockout
**Preconditions:** a valid test account.
**Test Steps:**
1. Attempt login with the correct username and a wrong password 5 times in a row, from the same browser/IP.
2. Attempt a 6th time, even with the **correct** password.
**Expected Result:** the 6th attempt (and any further attempts for ~15 minutes) is rejected with a "locked temporarily, try again in N minutes" message, even with correct credentials.
**Failure Conditions:** the 6th attempt succeeds; the lockout never lifts after 15 minutes; a *different* account or a different IP is also locked out (lockout should be scoped to username+IP).

### AUTH-4 — Session persists across refresh
**Preconditions:** logged in (AUTH-1 complete).
**Test Steps:**
1. Reload the page (F5 / browser refresh).
**Expected Result:** the user remains logged in, on the same view, without being asked to log in again; a brief loading state may appear before data re-populates.
**Failure Conditions:** the user is bounced to the login screen after a refresh despite a valid, non-expired session.

### AUTH-5 — Session expiry / server-side revocation
**Preconditions:** two admin sessions available (one to act, one to be acted upon), OR one regular account whose admin can deactivate it.
**Test Steps:**
1. Log in as a regular (non-admin) test account in Tab A.
2. In a separate admin session, deactivate that account (Admin Panel → Users → toggle inactive).
3. Within the next 30 seconds, perform any action in Tab A (e.g. edit a lead field).
**Expected Result:** within a short window (server-side revocation cache TTL is 30 seconds), Tab A's next server call fails with a session/auth error and the user is logged out or shown a re-login prompt.
**Failure Conditions:** Tab A continues to successfully read/write data indefinitely after deactivation.

### AUTH-6 — Change password
**Preconditions:** logged in as any role.
**Test Steps:**
1. Navigate to the change-password flow (wherever it's exposed in the UI for this account).
2. Enter the current password and a new password meeting the strength rule (8+ chars, at least one letter, one number).
3. Submit.
4. Log out, log back in with the new password.
**Expected Result:** password change succeeds; login with the old password now fails; login with the new password succeeds.
**Failure Conditions:** old password still works after change; new password is rejected on next login; weak passwords (e.g. `"1234567"`, no letters) are accepted.

---

## 2. Lead Creation (single "+ Add" row)

### CREATE-1 — Tele creates a lead
**Preconditions:** logged in as a tele account (use the **mismatched-username** tele account first — see 0.2).
**Test Steps:**
1. Navigate to "شيت التيلي" (my sheet).
2. Click "+ إضافة" and fill in customer name + phone (unique, not previously used) + store URL.
3. Save.
**Expected Result:** a success toast appears; the new row appears **immediately at the top** of the same sheet, under this tele account, without needing a manual refresh.
**Failure Conditions:** success toast appears but the row is **not** visible anywhere in the current sheet after a few seconds (this is the primary regression this checklist exists to catch — see also SEARCH-AFTER-IMPORT below).

### CREATE-2 — Sales creates a lead
**Preconditions:** logged in as a sales account (mismatched-username account first).
**Test Steps:** same as CREATE-1, on "شيت السيلز".
**Expected Result / Failure Conditions:** same as CREATE-1.

### CREATE-3 — Admin creates a lead assigned to a specific member
**Preconditions:** logged in as admin.
**Test Steps:**
1. Navigate to either sheet, select a specific tele/sales member from the admin member-picker (not "الكل"/all).
2. Add a new lead.
**Expected Result:** the lead is created with ownership set to the **selected member**, not the admin — it appears when that member later logs in and views their own sheet.
**Failure Conditions:** the lead is owned by "admin" instead of the selected member, or does not appear under the selected member's sheet when they log in.

### CREATE-4 — Required field validation
**Preconditions:** logged in as any role, on a sheet with the "+ Add" row open.
**Test Steps:**
1. Leave customer name and phone both empty, click save.
2. Fill only customer name, leave phone empty, click save.
**Expected Result:** a warning toast ("اسم العميل ورقم الجوال مطلوبان") appears both times; no row is created.
**Failure Conditions:** a lead is created with missing required fields.

### CREATE-5 — Duplicate-phone warning is shown on single add
**Preconditions:** a lead with a known phone number already exists (create one via CREATE-1 first, note the exact phone).
**Test Steps:**
1. As the same or a different user, add a new lead via "+ Add" using the **same phone number** (any equivalent format — with/without leading zero, with/without country code).
**Expected Result:** the new lead is still created (duplicates are allowed by design), **and** a warning toast appears naming the existing owner (e.g. "تنبيه: هذا الرقم موجود بالفعل لدى ...").
**Failure Conditions:** no warning toast appears at all (this was a fixed bug — the server always computed this warning but the client silently discarded it before the fix).

---

## 3. Bulk Import

### BULK-1 — Bulk-add page paste
**Preconditions:** logged in as tele or sales, on "إضافة ليدز".
**Test Steps:**
1. Paste 3–5 rows of tab/newline-separated data (phone + store URL + name) into the paste area.
2. Review the parsed rows; confirm each has no error state.
3. Click submit.
**Expected Result:** success toast with the count created; all rows appear in the corresponding sheet immediately.
**Failure Conditions:** some rows silently vanish (created server-side, per success toast, but never appear in the sheet — check both the sheet view and, as admin, the "All Leads" tab to see if it truly wasn't created vs. just not visible).

### BULK-2 — Quick Paste dialog (tele sheet)
**Preconditions:** logged in as tele, on "شيت التيلي".
**Test Steps:**
1. Press Ctrl+V (or the Quick Paste button) to open the dialog.
2. Paste several rows, review, save.
**Expected Result:** same as BULK-1, scoped to the tele sheet.
**Failure Conditions:** same as BULK-1.

### BULK-3 — Quick Paste dialog (sales sheet)
**Preconditions/Steps/Expected/Failure:** same as BULK-2, on the sales sheet.

### BULK-4 — Excel/file import
**Preconditions:** an `.xlsx` or `.csv` file with a small set of valid rows (phone, store URL, name columns).
**Test Steps:**
1. On "إضافة ليدز", use the file-upload control to import the file.
2. Confirm rows are parsed into the table with the correct phone/URL/name column mapping (not swapped).
3. Submit.
**Expected Result:** rows import correctly, phone and store URL are not swapped, all appear in the target sheet.
**Failure Conditions:** phone and URL values are swapped between columns; rows fail to parse; rows parse but never appear post-submit.

### BULK-5 — Row validation blocks submission
**Preconditions:** on the bulk-add page with the paste table open.
**Test Steps:**
1. Create a row with neither a phone (or a phone under 8 digits) nor a store URL.
2. Attempt to submit.
**Expected Result:** submission is blocked; the invalid row is flagged with an error message; no partial submission occurs.
**Failure Conditions:** the batch submits anyway, silently dropping or mis-creating the invalid row.

### BULK-6 — Large batch (>200 rows) full visibility
**Preconditions:** ability to generate/paste 250+ valid rows (can be synthetic test data with unique phone numbers).
**Test Steps:**
1. Submit a batch of 250+ rows via bulk-add.
2. Immediately after the success toast, scroll/count all rows now visible in the destination sheet (they should all be visible immediately, since the create response returns the full created array, not just a page of it).
3. Reload the page from scratch (hard refresh) and recount.
**Expected Result:** immediately after submit, all 250+ rows are present (added directly from the response, not paginated). After a hard refresh, all rows are still present once background loading completes (may take a few seconds longer for very large total lead counts).
**Failure Conditions:** any created row is permanently missing after a hard refresh and reasonable wait (10+ seconds).

---

## 4. Duplicate Detection

### DUP-1 — Pre-submit duplicate badge, already-loaded lead
**Preconditions:** a known existing lead's phone number, and that lead is already loaded in the current session (e.g. created earlier in this same session).
**Test Steps:**
1. On bulk-add, paste a row using that same phone number.
**Expected Result:** the row is flagged with an amber "Duplicate" badge before submission.
**Failure Conditions:** no duplicate badge appears despite the phone genuinely existing.

### DUP-2 — Pre-submit duplicate badge, NOT yet loaded in this session (server-authoritative check)
**Preconditions:** open a **brand-new** browser tab/session (so background loading of all leads has not necessarily completed), and have a phone number that exists in the database but was created by a **different** user/session.
**Test Steps:**
1. Immediately (within 1-2 seconds of login, before background loading likely completes) go to bulk-add and paste a row with that phone number.
2. Wait ~1 second (debounce window) and observe the row's duplicate state.
**Expected Result:** within about half a second, the row becomes flagged as a duplicate — this now comes from a direct server check, not just the client's local (possibly incomplete) lead list.
**Failure Conditions:** the row is never flagged as a duplicate in this session, even after waiting several seconds.

### DUP-3 — Duplicate reported, then searching finds it
**Preconditions:** none beyond DUP-1/DUP-2.
**Test Steps:**
1. After seeing a duplicate flag/warning for a phone number, search for that exact phone number in the relevant sheet's search box.
**Expected Result:** the search finds the existing lead (assuming it belongs to the searching user, or the searching user is admin/has cross-visibility access).
**Failure Conditions:** the duplicate check says the phone exists, but searching for it in the current user's own sheet finds nothing, **and** the current user should legitimately own or be able to see that lead. (If the lead legitimately belongs to a different, unrelated team member, not finding it in *your own* sheet is correct — check whether it's visible via the admin "All Leads" view or the Customer Status page instead, which are not owner-restricted the same way, before concluding this is a regression.)

### DUP-4 — Bulk-create duplicate warning surfaced
**Preconditions:** a batch of rows for bulk-add where at least one row's phone is a known pre-existing duplicate.
**Test Steps:**
1. Submit the batch (letting the duplicate row through, not deselecting it).
**Expected Result:** after the success toast, a second warning toast appears stating how many duplicate phone numbers were found in the submission.
**Failure Conditions:** no second warning toast appears despite a genuine duplicate being in the batch.

### DUP-5 — Intra-batch duplicates
**Preconditions:** on bulk-add, paste two rows with the identical phone number (both new, neither exists in the DB yet).
**Test Steps:**
1. Observe both rows' duplicate flags before submitting.
**Expected Result:** both rows (or at least the second occurrence) are flagged as duplicates before submission; submitting still creates both if not deselected (intra-batch duplicates are warned, not blocked, by design).
**Failure Conditions:** no flag appears at all for an obvious same-paste duplicate.

### DUP-6 — Admin duplicates report
**Preconditions:** logged in as admin; at least one known duplicate phone pair exists.
**Test Steps:**
1. Navigate to the admin duplicates view (if exposed in the admin panel) or hit the duplicates report directly.
**Expected Result:** the known duplicate pair is listed with the original and duplicate lead IDs.
**Failure Conditions:** a known duplicate does not appear in the report.

---

## 5. Search

### SEARCH-1 — Search by phone, own sheet
**Preconditions:** a lead owned by the current user exists, with a known phone number.
**Test Steps:**
1. In the sheet the lead belongs to, type the phone number (or a substring) into the search box.
**Expected Result:** the lead appears in the filtered results.
**Failure Conditions:** typing the exact phone number of a lead that is genuinely owned by and visible to this user returns no results.

### SEARCH-2 — Search by name / store URL
**Preconditions:** same lead as SEARCH-1.
**Test Steps:**
1. Clear the search box, search by (part of) the customer name.
2. Clear again, search by (part of) the store URL.
**Expected Result:** both searches find the lead.
**Failure Conditions:** either search fails to find a lead that is genuinely present and visible.

### SEARCH-3 — Search scope awareness (not a bug, a behavior to confirm)
**Preconditions:** a lead that belongs to a *different* team member than the current (non-admin) user.
**Test Steps:**
1. As the non-owning user, search for that lead's phone number in their own sheet.
**Expected Result:** it is **not** found — search only operates within the current view's already-filtered leads (own-ownership, archive-state, page filters); this is expected behavior, not a defect, given the app's current design (search does not query the server or cross ownership boundaries).
**Failure Conditions:** N/A for this case — this documents expected scope. If this behavior surprises testers, it is a candidate for a **product decision** (see `docs/DATA_VISIBILITY_INVESTIGATION.md` §1.7), not a bug report.

---

## 6. Lead Update

### UPDATE-1 — Edit phone
**Preconditions:** an existing, owned lead.
**Test Steps:**
1. Click the phone cell, change the value, click away (blur) to save.
2. Refresh the page.
**Expected Result:** the new value persists after refresh.
**Failure Conditions:** the value reverts after refresh, or the cell shows the new value locally but a hard refresh shows the old value (indicates the write didn't actually reach the server).

### UPDATE-2 — Edit store URL
**Preconditions/Steps/Expected/Failure:** same as UPDATE-1, on the store URL field.

### UPDATE-3 — Edit contact result
**Preconditions:** an existing, owned lead, on the tele sheet.
**Test Steps:**
1. Change the contact-result dropdown (e.g. to "رد" / replied).
2. Refresh.
**Expected Result:** the new contact result persists; the "contact result at" timestamp is set (verify indirectly via any timestamp-dependent stat, e.g. dashboard "مكالمات الشهر" incrementing).
**Failure Conditions:** value doesn't persist; timestamp-dependent stats don't reflect the change.

### UPDATE-4 — Failed update rolls back (simulated failure)
**Preconditions:** an existing, owned lead; browser DevTools open.
**Test Steps:**
1. In DevTools Network tab, set throttling to "Offline" (or block the `/api/leads` request pattern).
2. Edit any field on the lead (e.g. phone) and blur to trigger the save.
3. Observe the UI immediately (optimistic update should show the new value briefly), then wait for the request to fail.
4. Restore network connectivity.
**Expected Result:** an error toast appears ("فشل التحديث — حاول مرة أخرى"); the field visually reverts to its original value (rollback) rather than staying on the unsaved new value.
**Failure Conditions:** the field keeps showing the new, unsaved value after the request fails and no error toast appears — the UI is now lying about the saved state.

---

## 7. Notes

*(The "Notes"/"ملاحظات" field in this application is the sales-side follow-up notes field, distinct from the customer brief. It is edited via a dedicated notes cell on the sales sheet and the Follow-Up page.)*

### NOTES-1 — Add and persist a note
**Preconditions:** an owned lead, on the sales sheet or Follow-Up page.
**Test Steps:**
1. Click the notes cell, type free text (e.g. "العميل مهتم، سيتواصل الأسبوع القادم"), blur to save.
2. Refresh the page.
**Expected Result:** the note text persists after refresh.
**Failure Conditions:** note is lost after refresh.

### NOTES-2 — Note preserved through a status change to a non-closed-won value
**Preconditions:** a lead with a note already saved (NOTES-1).
**Test Steps:**
1. Change the lead's status (e.g. to "متابعة 1") without touching the notes cell.
2. Refresh; check the notes cell.
**Expected Result:** the note is unchanged.
**Failure Conditions:** the note is cleared or altered by the unrelated status change.

### NOTES-3 — Note preserved when marking closed-won *(regression test for a fixed bug)*
**Preconditions:** a lead with a note already saved (NOTES-1).
**Test Steps:**
1. Change the lead's status to "تم التقفيل" (closed-won).
2. Refresh; check the notes cell.
**Expected Result:** the note text is **unchanged** — the "closed-won" state is now tracked purely via the status field, and no longer overwrites the notes cell with the literal text "closed-won".
**Failure Conditions:** the notes cell now shows the text "closed-won" (or the sentinel value) instead of the original note — this was a confirmed, fixed bug; its reappearance is a high-priority regression.

### NOTES-4 — Note preserved across a transfer *(regression test for a fixed bug)*
**Preconditions:** a tele-owned lead with a note already saved, not yet transferred.
**Test Steps:**
1. As the tele owner, transfer the lead to a sales rep (fill in the transfer form, submit).
2. As the sales rep (or admin), open the lead and check the notes cell.
**Expected Result:** the note is unchanged — transferring no longer writes the literal text "new" into the notes cell.
**Failure Conditions:** the notes cell shows "new" instead of the original note text.

### NOTES-5 — Note preserved across a cancelled transfer *(regression test for a fixed bug)*
**Preconditions:** a lead that has been transferred (has a note on it before cancellation, e.g. reuse NOTES-4's lead before checking sales side, or add a note post-transfer then cancel).
**Test Steps:**
1. As the tele owner, cancel the transfer.
2. Check the notes cell.
**Expected Result:** the note is unchanged.
**Failure Conditions:** the notes cell is cleared to empty by the cancellation.

---

## 8. Status Change

### STATUS-1 — Setting status to "meeting" auto-fills meeting date
**Preconditions:** a tele-owned lead with no meeting date set.
**Test Steps:**
1. Change status to "📅 اجتماع" (meeting).
**Expected Result:** the meeting date field auto-populates with today's date if it was empty; the lead now appears in meeting-related views.
**Failure Conditions:** meeting date stays empty; the lead doesn't show up where scheduled meetings are expected to appear.

### STATUS-2 — Changing status away from "meeting" preserves meeting fields
**Preconditions:** a lead with status="meeting" and a meeting date/time/link set.
**Test Steps:**
1. Change status to something else (e.g. "not-interested").
2. Check the meeting date/time/link fields.
**Expected Result:** meeting date/time/link remain populated (this app deliberately preserves them regardless of status — the UI simply hides them from some views when status isn't "meeting").
**Failure Conditions:** meeting fields are wiped to empty by the status change (this would be a regression of an already-fixed historical bug, not a new one — flag with high priority if seen).

### STATUS-3 — Status affects "Customer Status" page counts
**Preconditions:** a small set of leads with varied statuses.
**Test Steps:**
1. Navigate to "حالة العملاء" (Customer Status).
2. Confirm the status breakdown bar chart reflects the actual distribution of statuses among visible leads.
**Expected Result:** counts match reality; changing a lead's status and returning to this page reflects the update.
**Failure Conditions:** counts don't match, or don't update after a status change.

---

## 9. Transfer

### TRANSFER-1 — Basic transfer flow
**Preconditions:** logged in as tele, an owned lead not yet transferred.
**Test Steps:**
1. Open the transfer modal for the lead, select a sales rep, fill in the brief (required) and meeting details, submit.
**Expected Result:** success toast; the lead now shows the assigned sales rep; it appears in "اجتماعات التلي" for both the tele and sales accounts, and in the sales rep's relevant views.
**Failure Conditions:** transfer reports success but the lead doesn't show the sales assignment, or doesn't appear in the sales rep's views after they log in.

### TRANSFER-2 — Ownership assignment correctness *(regression test for the primary fixed bug)*
**Preconditions:** log out and back in as the **mismatched-username** tele test account (see 0.2) to get a fresh, post-fix session token.
**Test Steps:**
1. Create a new lead via "+ Add" (per CREATE-1).
2. Immediately search for it by phone in the same sheet.
3. Transfer it to a sales rep.
4. As the sales rep, search for it by phone in their own sheet.
**Expected Result:** at every step, the lead is found by the acting user in their own sheet without needing to log out/in again or hard-refresh.
**Failure Conditions:** the lead is missing from the tele sheet's own search immediately after creation, or missing from the sales sheet's own search immediately after transfer — this is the exact symptom this checklist was created to catch; report with the account's username and display name attached.

### TRANSFER-3 — Failed transfer rolls back *(regression test for a fixed bug)*
**Preconditions:** an owned, untransferred lead; DevTools available to simulate a network failure.
**Test Steps:**
1. Open the transfer modal, fill in valid data.
2. Set the network to offline (or block the leads API) right before submitting.
3. Submit.
4. Restore the network.
**Expected Result:** an error toast ("فشل التحويل") appears; the lead reverts to its pre-transfer state in the UI (no sales assignment shown) rather than staying visually "transferred."
**Failure Conditions:** the lead keeps showing as transferred in the UI after the request failed and before any refresh.

### TRANSFER-4 — Transfer notification
**Preconditions:** two sessions — the transferring tele and the receiving sales rep.
**Test Steps:**
1. Tele transfers a lead to the sales rep.
2. As the sales rep, check the notification bell within 60 seconds (it polls, not realtime).
**Expected Result:** a "transfer" notification referencing the lead appears for the sales rep.
**Failure Conditions:** no notification appears after waiting a full 60+ seconds; or the notification goes to the wrong user.

---

## 10. Cancel Transfer

### CANCEL-1 — Basic cancel flow
**Preconditions:** a transferred lead (from TRANSFER-1).
**Test Steps:**
1. As the tele owner, cancel the transfer.
**Expected Result:** the lead no longer shows a sales assignment, meeting date/time/type are cleared, and it returns to appearing as an active (untransferred) tele lead.
**Failure Conditions:** the sales assignment or meeting fields remain after cancellation.

### CANCEL-2 — Attendance carryover on re-transfer *(known, documented limitation — verify it still behaves this way, do not "fix" it manually)*
**Preconditions:** a transferred lead that has already been marked "attended" or "no-show" by the sales rep, then cancelled by the tele owner, then re-transferred to a (possibly different) sales rep.
**Test Steps:**
1. Transfer a lead; as sales, mark it attended.
2. As tele, cancel the transfer.
3. Re-transfer the same lead (same or different sales rep).
4. As the new sales rep, check the attendance state shown for this lead.
**Expected Result (documented current behavior, not a target to "fix" here):** the attendance badge may still show the **stale** prior outcome (attended/no-show) immediately after re-transfer, since cancel-transfer does not clear `attended`/`attendanceMarkedAt`/`attendanceMarkedBy`. This is a known, documented gap (see `docs/LEAD_LIFECYCLE_INVESTIGATION.md` §4.6) — confirm it still reproduces exactly this way; if the behavior has changed (e.g. attendance now correctly resets), note that as a positive finding, not a failure.
**Failure Conditions for THIS test case:** only report as a bug if the behavior is *worse* than described (e.g. the app crashes, or an incorrect *different* lead's attendance appears).

### CANCEL-3 — Failed cancel rolls back *(regression test for a fixed bug)*
**Preconditions:** a transferred lead; DevTools available.
**Test Steps:**
1. Set network offline, attempt to cancel the transfer.
2. Restore network.
**Expected Result:** error toast appears; the lead's transfer state visually reverts to "still transferred" rather than staying on the optimistically-cleared state.
**Failure Conditions:** the lead keeps showing as un-transferred after the request failed.

---

## 11. Meeting

### MEETING-1 — Scheduled meeting appears in meetings views
**Preconditions:** a lead with status="meeting" and a meeting date set (today or a future date).
**Test Steps:**
1. Navigate to "اجتماعات التلي" (My Meetings).
2. Locate the lead.
**Expected Result:** the lead appears with correct date/time/type/link.
**Failure Conditions:** the lead is missing, or shows incorrect meeting details.

### MEETING-2 — Today / week / upcoming filters
**Preconditions:** a mix of leads with meeting dates today, this week (not today), and next week.
**Test Steps:**
1. On My Meetings, toggle between "اليوم" / "هذا الأسبوع" / date-range filters.
**Expected Result:** each filter shows exactly the leads whose meeting date falls in that window, using Cairo/Egypt timezone consistently (not the browser's local timezone) for the boundary.
**Failure Conditions:** a meeting scheduled for "today" (Cairo time) doesn't show under "today" for a tester in a different timezone, or vice versa.

---

## 12. Attendance

### ATTEND-1 — Mark attended from My Meetings
**Preconditions:** a transferred lead with a scheduled meeting, logged in as the sales rep or admin.
**Test Steps:**
1. On My Meetings, click "حضر" (attended) for the lead.
2. Refresh.
**Expected Result:** attendance persists as "attended," with a timestamp and the marking user's name recorded (verify via any UI that surfaces `attendanceMarkedBy`, or trust the badge state after refresh).
**Failure Conditions:** attendance doesn't persist after refresh.

### ATTEND-2 — Mark no-show
**Preconditions/Steps:** same as ATTEND-1, using "لم يحضر."
**Expected Result/Failure Conditions:** same pattern as ATTEND-1, for the no-show state.

### ATTEND-3 — Mark attendance from the employee profile page *(regression test for a fixed rollback bug)*
**Preconditions:** a lead with a scheduled meeting, visible on the "صفحتي" (employee profile) page's meetings list; DevTools available.
**Test Steps:**
1. Mark attendance from this page under normal network conditions — confirm it persists after refresh (baseline correctness).
2. Repeat, but with the network set offline right before clicking, then restore network after the request fails.
**Expected Result:** step 1 persists correctly. In step 2, an error toast appears and the attendance marking visually reverts (rollback) instead of staying on the optimistic, unsaved value.
**Failure Conditions:** in step 2, the UI keeps showing the new attendance value after the request failed — this specific handler previously had no rollback, unlike the equivalent one on the My Meetings page.

### ATTEND-4 — Attendance notification
**Preconditions:** two sessions — sales marking attendance, tele who owns/transferred the lead.
**Test Steps:**
1. Sales marks a lead attended or no-show.
2. Tele checks the notification bell within 60 seconds.
**Expected Result:** an "attendance" notification naming the customer appears for the tele rep who transferred the lead (not for unrelated users).
**Failure Conditions:** no notification, or it's sent to the wrong user, or duplicated multiple times for one action.

---

## 13. Archive

### ARCHIVE-1 — Archive a single lead
**Preconditions:** an owned, active lead.
**Test Steps:**
1. Select the lead, use the archive action.
2. Confirm it disappears from the active sheet.
3. Navigate to "أرشيفي" (My Archive) and confirm it appears there.
**Expected Result:** as described.
**Failure Conditions:** the lead remains in the active sheet, or doesn't appear in the archive.

### ARCHIVE-2 — Bulk archive
**Preconditions:** 2+ owned, active leads.
**Test Steps:**
1. Select multiple leads, bulk-archive.
**Expected Result:** all selected leads move to the archive together.
**Failure Conditions:** a partial subset archives, with no clear error for the rest.

### ARCHIVE-3 — Failed archive (documented: no rollback by design)
**Preconditions:** an owned, active lead; DevTools available.
**Test Steps:**
1. Set network offline, attempt to archive.
2. Restore network, observe.
**Expected Result (current, documented behavior — not a target to fix here):** an error toast appears, but the lead **may remain visually removed** from the active sheet even though the archive was never actually saved server-side, until a realtime event or manual refresh corrects it. This is an intentional, documented simplification, not an oversight.
**Failure Conditions for THIS case:** only report as a bug if there is **no error toast at all**, or if the lead is permanently, silently lost (does not reappear even after a manual refresh) — that would indicate the archive genuinely failed both server-side and client-side with no recovery path.

### ARCHIVE-4 — Admin archive tab
**Preconditions:** logged in as admin.
**Test Steps:**
1. Navigate to the admin panel's Archive tab.
2. Confirm archived leads from any user are visible and filterable.
**Expected Result:** as described.
**Failure Conditions:** archived leads from non-admin users are missing from this view.

---

## 14. Restore

### RESTORE-1 — Restore a single lead *(regression test for a fixed rollback bug)*
**Preconditions:** an archived lead (from ARCHIVE-1), on My Archive.
**Test Steps:**
1. Click restore/unarchive for the lead.
2. Confirm it disappears from the archive view and reappears in the active sheet.
**Expected Result:** as described.
**Failure Conditions:** the lead disappears from archive but never appears in the active sheet.

### RESTORE-2 — Bulk restore
**Preconditions:** 2+ archived leads.
**Test Steps:**
1. Select multiple, bulk-restore.
**Expected Result:** all selected leads move back to active together.
**Failure Conditions:** partial restore with no clear indication of which failed.

### RESTORE-3 — Failed restore rolls back *(regression test for a fixed bug)*
**Preconditions:** an archived lead; DevTools available.
**Test Steps:**
1. Set network offline, attempt restore.
2. Restore network, observe the archive view without manually refreshing.
**Expected Result:** an error toast appears, **and** the lead reappears in the archive list (rollback) rather than staying removed from view.
**Failure Conditions:** the lead stays missing from the archive view after the failed restore, with no automatic recovery — this was a previously-fixed gap; its reappearance is a regression.

---

## 15. Notifications

### NOTIF-1 — Unread count and bell
**Preconditions:** a fresh notification exists for the logged-in user (trigger one via TRANSFER-4 or ATTEND-4).
**Test Steps:**
1. Observe the notification bell badge count.
2. Click the bell to open the list.
**Expected Result:** unread count matches the number of unread notifications; opening the list shows them with correct messages.
**Failure Conditions:** count mismatch; notifications for a different user appear in this list.

### NOTIF-2 — Mark one as read
**Preconditions:** at least one unread notification.
**Test Steps:**
1. Click a single notification to mark it read.
2. Refresh; recheck unread count.
**Expected Result:** the count decreases by one and stays decreased after refresh.
**Failure Conditions:** the notification reverts to unread after refresh.

### NOTIF-3 — Mark all as read
**Preconditions:** 2+ unread notifications.
**Test Steps:**
1. Use "mark all as read."
2. Refresh.
**Expected Result:** unread count is 0 and stays 0 after refresh.
**Failure Conditions:** some notifications remain unread.

### NOTIF-4 — Polling interval (not realtime — documented behavior)
**Preconditions:** two sessions.
**Test Steps:**
1. Trigger a notification-generating event in session B (e.g. a transfer to session A's user).
2. In session A, do **not** manually refresh — just wait and watch the bell.
**Expected Result:** the new notification appears within about 60 seconds without a manual refresh (the bell polls the server on that interval — this is expected, not instant/realtime).
**Failure Conditions:** the notification never appears without a manual page reload, even after waiting well over 60 seconds.

---

## 16. Permissions

### PERM-1 — Tele cannot access sales-only views
**Preconditions:** logged in as tele.
**Test Steps:**
1. Attempt to navigate to "شيت السيلز", "Follow-Up", or the Admin Panel (via URL/state manipulation if the sidebar hides them, to test the guard itself).
**Expected Result:** redirected to the tele's default view (dashboard); sales-only content is never rendered.
**Failure Conditions:** sales-only data becomes visible or editable to a tele account.

### PERM-2 — Sales cannot access tele-only views
**Preconditions:** logged in as sales.
**Test Steps:** attempt to reach "شيت التيلي" or "التحويلات" (transfers, tele/admin-only).
**Expected Result:** redirected away; content not rendered.
**Failure Conditions:** tele-only content becomes accessible.

### PERM-3 — Non-owner cannot edit or delete another user's lead via direct API manipulation
**Preconditions:** two non-admin accounts, each owning at least one lead the other does not own. This test specifically probes server-side enforcement, not just UI hiding — requires DevTools or an API client (e.g. browser console `fetch`) to attempt a direct request.
**Test Steps:**
1. As user A, note the numeric ID of one of user B's leads (visible via admin's All Leads tab, or any exposed ID).
2. As user A (using A's own valid session token), attempt a direct `POST /api/leads` `update` (or `DELETE /api/leads?id=`) call against that lead's ID.
**Expected Result:** the request is rejected with a 403 Forbidden ("لا تملك صلاحية...") and the lead is unchanged.
**Failure Conditions:** the request succeeds — user A is able to modify or delete a lead they don't own.

### PERM-4 — Admin sees everything
**Preconditions:** logged in as admin; leads owned by multiple different tele/sales accounts exist.
**Test Steps:**
1. Browse both sheets with "الكل" (all) selected, and the All Leads tab.
**Expected Result:** every non-archived lead from every owner is visible and editable.
**Failure Conditions:** some users' leads are missing from the admin's view.

### PERM-5 — Access permissions matrix (cross-visibility)
**Preconditions:** logged in as admin; two tele accounts (A and B).
**Test Steps:**
1. In admin Settings, grant tele account A visibility into tele account B's sheet.
2. Log in as A, attempt to view B's sheet via the member picker (if exposed to non-admins with granted access) or confirm the intended UI surface for this permission.
3. Save the permissions, then repeat with the permission removed.
**Expected Result:** visibility follows the configured matrix exactly — granted, A can see B's leads; removed, A cannot.
**Failure Conditions:** the permission has no effect, or an unrelated account gains/loses access.

---

## 17. Reports

### REPORT-1 — Dashboard KPIs, current-month scoping
**Preconditions:** a mix of leads/activity from this month and (if testable) prior months.
**Test Steps:**
1. Open the dashboard as a non-admin user; note the KPI values (calls this month, meetings, closed-won, etc.).
2. Create a new qualifying event (e.g. mark a call result) and confirm the relevant KPI increments without a full page reload being required beyond the sheet's own update.
**Expected Result:** KPIs reflect only current-month activity where the label implies "current month," and update after new activity.
**Failure Conditions:** a KPI includes activity clearly outside the current month, or fails to update after new qualifying activity plus a refresh.

### REPORT-2 — "مركزك" (rank) computation
**Preconditions:** at least two tele or two sales accounts with differing activity levels this month.
**Test Steps:**
1. Compare the rank/score shown to each account against their relative activity (calls, transfers/meetings, attendance or closings, per role).
**Expected Result:** the account with more qualifying activity this month has an equal or higher rank score.
**Failure Conditions:** rank is clearly inverted or unrelated to actual activity.

### REPORT-3 — Customer Status page
**Preconditions:** leads with varied statuses.
**Test Steps:**
1. Open "حالة العملاء", confirm status breakdown and team performance table match the underlying data.
**Expected Result:** as described.
**Failure Conditions:** counts don't reconcile with the leads actually visible to this account.

### REPORT-4 — Admin overview tab
**Preconditions:** logged in as admin.
**Test Steps:**
1. Open the Admin Panel Overview tab, compare team performance figures against what's independently visible per-member on the dashboard/customer-status page for a couple of sample members.
**Expected Result:** figures are internally consistent (same underlying activity, even if the exact time-window definition differs by design between pages — see `docs/DATA_VISIBILITY_INVESTIGATION.md`/prior audit notes on differing KPI definitions across pages).
**Failure Conditions:** wildly inconsistent numbers for the same member on the same day (e.g. one page shows 0 and another shows 20 for what should be the same underlying count), not attributable to a known differing time-window definition.

---

## 18. Realtime Synchronization

### REALTIME-1 — Cross-tab INSERT
**Preconditions:** two tabs/sessions logged in as accounts that can both see the same lead pool (e.g. both admin, or two accounts with mutual access).
**Test Steps:**
1. In Tab A, create a new lead.
2. Without refreshing Tab B, watch for the lead to appear there.
**Expected Result:** the lead appears in Tab B within a couple of seconds, no manual refresh needed.
**Failure Conditions:** Tab B never receives it without a manual refresh (check Tab B's realtime connection indicator if the UI exposes one).

### REALTIME-2 — Cross-tab UPDATE
**Preconditions:** same as REALTIME-1, both tabs viewing the same lead.
**Test Steps:**
1. In Tab A, change the lead's status.
2. Watch Tab B.
**Expected Result:** Tab B reflects the new status within a couple of seconds.
**Failure Conditions:** Tab B doesn't update without a manual refresh.

### REALTIME-3 — sales_name realtime guard *(regression test for a fixed bug)*
**Preconditions:** two tabs, a lead visible in both, with `sales` currently unassigned (empty) in both tabs' view.
**Test Steps:**
1. In Tab A, transfer the lead to a sales rep (sets `sales_name`).
2. Confirm Tab B updates to show the new sales assignment.
3. In Tab A, cancel the transfer (clears `sales_name`).
4. Confirm Tab B updates to show it as unassigned again.
**Expected Result:** both directions propagate correctly to Tab B via realtime.
**Failure Conditions:** either direction fails to propagate — most importantly, confirm that a **legitimate** clear-to-empty (cancel transfer) still reaches other tabs (this was specifically preserved by the fix, which only guards against overwriting a *non-empty* cached value with an incoming empty one when the two might be out of order — a genuine, intentional clear should still work).

### REALTIME-4 — Reconnect after network drop
**Preconditions:** one tab, DevTools available.
**Test Steps:**
1. Set the network offline for ~10 seconds, then restore it.
2. Observe any realtime status indicator, and confirm a subsequent change made from another session eventually syncs in.
**Expected Result:** the connection recovers automatically (retry/backoff is built in); after reconnecting, new changes sync normally.
**Failure Conditions:** the tab never recovers realtime sync without a full page reload.

---

## 19. Cache Refresh

### CACHE-1 — New lead visible immediately after creation
**Preconditions:** none beyond a valid session.
**Test Steps:**
1. Create a lead (any method).
2. Immediately open a **second** tab (fresh load, same or different account with visibility) and search/browse for it.
**Expected Result:** the lead is visible in the second tab's fresh load — the write-path cache is invalidated on every UI-driven create.
**Failure Conditions:** the lead is missing from a fresh load for longer than the cache's TTL window (about 30 seconds) — if it's missing for exactly that long and then appears, that's the cache's normal TTL behavior on an uninvalidated path, worth noting but only a true failure if it's a UI-driven create (which should invalidate immediately).

### CACHE-2 — Sheets-sync webhook lead visibility *(regression test for a fixed bug — admin/API-testing only)*
**Preconditions:** admin access and the ability to call `POST /api/sheets-sync` directly (e.g. via the bulk-add page's "Test Connection" button, which sends one test record) — or coordinate with whoever manages the Google Sheets integration if configured.
**Test Steps:**
1. Trigger the sheets-sync test/webhook to create one lead.
2. Immediately (within a few seconds) load `GET /api/leads` fresh (new tab, or the admin All Leads tab) and search for the test lead.
**Expected Result:** the webhook-created lead is visible immediately, not just after the prior ~30-second cache TTL would have expired.
**Failure Conditions:** the lead is provably created (check via the sync test result / admin panel) but does not appear in a fresh `GET /api/leads` load for up to 30 seconds afterward.

### CACHE-3 — Admin maintenance tool cache invalidation *(regression test for a fixed bug)*
**Preconditions:** admin access; a known orphaned-lead scenario is difficult to safely construct in a live test — **treat this as an optional/lower-priority case**, or run it in a non-production environment only.
**Test Steps:**
1. In a safe/non-production environment, trigger one of the admin maintenance endpoints (cleanup-orphaned-leads, fix-sales-leads-tele, or diagnose-leads-dates POST) that reports a non-zero number of leads affected.
2. Immediately reload the affected sheet/view.
**Expected Result:** the changes are reflected immediately, not after a delay.
**Failure Conditions:** changes are confirmed by the tool's own response but don't show up in the UI for up to 30 seconds.

---

## 20. Search after Import

### SEARCH-AFTER-IMPORT-1 — Immediate self-search after single create
**Preconditions:** logged in as tele or sales, ideally the **mismatched-username** test account.
**Test Steps:**
1. Create a lead via "+ Add" with a unique, memorable phone number.
2. Immediately type that phone number into the same sheet's search box (do not refresh).
**Expected Result:** found instantly.
**Failure Conditions:** not found — this is the single most important regression case in this document; capture the account's username/display name and role.

### SEARCH-AFTER-IMPORT-2 — Immediate self-search after bulk import
**Preconditions:** same account considerations as above.
**Test Steps:**
1. Bulk-import 5 rows via bulk-add, each with a unique phone number.
2. Immediately search for each phone number in the destination sheet.
**Expected Result:** all 5 found instantly.
**Failure Conditions:** any subset is not found.

### SEARCH-AFTER-IMPORT-3 — Search after import, different viewing page
**Preconditions:** a sales-originated lead just created with `status: null` (the default for a freshly created, untouched lead).
**Test Steps:**
1. Create the lead.
2. Search for it on the sales sheet (should find it — no status filter there).
3. Search for it on the Follow-Up page (documented, expected: **will not** find it, since Follow-Up only shows specific statuses or already-transferred old meetings).
**Expected Result:** found on the sales sheet; **not** found on Follow-Up — this is intentional, documented behavior (see `docs/LEAD_REPLAY_INVESTIGATION.md` §12.1), not a bug. Confirm it matches this description exactly (present on sales sheet, absent on Follow-Up) rather than being absent from *both*.
**Failure Conditions:** absent from the sales sheet too (that would be a real regression, distinct from the expected Follow-Up exclusion).

---

## 21. Search after Update

### SEARCH-AFTER-UPDATE-1 — Search by newly-edited phone number
**Preconditions:** an existing, owned lead with a known original phone number.
**Test Steps:**
1. Edit the lead's phone number to a new, unique value.
2. Search for the **new** phone number.
3. Search for the **old** phone number.
**Expected Result:** the new number finds the lead; the old number does not (assuming no other lead shares it).
**Failure Conditions:** the new number doesn't find it (update didn't persist or didn't reach the search index, which for this app is just the in-memory store, so this indicates a write or store-update failure); or the old number still finds it (stale duplicate row, or the update silently created a new row instead of updating in place — check the lead's ID hasn't changed).

### SEARCH-AFTER-UPDATE-2 — Search after a status change that moves it across a filter boundary
**Preconditions:** a lead visible under a specific `activeFilter` toggle (e.g. "uncontacted").
**Test Steps:**
1. Confirm it's found while that filter is active and the search box is empty/matching.
2. Update the field that filter depends on (e.g. set a contact result, if using "uncontacted").
3. Re-check under the same filter, then check with the filter cleared.
**Expected Result:** the lead disappears from the now-non-matching filtered view, but is found once the filter is cleared or switched appropriately.
**Failure Conditions:** the lead is missing even with all filters cleared (a true visibility bug, not a filter-scope expectation).

---

## 22. Search after Transfer

### SEARCH-AFTER-TRANSFER-1 — Tele searches for a lead they just transferred away
**Preconditions:** a tele-owned lead.
**Test Steps:**
1. Transfer it to a sales rep.
2. As the same tele user, search for it in "شيت التيلي" (their own sheet) — it should **not** appear there anymore, since transferred leads move out of the origin sheet's default ownership view (depending on the exact sheet's filter — verify against current sheet behavior, since a transferred lead's `tele` field is not cleared, only `sales` is set).
3. Search for it in "اجتماعات التلي" — it **should** appear there for the tele user (their transfer history).
**Expected Result:** matches the described split — gone from the tele sheet's main list (if that sheet excludes leads with an active sales assignment — confirm current behavior first as a baseline, not an assumption), present in the meetings/transfers history view.
**Failure Conditions:** the lead is completely unfindable anywhere for the transferring tele user, including the meetings/history view where it should remain visible.

### SEARCH-AFTER-TRANSFER-2 — Sales searches for a lead just transferred to them
**Preconditions:** same transfer as above.
**Test Steps:**
1. As the receiving sales rep, immediately (no refresh) search for the lead by phone in "اجتماعات التلي" and/or the Follow-Up page.
**Expected Result:** found immediately — this is the primary regression scenario for the ownership-identity fix, applied specifically to the transfer path (`sales_name` is forced server-side the same way `tele_name`/`sales_name` are on create).
**Failure Conditions:** not found by the receiving sales rep immediately after transfer — capture the sales account's username/display name.

### SEARCH-AFTER-TRANSFER-3 — Search after a cancelled transfer
**Preconditions:** a lead transferred then cancelled (per CANCEL-1).
**Test Steps:**
1. As the tele owner, search for the lead in their own sheet.
2. As the (former) sales rep, search for it in their views.
**Expected Result:** found by the tele owner (back to normal ownership); no longer found by the sales rep (assignment cleared).
**Failure Conditions:** either direction is wrong — missing for the tele owner, or still showing for the sales rep after cancellation.

---

## 23. Known Limitations — Not Regressions If Reproduced As Described

These behaviors are **documented, intentional, or explicitly deferred** as of this checklist's writing. Reproducing them exactly as described here is expected; only report if the *actual* behavior is worse than described (e.g. data corruption, a crash, or a completely different failure mode):

1. Historical leads created before the ownership-identity fix may still be invisible to their original owner if that account's username differs from its display name — not retroactively corrected (needs a data migration).
2. A stale/out-of-order realtime event carrying `is_archived: true` can still archive a lead unexpectedly in a connected tab (no safe guard was identified for this specific field — see `docs/DATA_VISIBILITY_INVESTIGATION.md` §1.10 and the Batch 1 fix summary).
3. Delete, bulk-delete, and bulk-archive have no client-side rollback on failure by design (documented in-code) — a failed delete/archive can leave the UI showing the lead as removed until realtime or a manual refresh corrects it.
4. Attendance fields are not cleared when a transfer is cancelled (CANCEL-2 above).
5. A `status: null` lead is excluded from the Follow-Up page by design until it either gets a valid follow-up status or is an old tele-transferred meeting (SEARCH-AFTER-IMPORT-3).
6. Search never queries the server — it is always a client-side filter over whatever is currently loaded and already visible under the current ownership/archive/status filters (SEARCH-3).
7. `salesStatus` remains a dual-purpose field (enum sentinel + free-text notes) — the specific overwrite bugs are fixed, but the field's overloaded design itself is unchanged.

---

*End of UAT Checklist. No code was modified to produce this document.*
