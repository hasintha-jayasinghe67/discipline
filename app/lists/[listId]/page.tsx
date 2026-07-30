"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import Header from "@/components/Header";

interface StudentInfo {
  "Admission No": number;
  "Name with Initials": string;
  Class: string;
  "School House": string;
}

interface ListRecord {
  id: number;
  title: string;
  students: number[];
  active: boolean;
  createdBy: string;
  created_at: string;
}

export default function ListDetailPage() {
  const { authenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const listId = params.listId as string;

  useEffect(() => {
    if (!authenticated) {
      router.push("/authenticate");
    }
  }, [authenticated, router]);

  const [list, setList] = useState<ListRecord | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchList = async () => {
    setLoading(true);

    const { data: listData } = await supabase
      .from("lists")
      .select()
      .eq("id", Number(listId));

    if (!listData || listData.length < 1) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const foundList = listData[0] as ListRecord;
    setList(foundList);

    // Fetch full student info for each admission number in the list
    if (foundList.students.length > 0) {
      const { data: studentsData } = await supabase
        .from("students")
        .select()
        .in("Admission No", foundList.students);

      setStudents(studentsData || []);
    } else {
      setStudents([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (listId) fetchList();
  }, [listId]);

  const handleToggleActive = async () => {
    if (!list || toggling) return;
    setToggling(true);
    await supabase
      .from("lists")
      .update({ active: !list.active })
      .eq("id", list.id);
    setList({ ...list, active: !list.active });
    setToggling(false);
  };

  const handleRemoveStudent = async (admissionNo: number) => {
    if (!list) return;
    setRemovingId(admissionNo);
    const updatedStudents = list.students.filter((id) => id !== admissionNo);
    await supabase
      .from("lists")
      .update({ students: updatedStudents })
      .eq("id", list.id);
    setList({ ...list, students: updatedStudents });
    setStudents((prev) => prev.filter((s) => s["Admission No"] !== admissionNo));
    setRemovingId(null);
  };

  if (!authenticated) return null;

  if (loading) {
    return (
      <>
        <Header />
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen flex items-center justify-center">
          <div className="text-gray-400 text-base sm:text-lg animate-pulse">
            Loading list...
          </div>
        </div>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <Header />
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
          <div className="max-w-2xl mx-auto mt-8 sm:mt-12 bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
            <div className="text-4xl sm:text-6xl mb-4">🔍</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
              List Not Found
            </h2>
            <p className="text-sm sm:text-base text-gray-500">
              No list found with ID:{" "}
              <span className="font-semibold text-gray-700">{listId}</span>
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
        <div className="max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6">
          {/* Back link */}
          <a
            href="/lists"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 hover:text-indigo-600 transition-colors w-fit"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to lists
          </a>

          {/* List info card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${
                    list!.active ? "bg-emerald-400" : "bg-gray-300"
                  }`} />
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    {list!.title}
                  </h1>
                </div>
                <p className="text-sm text-gray-500 mt-1.5">
                  {list!.students.length} student{list!.students.length !== 1 ? "s" : ""}
                  {" · "}Created by {list!.createdBy}
                  {" · "}{new Date(list!.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={handleToggleActive}
                disabled={toggling}
                className={`px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all ${
                  list!.active
                    ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white"
                }`}
              >
                {toggling
                  ? "..."
                  : list!.active
                  ? "Set Inactive"
                  : "Set Active"}
              </button>
            </div>
          </div>

          {/* Students list */}
          {students.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="text-5xl mb-4">👤</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                This list has no students yet
              </h2>
              <p className="text-sm text-gray-500">
                Add students from the create page or edit the list data.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {students.map((student) => (
                <div
                  key={student["Admission No"]}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                      {student["Name with Initials"].charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                        {student["Name with Initials"]}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {student.Class} · {student["School House"]}
                      </p>
                      <p className="text-xs text-gray-400">
                        Admission: {student["Admission No"]}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveStudent(student["Admission No"])}
                    disabled={removingId === student["Admission No"]}
                    className="shrink-0 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs sm:text-sm font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {removingId === student["Admission No"] ? (
                      "Removing..."
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Remove
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
