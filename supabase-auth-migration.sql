-- ============================================================================
-- supabase-auth-migration.sql
-- ============================================================================
-- Migrates Prefects Discipline from custom (bcrypt) auth to Supabase Auth:
--   * links the users table to auth.users (auth_id + email columns)
--   * drops the bcrypt password column (passwords now live in auth.users)
--   * enables Row-Level Security on all 10 tables with role-aware policies
--   * removes legacy bcrypt-only user rows (passwords unrecoverable)
--
-- Everything is idempotent — safe to run more than once.
--
-- RECOMMENDED ORDER:
--   1. Run this file in the Supabase SQL editor.
--   2. Run  npm run create-superuser -- <username> <password>
--      (creates the seed superuser in Supabase Auth and links it).
--   3. Re-run this file if step 1 ended with an error at the FINALIZE section
--      (the NOT NULL constraints need the seed row linked first).
--
-- NOTE: Section 2 deletes users whose accounts are not yet linked to Supabase
-- Auth (their bcrypt passwords cannot be recovered). If you run this before
-- step 2, the seed admin row is removed too — the create-superuser script
-- recreates it. Back up the users table first if you want to keep history.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COLUMNS — link users to auth.users (idempotent, safe anytime)
-- ----------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- ----------------------------------------------------------------------------
-- 2. LEGACY ROWS — remove bcrypt-only accounts (unrecoverable passwords).
--    The superuser recreates accounts via the Users page afterwards.
-- ----------------------------------------------------------------------------
DELETE FROM users WHERE auth_id IS NULL;

-- ----------------------------------------------------------------------------
-- 3. BACKFILL — mapped email for any remaining row (e.g. the seed superuser
--    linked by scripts/create-superuser.mjs after this file ran).
-- ----------------------------------------------------------------------------
UPDATE users
SET email = lower(username) || '@prefects.local'
WHERE email IS NULL;

-- ----------------------------------------------------------------------------
-- 4. HELPER — current caller's role (used by the RLS policies).
--    SECURITY DEFINER + fixed search_path so policies can look up roles.
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

-- ----------------------------------------------------------------------------
-- 5. ENABLE ROW-LEVEL SECURITY on all 10 tables
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
-- 6. POLICIES
-- ----------------------------------------------------------------------------

-- --- users: everyone can read their own row; superusers see all;
-- --- admins see everyone except superusers; only superusers can write.
DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users FOR SELECT
  TO authenticated
  USING (
    auth_id = auth.uid()
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
-- --- superusers can write (matches the existing role matrix).
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
-- 7. FINALIZE — drop the bcrypt column and require the auth link.
--    (Requires at least one linked user — run scripts/create-superuser.mjs
--    first if this step errors.)
-- ----------------------------------------------------------------------------
ALTER TABLE users DROP COLUMN IF EXISTS password;
ALTER TABLE users ALTER COLUMN auth_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
