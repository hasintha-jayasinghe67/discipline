"use client";

import {
  AttendanceSessionSummary,
  AttendanceStatus,
  attendanceStatusColors,
  attendanceStatusLabels,
  countByStatus,
  formatSessionDate,
  todayDateString,
} from "@/lib/listAttendance";

const STATUS_ORDER: AttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "excused",
];

interface ListAttendanceSummaryProps {
  summaries: AttendanceSessionSummary[];
}

export default function ListAttendanceSummary({
  summaries,
}: ListAttendanceSummaryProps) {
  if (summaries.length === 0) return null;

  const today = todayDateString();

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
      {summaries.map(({ session, records }) => {
        const counts = countByStatus(records);
        const isToday = session.session_date === today;
        const savedAt = session.updated_at || session.created_at;
        const visibleStatuses = STATUS_ORDER.filter(
          (status) => counts[status] > 0
        );

        return (
          <div
            key={session.id}
            className={`text-xs sm:text-sm leading-relaxed ${
              isToday
                ? "text-slate-700"
                : "text-slate-500"
            }`}
          >
            <span className="font-medium text-slate-800">
              {isToday ? "Today's attendance" : "Attendance"} ·{" "}
              {formatSessionDate(session.session_date)}
            </span>
            {visibleStatuses.length > 0 && (
              <>
                <span className="text-slate-400 mx-1.5">·</span>
                {visibleStatuses.map((status, index) => (
                  <span key={status}>
                    {index > 0 && (
                      <span className="text-slate-300 mx-1">·</span>
                    )}
                    <span
                      className={`font-semibold ${attendanceStatusColors[status].text}`}
                    >
                      {counts[status]}{" "}
                      {attendanceStatusLabels[status].toLowerCase()}
                    </span>
                  </span>
                ))}
              </>
            )}
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="text-slate-500">
              by {session.taken_by}
              {savedAt &&
                ` at ${new Date(savedAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
