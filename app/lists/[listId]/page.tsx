"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, isAdminOrAbove } from "@/lib/AuthContext";
import Header from "@/components/Header";
import Modal from "@/components/Modal";
import { getThreshold, hasRule } from "@/lib/strikeRules";
import { categoryLabels } from "@/lib/labels";
import { addPendingBlackmark, removePendingBlackmark } from "@/lib/pendingBlackmarks";

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
  const { authenticated, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const listId = params.listId as string;

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

  const [list, setList] = useState<ListRecord | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Add-students modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<StudentInfo | null>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  // Selection mode state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Bulk action modal state
  const [bulkStrikeModalOpen, setBulkStrikeModalOpen] = useState(false);
  const [bulkBlackMarkModalOpen, setBulkBlackMarkModalOpen] = useState(false);

  // Bulk form state
  const [strikeType, setStrikeType] = useState("grooming");
  const [blackmarkReason, setBlackmarkReason] = useState("grooming");
  const [issuer, setIssuer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bulk strike → blackmark threshold prompt
  const [bulkPromptOpen, setBulkPromptOpen] = useState(false);
  const [bulkPromptEntries, setBulkPromptEntries] = useState<
    { admissionNo: number; name: string; count: number; threshold: number }[]
  >([]);
  const [bulkPromptIssuedBy, setBulkPromptIssuedBy] = useState("");
  const [bulkPromptBusy, setBulkPromptBusy] = useState(false);

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
    setSelectedIds((prev) => prev.filter((id) => id !== admissionNo));
    setRemovingId(null);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearched(true);

    const { data } = await supabase
      .from("students")
      .select()
      .eq("Admission No", Number(searchQuery));

    if (data && data.length > 0) {
      setSearchResult(data[0] as unknown as StudentInfo);
    } else {
      setSearchResult(null);
    }
    setSearching(false);
  };

  const isAlreadyInList = (admissionNo: number) =>
    list!.students.includes(admissionNo);

  const handleAddStudent = async (student: StudentInfo) => {
    if (!list || isAlreadyInList(student["Admission No"])) return;
    setAddingId(student["Admission No"]);

    const updatedStudents = [...list.students, student["Admission No"]];
    const { error } = await supabase
      .from("lists")
      .update({ students: updatedStudents })
      .eq("id", list.id);

    if (error) {
      alert(`Failed to add student: ${error.message}`);
      setAddingId(null);
      return;
    }

    setList({ ...list, students: updatedStudents });
    // Add full info to the displayed students list
    setStudents((prev) => {
      if (prev.some((s) => s["Admission No"] === student["Admission No"])) return prev;
      return [...prev, student];
    });

    // Reset search so the next student can be added
    setSearchQuery("");
    setSearchResult(null);
    setSearched(false);
    setAddingId(null);
  };

  const closeAddModal = () => {
    setAddModalOpen(false);
    setSearchQuery("");
    setSearchResult(null);
    setSearched(false);
  };

  const toggleSelectMode = () => {
    if (selectMode) setSelectedIds([]);
    setSelectMode(!selectMode);
    setBulkStrikeModalOpen(false);
    setBulkBlackMarkModalOpen(false);
  };

  const toggleSelectStudent = (admissionNo: number) => {
    setSelectedIds((prev) =>
      prev.includes(admissionNo)
        ? prev.filter((id) => id !== admissionNo)
        : [...prev, admissionNo]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.length === students.length
        ? []
        : students.map((s) => s["Admission No"])
    );
  };

  const handleBulkAddStrike = async () => {
    if (selectedIds.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("strikes").insert(
        selectedIds.map((admissionNo) => ({
          "Admission No": admissionNo,
          Category: strikeType,
        }))
      );
      if (error) {
        alert("Failed to add strikes: " + error.message);
        return;
      }
      setBulkStrikeModalOpen(false);

      // Check which selected students crossed a blackmark threshold
      const threshold = getThreshold(strikeType);
      if (threshold !== null) {
        const { data: strikesData } = await supabase
          .from("strikes")
          .select("*")
          .eq("Category", strikeType)
          .in("Admission No", selectedIds);
        const strikeRows = (strikesData || []) as {
          "Admission No": number;
          Category: string;
        }[];
        const affected = selectedIds
          .map((admissionNo) => {
            const count =
              strikeRows.filter((s) => s["Admission No"] === admissionNo).length || 0;
            if (count < threshold) return null;
            const stu = students.find((s) => s["Admission No"] === admissionNo);
            return {
              admissionNo,
              name: stu?.["Name with Initials"] || `Student #${admissionNo}`,
              count,
              threshold,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);
        if (affected.length > 0) {
          setBulkPromptEntries(affected);
          setBulkPromptIssuedBy("");
          setBulkPromptOpen(true);
        }
      }

      setSelectMode(false);
      setSelectedIds([]);
    } finally {
      setSubmitting(false);
    }
  };

  const dismissBulkPrompt = () => {
    if (bulkPromptBusy) return;
    bulkPromptEntries.forEach((entry) =>
      addPendingBlackmark(`${entry.admissionNo}|${strikeType}`)
    );
    setBulkPromptOpen(false);
    setBulkPromptEntries([]);
    setBulkPromptIssuedBy("");
  };

  const confirmBulkPrompt = async () => {
    if (bulkPromptEntries.length === 0 || !bulkPromptIssuedBy.trim() || bulkPromptBusy) {
      return;
    }
    setBulkPromptBusy(true);
    try {
      const { error: bmErr } = await supabase.from("blackmarks").insert(
        bulkPromptEntries.map((entry) => ({
          "Admission No": entry.admissionNo,
          Reason: strikeType,
          issuedBy: bulkPromptIssuedBy.trim(),
        }))
      );
      if (bmErr) {
        alert("Failed to create blackmarks: " + bmErr.message);
        return;
      }
      const { error: delErr } = await supabase
        .from("strikes")
        .delete()
        .eq("Category", strikeType)
        .in(
          "Admission No",
          bulkPromptEntries.map((e) => e.admissionNo)
        );
      if (delErr) {
        console.error("Strike reset error:", delErr);
      }
      setBulkPromptOpen(false);
      setBulkPromptEntries([]);
      setBulkPromptIssuedBy("");
    } catch (err) {
      alert(
        "Failed to create blackmarks: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setBulkPromptBusy(false);
    }
  };

  const handleBulkAddBlackmark = async () => {
    if (selectedIds.length === 0 || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("blackmarks").insert(
      selectedIds.map((admissionNo) => ({
        "Admission No": admissionNo,
        Reason: blackmarkReason,
        issuedBy: issuer,
      }))
    );
    setSubmitting(false);
    if (error) {
      alert("Failed to add blackmarks: " + error.message);
      return;
    }
    // A blackmark in a rule category consumes those students' strikes (full reset)
    if (hasRule(blackmarkReason)) {
      await supabase
        .from("strikes")
        .delete()
        .eq("Category", blackmarkReason)
        .in("Admission No", selectedIds);
      selectedIds.forEach((admissionNo) =>
        removePendingBlackmark(`${admissionNo}|${blackmarkReason}`)
      );
    }
    setBulkBlackMarkModalOpen(false);
    setSelectMode(false);
    setSelectedIds([]);
  };

  if (!authenticated || !isAdminOrAbove(user)) return null;

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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Students
                </button>
                {students.length > 0 && (
                  <button
                    onClick={toggleSelectMode}
                    className={`px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all ${
                      selectMode
                        ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        : "bg-white border border-gray-300 hover:border-indigo-400 hover:text-indigo-600 text-gray-700"
                    }`}
                  >
                    {selectMode ? "Cancel" : "Select"}
                  </button>
                )}
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
          </div>

          {/* Selection action bar */}
          {selectMode && (
            <div className="bg-white rounded-xl shadow-sm border border-indigo-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {selectedIds.length}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {selectedIds.length === 0
                    ? "No students selected"
                    : `${selectedIds.length} student${selectedIds.length !== 1 ? "s" : ""} selected`}
                </span>
                <button
                  onClick={toggleSelectAll}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {selectedIds.length === students.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              </div>
              {isAdminOrAbove(user) && (
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setBulkStrikeModalOpen(true)}
                    disabled={selectedIds.length === 0}
                    className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed text-white font-medium text-sm px-4 py-2 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Add Strike
                  </button>
                  <button
                    onClick={() => setBulkBlackMarkModalOpen(true)}
                    disabled={selectedIds.length === 0}
                    className="flex-1 sm:flex-none bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 disabled:cursor-not-allowed text-white font-medium text-sm px-4 py-2 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Add Blackmark
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Students list */}
          {students.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="text-5xl mb-4">👤</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                This list has no students yet
              </h2>
              <p className="text-sm text-gray-500">
                Use the "Add Students" button above to add students to this list.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {students.map((student) => {
                const isSelected = selectedIds.includes(student["Admission No"]);
                return (
                  <div
                    key={student["Admission No"]}
                    onClick={
                      selectMode
                        ? () => toggleSelectStudent(student["Admission No"])
                        : undefined
                    }
                    className={`bg-white rounded-xl shadow-sm border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
                      selectMode
                        ? isSelected
                          ? "border-indigo-400 ring-2 ring-indigo-200 cursor-pointer"
                          : "border-gray-100 hover:border-indigo-300 cursor-pointer"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      {selectMode && (
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}
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
                    {!selectMode && (
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bulk strike modal */}
      <Modal
        isOpen={bulkStrikeModalOpen}
        onClose={() => setBulkStrikeModalOpen(false)}
        title={`Add strikes to ${selectedIds.length} student${selectedIds.length !== 1 ? "s" : ""}`}
      >
        <div className="text-sm text-gray-500 mb-4">
          Adding a strike to{" "}
          <span className="font-semibold text-gray-700">
            {selectedIds.length} selected student{selectedIds.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div>
          <label
            htmlFor="bulk-strike-category"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Category
          </label>
          <select
            id="bulk-strike-category"
            value={strikeType}
            onChange={(e) => setStrikeType(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:border-indigo-400 focus:bg-white"
          >
            <option value="grooming">Personal Grooming</option>
            <option value="repeated-punish">Repeated punishment</option>
            <option value="bullying">Bullying</option>
            <option value="late">Getting Late Often</option>
            <option value="substances">Substances</option>
            <option value="classfuckup">Classroom Behavior</option>
            <option value="clubbing">Clubbing</option>
          </select>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            onClick={handleBulkAddStrike}
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Save"}
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all"
            onClick={() => setBulkStrikeModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>

      {/* Bulk strike → blackmark threshold prompt */}
      <Modal
        isOpen={bulkPromptOpen}
        onClose={dismissBulkPrompt}
        title="Blackmark Threshold Reached"
      >
        <div className="flex flex-col gap-4">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
            <span className="font-semibold text-rose-900">
              {bulkPromptEntries.length}
            </span>{" "}
            student{bulkPromptEntries.length !== 1 ? "s" : ""} reached the{" "}
            <span className="font-semibold text-rose-900">
              {categoryLabels[strikeType] || strikeType}
            </span>{" "}
            blackmark threshold:
          </div>
          <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 border border-gray-100 rounded-lg p-2">
            {bulkPromptEntries.map((entry) => (
              <div
                key={entry.admissionNo}
                className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2"
              >
                <span className="font-medium text-gray-900 truncate">
                  {entry.name}
                </span>
                <span className="text-xs font-bold text-rose-600 shrink-0">
                  {entry.count}/{entry.threshold}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Creating the black marks will reset each student's strikes in this
            category.
          </p>
          <div>
            <label
              htmlFor="bulk-prompt-issued-by"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Issued By
            </label>
            <input
              id="bulk-prompt-issued-by"
              type="text"
              value={bulkPromptIssuedBy}
              onChange={(e) => setBulkPromptIssuedBy(e.target.value)}
              placeholder="Enter your name"
              autoFocus
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
            />
          </div>
          <div className="flex w-full gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={confirmBulkPrompt}
              disabled={bulkPromptBusy || !bulkPromptIssuedBy.trim()}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            >
              {bulkPromptBusy ? "Saving..." : "Create Black Marks"}
            </button>
            <button
              onClick={dismissBulkPrompt}
              disabled={bulkPromptBusy}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk blackmark modal */}
      <Modal
        isOpen={bulkBlackMarkModalOpen}
        onClose={() => setBulkBlackMarkModalOpen(false)}
        title={`Add black marks to ${selectedIds.length} student${selectedIds.length !== 1 ? "s" : ""}`}
      >
        <div className="text-sm text-gray-500 mb-3">
          Adding a black mark to{" "}
          <span className="font-semibold text-gray-700">
            {selectedIds.length} selected student{selectedIds.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="bulk-bm-reason"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Reason
            </label>
            <select
              id="bulk-bm-reason"
              value={blackmarkReason}
              onChange={(e) => setBlackmarkReason(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:border-indigo-400 focus:bg-white"
            >
              <option value="grooming">Personal Grooming</option>
              <option value="repeated-punish">Repeated punishment</option>
              <option value="bullying">Bullying</option>
              <option value="late">Getting Late Often</option>
              <option value="substances">Substances</option>
              <option value="classfuckup">Classroom Behavior</option>
              <option value="clubbing">Clubbing</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="bulk-issuer"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Issued By
            </label>
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              type="text"
              id="bulk-issuer"
              placeholder="Enter your name"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
            />
          </div>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            onClick={handleBulkAddBlackmark}
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Save"}
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all"
            onClick={() => setBulkBlackMarkModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>

      {/* Add students modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={closeAddModal}
        title={`Add students to ${list!.title}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs sm:text-sm text-gray-500">
            Currently {list!.students.length} student{list!.students.length !== 1 ? "s" : ""} in this
            list. Search by admission number to add more.
          </p>

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="Enter Admission No"
                type="number"
                className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            >
              {searching ? "..." : "Search"}
            </button>
          </div>

          {/* Search result */}
          {searched && !searching && (
            <div>
              {searchResult ? (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {searchResult["Name with Initials"].charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {searchResult["Name with Initials"]}
                      </p>
                      <p className="text-xs text-gray-500">
                        {searchResult.Class} · Admission: {searchResult["Admission No"]}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddStudent(searchResult)}
                    disabled={
                      addingId === searchResult["Admission No"] ||
                      isAlreadyInList(searchResult["Admission No"])
                    }
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all shrink-0 ${
                      isAlreadyInList(searchResult["Admission No"])
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-emerald-500 hover:bg-emerald-600 text-white"
                    }`}
                  >
                    {addingId === searchResult["Admission No"]
                      ? "Adding..."
                      : isAlreadyInList(searchResult["Admission No"])
                      ? "In list ✓"
                      : "Add to list"}
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-gray-500">
                    No student found with Admission No:{" "}
                    <span className="font-semibold text-gray-700">{searchQuery}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
