# TODO — Prefects Discipline

Security risks to fix and feature ideas to build, collected from the code review.
Items are ordered by priority within each section.

---

## 1. Security risks

The app is **not vulnerable to SQL injection** (verified: all queries go through the
Supabase JS client / PostgREST with parameterized values; no `.rpc()`, raw SQL, or
string-interpolated queries exist). The real risks are access-control issues, not
query-injection issues.

### P0 — Critical

1. **No Row-Level Security (RLS) on any table**
   - The anon/publishable key in `lib/supabase.ts` is public by design and shipped in
     the client bundle. With no RLS policies, anyone can call the Supabase REST API
     directly (`https://kjpvfhcbnehcmyxzpurk.supabase.co/rest/v1/...`) to read, write,
     or delete every table — same privileges the UI has, no login required.
   - Fix: enable RLS on all 10 tables and add policies. Ideally migrate to Supabase
     Auth so policies can key off the authenticated user; otherwise policies must
     reference the `users` table somehow (e.g. a request-scoped `app.username` set via
     `set_config` from the client).

2. **Role impersonation via localStorage**
   - The "session" is `{id, username, role}` stored in localStorage under key `"user"`.
     Anyone can edit it (devtools) to `"role": "admin"` and gain the admin UI.
   - Fix: server-verified sessions (real Supabase Auth or a server API that re-checks
     credentials on each request).

3. **Auth is a UI gate, not an access boundary**
   - Login is a client-side bcrypt compare against the `users` table; there is no
     server-side enforcement of roles anywhere. Same root cause as #1/#2 — the login
     screen only hides buttons, it doesn't protect data.

### P1 — High

4. **No audit trail**
   - `strikes` has no issuer field at all; `issuedBy`/`assignedBy`/`commentor` are
     free-text (anyone can type any name). Deletes are permanent and unrecoverable
     (including "Clear All Strikes" via `.delete().gte("id", 0)`).
   - Fix: `audit_log` table written by Postgres triggers (catches even direct API
     writes) recording `user, action (insert/update/delete), table, record_id,
     admission_no, payload (before/after), timestamp`. Depends on #1 for reliable
     user attribution.

5. **No referential integrity**
   - Record tables reference `students."Admission No"` by convention only (no FKs);
     `comments."Admission No"` is a text column. Orphaned records are possible.
   - Fix: add FK constraints (and fix any orphan rows first — see
     `audit-orphan-admission-numbers.sql`).

6. **Sensitive config in the client bundle**
   - Supabase URL + anon key hardcoded in `lib/supabase.ts`. Not a leak per se (anon
     key is public), but it makes the "no RLS" problem trivially exploitable. Move to
     env vars (`NEXT_PUBLIC_*`) and never introduce a service-role key client-side.

### P2 — Medium

7. **Client-side bcrypt**
   - Password hashes are compared in the browser. Acceptable for this app's current
     threat model, but unusual; worth noting if the app grows.

8. **Unchecked write errors**
   - Several inserts (strikes, blackmarks, comments, list ops) ignore Supabase errors
     (`alert()` only on some). Failures can silently drop data.

9. **Data volumes fetched wholesale**
   - Dashboard name search and Records page pull all ~2,746 students and all records
     into the browser. Fine today; breaks past low tens of thousands of rows. Move to
     server-side filtering/pagination.

---

## 2. Feature ideas

### High impact — reporting & analytics

1. **Date-range report (PDF + on-screen)** — extend the daily report to arbitrary
   ranges ("this week", "this month", "term so far") for staff meetings.
2. **Analytics dashboard** — per-category breakdowns, trends over time, repeat-offender
   lists, and class/house comparisons (`Class` and `School House` are currently
   unused in the UI).
3. **CSV/Excel export** — staff want record feeds and lists in a spreadsheet; CSV
   parsing already exists for upload.
4. **Per-student discipline summary PDF** — printable record for the student detail
   page (presenting to teachers/parents).

### High impact — workflow correctness

5. **Audit trail** — see Security #4. Auto-fill `issuedBy` from the logged-in user;
   log edits/deletes with the acting user.
6. **Threshold auto-escalation** — `lib/strikeRules.ts` already prompts when a
   category hits its threshold; make it automatic and configurable per category,
   with a dashboard badge ("N students approaching blackmark").
7. **Punishment tracking with due dates** — add assigned/completed dates, overdue
   indicators, and "assign to a list" (auto-build a Detention list from today's
   punishments).
8. **Term-boundary reset / archive** — archive records and reset counts at end of
   term, auto-generating the term report.

### Quick wins

9. **"Today" dashboard strip** — recent activity, pending punishments, students near
   threshold, so prefects see what needs attention immediately.
10. **Advanced student search** — filter by `Class` / `Grade` / `School House`
    (data already loaded client-side).
11. **Record edit/delete with reason** — today records can only be deleted, not
    corrected; mistakes need re-entry.
12. **Pagination/scaling** — server-side filtering as volumes grow (Security #9).

### Deliberately deferred

- **Email/SMS notifications to parents** — biggest effort; needs a third-party
  service + data-protection review. A printable notification letter PDF gets most of
  the value.
- **Native mobile app** — dashboard is already responsive; a PWA install is cheaper.
