import { supabase } from "@/lib/supabase";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceSession {
  id: number;
  list_id: number;
  session_date: string;
  taken_by: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: number;
  session_id: number;
  "Admission No": number;
  status: AttendanceStatus;
}

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

export const attendanceStatusColors: Record<
  AttendanceStatus,
  { bg: string; text: string; border: string }
> = {
  present: {
    bg: "bg-emerald-500",
    text: "text-emerald-700",
    border: "border-emerald-400",
  },
  absent: {
    bg: "bg-rose-500",
    text: "text-rose-700",
    border: "border-rose-400",
  },
  late: {
    bg: "bg-amber-500",
    text: "text-amber-700",
    border: "border-amber-400",
  },
  excused: {
    bg: "bg-sky-500",
    text: "text-sky-700",
    border: "border-sky-400",
  },
};

export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface AttendanceSessionSummary {
  session: AttendanceSession;
  records: AttendanceRecord[];
}

export function countByStatus(
  records: AttendanceRecord[]
): Record<AttendanceStatus, number> {
  const counts: Record<AttendanceStatus, number> = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  };
  for (const record of records) {
    counts[record.status]++;
  }
  return counts;
}

export function formatSessionDate(sessionDate: string): string {
  const [year, month, day] = sessionDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function fetchListAttendanceSessions(
  listId: number
): Promise<AttendanceSessionSummary[]> {
  const { data: sessions } = await supabase
    .from("list_attendance_sessions")
    .select()
    .eq("list_id", listId)
    .order("session_date", { ascending: false });

  if (!sessions || sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((session) => session.id);
  const { data: records } = await supabase
    .from("list_attendance_records")
    .select()
    .in("session_id", sessionIds);

  const recordsBySession = new Map<number, AttendanceRecord[]>();
  for (const record of (records || []) as AttendanceRecord[]) {
    const existing = recordsBySession.get(record.session_id) || [];
    existing.push(record);
    recordsBySession.set(record.session_id, existing);
  }

  return sessions.map((session) => ({
    session: session as AttendanceSession,
    records: recordsBySession.get(session.id) || [],
  }));
}

export async function fetchAttendanceSession(
  listId: number,
  sessionDate: string
): Promise<{ session: AttendanceSession | null; records: AttendanceRecord[] }> {
  const { data: sessions } = await supabase
    .from("list_attendance_sessions")
    .select()
    .eq("list_id", listId)
    .eq("session_date", sessionDate);

  if (!sessions || sessions.length === 0) {
    return { session: null, records: [] };
  }

  const session = sessions[0] as AttendanceSession;
  const { data: records } = await supabase
    .from("list_attendance_records")
    .select()
    .eq("session_id", session.id);

  return {
    session,
    records: (records || []) as AttendanceRecord[],
  };
}

export async function saveAttendanceSession(
  listId: number,
  sessionDate: string,
  takenBy: string,
  statuses: Record<number, AttendanceStatus>,
  admissionNos: number[]
): Promise<{ error: string | null }> {
  const trimmedTakenBy = takenBy.trim();
  if (!trimmedTakenBy) {
    return { error: "Please enter your name." };
  }

  const { session: existing } = await fetchAttendanceSession(listId, sessionDate);
  let sessionId: number;

  if (existing) {
    const { error: updateError } = await supabase
      .from("list_attendance_sessions")
      .update({
        taken_by: trimmedTakenBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      return { error: updateError.message };
    }
    sessionId = existing.id;

    const { error: deleteError } = await supabase
      .from("list_attendance_records")
      .delete()
      .eq("session_id", sessionId);

    if (deleteError) {
      return { error: deleteError.message };
    }
  } else {
    const { data: newSession, error: insertError } = await supabase
      .from("list_attendance_sessions")
      .insert({
        list_id: listId,
        session_date: sessionDate,
        taken_by: trimmedTakenBy,
      })
      .select("id")
      .single();

    if (insertError || !newSession) {
      return { error: insertError?.message || "Failed to create attendance session." };
    }
    sessionId = newSession.id as number;
  }

  const records = admissionNos.map((admissionNo) => ({
    session_id: sessionId,
    "Admission No": admissionNo,
    status: statuses[admissionNo] || "present",
    updated_at: new Date().toISOString(),
  }));

  const { error: recordsError } = await supabase
    .from("list_attendance_records")
    .insert(records);

  if (recordsError) {
    return { error: recordsError.message };
  }

  return { error: null };
}
