"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
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
  const { authenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authenticated) {
      router.push("/authenticate");
    }
  }, [authenticated, router]);

  const [lists, setLists] = useState<ListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

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

  const displayedLists = showInactive
    ? lists
    : lists.filter((l) => l.active);

  const activeLists = lists.filter((l) => l.active);
  const inactiveLists = lists.filter((l) => !l.active);

  if (!authenticated) return null;

  return (
    <>
      <Header />
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
        <div className="max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Lists</h1>
              <p className="text-sm text-gray-500 mt-1">
                {activeLists.length} active, {inactiveLists.length} inactive
              </p>
            </div>
            <button
              onClick={() => router.push("/lists/create")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New List
            </button>
          </div>

          {/* Inactive toggle */}
          {inactiveLists.length > 0 && (
            <label className="flex items-center gap-2.5 cursor-pointer w-fit select-none">
              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  showInactive ? "bg-indigo-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    showInactive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-600">Show inactive lists</span>
            </label>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400 text-base animate-pulse">Loading lists...</div>
            </div>
          )}

          {/* Empty state */}
          {!loading && displayedLists.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="text-5xl mb-4">📋</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {showInactive ? "No inactive lists" : "No active lists yet"}
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                {showInactive
                  ? "All lists are currently active."
                  : "Create your first list to get started."}
              </p>
              {!showInactive && (
                <button
                  onClick={() => router.push("/lists/create")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition-all"
                >
                  Create a List
                </button>
              )}
            </div>
          )}

          {/* List cards */}
          {!loading && displayedLists.length > 0 && (
            <div className="flex flex-col gap-3">
              {displayedLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => router.push(`/lists/${list.id}`)}
                  className="text-left bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${
                        list.active ? "bg-emerald-400" : "bg-gray-300"
                      }`} />
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                          {list.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {list.students.length} student{list.students.length !== 1 ? "s" : ""}
                          {!list.active && (
                            <span className="ml-2 text-gray-400">(inactive)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
