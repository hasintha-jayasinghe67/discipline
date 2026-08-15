"use client";

import { useEffect, useState } from "react";
import {
  AttendanceStatus,
  attendanceStatusColors,
  attendanceStatusLabels,
  fetchAttendanceSession,
  saveAttendanceSession,
  todayDateString,
} from "@/lib/listAttendance";

interface StudentInfo {
  "Admission No": number;
  "Name with Initials": string;
  Class: string;
  "School House": string;
}

interface ListAttendancePanelProps {
  listId: number;
  students: StudentInfo[];
  onClose: () => void;
}

const STATUS_OPTIONS: AttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "excused",
];

export default function ListAttendancePanel({
  listId,
  students,
  onClose,
}: ListAttendancePanelProps) {
  const [sessionDate, setSessionDate] = useState(todayDateString());
  const [takenBy, setTakenBy] = useState("");
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingSession, setExistingSession] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const buildDefaultStatuses = () =>
    Object.fromEntries(
      students.map((s) => [s["Admission No"], "present" as AttendanceStatus])
    );

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      setLoading(true);
      const { session, records } = await fetchAttendanceSession(
        listId,
        sessionDate
      );

      if (cancelled) return;

      if (session) {
        setExistingSession(true);
        setTakenBy(session.taken_by);
        setLastSavedAt(session.updated_at || session.created_at);

        const loaded: Record<number, AttendanceStatus> = buildDefaultStatuses();
        for (const record of records) {
          loaded[record["Admission No"]] = record.status;
        }
        setStatuses(loaded);
      } else {
        setExistingSession(false);
        setTakenBy("");
        setLastSavedAt(null);
        setStatuses(buildDefaultStatuses());
      }

      setLoading(false);
    };

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [listId, sessionDate, students]);

  const setStudentStatus = (admissionNo: number, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [admissionNo]: status }));
  };

  const setAllStatuses = (status: AttendanceStatus) => {
    setStatuses(
      Object.fromEntries(
        students.map((s) => [s["Admission No"], status])
      )
    );
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    const { error } = await saveAttendanceSession(
      listId,
      sessionDate,
      takenBy,
      statuses,
      students.map((s) => s["Admission No"])
    );

    setSaving(false);

    if (error) {
      alert("Failed to save attendance: " + error);
      return;
    }

    setExistingSession(true);
    setLastSavedAt(new Date().toISOString());
    onClose();
  };

  const summary = STATUS_OPTIONS.map((status) => ({
    status,
    count: students.filter(
      (s) => (statuses[s["Admission No"]] || "present") === status
    ).length,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Controls bar */}
      <div className="bg-white rounded-xl shadow-sm border border-sky-200 p-4 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor="attendance-date"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Date
            </label>
            <input
              id="attendance-date"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 focus:border-sky-400 focus:bg-white"
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor="attendance-taken-by"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Taken by
            </label>
            <input
              id="attendance-taken-by"
              type="text"
              value={takenBy}
              onChange={(e) => setTakenBy(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-sky-400 focus:bg-white"
            />
          </div>
        </div>

        {existingSession && lastSavedAt && !loading && (
          <p className="text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
            Attendance already recorded for this date. You can update it below.
            Last saved{" "}
            {new Date(lastSavedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {takenBy ? ` by ${takenBy}` : ""}.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Quick mark:</span>
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => setAllStatuses(status)}
              disabled={loading}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all disabled:opacity-50 ${attendanceStatusColors[status].text} bg-white ${attendanceStatusColors[status].border} hover:opacity-80`}
            >
              All {attendanceStatusLabels[status]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          {summary.map(({ status, count }) => (
            <span
              key={status}
              className={`font-medium ${attendanceStatusColors[status].text}`}
            >
              {count} {attendanceStatusLabels[status].toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Student rows */}
      {loading ? (
        <div className="text-center py-8 text-slate-400 animate-pulse">
          Loading attendance...
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((student) => {
            const admissionNo = student["Admission No"];
            const currentStatus = statuses[admissionNo] || "present";

            return (
              <div
                key={admissionNo}
                className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-sky-500 to-teal-500 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {student["Name with Initials"].charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {student["Name with Initials"]}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {student.Class} · {student["School House"]}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((status) => {
                    const isActive = currentStatus === status;
                    const colors = attendanceStatusColors[status];
                    return (
                      <button
                        key={status}
                        onClick={() => setStudentStatus(admissionNo, status)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          isActive
                            ? `${colors.bg} text-white border-transparent shadow-sm`
                            : `bg-white ${colors.text} ${colors.border} hover:opacity-80`
                        }`}
                      >
                        {attendanceStatusLabels[status]}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleSave}
          disabled={saving || loading || !takenBy.trim()}
          className="btn-primary flex-1 px-4 py-2.5 text-sm"
        >
          {saving
            ? "Saving..."
            : existingSession
            ? "Update Attendance"
            : "Save Attendance"}
        </button>
        <button
          onClick={onClose}
          disabled={saving}
          className="btn-secondary flex-1 px-4 py-2.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
