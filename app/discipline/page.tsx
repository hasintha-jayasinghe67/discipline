"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import Header from "@/components/Header";

const categoryLabels: Record<string, string> = {
  grooming: "Personal Grooming",
  "repeated-punish": "Repeated Punishments",
  bullying: "Bullying",
  late: "Getting Late Often",
  substances: "Substances",
  classfuckup: "Classroom Behavior",
  clubbing: "Clubbing",
};

interface StudentInfo {
  "Admission No": number;
  "Name with Initials": string;
  Class: string;
  "School House": string;
}

interface StrikeRecord {
  "Admission No": number;
  Category: string;
  created_at: string;
  student?: StudentInfo;
}

interface BlackmarkRecord {
  "Admission No": number;
  Reason: string;
  issuedBy: string;
  created_at: string;
  student?: StudentInfo;
}

export default function DisciplinePage() {
  const { authenticated } = useAuth();
  const router = useRouter();

  const [strikes, setStrikes] = useState<StrikeRecord[]>([]);

  useEffect(() => {
    if (!authenticated) {
      router.push("/authenticate");
    }
  }, [authenticated, router]);

  const [blackmarks, setBlackmarks] = useState<BlackmarkRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [issuerFilter, setIssuerFilter] = useState("");

  // Sort state for each column
  const [strikeSort, setStrikeSort] = useState<"newest" | "oldest" | "category">("newest");
  const [blackmarkSort, setBlackmarkSort] = useState<"newest" | "oldest" | "category">("newest");

  // Category filter state for each column
  const [strikeCategoryFilter, setStrikeCategoryFilter] = useState("all");
  const [blackmarkCategoryFilter, setBlackmarkCategoryFilter] = useState("all");

  const fetchData = async () => {
    setLoading(true);

    const [strikesRes, blackmarksRes, studentsRes] = await Promise.all([
      supabase.from("strikes").select("*").order("created_at", { ascending: false }),
      supabase.from("blackmarks").select("*").order("created_at", { ascending: false }),
      supabase.from("students").select("*"),
    ]);

    // Build student lookup map
    const studentMap: Record<number, StudentInfo> = {};
    studentsRes.data?.forEach((s) => {
      studentMap[s["Admission No"]] = s;
    });

    // Enrich with student data
    const enrichedStrikes =
      strikesRes.data?.map((s) => ({
        ...s,
        student: studentMap[s["Admission No"]],
      })) || [];

    const enrichedBlackmarks =
      blackmarksRes.data?.map((bm) => ({
        ...bm,
        student: studentMap[bm["Admission No"]],
      })) || [];

    setStrikes(enrichedStrikes);
    setBlackmarks(enrichedBlackmarks);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Apply date range filter
  const filterByDate = (record: { created_at: string }) => {
    if (!dateFrom && !dateTo) return true;
    const recordDate = new Date(record.created_at);
    if (dateFrom && recordDate < new Date(dateFrom)) return false;
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999); // include the full day
      if (recordDate > endDate) return false;
    }
    return true;
  };

  // Unique category options derived from data
  const strikeCategories = [...new Set(strikes.map((s) => s.Category))].sort(
    (a, b) => (categoryLabels[a] || a).localeCompare(categoryLabels[b] || b)
  );
  const blackmarkCategories = [...new Set(blackmarks.map((bm) => bm.Reason))].sort(
    (a, b) => (categoryLabels[a] || a).localeCompare(categoryLabels[b] || b)
  );

  const filteredStrikes = strikes.filter((s) => {
    if (!filterByDate(s)) return false;
    if (strikeCategoryFilter !== "all" && s.Category !== strikeCategoryFilter) return false;
    return true;
  });

  const filteredBlackmarks = blackmarks.filter((bm) => {
    if (!filterByDate(bm)) return false;
    if (blackmarkCategoryFilter !== "all" && bm.Reason !== blackmarkCategoryFilter) return false;
    if (issuerFilter) {
      return bm.issuedBy
        ?.toLowerCase()
        .includes(issuerFilter.toLowerCase());
    }
    return true;
  });

  // Sort helpers
  const sortByCategory = (a: { Category?: string; Reason?: string }, b: { Category?: string; Reason?: string }) => {
    const labelA = categoryLabels[a.Category || a.Reason || ""] || a.Category || a.Reason || "";
    const labelB = categoryLabels[b.Category || b.Reason || ""] || b.Category || b.Reason || "";
    return labelA.localeCompare(labelB);
  };

  const sortByNewest = (a: { created_at: string }, b: { created_at: string }) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

  const sortByOldest = (a: { created_at: string }, b: { created_at: string }) =>
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();

  const applySort = <T extends { created_at: string; Category?: string; Reason?: string }>(
    items: T[],
    sortKey: string
  ): T[] => {
    const sorted = [...items];
    if (sortKey === "category") {
      sorted.sort(sortByCategory);
    } else if (sortKey === "oldest") {
      sorted.sort(sortByOldest);
    } else {
      sorted.sort(sortByNewest);
    }
    return sorted;
  };

  const sortedStrikes = applySort(filteredStrikes, strikeSort);
  const sortedBlackmarks = applySort(filteredBlackmarks, blackmarkSort);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!authenticated) return null;

  return (
    <>
      <Header />
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto flex flex-col gap-4 sm:gap-6">
          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Discipline Records
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                View all strikes and blackmarks across students
              </p>
            </div>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 hover:text-indigo-600 transition-colors w-fit"
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
              Back to search
            </a>
          </div>

          {/* Date range filter — shared across both columns */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Filter by date
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <label htmlFor="date-from" className="text-xs text-gray-500 shrink-0">
                    From
                  </label>
                  <input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="flex-1 sm:w-auto bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="date-to" className="text-xs text-gray-500 shrink-0">
                    To
                  </label>
                  <input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="flex-1 sm:w-auto bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:bg-white"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-gray-400 text-base sm:text-lg animate-pulse">
                Loading discipline records...
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* ===== STRIKES COLUMN ===== */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-amber-400 rounded-full"></span>
                    Strikes
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Sort controls */}
                    <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 text-xs">
                      <button
                        onClick={() => setStrikeSort("newest")}
                        className={`px-2 py-1 rounded-l-lg transition-colors ${
                          strikeSort === "newest"
                            ? "bg-amber-500 text-white"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Newest
                      </button>
                      <button
                        onClick={() => setStrikeSort("oldest")}
                        className={`px-2 py-1 transition-colors ${
                          strikeSort === "oldest"
                            ? "bg-amber-500 text-white"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Oldest
                      </button>
                      <button
                        onClick={() => setStrikeSort("category")}
                        className={`px-2 py-1 rounded-r-lg transition-colors ${
                          strikeSort === "category"
                            ? "bg-amber-500 text-white"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Category
                      </button>
                    </div>
                    <span className="text-xs text-gray-400 font-medium bg-gray-50 px-2.5 py-1 rounded-full">
                      {sortedStrikes.length} record{sortedStrikes.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Category filter — strikes */}
                {strikeCategories.length > 0 && (
                  <div className="mb-3">
                    <div className="relative">
                      <select
                        value={strikeCategoryFilter}
                        onChange={(e) => setStrikeCategoryFilter(e.target.value)}
                        className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs text-gray-700 focus:border-amber-400 focus:bg-white focus:ring-1 focus:ring-amber-300 cursor-pointer"
                      >
                        <option value="all">All categories</option>
                        {strikeCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {categoryLabels[cat] || cat}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}

                {sortedStrikes.length === 0 ? (
                  <p className="text-gray-400 text-sm py-8 text-center">
                    {strikes.length === 0
                      ? "No strikes recorded yet"
                      : "No strikes match the selected filters"}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {sortedStrikes.map((strike, i) => (
                      <div
                        key={`${strike["Admission No"]}-${strike.created_at}-${i}`}
                        className="bg-amber-50 border border-amber-100 rounded-lg p-3.5"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center text-amber-700 text-xs font-bold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            {/* Student name + admission */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={`/student/${strike["Admission No"]}`}
                                className="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                              >
                                {strike.student?.["Name with Initials"] || `Student #${strike["Admission No"]}`}
                              </a>
                              <span className="text-xs text-gray-400">
                                #{strike["Admission No"]}
                              </span>
                            </div>
                            {/* Class + House */}
                            {strike.student && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {strike.student.Class}
                                {strike.student["School House"] && (
                                  <>
                                    <span className="mx-1">•</span>
                                    {strike.student["School House"]}
                                  </>
                                )}
                              </div>
                            )}
                            {/* Reason */}
                            <div className="mt-2 flex items-center gap-2">
                              <span className="inline-block text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                {categoryLabels[strike.Category] || strike.Category}
                              </span>
                            </div>
                            {/* Date */}
                            {strike.created_at && (
                              <div className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {formatDate(strike.created_at)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ===== BLACKMARKS COLUMN ===== */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-rose-400 rounded-full"></span>
                    Blackmarks
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Sort controls */}
                    <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 text-xs">
                      <button
                        onClick={() => setBlackmarkSort("newest")}
                        className={`px-2 py-1 rounded-l-lg transition-colors ${
                          blackmarkSort === "newest"
                            ? "bg-rose-500 text-white"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Newest
                      </button>
                      <button
                        onClick={() => setBlackmarkSort("oldest")}
                        className={`px-2 py-1 transition-colors ${
                          blackmarkSort === "oldest"
                            ? "bg-rose-500 text-white"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Oldest
                      </button>
                      <button
                        onClick={() => setBlackmarkSort("category")}
                        className={`px-2 py-1 rounded-r-lg transition-colors ${
                          blackmarkSort === "category"
                            ? "bg-rose-500 text-white"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Category
                      </button>
                    </div>
                    <span className="text-xs text-gray-400 font-medium bg-gray-50 px-2.5 py-1 rounded-full">
                      {sortedBlackmarks.length} record{sortedBlackmarks.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Issuer search — only above blackmarks column */}
                <div className="mb-4">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
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
                      value={issuerFilter}
                      onChange={(e) => setIssuerFilter(e.target.value)}
                      type="text"
                      placeholder="Search by who assigned..."
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
                    />
                    {issuerFilter && (
                      <button
                        onClick={() => setIssuerFilter("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Category filter — blackmarks */}
                {blackmarkCategories.length > 0 && (
                  <div className="mb-4">
                    <div className="relative">
                      <select
                        value={blackmarkCategoryFilter}
                        onChange={(e) => setBlackmarkCategoryFilter(e.target.value)}
                        className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs text-gray-700 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-300 cursor-pointer"
                      >
                        <option value="all">All categories</option>
                        {blackmarkCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {categoryLabels[cat] || cat}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}

                {sortedBlackmarks.length === 0 ? (
                  <p className="text-gray-400 text-sm py-8 text-center">
                    {blackmarks.length === 0
                      ? "No blackmarks recorded yet"
                      : "No blackmarks match the current filters"}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {sortedBlackmarks.map((bm, i) => (
                      <div
                        key={`${bm["Admission No"]}-${bm.created_at}-${i}`}
                        className="bg-rose-50 border border-rose-100 rounded-lg p-3.5"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-rose-200 rounded-full flex items-center justify-center text-rose-700 text-xs font-bold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            {/* Student name + admission */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={`/student/${bm["Admission No"]}`}
                                className="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                              >
                                {bm.student?.["Name with Initials"] || `Student #${bm["Admission No"]}`}
                              </a>
                              <span className="text-xs text-gray-400">
                                #{bm["Admission No"]}
                              </span>
                            </div>
                            {/* Class + House */}
                            {bm.student && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {bm.student.Class}
                                {bm.student["School House"] && (
                                  <>
                                    <span className="mx-1">•</span>
                                    {bm.student["School House"]}
                                  </>
                                )}
                              </div>
                            )}
                            {/* Reason */}
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <span className="inline-block text-xs font-medium bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                                {categoryLabels[bm.Reason] || bm.Reason}
                              </span>
                            </div>
                            {/* Issued by + Date */}
                            <div className="flex items-center gap-3 mt-1.5 text-xs">
                              {bm.issuedBy && (
                                <span className="text-rose-600 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  By: {bm.issuedBy}
                                </span>
                              )}
                              {bm.created_at && (
                                <span className="text-rose-500 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {formatDate(bm.created_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
