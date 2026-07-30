"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import Header from "@/components/Header";

interface SearchedStudent {
  "Admission No": number;
  "Name with Initials": string;
  Class: string;
}

export default function CreateListPage() {
  const { authenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authenticated) {
      router.push("/authenticate");
    }
  }, [authenticated, router]);

  const [listTitle, setListTitle] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchedStudent | null>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [addedStudents, setAddedStudents] = useState<SearchedStudent[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearched(true);

    const { data } = await supabase
      .from("students")
      .select()
      .eq("Admission No", Number(searchQuery));

    if (data && data.length > 0) {
      const s = data[0] as unknown as SearchedStudent;
      setSearchResult(s);
    } else {
      setSearchResult(null);
    }
    setSearching(false);
  };

  const handleAddToList = () => {
    if (!searchResult) return;
    if (addedStudents.some((s) => s["Admission No"] === searchResult["Admission No"])) return;
    setAddedStudents((prev) => [...prev, searchResult]);
  };

  const handleRemoveAdded = (admissionNo: number) => {
    setAddedStudents((prev) => prev.filter((s) => s["Admission No"] !== admissionNo));
    // Also re-enable the search result if it's the same student
    if (searchResult && searchResult["Admission No"] === admissionNo) {
      setSearchResult(null);
      setSearched(false);
    }
  };

  const isAlreadyAdded = (admissionNo: number) =>
    addedStudents.some((s) => s["Admission No"] === admissionNo);

  const handleSubmit = async () => {
    if (!listTitle.trim() || addedStudents.length === 0 || !createdBy.trim()) return;
    setSubmitting(true);

    const { data } = await supabase
      .from("lists")
      .insert({
        title: listTitle.trim(),
        students: addedStudents.map((s) => s["Admission No"]),
        active: true,
        createdBy: createdBy.trim(),
      })
      .select();

    if (data && data.length > 0) {
      router.push(`/lists/${data[0].id}`);
    } else {
      setSubmitting(false);
      alert("Failed to create list. Please try again.");
    }
  };

  if (!authenticated) return null;

  return (
    <>
      <Header />
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
        <div className="max-w-2xl mx-auto flex flex-col gap-4 sm:gap-6">
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

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">
              Create New List
            </h1>

            {/* List title */}
            <div className="mb-5">
              <label htmlFor="list-title" className="block text-sm font-medium text-gray-700 mb-1.5">
                List Title
              </label>
              <input
                id="list-title"
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="e.g. Duty Roster, Detention Group A..."
                maxLength={200}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
              />
            </div>

            {/* Added students count */}
            <div className="mb-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Students</span>
                <span className="text-xs sm:text-sm text-gray-500">
                  {addedStudents.length} added
                </span>
              </div>
              {addedStudents.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {addedStudents.map((s) => (
                    <span
                      key={s["Admission No"]}
                      className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs sm:text-sm px-2.5 py-1 rounded-full"
                    >
                      {s["Name with Initials"]}
                      <button
                        onClick={() => handleRemoveAdded(s["Admission No"])}
                        className="text-indigo-400 hover:text-indigo-600 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Search bar */}
            <div className="border-t border-gray-100 pt-5 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Add students by Admission No</p>
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
            </div>

            {/* Search result */}
            {searched && !searching && (
              <div className="mb-4">
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
                      onClick={handleAddToList}
                      disabled={isAlreadyAdded(searchResult["Admission No"])}
                      className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                        isAlreadyAdded(searchResult["Admission No"])
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-emerald-500 hover:bg-emerald-600 text-white"
                      }`}
                    >
                      {isAlreadyAdded(searchResult["Admission No"]) ? "Added ✓" : "Add to list"}
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

            {/* Created by */}
            <div className="border-t border-gray-100 pt-5 mb-5">
              <label htmlFor="created-by" className="block text-sm font-medium text-gray-700 mb-1.5">
                Your Name
              </label>
              <input
                id="created-by"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!listTitle.trim() || addedStudents.length === 0 || !createdBy.trim() || submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-5 py-3 rounded-lg shadow-sm transition-all text-sm sm:text-base"
            >
              {submitting ? "Creating..." : `Create List (${addedStudents.length} students)`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
