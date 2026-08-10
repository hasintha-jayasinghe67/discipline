# Name Search Tab — Specification

Feature: Add a **"Name"** search tab to the existing box-shaped search card on the main `/` page (`app/page.tsx`), allowing authenticated prefects to search students by the `"Name with Initials"` field of the `students` table. Results render as a list of the **existing full Student cards**, each with fully functional action buttons.

Status: **Spec — no code changes made yet**

---

## 1. Background Research (actual data)

The `students` table was inspected (read-only, via the same Supabase anon key the app uses):

- **Total rows: 2,746 students.**
- Stored `"Name with Initials"` values are **all-uppercase letters and spaces only** — across 1,000 sampled rows, **zero** names contained dots, hyphens, apostrophes, or digits.
- Observed format variations:
  | Format | Real examples |
  |--------|---------------|
  | `SURNAME INITIALS` (no spaces between initials) | `THOTAGAMUWA JU`, `WEERASINGHE SR`, `THILAKARATNE WMHN`, `GAMAGE MSR`, `FERNANDO HNA` |
  | Surname **with a space** | `DE ALWIS MKAD`, `DE SILVA ES`, `DE SILVA HYR` |
  | Initials **separated by spaces** | `BALASUNDARAM A A`, `COORAY M T S`, `DAWSON R K` |
- Admission numbers are 5-digit integers (e.g. `24781`).
- Consequence: dots (`.`) and lowercase only ever come from the **user's query**, never from stored data. Case-insensitivity is mandatory. Space-insensitive matching is mandatory to bridge `DE SILVA` ↔ `desilva` and `COORAY M T S` ↔ `cooray mts`.

---

## 2. Decisions (from user interview)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Tab structure | Two tabs above the existing search box: **"Admission No"** and **"Name"**. |
| 2 | Result card | **Full `Student` component card** per result (the exact card currently shown on `/` after an admission search — with counts and all 4 action buttons). |
| 3 | Search trigger | **Enter key / "Search" button** (same interaction as the current admission search). |
| 4 | Match type | **Partial substring match** (most forgiving). |
| 5 | Normalization | **Fully space-insensitive**: strip dots, spaces, and case from **both** the query and the stored name, then substring-match. |
| 6 | Searchable text | **Full name string** (surname + initials) — e.g. `wmhn` finds `THILAKARATNE WMHN`. |
| 7 | Minimum length | **2 normalized characters** before searching is allowed. |
| 8 | Result pagination | **Reveal 20 cards initially**, then a **"Load more students (N remaining)"** button reveals the next 20 each click — no hard cap. All matches are held in memory (already fetched), so loading more is instant. |
| 9 | Counts loading | Fetch the `strikes`, `blackmarks`, `goldmarks` tables **once** and count client-side for every result card. |
| 10 | Card actions | **Fully functional per card** — each card's buttons open the working modal for that specific student, insert the record, and refresh that card's counts. |
| 11 | Tab state | **Independent state per tab** — switching tabs preserves each mode's query and results. |
| 12 | Result ordering | **Alphabetical** by `"Name with Initials"` (A→Z). |
| 13 | Empty state | **Reuse the existing "Student Not Found" box** (emoji + message + the playful italic line). |
| 14 | Scope | **Front-end only** — no database/schema changes. |

---

## 3. Search Algorithm

### 3.1 Normalization (pure helper)

```ts
// lib/nameSearch.ts
export const normalizeName = (input: string): string =>
  (input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ""); // strips dots, spaces, hyphens, apostrophes, etc.
```

- Applies to **both** the query and every stored `"Name with Initials"` value.
- `A–Z` kept; `0–9` kept (defensive; none exist in names today); everything else removed.
- Stored names already match `[A-Z ]`, so normalization effectively just removes spaces and lowercases (uppercases) both sides.

### 3.2 Matching

```ts
export const searchStudents = (
  students: StudentInfo[],
  query: string
): StudentInfo[] => {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  return students
    .filter((s) => normalizeName(s["Name with Initials"]).includes(q))
    .sort((a, b) =>
      a["Name with Initials"].localeCompare(b["Name with Initials"])
    );
};
```

### 3.3 Worked examples (real data)

| User types | Normalized query | Matches (substring, full name) |
|------------|------------------|--------------------------------|
| `thotagamuwa` | `THOTAGAMUWA` | `THOTAGAMUWA JU` |
| `THOTAGAMUWA JU` | `THOTAGAMUWAJU` | `THOTAGAMUWA JU` |
| `thotagamuwa j.u.` | `THOTAGAMUWAJU` | `THOTAGAMUWA JU` (dots stripped) |
| `de silva` | `DESILVA` | `DE SILVA ES`, `DE SILVA HYR` |
| `desilva` (no space) | `DESILVA` | `DE SILVA ES`, `DE SILVA HYR` (space-insensitive) |
| `cooray m.t.s.` | `COORAYMTS` | `COORAY M T S` |
| `cooray mts` | `COORAYMTS` | `COORAY M T S` |
| `fernando` | `FERNANDO` | `FERNANDO HNA`, `FERNANDO MMY` |
| `wmhn` | `WMHN` | `THILAKARATNE WMHN` (initials searchable) |
| `silva` | `SILVA` | Every name containing `SILVA` as a substring (e.g. both `DE SILVA*`). |
| `k` (1 char) | `K` | **No search** (min 2 chars). |

### 3.4 Documented limitations (accepted)

- The normalized query is one contiguous substring, so **term order matters**: `silva de` will **not** match `DE SILVA ES` (normalized `SILVADE` is not a substring of `DESILVAES`). This is the natural consequence of the chosen "partial substring + fully space-insensitive" semantics.
- Short queries (2 chars) can be noisy (e.g. `ju` matches `THOTAGAMUWA JU` and `BOTHEJUE WYR`). The 20-result cap and min-length rule mitigate this; the "Showing first 20 of X" notice tells the user to refine.
- No typo tolerance / fuzzy matching (out of scope).

---

## 4. UI Specification (`app/page.tsx`)

The main search card gains a **segmented tab control** at its top, then renders the active tab's content below.

### 4.1 Tab bar

- Two buttons inside the existing white card, above the search input:
  - **Admission No** (active by default — preserves today's behavior)
  - **Name**
- Active tab: filled indigo (`bg-indigo-600 text-white`), matching the app's sort-button pattern in `app/discipline/page.tsx` / `app/lists/page.tsx`.
- Inactive tab: gray outline (`bg-gray-50 border border-gray-200 text-gray-600 hover:border-indigo-300`).
- Switching tabs does **not** clear either mode's query or results (independent state).

### 4.2 "Admission No" tab (unchanged behavior)

- Exactly the current search box (`Enter Admission No`), Enter/Search button, single full `Student` card result, existing "Student Not Found" box.
- Input is `type="number"`-ish behavior as today (numeric admission).
- Existing state variables (`name`, `studentName`, `notFound`, counts) remain, now scoped to this tab.

### 4.3 "Name" tab (new)

- Search input: placeholder `Enter student name (min 2 letters)`.
- Same magnifier icon + "Search" button layout as today.
- Enter key submits; Search button submits.
- **Search button disabled** while the normalized query is < 2 chars.
- On submit:
  1. If the students list hasn't been fetched yet, fetch it once and cache: `supabase.from("students").select("*")` (2,746 rows, one-time).
  2. If counts haven't been fetched yet, fetch once and cache:
     `supabase.from("strikes").select("Admission No")`, same for `blackmarks` and `goldmarks`.
  3. Run `searchStudents(...)`, cap at 20, remember `totalMatches`.

### 4.4 Results rendering

- Vertical stack of **full `Student` component cards** (`flex flex-col gap-3`), inside the existing `max-w-2xl` column.
- Each card receives:
  - `name`, `Class`, `house`, `admission` (as string)
  - `strikes` / `blackmarks` / `goldmarks` = counts from the cached counts map for that admission number
  - `onStrikeClick` / `onGoldMarkClick` / `onCommentClick` / `onBlackmarkClick` handlers bound to **that specific card**
- Only the first `visibleCount` (starts at 20) cards are rendered: `nameResults.slice(0, visibleCount)`.
- Card count label above the list:
  - When more remain: `Showing {visibleCount} of {total} students`
  - Otherwise: `{total} student(s) found`
- **"Load more students ({remaining} remaining)" button** below the cards when `visibleCount < total`; each click adds 20 (`Math.min(visibleCount + 20, total)`). Instant — data is already in memory.
- `visibleCount` resets to 20 on every new search.

### 4.5 Empty / hint states

- **Query < 2 chars after submit attempt:** show a small hint: `Type at least 2 letters to search.`
- **No matches:** reuse the existing "Student Not Found" box:
  - 🔍 emoji, heading `Student Not Found`
  - `No student found with name: <query>`
  - the existing italic line: `"He lied to you, you're not scary, you're a lolla"`

### 4.6 Per-card modals (functional)

- One modal can be open at a time (existing `Modal` component design).
- Clicking an action button on card **X** sets a `selectedCardAdmission` (plus the student name/class/house for the modal title) and opens the corresponding modal.
- Modal titles follow the existing pattern, e.g. `Add strike to student {Name}`.
- Form field state (issuer, commentor, reasons, types) stays **single/shared** — it is only ever edited while one modal is open.
- On **Save**, insert uses `selectedCardAdmission`:
  ```ts
  await supabase.from("strikes").insert({ "Admission No": selectedCardAdmission, Category: strikeType });
  // same for blackmarks / goldmarks / comments with their fields
  ```
  then close the modal and **refresh the counts map** (re-fetch the 3 record tables) so the card's counts update immediately. (Alternative micro-optimization: increment the local count; re-fetch is preferred for correctness since other prefects may have added records.)

---

## 5. State Design (summary)

| State | Type | Purpose |
|-------|------|---------|
| `activeTab` | `"admission" \| "name"` | Which tab is active. |
| `nameQuery` | `string` | Name tab input (independent of `name`). |
| `nameResults` | `StudentInfo[]` | Capped, alphabetized matches. |
| `nameTotalMatches` | `number` | Un-capped match count. |
| `nameSearched` | `boolean` | Whether a search has been run (to show empty/hint states). |
| `allStudents` | `StudentInfo[] \| null` | Cached full students fetch. |
| `countsMap` | `Record<number, { strikes: number; blackmarks: number; goldmarks: number }>` | Built once from the 3 record tables. |
| `selectedCardAdmission` | `number \| null` | Which result card the open modal targets. |
| (existing) | `name`, `studentName`, `notFound`, per-record counts, modal booleans + form fields | Unchanged, now scoped to the Admission tab. |

Existing modal booleans (`strikeModalOpen`, `blackMarkModalOpen`, `goldMarkModalOpen`, `commentModalOpen`) are reused; only their insert target changes to `selectedCardAdmission` when launched from a name-tab card.

---

## 6. Edge Cases

| Case | Behavior |
|------|----------|
| Empty / whitespace-only query | No search; hint state. |
| Query normalizes to < 2 chars (e.g. `k`, `a.`) | No search; search button disabled + hint. |
| No matches | Reused "Student Not Found" box with the query echoed. |
| > 20 matches | Show first 20 cards + a "Load more students (N remaining)" button that reveals 20 more per click until exhausted. |
| Dots in query (`K.G.S.`, `j.u.`) | Stripped by normalization. |
| Mixed case query | Case-insensitive (uppercased both sides). |
| Multiple/double spaces (`de   silva`) | Stripped (space-insensitive). |
| Surname typed without its space (`desilva`) | Matches `DE SILVA ES`. |
| Query terms in reverse order (`silva de`) | Won't match — documented limitation (§3.4). |
| No students loaded yet / fetch failure | Treat as no results; surface the empty state; log error to console. |
| Counts stale after a save | Counts map re-fetched after every modal save. |
| Very short noisy queries (`ju`) | Allowed (≥2 chars) but capped at 20 with a refine hint. |
| Auth guard | Unchanged — redirect to `/authenticate` if not authenticated. |

---

## 7. Implementation Plan

### Files

| File | Change |
|------|--------|
| `lib/nameSearch.ts` | **New** — `normalizeName()` + `searchStudents()` pure helpers. |
| `app/page.tsx` | **Modified** — tabs, name-search state, results list, per-card modal wiring, counts map, empty/hint states. |
| `components/Student.tsx` | **Unchanged** — reused as-is. |

### Steps

1. Create `lib/nameSearch.ts` with `normalizeName` and `searchStudents` (pure, unit-testable).
2. Add `activeTab` segmented control to the search card in `app/page.tsx`.
3. Add name-tab search UI: input, Search button, Enter handling, min-2-chars gating.
4. Lazy-fetch & cache `students` + the three record tables (once), build `countsMap`.
5. Render capped, alphabetized results as full `Student` cards with per-card handlers.
6. Wire per-card modals via `selectedCardAdmission`; refresh counts after saves.
7. Add empty / hint / cap-notice states.
8. Validate: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Conventions to reuse

- `supabase` client from `@/lib/supabase`; `useAuth` from `@/lib/AuthContext`; `Header`, `Student`, `Modal` components.
- Card/input/button styling and responsive patterns already used across `/`, `/lists`, `/discipline`.
- Indigo accent color to match the app theme.

---

## 8. Non-Goals

- No database schema changes, generated columns, or indexes (front-end only).
- No fuzzy/typo-tolerant matching (e.g. Levenshtein).
- No infinite-scroll auto-loading — an explicit "Load more" button instead.
- No multi-term AND/OR query semantics.
- No changes to the "Admission No" tab behavior or to the `Student` component itself.
