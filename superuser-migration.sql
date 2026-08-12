-- ============================================================
-- Superuser Role Migration (complete, run-to-make-it-work script)
--
-- Run this WHOLE script in the Supabase SQL editor.
-- It is idempotent: safe to run multiple times.
--
-- What it does:
--   1. Extends users.role CHECK constraint to allow 'superuser'.
--   2. Promotes an existing 'admin' account to superuser (if present).
--   3. If there is still no superuser, creates a brand-new one
--      (username 'admin', password 'password').
-- ============================================================

-- 1) Drop any existing role CHECK constraint on users.role and re-add
--    it to include 'superuser'. (Handles any auto-generated name.)
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
    CHECK (role IN ('superuser', 'admin', 'view-only'));

-- 2) Promote the existing 'admin' account to superuser (if it exists).
UPDATE users
SET role = 'superuser'
WHERE username = 'admin' AND role = 'admin';

-- 3) If there is still no superuser in the system, create one.
--    Username: admin   Password: password
--    (To change either, edit the two values below and re-generate the
--     hash: node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 10))")
INSERT INTO users (username, password, role)
SELECT 'admin', '$2b$10$8HmypA9I5LLWsx4hOwuPhOfAbsV.d0MLBsgikEYG/EGPuZGMd8xke', 'superuser'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'superuser');

-- 4) Verify the result.
SELECT id, username, role, created_at FROM users ORDER BY id;
