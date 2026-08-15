"use client";

import { useRouter } from "next/navigation";
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
  listId: number;
  summaries: AttendanceSessionSummary[];
}

export default function ListAttendanceSummary({
  listId,
  summaries,
}: ListAttendanceSummaryProps) {
  const router = useRouter();

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
          <button
            key={session.id}
            type="button"
            onClick={() =>
              router.push(`/lists/${listId}/attendance/${session.id}`)
            }
            className={`text-left text-xs sm:text-sm leading-relaxed rounded-lg px-2.5 py-2 -mx-1 transition-all hover:bg-slate-50 hover:ring-1 hover:ring-slate-200 group ${
              isToday ? "text-slate-700" : "text-slate-500"
            }`}
          >
            <span className="font-medium text-slate-800 group-hover:text-sky-700 transition-colors">
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
            <span className="inline-flex items-center ml-1.5 text-slate-400 group-hover:text-sky-500 transition-colors align-middle">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}
