-- ============================================================================
-- AUDIT: Records & lists referencing admission numbers that do NOT exist
--        in the `students` table
-- ============================================================================
-- Why this matters: the app looks up each student's name/class/house from the
-- `students` table by "Admission No". When no row exists for a referenced
-- number, the UI/PDF falls back to "Student #<ADMISSION NO>".
--
-- Run the whole script in the Supabase SQL editor. It is read-only
-- (SELECT only) and safe to re-run.
--
-- NOTE on lists.students: this column is documented as BIGINT[]. The queries
-- below use a `::jsonb` cast so they work whether the column is bigint[],
-- text[], or jsonb — no adjustment needed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) (Optional) Show the actual column types, so you know what you're working
--    with. If lists.students shows "ARRAY" it is a Postgres array; if it
--    shows "jsonb" the cast below still works.
-- ---------------------------------------------------------------------------
SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name IN ('students', 'strikes', 'blackmarks', 'goldmarks',
                     'punishments', 'comments', 'lists')
  AND column_name IN ('Admission No', 'students')
ORDER BY table_name, column_name;

-- ============================================================================
-- 1) STRIKES referencing missing students
-- ============================================================================
SELECT s.id                        AS strike_id,
       s."Admission No"            AS admission_no,
       s.created_at::date          AS date,
       s.Category                  AS category
FROM strikes s
LEFT JOIN students st ON st."Admission No" = s."Admission No"
WHERE st."Admission No" IS NULL
ORDER BY s."Admission No";

-- ============================================================================
-- 2) BLACKMARKS referencing missing students
-- ============================================================================
SELECT b.id                        AS blackmark_id,
       b."Admission No"            AS admission_no,
       b.created_at::date          AS date,
       b.Reason                    AS reason,
       b.issuedBy                  AS issued_by
FROM blackmarks b
LEFT JOIN students st ON st."Admission No" = b."Admission No"
WHERE st."Admission No" IS NULL
ORDER BY b."Admission No";

-- ============================================================================
-- 3) GOLDMARKS referencing missing students
-- ============================================================================
SELECT g.id                        AS goldmark_id,
       g."Admission No"            AS admission_no,
       g.created_at::date          AS date,
       g.Reason                    AS reason,
       g.issuedBy                  AS issued_by
FROM goldmarks g
LEFT JOIN students st ON st."Admission No" = g."Admission No"
WHERE st."Admission No" IS NULL
ORDER BY g."Admission No";

-- ============================================================================
-- 4) PUNISHMENTS referencing missing students
-- ============================================================================
SELECT p.id                        AS punishment_id,
       p."Admission No"            AS admission_no,
       p.created_at::date          AS date,
       p.Type                      AS type,
       p.Reason                    AS reason,
       p.assignedBy                AS assigned_by,
       p.Status                    AS status
FROM punishments p
LEFT JOIN students st ON st."Admission No" = p."Admission No"
WHERE st."Admission No" IS NULL
ORDER BY p."Admission No";

-- ============================================================================
-- 5) COMMENTS referencing missing students
-- ============================================================================
SELECT c.id                        AS comment_id,
       c."Admission No"            AS admission_no,
       c.created_at::date          AS date,
       c.commentor                 AS commentor,
       LEFT(c.commentText, 60)     AS comment_preview
FROM comments c
LEFT JOIN students st ON st."Admission No" = c."Admission No"
WHERE st."Admission No" IS NULL
ORDER BY c."Admission No";

-- ============================================================================
-- 6) LISTS containing admission numbers that are missing from `students`
--    (one row per missing number; a list can appear several times)
--    `::jsonb` cast makes this work for bigint[] / text[] / jsonb columns.
-- ============================================================================
SELECT l.id                        AS list_id,
       l.title                     AS list_title,
       l.created_at::date          AS date,
       (elem #>> '{}')::bigint     AS missing_admission_no
FROM lists l
CROSS JOIN LATERAL jsonb_array_elements(l.students::jsonb) AS elem
LEFT JOIN students st ON st."Admission No" = (elem #>> '{}')::bigint
WHERE st."Admission No" IS NULL
ORDER BY l.id, (elem #>> '{}')::bigint;

-- ============================================================================
-- 7) SUMMARY: how many orphan references in each source
-- ============================================================================
SELECT 'strikes'     AS source, count(*) AS orphan_references
FROM strikes s
LEFT JOIN students st ON st."Admission No" = s."Admission No"
WHERE st."Admission No" IS NULL
UNION ALL
SELECT 'blackmarks', count(*)
FROM blackmarks b
LEFT JOIN students st ON st."Admission No" = b."Admission No"
WHERE st."Admission No" IS NULL
UNION ALL
SELECT 'goldmarks', count(*)
FROM goldmarks g
LEFT JOIN students st ON st."Admission No" = g."Admission No"
WHERE st."Admission No" IS NULL
UNION ALL
SELECT 'punishments', count(*)
FROM punishments p
LEFT JOIN students st ON st."Admission No" = p."Admission No"
WHERE st."Admission No" IS NULL
UNION ALL
SELECT 'comments', count(*)
FROM comments c
LEFT JOIN students st ON st."Admission No" = c."Admission No"
WHERE st."Admission No" IS NULL
UNION ALL
SELECT 'lists', count(*)
FROM lists l
CROSS JOIN LATERAL jsonb_array_elements(l.students::jsonb) AS elem
LEFT JOIN students st ON st."Admission No" = (elem #>> '{}')::bigint
WHERE st."Admission No" IS NULL
ORDER BY source;

-- ============================================================================
-- 8) CROSS-REFERENCE: every distinct missing admission number, and which
--    sources reference it (useful to see e.g. 24790 appearing in both
--    strikes AND lists).
-- ============================================================================
SELECT r."Admission No"                       AS admission_no,
       string_agg(DISTINCT r.source, ', '
                  ORDER BY r.source)          AS referenced_in
FROM (
    SELECT "Admission No", 'strikes'     AS source FROM strikes
    UNION ALL
    SELECT "Admission No", 'blackmarks'  FROM blackmarks
    UNION ALL
    SELECT "Admission No", 'goldmarks'   FROM goldmarks
    UNION ALL
    SELECT "Admission No", 'punishments' FROM punishments
    UNION ALL
    SELECT "Admission No", 'comments'    FROM comments
    UNION ALL
    SELECT (elem #>> '{}')::bigint, 'lists'
    FROM lists
    CROSS JOIN LATERAL jsonb_array_elements(lists.students::jsonb) AS elem
) r
LEFT JOIN students st ON st."Admission No" = r."Admission No"
WHERE st."Admission No" IS NULL
GROUP BY r."Admission No"
ORDER BY r."Admission No";
