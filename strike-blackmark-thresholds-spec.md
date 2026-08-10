# Strike → Blackmark Thresholds Spec

**Status:** Draft (interviewed, no code written yet)

## 1. Overview

Certain strike categories convert into blackmarks when a student accumulates enough strikes in that
category. This feature:

1. Shows a **fraction** (`count/threshold`) on every strike card of a rule category on the student
   detail page (`/student/<ADMISSION NO>`).
2. **Automatically prompts** for blackmark creation the moment a student's strike count in a rule
   category reaches its threshold — wherever the strike was added (dashboard, student detail page,
   or bulk add from the lists page).
3. On confirmation, **creates the blackmark and fully resets** that student's strikes in that
   category (records deleted from the `strikes` table).
4. Shows a **"Pending Black Mark"** badge on the dashboard student cards and the student detail page
   when the prompt is dismissed without completion.

Categories with **no rule** (bullying, substances, clubbing) are unaffected — no fraction, no
prompt, no reset.

## 2. Threshold rules (single source of truth)

| Category key | Label | Strikes → 1 Blackmark |
|---|---|---|
| `grooming` | Personal Grooming | **2** |
| `repeated-punish` | Repeated Punishments | **3** |
| `late` | Getting Late Often | **3** |
| `classfuckup` | Classroom Behavior | **3** |
| `bullying` | Bullying | — (no rule) |
| `substances` | Substances | — (no rule) |
| `clubbing` | Clubbing | — (no rule) |

- Rules live in a new shared module, e.g. `lib/strikeRules.ts`, exporting:
  - `STRIKE_TO_BLACKMARK: Record<string, number>` (category key → threshold)
  - `getThreshold(category): number | null`
  - `hasRule(category): boolean`
- Blackmarks do **not** require strikes in general — manual blackmark issuance stays as-is.

## 3. Fraction display (student detail page)

**Where:** each strike card in the Strikes list on `/student/<ADMISSION NO>`.

**What:**
- Only cards whose category has a rule get a fraction. No fraction for no-rule categories.
- The fraction is the student's **current total** for that category over the threshold, e.g. a
  student with 2 lateness strikes sees **2/3**.
- **Every card in the same category shows the same running total** (not sequential 1/3, 2/3).
- The count **keeps counting past the threshold** (5 lateness strikes → **5/3**).
- Position: **right-aligned badge** at the end of each card row.
- When `count >= threshold`, the card is **visually highlighted** (red border / red background
  tint) to signal "blackmark owed".
- Example: personal grooming threshold is 2, so 2 grooming strikes show **2/2** on every grooming
  card, highlighted red. (The "2/3" in the original request was illustrative — thresholds are
  per-rule.)

## 4. Auto-blackmark prompt flow

**Trigger:** after *any* strike insert (dashboard `/`, student detail page, bulk list add) where the
student's count in the inserted category is now `>= threshold`.

**Prompt modal:**
- Title: "Blackmark Threshold Reached"
- Body: student name, category label, `count/threshold`, e.g. *"Ali Perera — Getting Late Often
  (3/3)"*.
- **"Issued by"** — free-text input (same style as the existing Black Mark modal). No default.
- Buttons: **Save** (create blackmark + reset) and **Dismiss**.

**On Save (per affected student + category):**
1. Insert blackmark: `{ "Admission No": <no>, Reason: <category key>, issuedBy: <entered> }`.
2. Delete all strikes for that student + category:
   `delete().eq("Admission No", <no>).eq("Category", <category>)` — full database-side reset.
3. Refresh data.
4. Clear any "Pending Black Mark" state for that student + category.

**On Dismiss / cancel:**
- The strike stays in the DB; the count stays at the threshold.
- A **"Pending Black Mark"** badge is added for that student + category (see §6).
- The next strike added in that category will prompt again (count still `>= threshold`).

**Manual blackmarks:** when an admin issues a blackmark manually for a **rule** category, the same
reset applies — delete that student's strikes in that category so the count restarts. (This is the
natural reading of "reset after a blackmark is issued, on the database side as well".)

## 5. Bulk adds (lists page)

The lists page can add a strike to many students at once. If several students cross a threshold in
that category:

- **One single combined prompt modal** listing every affected student (name + `count/threshold`),
  with **one shared "issued by"** field that applies to all of them.
- On Save: insert a blackmark for **each** listed student, then reset each student's strikes in that
  category, then refresh.
- On Dismiss: mark all listed students as pending (badges appear on the dashboard / student pages).

## 6. "Pending Black Mark" badge

- **When it appears:** only after an auto-blackmark prompt is **dismissed** (a "you skipped this"
  marker). Pre-existing over-threshold students are **not** badged until a prompt has been shown and
  dismissed. ("Only going forward.")
- **Where:**
  - Dashboard `/` — on each **Student card**, near the Strikes row (red/amber pill, e.g.
    "Pending Black Mark").
  - Student detail page — near the strike summary / Strikes section header.
- **Clears when:** a blackmark is issued for that category (auto or manual, which resets the
  strikes), or when the strikes for that category drop below the threshold.
- **Persistence:** in-memory per session (a state set of `admissionNo|category`). Not stored in the
  DB in this iteration; lost on reload. *(Possible follow-up: persist a flag so badges survive
  reloads.)*

## 7. Role behavior

- **View-only users:** cannot add strikes, so the prompt never fires for them. Fraction display and
  badges are purely informational and **visible to all roles**.
- **Admins:** full flow as described.

## 8. Files touched (planned)

| File | Change |
|---|---|
| `lib/strikeRules.ts` | **New** — thresholds + helpers |
| `app/student/[admissionNo]/page.tsx` | Fraction badge + red highlight on strike cards; auto-prompt modal after strike insert; pending badge; reset on manual blackmark for rule categories |
| `app/page.tsx` | Extend per-student counts to per-category; auto-prompt after strike insert; pending badge state; pass badge flag to `<Student>` |
| `components/Student.tsx` | Accept `pendingBlackmark?: boolean` prop; render badge near Strikes row |
| `app/lists/[listId]/page.tsx` | After bulk add, gather affected students → single combined prompt modal → insert blackmarks + reset |

## 9. Edge cases & decisions locked in

- Fraction = **count / rule threshold**; example "2/3" was illustrative (grooming shows 2/2).
- Same total on **every** card of a category, not sequential.
- No fraction for categories without a rule.
- Count **keeps counting past** threshold (5/3) until a blackmark resets it.
- Threshold-reached cards are **highlighted red**.
- Auto-blackmark creation is **on** (with a confirmation-style modal requiring "issued by").
- Reset = **delete all strikes** for that student + category (true DB reset).
- Resets apply **going forward only** — existing over-threshold data is not reset retroactively.
- Bulk adds → **single combined prompt** with one shared "issued by".
- Badge appears **only after a prompt is dismissed**; on **both** dashboard cards and student page.

## 10. Open questions / possible follow-ups

- Persist "pending" flags in the DB so badges survive a page reload.
- Show the fraction/badge on the Records page (`/discipline`) and in the daily PDF report.
- What happens to a pending blackmark when the category count exceeds threshold and keeps growing —
  confirmed: prompt re-fires on each new strike until resolved.
- Should gold-mark or punishment counts ever feed thresholds? (Not in scope.)
