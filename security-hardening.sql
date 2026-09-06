-- ============================================================================
-- security-hardening.sql
-- ============================================================================
-- Security fixes found during the September 2026 audit. Run the WHOLE script
-- in the Supabase SQL editor. It is idempotent (safe to run more than once).
--
-- What it fixes:
--   1. current_user_role() leaked to anonymous callers — now locked down and
--      revocable.
--   2. RLS policies queried users via `auth_id = auth.uid()`, which leaks
--      every user's auth UUID to any authenticated caller (error-based
--      enumeration). Replaced with a leak-proof role lookup.
--   3. The `anon` role retained default table privileges — revoked.
--   4. Missing RLS policies on list_attendance_* in the legacy migration —
--      created (the fresh setup already had them).
--   5. Weak default password in superuser-migration.sql documented — a
--      reminder to change it (see bottom comments).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Lock down current_user_role()
--    It was SECURITY DEFINER with no explicit REVOKE, so `anon` and the
--    PUBLIC pseudo-role could call it. Only authenticated sessions need it.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Leak-proof role lookup
--    Policies previously called current_user_role() (fine) but ALSO compared
--    `auth_id = auth.uid()` on the users table inside users_select. Postgres
--    surfaces that comparison as a filter error ("permission denied for
--    column auth_id") only when a row matches, which lets any authenticated
--    user enumerate which auth UUIDs exist. The users_select policy now uses
--    a SECURITY DEFINER helper that returns only a boolean, and the
--    comparison happens inside the definer function where the caller cannot
--    observe it.
-- ----------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.is_current_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user(uuid) TO authenticated;

-- users_select: leak-proof version. Same visible outcome (own row, admins see
-- non-superusers, superusers see everyone) without exposing auth_id checks to
-- the caller's row-filtering error channel.
DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users FOR SELECT
  TO authenticated
  USING (
    public.is_current_user(auth_id)
    OR public.current_user_role() = 'superuser'
    OR (public.current_user_role() = 'admin' AND role <> 'superuser')
  );

-- ----------------------------------------------------------------------------
-- 3. Revoke default privileges from `anon` on every app table
--    RLS already blocks anon reads, but explicit revocation removes the
--    residual risk of a future policy accidentally granting anon access and
--    keeps the surface minimal.
-- ----------------------------------------------------------------------------
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
-- 4. Ensure RLS is enabled and policies exist on list_attendance_* (the
--    standalone list-attendance-migration.sql did not include them; the
--    fresh setup script does, but re-creating is idempotent and keeps every
--    database at the same hardening level).
-- ----------------------------------------------------------------------------
ALTER TABLE list_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sel_auth_list_attendance_sessions" ON list_attendance_sessions;
CREATE POLICY "sel_auth_list_attendance_sessions" ON list_attendance_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ins_admin_list_attendance_sessions" ON list_attendance_sessions;
CREATE POLICY "ins_admin_list_attendance_sessions" ON list_attendance_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','superuser'));

DROP POLICY IF EXISTS "upd_admin_list_attendance_sessions" ON list_attendance_sessions;
CREATE POLICY "upd_admin_list_attendance_sessions" ON list_attendance_sessions
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin','superuser'))
  WITH CHECK (public.current_user_role() IN ('admin','superuser'));

DROP POLICY IF EXISTS "del_admin_list_attendance_sessions" ON list_attendance_sessions;
CREATE POLICY "del_admin_list_attendance_sessions" ON list_attendance_sessions
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('admin','superuser'));

DROP POLICY IF EXISTS "sel_auth_list_attendance_records" ON list_attendance_records;
CREATE POLICY "sel_auth_list_attendance_records" ON list_attendance_records
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ins_admin_list_attendance_records" ON list_attendance_records;
CREATE POLICY "ins_admin_list_attendance_records" ON list_attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','superuser'));

DROP POLICY IF EXISTS "upd_admin_list_attendance_records" ON list_attendance_records;
CREATE POLICY "upd_admin_list_attendance_records" ON list_attendance_records
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin','superuser'))
  WITH CHECK (public.current_user_role() IN ('admin','superuser'));

DROP POLICY IF EXISTS "del_admin_list_attendance_records" ON list_attendance_records;
CREATE POLICY "del_admin_list_attendance_records" ON list_attendance_records
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('admin','superuser'));

-- ----------------------------------------------------------------------------
-- 5. Done. Two manual follow-ups (not SQL-fixable):
--    a. If you used superuser-migration.sql historically, its step 3 created
--       an account with password "password". If that account still exists,
--       delete or change its password NOW:
--         UPDATE auth.users SET ... -- do it from the Dashboard:
--         Authentication → Users → ... → Reset password / Remove user.
--    b. In Supabase Dashboard → Authentication → Policies, set:
--         - Minimum password length: 8
--         - Enable "leaked password protection" (HaveIBeenPwned check)
--       The app's API routes now enforce the 8-char minimum server-side too.
-- ============================================================================
