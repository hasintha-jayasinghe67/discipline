"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, isAdminOrAbove } from "@/lib/AuthContext";
import Header from "@/components/Header";

interface ListRecord {
  id: number;
  title: string;
  students: number[];
  active: boolean;
  createdBy: string;
  created_at: string;
}

export default function ListsOverviewPage() {
  const { authenticated, user } = useAuth();
  const router = useRouter();

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

  const [lists, setLists] = useState<ListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Search & date filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sort
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "students">("newest");

  const fetchLists = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lists")
      .select()
      .order("created_at", { ascending: false });
    setLists(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLists();
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

  // Apply active toggle, title search, and date range
  const displayedLists = lists
    .filter((l) => (showInactive ? true : l.active))
    .filter((l) =>
      !searchQuery.trim() ||
      l.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
    .filter((l) => filterByDate(l));

  // Sort the filtered lists
  const sortByNewest = (a: ListRecord, b: ListRecord) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  const sortByOldest = (a: ListRecord, b: ListRecord) =>
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  const sortByStudentCount = (a: ListRecord, b: ListRecord) =>
    b.students.length - a.students.length;

  const sortedDisplayedLists = [...displayedLists].sort((a, b) => {
    if (sortBy === "oldest") return sortByOldest(a, b);
    if (sortBy === "students") return sortByStudentCount(a, b);
    return sortByNewest(a, b);
  });

  const activeLists = lists.filter((l) => l.active);
  const inactiveLists = lists.filter((l) => !l.active);

  const filtersActive = searchQuery.trim() !== "" || dateFrom !== "" || dateTo !== "";

  if (!authenticated || !isAdminOrAbove(user)) return null;

  return (
    <>
      <Header />
      <div className="page-shell">
        <div className="max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="page-title">Lists</h1>
              <p className="page-subtitle mt-1">
                {activeLists.length} active, {inactiveLists.length} inactive
              </p>
            </div>
            <button
              onClick={() => router.push("/lists/create")}
              className="btn-primary px-5 py-2.5 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New List
            </button>
          </div>

          {/* Search & date filters */}
          <div className="card-solid p-4 sm:p-5 flex flex-col gap-3">
            {/* Search by title */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
                placeholder="Search lists by title..."
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200/70 rounded-xl text-slate-900 placeholder-slate-400 focus:border-accent focus:bg-white"
              />
            </div>

            {/* Date range filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-slate-500 font-medium shrink-0">
                Filter by date
              </span>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-1">
                <label className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-slate-500 shrink-0">From</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-slate-900 focus:border-accent focus:bg-white"
                  />
                </label>
                <label className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-slate-500 shrink-0">To</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-slate-900 focus:border-accent focus:bg-white"
                  />
                </label>
              </div>
              {filtersActive && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="text-xs sm:text-sm text-accent hover:text-accent-hover font-medium transition-colors shrink-0"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Sort options */}
            <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-slate-500 font-medium shrink-0">
                Sort by
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy("newest")}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                    sortBy === "newest"
                      ? "bg-accent text-white shadow-sm"
                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-accent"
                  }`}
                >
                  Newest
                </button>
                <button
                  onClick={() => setSortBy("oldest")}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                    sortBy === "oldest"
                      ? "bg-accent text-white shadow-sm"
                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-accent"
                  }`}
                >
                  Oldest
                </button>
                <button
                  onClick={() => setSortBy("students")}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                    sortBy === "students"
                      ? "bg-accent text-white shadow-sm"
                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-accent"
                  }`}
                >
                  Most students
                </button>
              </div>
            </div>
          </div>

          {/* Inactive toggle */}
          {inactiveLists.length > 0 && (
            <label className="flex items-center gap-2.5 cursor-pointer w-fit select-none">
              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  showInactive ? "bg-accent" : "bg-fill"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    showInactive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-slate-600">Show inactive lists</span>
            </label>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-400 text-base animate-pulse">Loading lists...</div>
            </div>
          )}

          {/* Empty state */}
          {!loading && sortedDisplayedLists.length === 0 && (
            <div className="card-solid p-8 text-center">
              <div className="text-5xl mb-4">📋</div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                {filtersActive
                  ? "No lists match your filters"
                  : showInactive
                  ? "No inactive lists"
                  : "No active lists yet"}
              </h2>
              <p className="text-sm text-slate-500 mb-5">
                {filtersActive
                  ? "Try adjusting the search or date range."
                  : showInactive
                  ? "All lists are currently active."
                  : "Create your first list to get started."}
              </p>
              {!showInactive && !filtersActive && (
                <button
                  onClick={() => router.push("/lists/create")}
                  className="btn-primary px-5 py-2.5 transition-all"
                >
                  Create a List
                </button>
              )}
            </div>
          )}

          {/* List cards */}
          {!loading && sortedDisplayedLists.length > 0 && (
            <div className="flex flex-col gap-3">
              {sortedDisplayedLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => router.push(`/lists/${list.id}`)}
                  className="text-left card-solid p-4 sm:p-5 hover:shadow-md hover:border-hairline transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${
                        list.active ? "bg-emerald-400" : "bg-gray-300"
                      }`} />
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                          {list.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500">
                          {list.students.length} student{list.students.length !== 1 ? "s" : ""}
                          {!list.active && (
                            <span className="ml-2 text-slate-400">(inactive)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
