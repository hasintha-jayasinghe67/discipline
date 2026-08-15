"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, isAdminOrAbove } from "@/lib/AuthContext";
import Header from "@/components/Header";
import { fetchStudentsFor } from "@/lib/students";
import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  attendanceStatusColors,
  attendanceStatusLabels,
  countByStatus,
  fetchAttendanceSessionById,
  formatSessionDate,
} from "@/lib/listAttendance";

interface StudentInfo {
  "Admission No": number;
  "Name with Initials": string;
  Class: string;
  "School House": string;
}

const STATUS_ORDER: AttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "excused",
];

export default function AttendanceSessionDetailPage() {
  const { authenticated, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const listId = params.listId as string;
  const sessionId = params.sessionId as string;

  useEffect(() => {
    if (!authenticated) {
      router.push("/authenticate");
    }
  }, [authenticated, router]);

  useEffect(() => {
    if (authenticated && !isAdminOrAbove(user)) {
      router.push("/");
    }
  }, [authenticated, user, router]);

  const [listTitle, setListTitle] = useState("");
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [studentsByAdmission, setStudentsByAdmission] = useState<
    Map<number, StudentInfo>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: listData } = await supabase
        .from("lists")
        .select("id, title")
        .eq("id", Number(listId));

      if (!listData || listData.length < 1) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setListTitle(listData[0].title as string);

      const { session: loadedSession, records: loadedRecords } =
        await fetchAttendanceSessionById(Number(sessionId));

      if (
        !loadedSession ||
        loadedSession.list_id !== Number(listId)
      ) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setSession(loadedSession);
      setRecords(loadedRecords);

      const admissionNos = loadedRecords.map((r) => r["Admission No"]);
      if (admissionNos.length > 0) {
        const students = await fetchStudentsFor(admissionNos);
        setStudentsByAdmission(
          new Map(students.map((s) => [s["Admission No"], s]))
        );
      }

      setLoading(false);
    };

    if (listId && sessionId) load();
  }, [listId, sessionId]);

  if (!authenticated || !isAdminOrAbove(user)) return null;

  if (loading) {
    return (
      <>
        <Header />
        <div className="page-shell flex items-center justify-center">
          <div className="text-slate-400 text-base sm:text-lg animate-pulse">
            Loading attendance...
          </div>
        </div>
      </>
    );
  }

  if (notFound || !session) {
    return (
      <>
        <Header />
        <div className="page-shell">
          <div className="max-w-2xl mx-auto mt-8 sm:mt-12 card-solid p-6 sm:p-8 text-center">
            <div className="text-4xl sm:text-6xl mb-4">🔍</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-2">
              Attendance Not Found
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mb-5">
              No attendance session found for this list.
            </p>
            <a
              href={`/lists/${listId}`}
              className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 font-medium transition-colors"
            >
              Back to list
            </a>
          </div>
        </div>
      </>
    );
  }

  const counts = countByStatus(records);
  const savedAt = session.updated_at || session.created_at;

  const studentsByStatus = STATUS_ORDER.map((status) => ({
    status,
    students: records
      .filter((r) => r.status === status)
      .map((r) => {
        const info = studentsByAdmission.get(r["Admission No"]);
        return {
          admissionNo: r["Admission No"],
          name: info?.["Name with Initials"] || `Student #${r["Admission No"]}`,
          className: info?.Class || "",
          house: info?.["School House"] || "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.students.length > 0);

  return (
    <>
      <Header />
      <div className="page-shell">
        <div className="max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6">
          <a
            href={`/lists/${listId}`}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-teal-600 transition-colors w-fit"
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to {listTitle || "list"}
          </a>

          <div className="card-solid p-4 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Attendance
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              {listTitle}
              {" · "}
              {formatSessionDate(session.session_date)}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Taken by {session.taken_by}
              {savedAt &&
                ` at ${new Date(savedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}`}
            </p>

            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-3 text-xs sm:text-sm">
              {STATUS_ORDER.map((status) => (
                <span
                  key={status}
                  className={`font-semibold ${attendanceStatusColors[status].text}`}
                >
                  {counts[status]} {attendanceStatusLabels[status].toLowerCase()}
                </span>
              ))}
            </div>
          </div>

          {studentsByStatus.length === 0 ? (
            <div className="card-solid p-8 text-center">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">
                No attendance records
              </h2>
              <p className="text-sm text-slate-500">
                This session has no student records yet.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {studentsByStatus.map(({ status, students }) => {
                const colors = attendanceStatusColors[status];
                return (
                  <section key={status} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-1">
                      <span
                        className={`w-2 h-2 rounded-full ${colors.bg}`}
                      />
                      <h2
                        className={`text-sm font-semibold ${colors.text}`}
                      >
                        {attendanceStatusLabels[status]}
                      </h2>
                      <span className="text-xs text-slate-400">
                        ({students.length})
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {students.map((student) => (
                        <button
                          key={student.admissionNo}
                          type="button"
                          onClick={() =>
                            router.push(`/student/${student.admissionNo}`)
                          }
                          className="text-left bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4 flex items-center gap-3 hover:border-teal-300 hover:shadow-md transition-all group"
                        >
                          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {student.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate group-hover:text-teal-600 transition-colors">
                              {student.name}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500">
                              {[student.className, student.house]
                                .filter(Boolean)
                                .join(" · ") ||
                                `Admission: ${student.admissionNo}`}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg border ${colors.text} ${colors.border} bg-white`}
                          >
                            {attendanceStatusLabels[status]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
