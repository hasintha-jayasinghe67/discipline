# Superuser Role — Specification

Feature: Add a third user level — **superuser** — on top of the existing `admin` and `view-only` roles. The superuser is the only role that can perform **CRUD operations on the `users` table** (create, read, update, delete users). Admin users **lose all user-management capabilities** but keep every other existing power (adding strikes/blackmarks/gold marks/comments, managing lists, generating the daily report, clearing strikes). The change is layered onto the **existing schema** by extending the `role` column's `CHECK` constraint — no new tables or columns.

Status: **Spec — no code changes made yet**

---

## 1. Background Research

### 1.1 Current authentication & roles

- `lib/AuthContext.tsx` provides `{ authenticated, user, login, logout }` via React context.
- `UserInfo` interface: `{ id: number; username: string; role: "admin" | "view-only" }`.
- Login queries the Supabase `users` table, compares bcrypt hash (`bcryptjs`), and persists `user` to `localStorage`.
- There is **no** hardcoded fallback anymore — all auth goes through the `users` table.

### 1.2 Current `users` table schema

```sql
CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,          -- bcrypt hash
  role TEXT NOT NULL DEFAULT 'view-only' CHECK (role IN ('admin', 'view-only')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- Seed data: one `admin` user (`admin` / bcrypt hash of `password`).

### 1.3 Where role checks currently live

| File | Current role logic |
|------|--------------------|
| `lib/AuthContext.tsx` | `UserInfo.role: "admin" \| "view-only"`; login casts `data.role` to that union |
| `components/Header.tsx` | `isAdmin = user?.role === "admin"` gates: GenerateDailyReportButton, Users link, Lists link (desktop + mobile) |
| `app/users/page.tsx` | Admin-only page. Full CRUD: add-user form, users table, edit modal, delete with self/last-admin guards. Role dropdown: Admin / View-only |
| `app/page.tsx` | `showActions={user?.role === "admin"}` on student cards (Add Strike, Blackmark, Gold Mark, Comment) |
| `app/student/[admissionNo]/page.tsx` | `user?.role === "admin"` gates action buttons |
| `app/discipline/page.tsx` | `user?.role === "admin"` gates: punishment status toggle, "Clear Strikes" button (password-verified) |
| `app/lists/page.tsx` | Admin-only page (redirect non-admins to `/`) |
| `app/lists/create/page.tsx` | Admin-only page |
| `app/lists/[listId]/page.tsx` | Admin-only page; `user?.role === "admin"` gates bulk-add/remove buttons |
| `app/authenticate/page.tsx` | Login form (role-agnostic) |

### 1.4 Stack

- Next.js 16.2.10, React 19.2.4, Tailwind 4.
- `@supabase/supabase-js` for all data ops; `bcryptjs` for password hashing (browser-compatible).
- Auth is **frontend-only enforcement** — no RLS, no JWTs; `localStorage` persistence.

---

## 2. Decisions (from user interview — 4 rounds)

### Round 1 — Role scope & permissions

| # | Question | Decision |
|---|----------|----------|
| 1 | What does "remove CRUD from admins" mean? | **Only user-management CRUD is removed.** Admins keep everything else: strikes, blackmarks, gold marks, comments, lists management, daily report, clear strikes. |
| 2 | What do admins see on the Users page? | **Read-only access (updated later).** Admins see the Users link in the header and can open `/users`, but the page is read-only for them: the Add-User form and Edit/Delete buttons are hidden, and **superuser rows are filtered out** of the list they see. Superusers see everyone with full CRUD. |
| 3 | Can superusers manage other superusers? | **Full CRUD on everyone** — superusers can create, edit, and delete accounts of all three roles, including other superusers. |

### Round 2 — Schema & data structure

| # | Question | Decision |
|---|----------|----------|
| 4 | How to add the new level to the schema? | **Extend the existing `role` column** — `ALTER TABLE` the `CHECK` constraint to `('superuser', 'admin', 'view-only')`. No new tables or columns. |
| 5 | What happens to the seeded `admin` user? | **Promote the existing `admin` account to superuser** so someone can manage users immediately. |
| 6 | Seed a shared superuser account? | **Yes** — the promoted `admin` account serves as the shared superuser account (same default `password` as today), useful for dev/demo. |

### Round 3 — Edge cases & guardrails

| # | Question | Decision |
|---|----------|----------|
| 7 | Self-deletion / last-role rules | **Same rules, promoted.** Superuser cannot delete or demote their own account, and **at least one superuser must always remain** (the old "last admin" rule becomes a "last superuser" rule). |
| 8 | Role editing freedom | **Any role, freely.** Superusers can promote anyone to superuser, demote anyone, or change roles arbitrarily — full trust in superuser. |
| 9 | Admin hits `/users` directly | **Allowed (updated later).** Admins are admitted to `/users` but get a read-only view with superusers hidden. Only view-only users are redirected to the dashboard. |

### Round 4 — UI/UX & remaining details

| # | Question | Decision |
|---|----------|----------|
| 10 | How to display the superuser role? | **Distinct badge + color.** A unique badge color for superuser (e.g. purple), distinct from admin (amber) and view-only (gray). |
| 11 | "Clear Strikes" availability | **Both admin and superuser** can use it (with the existing password-confirmation modal). |
| 12 | Anything else superuser-only? | **No.** Superuser = inherits all admin powers **plus** user management. Nothing else changes. |

---

## 3. Database Changes

### 3.1 Migration: extend the role CHECK constraint

Run in Supabase SQL editor (or a migration file):

```sql
ALTER TABLE users
  DROP CONSTRAINT users_role_check,
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('superuser', 'admin', 'view-only'));
```

- Existing rows untouched; `role` remains `TEXT NOT NULL DEFAULT 'view-only'`.

### 3.2 Seed / promotion

```sql
-- Promote the existing seeded admin account to superuser (idempotent).
UPDATE users SET role = 'superuser' WHERE username = 'admin' AND role = 'admin';

-- (Optional, if the admin row doesn't exist yet) create it with the
-- existing bcrypt hash of 'password' — reuse the hash from auth-system-spec.md §3.2.
```

- Result: `admin` / `password` logs in as **superuser**.

---

## 4. AuthContext Changes (`lib/AuthContext.tsx`)

### 4.1 `UserInfo` role union

```ts
export interface UserInfo {
  id: number;
  username: string;
  role: "superuser" | "admin" | "view-only";
}
```

### 4.2 Login cast

```ts
role: data.role as "superuser" | "admin" | "view-only",
```

### 4.3 Derived helpers (optional, for readability)

```ts
export const isSuperuser = (user: UserInfo | null) => user?.role === "superuser";
export const canManageUsers = (user: UserInfo | null) => user?.role === "superuser";
```

> **Note:** `localStorage` may hold a stale `user` object (role `"admin"`) from before the migration. Since role enforcement is frontend-only, an old cached admin session would still see admin UI. The spec recommends a **role re-verification on hydration** (see §6.5) OR a version bump on the stored user object — decided at implementation.

---

## 5. Role Enforcement Matrix

| Capability | View-only | Admin | Superuser |
|------------|-----------|-------|-----------|
| View dashboard / records / student pages | ✅ | ✅ | ✅ |
| Add strikes, blackmarks, gold marks, comments | ❌ | ✅ | ✅ |
| Punishment status toggle (complete/ongoing) | ❌ | ✅ | ✅ |
| Clear Strikes (password-verified) | ❌ | ✅ | ✅ |
| Manage lists (create / view / bulk add / remove) | ❌ | ✅ | ✅ |
| Generate daily report (header button) | ❌ | ✅ | ✅ |
| **Users page — view the user list** | ❌ | **❌ (hidden)** | ✅ |
| **Users page — add / edit / delete users** | ❌ | **❌ (removed)** | ✅ |
| Header: Users link | ❌ | ❌ | ✅ |
| Promote/demote any user, incl. other superusers | ❌ | ❌ | ✅ |
| Delete / demote own account | ❌ | ❌ | ❌ (blocked) |
| Delete / demote the **last** superuser | — | — | ❌ (blocked) |

---

## 6. Implementation Changes by File

### 6.1 `lib/AuthContext.tsx`
- Widen `UserInfo.role` union to `"superuser" | "admin" | "view-only"`.
- Update the login cast in §4.2.
- Add `isSuperuser` / `canManageUsers` helpers.

### 6.2 `components/Header.tsx`
- Replace `isAdmin`-gated **Users link** with a superuser-gated one:
  ```tsx
  const canManageUsers = user?.role === "superuser";
  // Users link (desktop + mobile):
  {canManageUsers && <a href="/users">Users</a>}
  ```
- The Lists link, Report button stay gated on `isAdmin` (superuser passes since `role === "admin"` is false... **see §6.6**).

### 6.3 `app/users/page.tsx`
- **Access guard:** `isAdminOrAbove(currentUser)` — admins **and** superusers are admitted; view-only users are redirected to `/`. (Previously superuser-only; relaxed per the later decision.)
- **Row visibility:** a derived `visibleUsers` list — superusers see everyone; **admins see everyone except `role === "superuser"`** (client-side filter).
- **Read-only for admins:** the Add-User form, the Actions column header, and the Edit/Delete buttons are all wrapped in `isSuperuser(currentUser) &&` — so admins see a plain read-only table.
- **Admin notice:** a small amber banner on the page for admins: "You have read-only access. Only superusers can add, edit, or delete users."
- **Role dropdown** (add + edit): options Superuser, Admin, View-only (superusers only, since admins can't open the form/modal).
- **Role badge:** superuser → purple (`bg-purple-100 text-purple-800`), admin → amber, view-only → gray.
- **Self-guard (unchanged):** `targetUser.id === currentUser?.id` → alert "You cannot delete your own account."
- **Last-superuser guard:** if `targetUser.role === "superuser"`, count remaining superusers (excluding target); if `0` → alert "At least one superuser must remain in the system."
- **Self-demotion guard:** editing your own role → blocked with alert "You cannot change your own role."
- **Last-superuser demotion guard:** demoting a superuser away from `superuser` when they're the last one → blocked.
- `DbUser` no longer selects the `password` column in the list query (only `id, username, role, created_at`).

### 6.4 `app/page.tsx`, `app/student/[admissionNo]/page.tsx`, `app/discipline/page.tsx`, `app/lists/*`
- **No changes needed** — all these gate on `user?.role === "admin"`. Superuser must be treated as an admin-equivalent here.

### 6.5 Role re-verification on hydration (recommended)
- On mount, instead of trusting `localStorage` blindly, optionally re-query the `users` table for the stored user's `id` and refresh `role` from the DB. This handles stale `localStorage` after the migration and role changes made by a superuser while the user is logged in.
- Decision point: full re-fetch (network on every load) vs. versioned storage. Left open; recommend the simple re-fetch.

### 6.6 Admin-equivalence helper (recommended, avoids `=== "admin"` breakage)
- Add a helper in `lib/AuthContext.tsx`:
  ```ts
  export const isAdminOrAbove = (user: UserInfo | null) =>
    user?.role === "admin" || user?.role === "superuser";
  ```
- Replace the ~10 `user?.role === "admin"` gates across pages/Header with `isAdminOrAbove(user)` so superusers automatically inherit admin powers without touching every file.
- **This is the key refactor** — without it, superusers would lose access to strikes/lists/reports because those gate on `role === "admin"` exactly.

---

## 7. Edge Cases

| Case | Behavior |
|------|----------|
| Stale `localStorage` session with role `"admin"` after migration | Re-verification on hydration (§6.5) refreshes the role from the DB automatically. |
| Superuser deletes their own account | Blocked with alert "You cannot delete your own account." |
| Superuser deletes the last superuser (someone else) | Blocked with alert "At least one superuser must remain in the system." |
| Superuser demotes themselves | Blocked with alert "You cannot change your own role." |
| Superuser demotes the last superuser | Blocked (same last-superuser rule). |
| Superuser deletes/demotes another superuser (not last) | Allowed — full trust per decision #3/#8. |
| Admin navigates directly to `/users` | Admitted with read-only view; superuser rows filtered out (updated decision #2/#9). |
| View-only navigates directly to `/users` | Silent redirect to `/` (same as before). |
| Superuser accesses everything admins can | Yes — via `isAdminOrAbove` helper (§6.6). |
| Existing seeded `admin` account | Promoted to superuser (decision #5/#6). |
| New user created by superuser with role `superuser` | Allowed — superuser sets any role freely. |
| Duplicate username on add/edit | Existing alert behavior unchanged ("Username already exists"). |
| Supabase query fails / offline | Login simply returns false (current behavior, no hardcoded fallback). |

---

## 8. Open Questions / Follow-ups (confirmed at implementation or future)

- **Self-role-edit in the edit modal:** should the "Edit" action even render for one's own row, or just block on save? (Spec assumes: render but block on save with an alert.)
- **Role re-verification on hydration:** re-fetch from DB on mount vs. versioned localStorage key. Recommend re-fetch; small cost.
- **Audit trail:** out of scope — no logging of who created/edited/deleted users (consistent with the current system).
- **RLS / server-side enforcement:** out of scope — role enforcement remains frontend-only, consistent with the existing design. A malicious client could call Supabase directly; noted as a known limitation.
- **Badge color for superuser:** purple chosen for the spec; final shade to match app theme (indigo/blue header) at implementation.

---

## 9. Implementation Plan

### Files to change

| File | Change |
|------|--------|
| Supabase SQL (run manually) | `ALTER TABLE users` — extend role CHECK constraint; promote `admin` row to superuser |
| `lib/AuthContext.tsx` | Widen `role` union; add `isAdminOrAbove` (+ optional `isSuperuser`) helpers; optional hydration re-verify |
| `components/Header.tsx` | Gate Users link on `role === "superuser"`; switch remaining gates to `isAdminOrAbove` |
| `app/users/page.tsx` | Access guard → superuser-only; add Superuser role option; new badge color; self/last-superuser guards; `DbUser.role` widened |
| `app/page.tsx` | Swap `user?.role === "admin"` → `isAdminOrAbove(user)` |
| `app/student/[admissionNo]/page.tsx` | Same swap (2 spots) |
| `app/discipline/page.tsx` | Same swap (3 spots: punishment toggle, Clear Strikes button) |
| `app/lists/page.tsx` | Same swap (redirect + guard) |
| `app/lists/create/page.tsx` | Same swap |
| `app/lists/[listId]/page.tsx` | Same swap (redirect + guard + bulk buttons) |

### Steps (in order)

1. **Database:** run the `ALTER TABLE` migration and the seed promotion SQL (§3).
2. **AuthContext:** widen the role union, add `isAdminOrAbove` helper.
3. **Sweep role gates:** replace `user?.role === "admin"` with `isAdminOrAbove(user)` across Header, dashboard, student detail, discipline, lists pages (search for `role === "admin"` to find all ~15 spots).
4. **Users page:** superuser-only access guard, Superuser role option in add/edit dropdowns, superuser badge color, updated self-deletion + last-superuser guards, new self-demotion / last-superuser-demotion guards.
5. **Header:** Users link gated on superuser only.
6. **Validate:**
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`
   - Manual test: login as seeded `admin` (superuser) → manage users; create an admin → verify no Users link, `/users` redirects to `/`; verify admin still has strikes/lists/report/clear-strikes; verify last-superuser and self-demotion blocks.

### Conventions to reuse

- `supabase` client from `@/lib/supabase`; `useAuth` from `@/lib/AuthContext`.
- Existing card/table/modal Tailwind patterns from `app/users/page.tsx`.
- Alert-based validation messages (no toast system).
- Badge style pattern: `text-[11px] font-semibold px-2 py-0.5 rounded-full bg-{color}-100 text-{color}-800`.

---

## 10. Non-Goals

- No new tables or columns — schema change is limited to the `role` CHECK constraint.
- No RLS / server-side role enforcement.
- No audit logging of user-management actions.
- No password reset / email flows.
- No self-registration.
- No changes to view-only role behavior.
- No changes to the daily report, lists, or discipline features beyond the admin-equivalence refactor.
