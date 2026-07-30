# Lists Feature — Specification

## Overview

A feature that allows authenticated prefects to create named lists of students (e.g. "Prefects on Duty", "Detention Group A", "Sports Team Captains"). Lists have an active/inactive toggle, support batch student addition, and allow student removal after creation.

---

## 1. Database Schema

### Table: `lists`

| Column       | Type                    | Constraints                    | Notes                                 |
|-------------|-------------------------|--------------------------------|---------------------------------------|
| `id`        | `BIGINT` / `UUID`       | `PRIMARY KEY`, auto-generated  | Use `GENERATED ALWAYS AS IDENTITY` if BIGINT, or `gen_random_uuid()` if UUID |
| `title`     | `TEXT`                  | `NOT NULL`                     | The list name (e.g. "Duty Roster")    |
| `students`  | `BIGINT[]`              | `NOT NULL`, `DEFAULT '{}'`     | Array of Admission No (numbers only)  |
| `active`    | `BOOLEAN`               | `NOT NULL`, `DEFAULT true`     | Active lists appear on /lists         |
| `createdBy` | `TEXT`                  | `NOT NULL`                     | Name of the prefect who created it    |
| `created_at`| `TIMESTAMPTZ`           | `DEFAULT now()`                | Auto-populated                        |
| `updated_at`| `TIMESTAMPTZ`           | `DEFAULT now()`                | Auto-populated, updated on changes    |

**SQL (copy-paste):**

```sql
CREATE TABLE lists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  students BIGINT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Notes:**
- `students` stores only **Admission No** values (numbers). Full student data (name, class, house) is fetched via a join/lookup from the `students` table when displaying.
- Use `BIGINT[]` (PostgreSQL array) instead of a separate junction table for simplicity, since no other data is associated with the student-list relationship.

---

## 2. Routes / Pages

### 2.1 `/lists` — Lists Overview

**Purpose:** Display all currently active lists as cards. Provide a toggle to also show inactive lists.

**Auth guard:** Redirect to `/authenticate` if not authenticated.

**UI:**
- A header row with the page title "Lists" and a "Create New List" button (links to `/lists/create`)
- A toggle/switch labeled "Show inactive lists" — defaults to off
- A grid of list cards, each card showing:
  - **Title** (the list name)
  - **Student count** (e.g. "12 students")
  - **Interactive state:** Clicking the card navigates to `/lists/<ID>`
- **Empty state:** "No active lists yet. Create one!" with a button to `/lists/create`
- **Filtered empty state:** "No inactive lists" when toggle is on but no inactive lists exist

**Card interactions:**
- Active lists have a green dot/badge
- Inactive lists have a grey badge
- Cards are clickable (navigate to detail page)

**Header nav:** A "Lists" link should be added to the existing Header component, alongside "Records" and "Dashboard".

---

### 2.2 `/lists/<LISTID>` — List Detail

**Purpose:** View all students in a specific list. Remove students or toggle list active/inactive.

**Auth guard:** Redirect to `/authenticate` if not authenticated.

**UI:**
- **Back link** to `/lists`
- **List title** displayed prominently
- **Action buttons row:**
  - "Toggle Active/Inactive" button (switches the `active` boolean)
  - (Optional future: "Delete List" button — not in this spec)
- **Stats row:** "X students in this list"
- **Student list:** Each student displayed as a **full mini-card** showing:
  - Name (`Name with Initials` from `students` table)
  - Class
  - Admission Number
  - School House
  - A small icon / house color indicator
  - **"Remove from list" button** — removes their Admission No from the `students` array
- **Empty state:** "This list has no students yet"

**Student data enrichment:**
- Since the `lists` table stores only Admission Nos, this page fetches full student data by querying `students` table with `.in("Admission No", list.students)`.
- The existing `categoryLabels` map and Supabase client are reused.

**Array update pattern (Supabase):**
```ts
// Remove student
await supabase
  .from("lists")
  .update({ students: currentStudents.filter(id => id !== admissionNo) })
  .eq("id", listId);

// Toggle active
await supabase
  .from("lists")
  .update({ active: !currentActive })
  .eq("id", listId);
```

---

### 2.3 `/lists/create` — Create List

**Purpose:** Form to create a new list with a title and batch-add students.

**Auth guard:** Redirect to `/authenticate` if not authenticated.

**UI layout (top to bottom):**

1. **Back link** to `/lists`
2. **Page title:** "Create New List"
3. **Title field:** Text input for the list name (label: "List Title")
4. **"Added students" summary:** A compact horizontal chip/badge area showing how many students have been added so far (e.g. "3 students added")
5. **Search bar:** Text input that searches by Admission No
   - A "Search" button next to the input
   - On submit, calls `supabase.from("students").select().eq("Admission No", Number(value))`
6. **Search result area:** Shows a **mini student card** (just name + class) with an **"Add to list" button**
   - If not found: "No student found with Admission No X"
   - If already added: Button is **disabled/greyed out** with text "Already added"
   - After clicking "Add to list": Button becomes disabled with text "Added ✓"
   - The search persists so the user can search for another student after adding one
7. **Added students preview:** A list/stack of all currently added students showing name and class, each with a small "×" remove button if they want to undo
8. **Submit button:** "Create List" button at the bottom
   - Disabled if title is empty OR no students have been added
   - On click:
     ```ts
     await supabase.from("lists").insert({
       title: listTitle,
       students: addedAdmissionNos, // number[]
       active: true,
       createdBy: prefectName, // from an input field or reuse "Issuer" pattern
     });
     ```
   - On success: redirect to `/lists/<newListId>` or `/lists`

**Prefect name input:** A small "Your name" input field (reusing the same pattern as the blackmark/goldmark issuer), placed near the submit button. This populates the `createdBy` column.

**Validation:**
- Title is required (min 1 character, max 200)
- At least one student must be added
- Duplicate admission numbers are prevented (button disabled if already added)

---

## 3. Implementation Plan

### Files to create:

| File | Purpose |
|------|---------|
| `app/lists/page.tsx` | Lists overview page |
| `app/lists/[listId]/page.tsx` | List detail page |
| `app/lists/create/page.tsx` | Create list page |

### Files to modify:

| File | Change |
|------|--------|
| `components/Header.tsx` | Add "Lists" nav link |

### Steps (in order):

1. Create the `lists` table in Supabase SQL editor using the schema above
2. Create `app/lists/page.tsx` — overview page with active/inactive toggle
3. Create `app/lists/[listId]/page.tsx` — detail page with student cards + remove + toggle active
4. Create `app/lists/create/page.tsx` — create form with search, batch add, submit
5. Edit `components/Header.tsx` — add "Lists" link
6. Build, verify, and review all changes

### Shared patterns (reuse from existing codebase):

- `Header` component for the top nav bar
- `supabase` client from `@/lib/supabase`
- `useAuth` from `@/lib/AuthContext` for auth guards
- `useRouter` from `next/navigation` for redirects
- `Text input` / `Button` / `Card` styling patterns from existing pages
- Same responsive design patterns (grid-cols-1 sm:grid-cols-2, etc.)

### Color theme:

- Lists feature color: **indigo/blue** (matching the existing Header gradient and overall app theme)
- Active indicator: green dot
- Inactive indicator: grey badge

---

## 4. Edge Cases & Decisions

| Decision | Answer |
|----------|--------|
| Student appears in multiple lists? | ✅ Yes, allowed |
| Remove student after creation? | ✅ Yes, "Remove from list" button on detail page |
| Inactive lists visible? | Hidden by default; toggle to show on /lists |
| Track who created it? | ✅ Yes, `createdBy` column |
| Add button behavior | Disabled/greyed out after adding (prevents duplicates) |
| Header link to /lists? | ✅ Yes |
| Batch or single student? | Batch add — search/add multiple, then submit once |
| Auth required? | ✅ Yes, same as rest of the app |

---

## 5. SQL Schema (copy-paste)

```sql
CREATE TABLE lists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  students BIGINT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
