# Daily Report (PDF) — Specification

Feature: Add a **"Generate Daily Report"** button to the shared `components/Header.tsx` nav bar (styled as a prominent button, distinct from the plain nav links). Clicking it generates a **PDF** containing **all strikes and blackmarks recorded today**, grouped into two sections (Strikes, then Blackmarks), expanded per student, and **automatically downloads** it to the user's computer. No page navigation, no print dialog, no extra clicks after pressing the button.

Status: **Spec — no code changes made yet**

---

## 1. Background Research (actual codebase facts)

### 1.1 Where the Header appears

`components/Header.tsx` is currently a static, server-renderable component (no `"use client"`, no interactivity, no props). It renders the "Discipline" brand block on the left and three plain text links on the right: **Lists** (`/lists`), **Records** (`/discipline`), **Prefects Dashboard** (`/`).

It is rendered on **6 pages** (all auth-guarded):

| Page | Path |
|------|------|
| Dashboard | `/` |
| Student detail | `/student/[admissionNo]` |
| Discipline records | `/discipline` |
| Lists overview | `/lists` |
| Create list | `/lists/create` |
| List detail | `/lists/[listId]` |

The Header is **not** rendered on `/authenticate` (no header there), so the button will only ever be visible to authenticated users — no extra auth handling needed.

### 1.2 Data model (Supabase, via `lib/supabase.ts` anon client)

| Table | Relevant columns | Notes |
|-------|------------------|-------|
| `strikes` | `"Admission No"` (number), `Category` (string), `created_at` (timestamptz) | Category uses slug keys like `grooming`, `bullying`, `late`, `substances`, `classfuckup`, `clubbing`, `repeated-punish` |
| `blackmarks` | `"Admission No"` (number), `Reason` (string), `issuedBy` (string), `created_at` (timestamptz) | Reason uses the same slug keys as Category |
| `students` | `"Admission No"` (number), `"Name with Initials"` (string), `Class` (string), `"School House"` (string) | 2,746 rows; names are uppercase |

- Inserts in the app (`app/page.tsx`, `app/student/[admissionNo]/page.tsx`, `app/lists/[listId]/page.tsx`) never set `created_at` explicitly — it is the DB default `now()` (timestamptz, stored in UTC). The discipline page filters/sorts on `created_at` today.
- The slug→label map `categoryLabels` (`grooming: "Personal Grooming"`, `bullying: "Bullying"`, `late: "Getting Late Often"`, …) currently lives **only** inside `app/discipline/page.tsx`. It must be shared with the report so PDF labels match the UI.

### 1.3 Dependencies / stack

- `package.json` deps: `next@16.2.10`, `react@19.2.4`, `react-dom@19.2.4`, `@supabase/supabase-js@2.110.3`. Tailwind v4.
- **No PDF library is installed.** This spec adds `jspdf` + `jspdf-autotable` (client-side; vector text, selectable/searchable, single `.save()` call triggers the download with zero user interaction).
- `AGENTS.md` warns this Next.js version has breaking changes vs. training data — before writing code, read the relevant guides under `node_modules/next/dist/docs/` (client components, dynamic import) and heed deprecation notices.

---

## 2. Decisions (from user interview)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Report date | **Today only, fixed** — always the current calendar date at click time. No date picker. |
| 2 | Section layout | **Two sections**: a **Strikes** section followed by a **Blackmarks** section. |
| 3 | Per-record details | Admission No, student name, class, house (required) **+ category/reason label** (e.g. "Bullying"). Issuer and time-of-day are **not** included. |
| 4 | Record types | **Only strikes and blackmarks.** No gold marks, punishments, or comments. |
| 5 | PDF generation | **jsPDF + jspdf-autotable**, fully client-side, auto-download via `doc.save()`. |
| 6 | Button style | **Prominent button** in the header (distinct filled pill, not a plain nav link). |
| 7 | Page filters | **Ignored** — the report always contains ALL strikes & blackmarks for today, regardless of which page or filters are active. |
| 8 | Empty day | **Alert + no download** — `alert("No strikes or blackmarks recorded today.")`; no PDF is generated. |
| 9 | Filename | `daily-report-YYYY-MM-DD.pdf` (local date), e.g. `daily-report-2026-08-10.pdf`. |
| 10 | PDF top area | **Title + date + summary counts**, e.g. `Daily Discipline Report — August 10, 2026` then `Total: 5 strikes, 3 blackmarks`. No school name block. |
| 11 | Ordering | **Newest first** within each section (students sorted by their most recent record; records within a student's block newest first). |
| 12 | Grouping | **Expanded blocks** — each student appears once per section as a header (name, admission no, class, house) with their individual records listed underneath, each showing its category label. |
| 13 | Section headers | Show counts, e.g. **`Strikes (5)`** and **`Blackmarks (3)`**. |
| 14 | Timezone | **User's local (browser) timezone** decides what counts as "today" (records are stored in UTC). |

---

## 3. Data Fetching

### 3.1 "Today" boundaries (local timezone → UTC ISO)

```ts
const now = new Date();
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // exclusive
```

Queries (run in parallel on click):

```ts
const [strikesRes, blackmarksRes, studentsRes] = await Promise.all([
  supabase
    .from("strikes")
    .select("*")
    .gte("created_at", startOfDay.toISOString())
    .lt("created_at", endOfDay.toISOString())
    .order("created_at", { ascending: false }),
  supabase
    .from("blackmarks")
    .select("*")
    .gte("created_at", startOfDay.toISOString())
    .lt("created_at", endOfDay.toISOString())
    .order("created_at", { ascending: false }),
  supabase.from("students").select("*"),
]);
```

- `lt` (exclusive) with next-midnight is deliberate so a record at exactly local `00:00:00.000` of the next day is excluded.
- `order(created_at, descending)` gives "newest first" directly; grouping preserves insertion order.
- Build a `students` lookup map keyed by `"Admission No"` (same pattern as `app/discipline/page.tsx`).

### 3.2 Grouping algorithm

```
groupByStudent(records): Map<admissionNo, records[]>
```

- Iterate records in the already-newest-first order; append each to its student's bucket (bucket order within a student = newest first, since we append in sorted order).
- Student block order within a section = order of first appearance in the newest-first list (i.e., student whose most recent record is newest comes first).
- If a student's row is missing from `students`, fall back to header text `Student #<Admission No>` with blank class/house.

---

## 4. PDF Layout Specification

### 4.1 Page structure (A4, portrait; default margins)

1. **Title line** — `Daily Discipline Report` (bold, ~20pt)
2. **Date line** — `August 10, 2026` (formatted via `toLocaleDateString("en-US", { year, month: "long", day: "numeric" })`) (~12pt, gray)
3. **Summary line** — `Total: 5 strikes, 3 blackmarks` (~11pt)
4. Horizontal rule
5. **Section 1 — `Strikes (5)`** (bold section header, drawn as a filled bar for scannability)
   - For each student: a **bold header row** — `Name with Initials` — `Admission No: 24781` — `Class: 12A` — `House: ...`
   - Beneath it: one row per record — the **category label** (e.g. `Bullying`)
6. **Section 2 — `Blackmarks (3)`** — same structure
7. Footer: page numbers (optional; `jspdf-autotable` handles pagination; section/student header rows repeat via autotable `head` on page breaks)

### 4.2 Rendering technique

- Use `jspdf-autotable` (`autoTable(doc, {...})`) for the record rows — it handles page breaks, repeated headers, and returns `finalY` for chaining.
- Implementation pattern:
  1. Title/date/summary drawn with `doc.setFontSize` / `doc.text`.
  2. Per section: draw the section header (filled rect via `doc.setFillColor` + text), then per student:
     - A one-row autotable with `head: [[studentName, "Adm: 24781", "Class: 12A", "House: ..."]]` styled bold (or draw manually with `doc.text`) to act as the student's header.
     - An autotable with `body: [[categoryLabel]]` (or `[categoryLabel, "#admNo"]` if a second column reads better) for that student's records.
     - Track `finalY` and add a gap before the next student; start a new page if `finalY` exceeds the page height minus margin.
  3. `doc.save("daily-report-" + yyyyMMdd + ".pdf")`.
- Labels via the shared `categoryLabels` map; unknown slugs render as-is (defensive).
- No images/logos — plain vector text keeps the bundle tiny and the file crisp.

### 4.3 Button UX (header)

- Position: right side of the header, **before** the existing `Lists` / `Records` links (left of the nav links), as a distinct filled pill, e.g.:
  - `bg-white text-indigo-700 hover:bg-indigo-50` rounded-full, small download icon (`⬇` svg), text `Generate Daily Report`, `text-xs sm:text-sm font-semibold`, subtle `shadow-sm`, `transition-colors`.
- On click:
  1. Button enters **loading state**: disabled, text swaps to `Generating…` (prevents double-clicks).
  2. Fetch + group + render + `save()`.
  3. On success: download fires automatically; button returns to idle.
  4. On zero records: `alert("No strikes or blackmarks recorded today.")`; button returns to idle; no download.
  5. On fetch error: `alert("Failed to load today's records: " + error.message)`; button returns to idle.

---

## 5. Component & File Design

### 5.1 New client component — `components/GenerateDailyReportButton.tsx`

- `"use client"` at top.
- Imports `supabase` from `@/lib/supabase` and `categoryLabels` from the shared labels module (see §5.3).
- Contains the button, loading state, fetch/group/render logic.
- jsPDF is **dynamically imported inside the click handler** (`await import("jspdf")`, `await import("jspdf-autotable")`) so the PDF library is only loaded on demand and never breaks SSR / bloats initial bundle.

### 5.2 Header change — `components/Header.tsx`

- Import and render `<GenerateDailyReportButton />` inside the right-side flex container, before the `Lists` link.
- Header itself can remain a server component (Next.js allows importing a client component into a server component).

### 5.3 Shared labels (small refactor for single source of truth)

- Extract the `categoryLabels` map from `app/discipline/page.tsx` into a new `lib/labels.ts` (export it), and update `app/discipline/page.tsx` to import it. This keeps PDF labels identical to UI labels. (If the user prefers zero refactor, duplicate the map in the report component instead — decision: extract.)

---

## 6. Edge Cases

| Case | Behavior |
|------|----------|
| No strikes/blackmarks today | `alert("No strikes or blackmarks recorded today.")`; no PDF; button resets. |
| Fetch failure (network / Supabase error) | `alert` with the error; no PDF; button resets. |
| Double-click / slow generation | Button disabled + `Generating…` while working. |
| Record at exactly local midnight | Included in the day it belongs to (next-day start is exclusive via `lt`). |
| DST transitions | Boundaries computed with the local `Date` constructor; works for both 23h/25h days. |
| Student missing from `students` table | Header falls back to `Student #<Admission No>`; class/house blank. |
| Missing `Class` / `"School House"` | Rendered as empty string in the header row. |
| Unknown category slug | Label rendered as-is (map fallback). |
| Many records in one day (e.g. 300) | Autotable paginates; section + student headers repeat on page breaks; no hard cap needed (dataset is small). |
| User on any page / filters active | Report always reflects ALL of today's strikes & blackmarks (filters ignored, by decision). |
| Clicked on `/authenticate` | Impossible — Header (and thus the button) isn't rendered there. |
| Download blocked by browser settings | Browser's normal download behavior applies; no special handling (still a standard `doc.save()`). |

---

## 7. Implementation Plan

### Files

| File | Change |
|------|--------|
| `package.json` | **Add deps** — `npm install jspdf jspdf-autotable`. |
| `lib/labels.ts` | **New** — extracted `categoryLabels` map (single source of truth). |
| `app/discipline/page.tsx` | **Modified** — import `categoryLabels` from `lib/labels.ts` instead of defining locally. |
| `components/GenerateDailyReportButton.tsx` | **New** — client component: button + fetch + group + jsPDF render + auto-download. |
| `components/Header.tsx` | **Modified** — render the new button before the `Lists` link. |

### Steps (in order)

1. `npm install jspdf jspdf-autotable`.
2. Read the relevant guides in `node_modules/next/dist/docs/` (per `AGENTS.md`) — confirm client-component and dynamic-import conventions for this Next.js version before writing code.
3. Create `lib/labels.ts`; update `app/discipline/page.tsx` to import from it; verify the Records page still renders identical labels.
4. Create `components/GenerateDailyReportButton.tsx` (button, loading state, today-boundary queries, grouping, autotable layout, `doc.save()`).
5. Edit `components/Header.tsx` to include the button with the prominent pill style.
6. Validate: `npx tsc --noEmit`, `npm run lint`, `npm run build`. Manually verify download on `/`, `/discipline`, and a student page.

### Conventions to reuse

- `supabase` client from `@/lib/supabase`; `useAuth` where needed (not required in the header since it's only on authed pages).
- Student lookup map pattern from `app/discipline/page.tsx`.
- Header styling tokens (white-on-gradient, `transition-colors`, responsive `text-xs sm:text-sm`).
- Indigo accent matching the app theme.

---

## 8. Non-Goals

- No date picker / custom date ranges (fixed to today).
- No gold marks, punishments, or comments in the report.
- No issuer or time-of-day columns (explicitly excluded by the user).
- No server-side PDF generation, no Supabase Edge Function, no email delivery.
- No school-name header block, logos, or images in the PDF.
- No changes to existing pages' filters or record handling.
- No persistence of generated reports (generated fresh on each click).
