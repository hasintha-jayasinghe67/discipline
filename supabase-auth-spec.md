# Supabase Auth Migration — Specification

Feature: Replace the current **custom authentication** (client-side bcrypt compare against a `users` table, `localStorage` session, no RLS) with **real Supabase Auth** — email/password accounts in `auth.users`, server-verified httpOnly-cookie sessions, server-side admin routes for user management, and Row-Level Security enabled on all tables. App functionality, role hierarchy, and role-gated features/pages stay **identical** to today. Superusers keep the ability to create users of **any role** (superuser / admin / view-only).

Status: **Spec — no code changes made yet**

---

## 1. Background Research

### 1.1 Current authentication (to be replaced)

- `lib/AuthContext.tsx`: session persisted as `{id, username, role}` in `localStorage` (key `"user"`). On mount it re-verifies the role against the `users` table; login does a **client-side bcrypt compare** against `users.password`.
- `lib/supabase.ts`: hardcoded Supabase URL + **anon key** in the client bundle. `.env.local` already defines `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` but they are **not used** — the file hardcodes values instead.
- **No RLS on any table** — anyone with the anon key can read/write/delete every table via the REST API. (Documented as P0 in `todo.md`.)
- Roles: `superuser` > `admin` > `view-only`, enforced **only in the UI** via `isAdminOrAbove(user)` / `isSuperuser(user)` in `lib/AuthContext.tsx`. Role impersonation is trivially possible by editing `localStorage` (P0 in `todo.md`).

### 1.2 Every place that touches passwords / bcrypt today

| # | File | What it does |
|---|------|--------------|
| 1 | `lib/AuthContext.tsx` | Login: fetch `users.password`, bcrypt compare; hydration from localStorage |
| 2 | `app/users/page.tsx` | Add user: bcrypt-hash password, insert into `users`; Edit: optional new password hashed |
| 3 | `components/ConfirmPasswordModal.tsx` | Destructive-action confirm: bcrypt compare against `users.password` (used by delete-record on `app/student/[admissionNo]/page.tsx` and `app/discipline/page.tsx`) |
| 4 | `components/UploadStudentsModal.tsx` | CSV upload: bcrypt compare against `users.password` (line ~231) |
| 5 | `app/discipline/page.tsx` | "Clear Strikes": inline bcrypt compare against `users.password` (line ~300) |

All five are replaced by Supabase Auth equivalents (see §5).

### 1.3 Stack & constraints

- Next.js **16.2.10** (custom build — breaking changes; `middleware` is deprecated and renamed to **`proxy`**; `cookies()` is async; read `node_modules/next/dist/docs/` before writing code).
- React 19.2.4, Tailwind v4, npm. `@supabase/supabase-js@^2.110.3` installed; `bcryptjs@^3.0.3` installed (becomes unused); **`@supabase/ssr` must be added**.
- The app is currently **100% client-side** — this migration adds the project's first server code (route handlers + `proxy.ts`).
- Supabase project URL: `https://kjpvfhcbnehcmyxzpurk.supabase.co`.

---

## 2. Decisions (from user interview — 4 rounds)

### Round 1 — Identity & roles

| # | Question | Decision |
|---|----------|----------|
| 1 | Login identifier | **Keep usernames.** Each username maps to a Supabase Auth email (`username@prefects.local`). Login form stays username + password exactly as today; header/avatar continue to use `username`. |
| 2 | "Category" terminology | **Confirmed: category = role.** Superusers create users of all three roles; role-gated features/pages (strikes, lists, reports, user management) stay identical. |
| 3 | Self-service password change | **Yes.** Add a "Change password" item in the header account menu. No "forgot password" / email-reset flow in scope. |

### Round 2 — Security architecture

| # | Question | Decision |
|---|----------|----------|
| 4 | Session storage | **Server-side httpOnly cookies** via `@supabase/ssr` + a `proxy.ts` that refreshes the session and redirects unauthenticated users away from protected routes. Sessions can no longer be forged via devtools. |
| 5 | RLS | **Enable RLS on all 10 tables** now, with role-aware policies. **Deliver the full SQL migration file at the end of the implementation workflow** (user explicitly requested this). |
| 6 | Admin operations | **Server-side admin routes** — a new route handler layer holds the service-role key (env var, never in the browser bundle) and performs auth-user create / delete / password-reset. |

### Round 3 — UX & behaviors

| # | Question | Decision |
|---|----------|----------|
| 7 | Destructive-action password re-entry | **Keep the confirmation modal, but re-verify via a real sign-in call** (`signInWithPassword` with the entered password against the current user's mapped email). Replaces bcrypt compare in all 3 spots (ConfirmPasswordModal, UploadStudentsModal, Clear Strikes). |
| 8 | Email confirmation on user creation | **Disabled** — `email_confirm: true` from the admin API; users can sign in immediately with the password the superuser set. No emails are sent. |
| 9 | Password policy | **Keep today's "any non-empty" behavior** in the UI. Caveat documented: Supabase Auth always requires a password and enforces a configurable minimum length (default **6**; the dashboard allows lowering it). Implementation will set the Supabase minimum as low as the dashboard permits and note the floor in the UI. |

### Round 4 — Migration & edge cases

| # | Question | Decision |
|---|----------|----------|
| 10 | Existing user migration | **Migrate only the seed superuser** (`admin`) programmatically with a fresh password chosen by the owner; **all other existing accounts are recreated manually** by the superuser via the Users page afterwards (old bcrypt rows are removed — plaintext is unrecoverable). |
| 11 | Username editing | **Immutable after creation** — username is the account identity (it defines the mapped email). The edit modal changes to allow only role and password. |
| 12 | Session persistence | **Persist sessions** — users stay logged in across browser restarts until logout or token expiry (matches today's localStorage behavior). |

---

## 3. Database Changes (SQL deliverable)

Delivered as `supabase-auth-migration.sql` at the **end** of the implementation workflow (user request). The file must be idempotent and commented. Contents:

### 3.1 `users` table restructure

```sql
-- 1) New columns: link to auth.users + mapped email
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- 2) Backfill email for existing rows (derived from username), then drop the old bcrypt column
--    (only after the seed superuser has a real auth account — see §4.2).
ALTER TABLE users DROP COLUMN IF EXISTS password;
ALTER TABLE users ALTER COLUMN auth_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

- `username` (TEXT UNIQUE) and `role` (TEXT, CHECK in `('superuser','admin','view-only')`) stay exactly as-is.
- `id BIGINT IDENTITY` PK stays; `auth_id` is the join key to `auth.users.id`.
- **Removal of legacy rows:** all rows except the seed superuser have unrecoverable passwords (bcrypt) — the migration deletes them so the superuser can recreate cleanly via the UI (see §4.3). Run the delete **after** backing up, and only after the seed row is linked.

### 3.2 RLS — enable on all 10 tables

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE goldmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_attendance_records ENABLE ROW LEVEL SECURITY;
```

### 3.3 RLS policies (role-aware, using a security-definer helper)

Policies reference the `users` table by `auth_id = auth.uid()`. A single helper function keeps the SQL readable:

```sql
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM users WHERE auth_id = auth.uid()
$$;
```

Policy matrix (matching the existing role matrix in `superuser-role-spec.md` §5):

| Table | SELECT | INSERT / UPDATE / DELETE |
|-------|--------|--------------------------|
| `users` | superuser: all rows; admin: rows where `role <> 'superuser'`; view-only: none | superuser only |
| `students` | any authenticated user | admin or superuser |
| `strikes`, `blackmarks`, `goldmarks`, `punishments`, `comments` | any authenticated user | admin or superuser |
| `lists`, `list_attendance_sessions`, `list_attendance_records` | any authenticated user | admin or superuser |

Pseudo-SQL per table (example for `strikes`):

```sql
CREATE POLICY "strikes_select_auth" ON strikes FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.current_user_role() IS NOT NULL);
CREATE POLICY "strikes_write_admin" ON strikes FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','superuser'));
CREATE POLICY "strikes_write_admin" ON strikes FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin','superuser'));
CREATE POLICY "strikes_write_admin" ON strikes FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('admin','superuser'));
```

> **Note:** `current_user_role()` must be created **before** the policies, and `users` needs its own SELECT policy *before* the helper works (the helper is `SECURITY DEFINER` with `search_path = public`, so it bypasses RLS — fine). RLS design must be verified against the app's real queries during implementation (e.g. the CSV upload does a full-table `DELETE` + chunked inserts on `students`, and Clear Strikes does `DELETE FROM strikes WHERE id >= 0` — both are admin/superuser-only flows, covered by the write policies).

### 3.4 Seed superuser bootstrap (cannot be done in raw SQL)

- Auth users cannot be created reliably via SQL (password hashing lives in `auth` schema internals). Provide `scripts/create-superuser.mjs` (one-off, service-role key via env) that:
  1. `auth.admin.createUser({ email: 'admin@prefects.local', password: <chosen>, email_confirm: true })`
  2. `UPDATE users SET auth_id = <new uuid>, email = 'admin@prefects.local' WHERE username = 'admin'`
- Alternative documented path: create the user in the Supabase Dashboard (Auth → Users → Add user), copy the UUID, and run a small `UPDATE` by hand.

---

## 4. Architecture

### 4.1 Session flow (server-verified)

1. Browser client (`@supabase/ssr` `createBrowserClient`) persists the session in **cookies** (`cookieStorage`); the refresh token is httpOnly where supported.
2. **`proxy.ts`** (project root — this Next version's replacement for `middleware`, Node runtime): on every request, refresh the session (`updateSession` pattern from `@supabase/ssr`); redirect unauthenticated users away from protected routes → `/authenticate`; redirect authenticated users away from `/authenticate` → `/`.
3. `lib/AuthContext.tsx` (client) subscribes to `supabase.auth.onAuthStateChange` and reads the session via `getSession()`; it never trusts localStorage.
4. On any session change, AuthContext fetches the user's `users` row **by `auth_id`** to obtain `{ id, username, role }`. The role always comes from the database — no stale/forged role.

### 4.2 `lib/supabase.ts` split

- **`lib/supabase.ts`** — keep as the **browser client** export so the ~85 existing `import { supabase } from "@/lib/supabase"` call sites keep compiling. Switch to env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (already in `.env.local`). All requests automatically carry the user's access token when logged in (this is what RLS keys off).
- **`lib/supabaseServer.ts`** (new) — server client via `createServerClient` reading `await cookies()`; used by route handlers. Also exports a **service-role client** built from `SUPABASE_SERVICE_ROLE_KEY` (server-only env var) for `auth.admin.*` calls.
- **`proxy.ts`** — uses `createServerClient` + `updateSession`.

### 4.3 User management (server-side admin routes)

New route handlers — the **only** place the service-role key is used:

| Route | Auth check (server-side) | Operation |
|-------|--------------------------|-----------|
| `POST /api/users` | caller is superuser | validate username charset + uniqueness → `auth.admin.createUser({ email: <mapped>, password, email_confirm: true })` → insert `users` row (`auth_id`, `username`, `role`, `email`) |
| `PATCH /api/users/[id]` | caller is superuser | change role; **username immutable**; optional password reset via `auth.admin.updateUserById` |
| `DELETE /api/users/[id]` | caller is superuser | `auth.admin.deleteUser(authId)` + delete `users` row (keep existing self-deletion / last-superuser guards, now enforced server-side too) |
| `POST /api/auth/change-password` | any authenticated user (session) | `supabase.auth.updateUser({ password })` — client-side is also possible, but a server route keeps one consistent pattern; handle "reauthentication required" by prompting for the current password first |

- Email mapping helper (shared): `email = username.trim().toLowerCase().replace(/\s+/g, "-") + "@prefects.local"` — **username charset enforced at creation** (letters, digits, `_`, `-`, `.`; no spaces) so the mapped email is always valid. Domain constant lives in one place (`lib/emailMap.ts` or similar).
- Self-service password change: add a "Change password" item to the header account menu (desktop + mobile), with a small modal (current password + new password + confirm). Current password verification = re-auth sign-in; then `updateUser({ password })`.

### 4.4 AuthContext rewrite

```ts
export interface UserInfo {
  authId: string;   // auth.users.id (uuid)
  id: number;       // users.id
  username: string;
  role: "superuser" | "admin" | "view-only";
}
```

- `login(username, password)`: `supabase.auth.signInWithPassword({ email: mapEmail(username), password })` → on success, `onAuthStateChange` / session callback fetches the `users` row by `auth_id` and sets `user` + `authenticated`. Returns false on Supabase error (map `invalid_credentials` → "Invalid username or password").
- `logout()`: `supabase.auth.signOut()` (proxy/cookie cleanup handles the rest).
- Hydration: `onAuthStateChange` (`SIGNED_IN` / `SIGNED_OUT` / `TOKEN_REFRESHED`) + initial `getSession()`; no localStorage reads/writes. Remove the old `"user"` localStorage key once (one-time cleanup on mount).
- `isAdminOrAbove`, `isSuperuser`, `Role` exports stay — **all role-gated pages/components keep working unchanged**.

---

## 5. Password-verification touchpoints (all replaced)

| # | File | New behavior |
|---|------|--------------|
| 1 | `lib/AuthContext.tsx` | Supabase Auth sign-in (§4.4); no bcrypt, no `users.password` reads |
| 2 | `app/users/page.tsx` | Add/edit/delete call the admin routes (§4.3); username field read-only on edit; no bcrypt import |
| 3 | `components/ConfirmPasswordModal.tsx` | Verify via `signInWithPassword` with the entered password + current user's mapped email; on success run `onVerified()` |
| 4 | `components/UploadStudentsModal.tsx` | Same sign-in re-verification replacing the inline bcrypt compare |
| 5 | `app/discipline/page.tsx` (Clear Strikes) | Same sign-in re-verification replacing the inline bcrypt compare |

- After the migration, **`bcryptjs` has no remaining usages** — remove it from `package.json` (verify with a final grep).

---

## 6. Implementation Changes by File

| File | Change |
|------|--------|
| `package.json` | Add `@supabase/ssr`; remove `bcryptjs` |
| `.env.local` / `.env.example` | Ensure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; add `SUPABASE_SERVICE_ROLE_KEY` (server-only, never prefixed `NEXT_PUBLIC_`) |
| `lib/supabase.ts` | Read env vars; keep exporting the browser client |
| `lib/supabaseServer.ts` | **New** — server client (cookies) + service-role client |
| `lib/emailMap.ts` | **New** — username → email mapping + username charset validation |
| `proxy.ts` | **New** — `updateSession` + route protection (this Next version's `middleware` replacement; read the `proxy.md` doc before writing) |
| `lib/AuthContext.tsx` | Rewrite per §4.4 |
| `app/api/users/route.ts` | **New** — `POST` create user (superuser only, service role) |
| `app/api/users/[id]/route.ts` | **New** — `PATCH` role/password, `DELETE` user (superuser only) |
| `app/api/auth/change-password/route.ts` | **New** — self-service password change |
| `app/authenticate/page.tsx` | Nearly unchanged (username/password form); map Supabase error codes to friendly messages |
| `app/users/page.tsx` | Call admin routes; username immutable in edit modal; remove bcrypt; password-reset via route; role dropdown unchanged (Superuser/Admin/View-only) |
| `components/Header.tsx` | Add "Change password" menu item (desktop + mobile); no other changes |
| `components/ConfirmPasswordModal.tsx` | Sign-in re-verification |
| `components/UploadStudentsModal.tsx` | Sign-in re-verification |
| `app/discipline/page.tsx` | Clear Strikes: sign-in re-verification |
| `app/layout.tsx` | AuthProvider stays; no change expected |
| `supabase-auth-migration.sql` | **New (deliverable)** — §3 SQL, run at the end of the workflow |
| `scripts/create-superuser.mjs` | **New** — seed superuser bootstrap via service role |

**Unchanged:** every role-gated page and component (`app/page.tsx`, `app/student/[admissionNo]/page.tsx`, `app/discipline/page.tsx` gating, `app/lists/*`, `components/GenerateDailyReportButton.tsx`, `components/GenerateReportModal.tsx`, `components/DashboardDailyStats.tsx`, `lib/students.ts`, `lib/listAttendance.ts`, `lib/disciplineReport.ts`, `lib/pendingBlackmarks.ts`, `lib/strikeRules.ts`, `lib/labels.ts`) — they consume `useAuth()` and the same helper functions, so role behavior is bit-for-bit identical.

---

## 7. Edge Cases

| Case | Behavior |
|------|----------|
| Anon key holder calls REST directly (no login) | RLS denies everything (no anon policies) — the P0 hole from `todo.md` is closed |
| User edits localStorage to fake a role | Sessions live in httpOnly cookies; AuthContext role comes from the DB each session — forged localStorage has no effect |
| View-only user hits `/users` directly | `proxy.ts` lets them through (authenticated), then the page's existing `isAdminOrAbove` check redirects to `/` — unchanged from today |
| Unauthenticated user hits `/` or `/discipline` | `proxy.ts` redirects to `/authenticate` (previously a client-side redirect after hydration) |
| Username with invalid email characters (space, `@`, unicode) | Blocked at creation by charset validation |
| Username case variants ("Admin" vs "admin") | Emails normalized to lowercase; `users.username` stays case-sensitive as today; document |
| Duplicate username on create | Postgres UNIQUE + auth email UNIQUE → friendly "Username already exists" (server route returns the message) |
| Re-verify password during a destructive action | `signInWithPassword` with entered password; wrong password → "Incorrect password. Action aborted."; the re-auth rotates tokens harmlessly |
| Password change with stale session | Supabase may require reauthentication → prompt for current password first (sign-in re-auth) |
| Legacy `users` rows with NULL `auth_id` after migration | Removed by migration SQL (§3.1) except the seed superuser; superuser recreates accounts via UI |
| Deleting a user | `auth.admin.deleteUser` + `users` row delete; existing self-delete / last-superuser guards stay (now also enforced server-side) |
| User signs in before their `users` row exists | AuthContext signs them out (no role row) — matches today's "deleted account → logged out" behavior |
| Supabase Auth temporarily down | Login fails with a clear error; existing sessions in cookies survive until token expiry |
| Multiple tabs | `onAuthStateChange` keeps all tabs in sync (better than today) |
| `@supabase/ssr` with this custom Next version | **Verify during implementation** — `proxy.ts` uses Node runtime + async `cookies()`; read the bundled `proxy.md` / `cookies.md` docs first. Fallback if incompatible: keep session refresh in AuthContext + per-route handler checks |

---

## 8. Open Questions (resolve at implementation)

- **Minimum password length floor:** Supabase dashboard allows configuring minimum length; confirm the lowest permitted value and surface it in the add-user form UI (user wants "any non-empty" — a mandatory password field with the lowest Supabase floor is the practical outcome).
- **`proxy.ts` matcher:** exact route list to protect (all app routes except `/authenticate`, `/api/*`, `/_next/*`, static assets) — confirm at implementation against the `proxy.md` doc.
- **Change-password UX:** modal fields (current password + new + confirm) — confirm copy/styling at implementation; follows existing `Modal` + `PasswordInput` patterns.
- **Session expiry:** Supabase refresh-token defaults (60 min access token, rolling refresh) — decide whether to lengthen for the school setting.
- **Auth email domain:** `@prefects.local` chosen for the spec; confirm or change at implementation (single constant).
- **Legacy row cleanup timing:** delete legacy `users` rows in the same migration as the seed link, or leave them visible for the superuser to delete via UI — spec recommends deleting in migration (passwords worthless), but confirm against the owner's preference for `created_at` history.

---

## 9. Implementation Plan

1. **Docs:** read `node_modules/next/dist/docs/` guides for `proxy` (file convention), `cookies`, and route handlers before writing server code.
2. **Deps:** `npm install @supabase/ssr`; add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (do not prefix `NEXT_PUBLIC_`).
3. **Env-driven clients:** update `lib/supabase.ts` to use env vars; create `lib/supabaseServer.ts` (cookies client + service-role client); create `lib/emailMap.ts`.
4. **AuthContext rewrite** (§4.4) — session via `getSession`/`onAuthStateChange`, role fetched by `auth_id`, one-time localStorage cleanup.
5. **`proxy.ts`** — session refresh + route protection (verify `@supabase/ssr` compatibility with this Next version).
6. **Server routes** (§4.3): `POST /api/users`, `PATCH|DELETE /api/users/[id]`, `POST /api/auth/change-password` — each with server-side superuser/authenticated checks.
7. **Users page** — switch to admin routes; username immutable; password reset; remove bcrypt.
8. **Password re-verification swaps** — `ConfirmPasswordModal`, `UploadStudentsModal`, Clear Strikes → sign-in re-auth.
9. **Header** — add "Change password" menu item; wire the modal.
10. **Bootstrap seed superuser** — run `scripts/create-superuser.mjs` (or dashboard path) BEFORE RLS goes live.
11. **Deliver RLS SQL** — write `supabase-auth-migration.sql` (idempotent, commented, ordered: helper function → users restructure → RLS enable → policies → legacy-row cleanup) and hand to the user to run in the Supabase SQL editor.
12. **Validate:**
    - `npx tsc --noEmit`, `npm run lint`, `npm run build`.
    - Grep for remaining `bcrypt` / `localStorage` usage — must be zero.
    - Manual: seed superuser login → create superuser/admin/view-only users → verify every role gate on dashboard/records/student/lists/users pages is identical to before → destructive-action re-auth works → anon REST call fails (RLS) → change-password works → logout/login across restart persists → unauthenticated URL access redirects.

### Conventions to reuse

- `useAuth()` + `isAdminOrAbove` / `isSuperuser` helpers — unchanged API, so pages don't change.
- Existing `Modal` / `PasswordInput` / `.card-solid` / `.input-field` patterns for new modals (change-password).
- Existing spec style: SQL deliverables as commented, idempotent migration files (see `superuser-migration.sql`, `list-attendance-migration.sql`).

---

## 10. Non-Goals

- No change to role hierarchy or role-gated features (bit-for-bit parity with today).
- No "forgot password" / email-based reset flow.
- No self-registration / sign-up page (superusers create users, as today).
- No audit logging of user-management actions (existing non-goal, unchanged).
- No changes to the discipline/lists/report/student features beyond the auth-layer swaps listed above.
- No pagination / server-side data fetching for records (separate `todo.md` item, out of scope).
- No removal of the existing `users.id`/`username`/`role` columns or the app's role-check helpers — only the `password` column and bcrypt flows are removed.
