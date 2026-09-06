-- ============================================================================
-- setup.sql — FRESH Supabase database setup for Prefects Discipline
-- ============================================================================
-- Run this WHOLE script in the Supabase SQL editor on a brand-new database.
-- It creates everything the app needs to run:
--    10 tables  · indexes · the auth helper · Row-Level Security policies
--
-- It is idempotent (safe to run more than once).
--
-- AFTER running this script you still need ONE more step to log in:
--    1. Create the first (superuser) account in Supabase Auth, either:
--         a. npm run create-superuser -- <username> <password>
--            (requires SUPABASE_SERVICE_ROLE_KEY in .env.local), or
--         b. Supabase Dashboard → Authentication → Users → Add user
--            (email = <username>@prefects.local, password, confirm email ON),
--            then link it to the users table by copying the new user's UUID
--            and running:
--            INSERT INTO users (username, auth_id, email, role)
--            VALUES ('<username>', '<the-uuid>', '<username>@prefects.local', 'superuser');
--    2. Then sign in to the app with that username + password.
--
-- DESIGN NOTES
--   * No foreign keys from record tables (strikes/blackmarks/…) to students:
--     the "Upload Student Details" CSV flow deletes ALL students and re-inserts
--     them, so FKs would cascade-delete discipline records. References are by
--     convention on "Admission No" (see audit-orphan-admission-numbers.sql).
--   * Category/Reason/Type columns hold slug keys with NO CHECK constraints —
--     new categories need no schema change (labels live in lib/labels.ts).
--   * Password storage is handled by Supabase Auth (auth.users). The users
--     table holds identity + role only; there is no password column.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. users — app accounts, linked to Supabase Auth
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'view-only'
    CHECK (role IN ('superuser', 'admin', 'view-only')),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- In the final state every account must be linked to Supabase Auth.
ALTER TABLE users ALTER COLUMN auth_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users (auth_id);

-- ----------------------------------------------------------------------------
-- 2. students — the roster (replaced wholesale by the CSV upload)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  "Admission No" BIGINT PRIMARY KEY,
  "Name with Initials" TEXT NOT NULL,
  Class TEXT,
  "School House" TEXT,
  Grade TEXT
);

-- ----------------------------------------------------------------------------
-- 3. Record tables — discipline history (reference students by convention)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS strikes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "Admission No" BIGINT NOT NULL,
  Category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blackmarks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "Admission No" BIGINT NOT NULL,
  Reason TEXT NOT NULL,
  issuedBy TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goldmarks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "Admission No" BIGINT NOT NULL,
  Reason TEXT NOT NULL,
  issuedBy TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS punishments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "Admission No" BIGINT NOT NULL,
  Type TEXT NOT NULL,          -- e.g. detention / weekend-duty / cleanup / other
  Reason TEXT,
  assignedBy TEXT,
  Status TEXT NOT NULL DEFAULT 'ongoing'
    CHECK (Status IN ('ongoing', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "Admission No" BIGINT NOT NULL,
  commentor TEXT,
  commentText TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. lists — named student groups (membership is a denormalized array)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  students BIGINT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  createdBy TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Maintain lists.updated_at on change.
CREATE OR REPLACE FUNCTION public.touch_lists_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lists_updated_at ON lists;
CREATE TRIGGER trg_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION public.touch_lists_updated_at();

-- ----------------------------------------------------------------------------
-- 5. List attendance — one session per list per date, one record per student
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS list_attendance_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  list_id BIGINT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  taken_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (list_id, session_date)
);

CREATE TABLE IF NOT EXISTS list_attendance_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES list_attendance_sessions(id) ON DELETE CASCADE,
  "Admission No" BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'late', 'excused')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, "Admission No")
);

-- ----------------------------------------------------------------------------
-- 6. Indexes for the app's common query patterns
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_strikes_admission ON strikes ("Admission No");
CREATE INDEX IF NOT EXISTS idx_strikes_category ON strikes (Category);
CREATE INDEX IF NOT EXISTS idx_blackmarks_admission ON blackmarks ("Admission No");
CREATE INDEX IF NOT EXISTS idx_goldmarks_admission ON goldmarks ("Admission No");
CREATE INDEX IF NOT EXISTS idx_punishments_admission ON punishments ("Admission No");
CREATE INDEX IF NOT EXISTS idx_comments_admission ON comments ("Admission No");
CREATE INDEX IF NOT EXISTS idx_lists_active ON lists (active);

CREATE INDEX IF NOT EXISTS idx_list_attendance_sessions_list_date
  ON list_attendance_sessions (list_id, session_date);
CREATE INDEX IF NOT EXISTS idx_list_attendance_records_session
  ON list_attendance_records (session_id);
CREATE INDEX IF NOT EXISTS idx_list_attendance_records_admission
  ON list_attendance_records ("Admission No");

-- ----------------------------------------------------------------------------
-- 7. RLS helper — the current caller's role (used by the policies below)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE auth_id = auth.uid();
$$;

-- Leak-proof "is this row mine?" helper. Policies must not compare
-- auth_id = auth.uid() directly: Postgres surfaces that comparison as a
-- row filter error, letting callers enumerate which auth UUIDs exist.
CREATE OR REPLACE FUNCTION public.is_current_user(uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = $1
      AND auth_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 8. Row-Level Security — enable on all 10 tables
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 9. RLS policies
-- ----------------------------------------------------------------------------

-- --- users: everyone can read their own row; superusers see all; admins see
-- --- everyone except superusers; only superusers can write.
DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users FOR SELECT
  TO authenticated
  USING (
    public.is_current_user(auth_id)
    OR public.current_user_role() = 'superuser'
    OR (public.current_user_role() = 'admin' AND role <> 'superuser')
  );

DROP POLICY IF EXISTS "users_insert" ON users;
CREATE POLICY "users_insert" ON users FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'superuser');

DROP POLICY IF EXISTS "users_update" ON users;
CREATE POLICY "users_update" ON users FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'superuser')
  WITH CHECK (public.current_user_role() = 'superuser');

DROP POLICY IF EXISTS "users_delete" ON users;
CREATE POLICY "users_delete" ON users FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'superuser');

-- --- Data tables: any authenticated user can read; only admins and
-- --- superusers can write (matches the app's role matrix).
DO $$
DECLARE
  t TEXT;
  pol TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students',
    'strikes',
    'blackmarks',
    'goldmarks',
    'punishments',
    'comments',
    'lists',
    'list_attendance_sessions',
    'list_attendance_records'
  ]
  LOOP
    pol := 'sel_auth_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)',
      pol, t
    );

    pol := 'ins_admin_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN (''admin'',''superuser''))',
      pol, t
    );

    pol := 'upd_admin_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.current_user_role() IN (''admin'',''superuser'')) WITH CHECK (public.current_user_role() IN (''admin'',''superuser''))',
      pol, t
    );

    pol := 'del_admin_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.current_user_role() IN (''admin'',''superuser''))',
      pol, t
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 10. Harden privileges
--     current_user_role()/is_current_user() are SECURITY DEFINER — only
--     authenticated sessions should execute them. Revoke table privileges
--     from `anon` so the anonymous key can only hit RLS-protected paths.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.is_current_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user(uuid) TO authenticated;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users',
    'students',
    'strikes',
    'blackmarks',
    'goldmarks',
    'punishments',
    'comments',
    'lists',
    'list_attendance_sessions',
    'list_attendance_records'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 11. You're done with the database.
-- ----------------------------------------------------------------------------
-- Remaining (one-time, outside SQL):
--   1. Create the seed superuser in Supabase Auth (see the header comment) —
--      `npm run create-superuser -- <username> <password>` or the dashboard.
--   2. Make sure the app's env vars point at this project:
--        NEXT_PUBLIC_SUPABASE_URL
--        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
--        SUPABASE_SERVICE_ROLE_KEY  (server-side only)
--   3. Add the app's URL to Supabase → Authentication → URL Configuration
--      (Site URL / Additional Redirect URLs) if you want email links to work.
-- ============================================================================
