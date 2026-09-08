-- ============================================================================
-- room-role-migration.sql
-- ============================================================================
-- Adds the 'room' role: dashboard + student read, lists + attendance write,
-- no discipline writes (strikes / blackmarks / comments / etc.).
--
-- Run this WHOLE script in the Supabase SQL editor. It is idempotent.
-- ============================================================================

-- 1) Extend users.role CHECK to allow 'room'
DO $$
DECLARE
  cons_name text;
BEGIN
  SELECT conname INTO cons_name
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%view-only%';
  IF cons_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', cons_name);
  END IF;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('superuser', 'admin', 'room', 'view-only'));

-- 2) Lists + attendance: allow room (alongside admin / superuser) to write
DO $$
DECLARE
  t TEXT;
  pol TEXT;
  write_roles CONSTANT TEXT := '''admin'',''superuser'',''room''';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lists',
    'list_attendance_sessions',
    'list_attendance_records'
  ]
  LOOP
    pol := 'ins_admin_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN (%s))',
      pol, t, write_roles
    );

    pol := 'upd_admin_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.current_user_role() IN (%s)) WITH CHECK (public.current_user_role() IN (%s))',
      pol, t, write_roles, write_roles
    );

    pol := 'del_admin_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.current_user_role() IN (%s))',
      pol, t, write_roles
    );
  END LOOP;
END $$;

-- Discipline tables (strikes, blackmarks, comments, …) stay admin/superuser only.
-- Authenticated SELECT on all student data remains unchanged for room users.
