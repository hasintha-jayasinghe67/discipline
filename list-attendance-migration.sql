-- ============================================================
-- List Attendance Migration
--
-- Run this script in the Supabase SQL editor.
-- Creates tables for taking and updating attendance on lists.
-- ============================================================

-- One attendance session per list per calendar date.
CREATE TABLE IF NOT EXISTS list_attendance_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  list_id BIGINT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  taken_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (list_id, session_date)
);

-- Individual student status within a session.
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

CREATE INDEX IF NOT EXISTS idx_list_attendance_sessions_list_date
  ON list_attendance_sessions (list_id, session_date);

CREATE INDEX IF NOT EXISTS idx_list_attendance_records_session
  ON list_attendance_records (session_id);

CREATE INDEX IF NOT EXISTS idx_list_attendance_records_admission
  ON list_attendance_records ("Admission No");
