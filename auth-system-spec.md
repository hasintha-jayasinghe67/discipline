# Authentication System & User Management — Specification

Feature: Replace the hardcoded `admin/password` login with a **Supabase-backed user authentication system** while keeping the hardcoded check as a fallback. Introduce two roles — **admin** (full access) and **view-only** (read-only, no record creation or report generation). Add a **Users** link in the header and a `/users` management page where admins can create, edit, and delete users.

Status: **Spec — no code changes made yet**

---

## 1. Background Research

### 1.1 Current authentication

- `lib/AuthContext.tsx` provides `{ authenticated, login, logout }` via `React.createContext`.
- `login(username, password)` checks `username === "admin" && password === "password"` — hardcoded, no role concept.
- `authenticated` is persisted to `localStorage` as `"true"` / `"false"` — no user identity or role stored.
- Every page (except `/authenticate`) uses:
  ```ts
  const { authenticated } = useAuth();
  if (!authenticated) router.push("/authenticate");
  if (!authenticated) return null;
  ```

### 1.2 Where auth is checked

| File | Auth | Action buttons affected |
|------|------|------------------------|
| `app/page.tsx` | `authenticated` | Add Strike, Blackmark, Gold Mark, Comment (on student cards) |
| `app/student/[admissionNo]/page.tsx` | `authenticated` | Same action buttons (on student detail) |
| `app/discipline/page.tsx` | `authenticated` | Punishment status toggle |
| `app/lists/[listId]/page.tsx` | `authenticated` | Bulk Add Strike / Blackmark, Remove from list |
| `app/lists/create/page.tsx` | `authenticated` | Create list |
| `app/lists/page.tsx` | `authenticated` | (read-only) |
| `components/Header.tsx` | **Not checked** (server component) | Lists / Records / Dashboard links always visible |
| `components/GenerateDailyReportButton.tsx` | **Not checked** | Always rendered (relies on header being on authed pages only) |

### 1.3 Existing dependencies & stack

- `@supabase/supabase-js` — already installed and used for all data operations.
- `next@16.2.10`, `react@19.2.4`, `tailwindcss@4`.
- No password-hashing library installed. This spec adds `bcryptjs` (pure JS, browser-compatible).

---

## 2. Decisions (from user interview)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Login flow | Query Supabase `users` table first; if it fails (offline) or credentials don't match any row, fall back to the hardcoded `admin/password` check. |
| 2 | Hardcoded fallback role | **Admin** — logged in via hardcoded fallback gets full access. |
| 3 | Password storage | **bcrypt hashed** (plain text never stored). Use `bcryptjs` client-side lib for hashing on create/edit and comparison on login. |
| 4 | Users page actions | **Full CRUD** — add new users, edit (username, password, role), delete existing users. |
| 5 | Users page access | **Admins only** — view-only users cannot see the "Users" link in the header or access the `/users` page. |
| 6 | Seed data | Include a default admin user in the SQL (`admin` / bcrypt hash of `password`) so the system works immediately. |
| 7 | View-only: action buttons | **Hide entirely** — Add Strike, Blackmark, Gold Mark, Comment buttons are removed from student cards. |
| 8 | View-only: report button | **Hide entirely** — Generate Daily Report button is removed from the header. |
| 9 | View-only: punishment toggles | **Block** — Mark complete / Mark ongoing buttons hidden. |
| 10 | Header role awareness | **Convert Header to `"use client"`** — use `AuthContext` directly to conditionally render the Users link and Report button based on role. |
| 11 | Users page layout | **Single page** — a table of all users with inline row actions (edit modal, delete button) plus an "Add User" form at the top. |
| 12 | Self-deletion / last admin | **Prevent it** — alert if the admin tries to delete their own account, or if only one admin remains. |

---

## 3. Database Schema

### 3.1 Table: `users`

```sql
CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,          -- bcrypt hash
  role TEXT NOT NULL DEFAULT 'view-only' CHECK (role IN ('admin', 'view-only')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Seed data

```sql
-- Default admin user (username: admin, password: password)
-- The bcrypt hash below was generated with bcryptjs hashSync('password', 10).
-- Verify it works on your local installation before running.
INSERT INTO users (username, password, role)
VALUES ('admin', '$2a$10$8KzYpGkKbCf2q0G1y0X1eOXq3H5s6D7f8g9h0j1k2l3m4n5o6p7q8r', 'admin');
```

> **Note:** The exact hash value must be generated at implementation time by running `node -e "console.log(require('bcryptjs').hashSync('password', 10))"` after installing `bcryptjs`. The hash above is a placeholder — the actual SQL in the spec will include the real hash.

---

## 4. Login Flow (algorithm)

```
User submits username + password on /authenticate:

1. Supabase query: SELECT * FROM users WHERE username = enteredUsername
2. If a row is found:
   a. Compare entered password against stored bcrypt hash using bcryptjs.compareSync
   b. If match → login as that user (role = user.role); store user info in localStorage
   c. If no match → "Invalid username or password"
3. If no row found OR Supabase query fails (offline):
   a. Fall back to hardcoded check: username === "admin" && password === "password"
   b. If match → login as admin (role = "admin"); store user info
   c. If no match → "Invalid username or password"
```

---

## 5. AuthContext Changes (`lib/AuthContext.tsx`)

### 5.1 New state shape

```ts
interface UserInfo {
  id: number;
  username: string;
  role: "admin" | "view-only";
}

interface AuthContextType {
  authenticated: boolean;
  user: UserInfo | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}
```

### 5.2 Hydration

- On mount, read `user` from `localStorage` (JSON.parse).
- If present, set `authenticated: true` and `user`. If absent, `authenticated: false`.

### 5.3 Login

```ts
const login = async (username: string, password: string): Promise<boolean> => {
  // 1. Try Supabase users table
  const { data, error } = await supabase
    .from("users")
    .select("id, username, password, role")
    .eq("username", username)
    .single(); // may return 406 if not found, handled gracefully

  if (data && !error) {
    const match = bcryptjs.compareSync(password, data.password);
    if (match) {
      const user = { id: data.id, username: data.username, role: data.role };
      setUser(user);
      setAuthenticated(true);
      localStorage.setItem("user", JSON.stringify(user));
      return true;
    }
    return false; // password mismatch
  }

  // 2. Fallback: hardcoded admin/password
  if (username === "admin" && password === "password") {
    const user = { id: 0, username: "admin", role: "admin" as const };
    setUser(user);
    setAuthenticated(true);
    localStorage.setItem("user", JSON.stringify(user));
    return true;
  }

  return false;
};
```

### 5.4 Logout

```ts
const logout = () => {
  setAuthenticated(false);
  setUser(null);
  localStorage.removeItem("user");
};
```

### 5.5 Convenience hook

```ts
export function useAuth() {
  return useContext(AuthContext);
}

// Derived helpers for components
export const isAdmin = (user: UserInfo | null) => user?.role === "admin";
```

---

## 6. Role Enforcement (which components hide what)

### 6.1 Summary

| Component | Admin | View-only |
|-----------|-------|-----------|
| **Header: Users link** | Visible | Hidden |
| **Header: Generate Daily Report button** | Visible | Hidden |
| **Student card: Add Strike, Blackmark, Gold Mark, Comment buttons** | Visible | Hidden |
| **Student Detail: action buttons** | Visible | Hidden |
| **Records page: punishment toggle buttons** | Visible | Hidden |
| **List detail: Bulk Add Strike / Blackmark buttons** | Visible | Hidden |
| **List detail: Remove from list button** | Visible | Admin check? |
| **Lists create page** | Accessible | Accessible? |

Wait — the user's request focused on "view-only users cannot access the generate report functionality or the ability to add strikes, blackmarks, comments, goldmarks". Let me also consider: should view-only users be able to create/edit lists? The user didn't mention lists explicitly. Lists involve creating/editing (write) operations. I'll note in the spec that lists management is also gated to admins by default (consistent with the "view-only = read-only" principle), but this can be decided at implementation.

### 6.2 Implementation pattern

- Each page that has write actions imports `useAuth` and retrieves `user.role`.
- A shared helper `isAdmin(user)` gates the rendering of action buttons.
- Gate pattern:
  ```tsx
  {user?.role === "admin" && (
    <button onClick={onStrikeClick}>Add Strike</button>
  )}
  ```

### 6.3 Header changes

- Convert `components/Header.tsx` to `"use client"`.
- Import `useAuth` from `@/lib/AuthContext`.
- Wrap the Users link and the Generate Daily Report button in:
  ```tsx
  {user?.role === "admin" && (
    <>
      <GenerateDailyReportButton />
      <a href="/users">Users</a>
    </>
  )}
  ```
- The rest of the nav links (Lists, Records, Dashboard) remain visible to all authenticated users.

---

## 7. Users Page (`/users`)

### 7.1 Route

- `app/users/page.tsx` — new page, auth-guarded, admins only.

### 7.2 Page layout

A single-page management interface:

1. **Page title:** "User Management"
2. **Add User form** — a compact card with fields:
   - Username (text input, required)
   - Password (text input, required, min 4 chars, not echoed? — plain text input for now)
   - Role (dropdown: "Admin" / "View-only", default "View-only")
   - "Add User" button
   - On submit: hash password with `bcryptjs.hashSync`, insert into `users` table, refresh list.
3. **Users table** — a card listing all users:
   - Columns: Username, Role, Created date, Actions
   - Each row has:
     - **Edit button** — opens a modal/inline form to edit username, password, role. Password field is optional (blank = keep current).
     - **Delete button** — deletes the user after confirmation (confirm dialog). Blocked if `user.id === currentUser.id` (self-deletion) or if this is the last admin.
4. **Empty state:** "No users yet. Add the first user above."
5. **Error handling:** Duplicate username → `alert("Username already exists")`. Self-deletion blocked → `alert("You cannot delete your own account")`. Last admin → `alert("At least one admin must remain")`.

### 7.3 Auth guard

Double safety:
- The page redirects to `/authenticate` if not logged in.
- For non-admin users, redirect to `/` (or show "Access denied").
- The Header link is hidden from view-only users, so the path must be accessed directly.

### 7.4 Edit flow

- Clicking "Edit" opens a modal with the current username pre-filled, role pre-selected, password blank.
- User can change username, role, or optionally set a new password.
- On save: if password is non-empty, hash it; build update payload; `supabase.from("users").update(...).eq("id", userId)`.
- On success: close modal, refresh list.

### 7.5 Delete flow

- Clicking "Delete" first checks:
  - `userId === currentUser.id` → alert "Cannot delete yourself"
  - `targetUser.role === "admin" && remainingAdmins === 1` → alert "At least one admin must remain"
- Otherwise, confirm dialog: `Are you sure you want to delete user "{username}"?`
- On confirm: `supabase.from("users").delete().eq("id", userId)`, refresh list.

---

## 8. Implementation Plan

### Files

| File | Change |
|------|--------|
| `package.json` | **Add dep** — `npm install bcryptjs` |
| `lib/AuthContext.tsx` | **Rewrite** — add `UserInfo`, `user` state, role-aware login, `user` in localStorage |
| `components/Header.tsx` | **Convert to `"use client"`**, import `useAuth`, conditionally render Users link and Report button for admins only |
| `app/users/page.tsx` | **New** — User management page with add/edit/delete |
| `app/page.tsx` | **Edit** — gate action buttons behind `user.role === "admin"` |
| `app/student/[admissionNo]/page.tsx` | **Edit** — gate action buttons behind `user.role === "admin"` |
| `app/discipline/page.tsx` | **Edit** — gate punishment toggle button behind `user.role === "admin"` |
| `app/lists/[listId]/page.tsx` | **Edit** — gate bulk add buttons behind `user.role === "admin"` |

### Steps (in order)

1. `npm install bcryptjs` (and `@types/bcryptjs` if needed — it ships with TS types).
2. Generate the bcrypt hash of `"password"`:
   `node -e "console.log(require('bcryptjs').hashSync('password', 10))"`
   Save the hash for the seed SQL.
3. Rewrite `lib/AuthContext.tsx` with the new `UserInfo` type, updated login flow, `user` state, and localStorage persistence.
4. Write the seed SQL (copy-paste to Supabase SQL editor):
   - `CREATE TABLE users` with the schema from §3.1
   - `INSERT INTO users` with the generated hash from step 2
5. Convert `components/Header.tsx` to a client component, add role-based conditional rendering.
6. Create `app/users/page.tsx` with user management table, add/edit/delete functionality.
7. Gate action buttons on `app/page.tsx` behind `user.role === "admin"`.
8. Gate action buttons on `app/student/[admissionNo]/page.tsx`.
9. Gate punishment toggle on `app/discipline/page.tsx`.
10. Gate bulk add buttons on `app/lists/[listId]/page.tsx`.
11. Validate: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Conventions to reuse

- `supabase` client from `@/lib/supabase`; `useAuth` from `@/lib/AuthContext`; `Header` component.
- Tailwind card/button/input styling patterns from existing pages.
- Indigo accent color for the app theme.
- Auth guard pattern (redirect + conditional render) from existing pages.

---

## 9. Edge Cases

| Case | Behavior |
|------|----------|
| Supabase `users` table is empty (first run) | All logins fall back to hardcoded `admin/password` → admin role |
| Supabase query fails (offline) | Fallback to hardcoded check |
| Username typed with wrong case | `users` table query is case-sensitive; fallback (hardcoded) is also case-sensitive. Document this. |
| Admin creates a user with an existing username | Supabase UNIQUE constraint → error caught and shown as alert |
| Admin deletes own account | Blocked with alert |
| Admin tries to delete the last admin in the system | Blocked with alert |
| Admin edits their own role to view-only | Allowed (they lose admin access on next page refresh) |
| View-only user navigates directly to `/users` | Redirect to `/` (or show "Access denied") |
| Browser localStorage cleared | Next page load → not authenticated → redirect to `/authenticate` |
| Multiple tabs open | Each tab independently reads `localStorage` on mount; consistent |
| Existing hardcoded login still works | Yes — it's the fallback path. The session is identical to an admin-table login. |

---

## 10. Password Hashing Detail

- Use `bcryptjs` (pure JavaScript, no native dependencies, works in browser).
- **Login comparison:** `bcryptjs.compareSync(password, storedHash)` — returns boolean.
- **User creation / password edit:** `bcryptjs.hashSync(password, 10)` — returns hash.
- The `password` column in the `users` table stores the **full bcrypt hash string** (e.g. `$2a$10$...`).
- The seed SQL uses a pre-computed hash of `"password"` generated at implementation time.

---

## 11. Non-Goals

- No self-registration / sign-up page (only admins create users).
- No email / password-recovery / password-reset flow.
- No Supabase Auth (Row-Level Security) — all access uses the same anon key; role enforcement is purely frontend.
- No session tokens / JWTs (persistence is via localStorage).
- No audit log of who created/edited which user.
- No rate limiting on login attempts.
- No changes to the existing hardcoded `admin/password` fallback beyond what's described.