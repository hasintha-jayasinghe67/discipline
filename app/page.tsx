"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth, isAdminOrAbove } from "@/lib/AuthContext";
import Header from "@/components/Header";
import DashboardDailyStats from "@/components/DashboardDailyStats";
import Student from "@/components/Student";
import Modal from "@/components/Modal";
import { normalizeName, searchStudents, type StudentInfo } from "@/lib/nameSearch";
import { getThreshold, hasRule } from "@/lib/strikeRules";
import { categoryLabels } from "@/lib/labels";
import { fetchAllStudents } from "@/lib/students";
import {
  addPendingBlackmark,
  removePendingBlackmark,
  pendingBlackmarkKeys,
  setPendingBlackmarksAll,
} from "@/lib/pendingBlackmarks";

// How many name-search results are revealed at once; "Load more" adds more.
const NAME_RESULTS_PAGE = 20;

type Tab = "admission" | "name";

interface StudentCounts {
  strikes: number;
  blackmarks: number;
  goldmarks: number;
}

interface ModalTarget {
  admissionNo: number;
  name: string;
}

export default function Home() {
  const { authenticated, user } = useAuth();
  const router = useRouter();

  // Which search tab is active
  const [activeTab, setActiveTab] = useState<Tab>("admission");

  // Admission No tab state (unchanged behavior)
  const [name, setName] = useState("");

  useEffect(() => {
    if (!authenticated) {
      router.push("/authenticate");
    }
  }, [authenticated, router]);

  const [studentName, setStudentName] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [Class, setClass] = useState("");
  const [house, setHouse] = useState("");
  const [strikes, setStrikes] = useState(0);
  const [blackmarks, setBlackmarks] = useState(0);
  const [goldmarks, setGoldmarks] = useState(0);

  // Name tab state
  const [nameQuery, setNameQuery] = useState("");
  const [nameResults, setNameResults] = useState<StudentInfo[]>([]);
  const [visibleCount, setVisibleCount] = useState(NAME_RESULTS_PAGE);
  const [nameSearched, setNameSearched] = useState(false);
  const [nameTooShort, setNameTooShort] = useState(false);
  const [searching, setSearching] = useState(false);

  // Cached data (lazily fetched on first name search)
  const [countsMap, setCountsMap] = useState<Record<number, StudentCounts>>({});
  const studentsCache = useRef<StudentInfo[] | null>(null);
  const countsCache = useRef<Record<number, StudentCounts> | null>(null);
  const searchingRef = useRef(false);

  // Strike → blackmark threshold feature
  const [pendingBlackmarks, setPendingBlackmarks] = useState<Set<string>>(
    () => new Set(pendingBlackmarkKeys())
  );
  const [blackmarkPrompt, setBlackmarkPrompt] = useState<{
    admissionNo: number;
    name: string;
    category: string;
    count: number;
    threshold: number;
  } | null>(null);
  const [promptIssuedBy, setPromptIssuedBy] = useState("");
  const [promptBusy, setPromptBusy] = useState(false);

  // Which student an open modal targets (null = the Admission No tab student)
  const [modalStudent, setModalStudent] = useState<ModalTarget | null>(null);

  // Modals
  const [strikeModalOpen, setStrikeModalOpen] = useState(false);
  const [blackMarkModalOpen, setBlackmarkModalOpen] = useState(false);
  const [goldMarkModalOpen, setGoldMarkModalOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);

  // strike insert fields
  const [strikeType, setStrikeType] = useState("grooming");

  // blackmark & goldmark state
  const [issuer, setIssuer] = useState("");
  const [blackmarkReason, setBlackmarkReason] = useState("grooming");
  const [goldMarkReason, setGoldMarkReason] = useState("good-behavior");

  // Comment state
  const [commentor, setCommentor] = useState("");
  const [commentText, setCommentText] = useState("");

  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const bumpStatsRefresh = () => setStatsRefreshKey((k) => k + 1);

  const fetchStudentData = async () => {
    if (!name.trim()) return;

    const students = await supabase
      .from("students")
      .select()
      .eq("Admission No", Number(name));

    if ((students.data?.length as number) < 1) {
      setNotFound(true);
      setStudentName("");
      setClass("");
      setHouse("");
      setStrikes(0);
      setBlackmarks(0);
      setGoldmarks(0);
    } else {
      setNotFound(false);
      students.data?.map((s) => {
        setClass(s.Class);
        setStudentName(s["Name with Initials"]);
        setHouse(s["School House"]);
      });

      const strks = await supabase
        .from("strikes")
        .select()
        .eq("Admission No", Number(name));
      setStrikes(strks.data?.length as number);

      const bms = await supabase
        .from("blackmarks")
        .select()
        .eq("Admission No", Number(name));
      setBlackmarks(bms.data?.length as number);

      const gms = await supabase
        .from("goldmarks")
        .select()
        .eq("Admission No", Number(name));
      setGoldmarks(gms.data?.length as number);
    }
  };

  // Build a { admissionNo: { strikes, blackmarks, goldmarks } } map and a per-category
  // strike count map from the record tables
  const fetchCountsMap = async (): Promise<{
    counts: Record<number, StudentCounts>;
    cats: Record<number, Record<string, number>>;
  }> => {
    const [s, b, g] = await Promise.all([
      supabase.from("strikes").select("*"),
      supabase.from("blackmarks").select("*"),
      supabase.from("goldmarks").select("*"),
    ]);
    const map: Record<number, StudentCounts> = {};
    const cats: Record<number, Record<string, number>> = {};
    const inc = (admissionNo: number, key: keyof StudentCounts) => {
      if (!map[admissionNo]) {
        map[admissionNo] = { strikes: 0, blackmarks: 0, goldmarks: 0 };
      }
      map[admissionNo][key]++;
    };
    s.data?.forEach((r) => {
      inc(r["Admission No"], "strikes");
      const cat = r.Category as string;
      if (!cats[r["Admission No"]]) cats[r["Admission No"]] = {};
      cats[r["Admission No"]][cat] = (cats[r["Admission No"]][cat] || 0) + 1;
    });
    b.data?.forEach((r) => inc(r["Admission No"], "blackmarks"));
    g.data?.forEach((r) => inc(r["Admission No"], "goldmarks"));
    return { counts: map, cats };
  };

  // Drop pending flags whose category count is now below threshold
  const prunePending = (cats: Record<number, Record<string, number>>) => {
    setPendingBlackmarks((prev) => {
      const next = new Set(prev);
      let changed = false;
      next.forEach((key) => {
        const [adm, cat] = key.split("|");
        const count = cats[Number(adm)]?.[cat] || 0;
        const t = getThreshold(cat);
        if (t === null || count < t) {
          next.delete(key);
          changed = true;
        }
      });
      if (changed) setPendingBlackmarksAll([...next]);
      return next;
    });
  };

  // Refresh the cached counts map after a record is added (only if it was loaded)
  const refreshRecordCounts = async () => {
    bumpStatsRefresh();
    if (!countsCache.current) return;
    const { counts, cats } = await fetchCountsMap();
    countsCache.current = counts;
    setCountsMap(counts);
    prunePending(cats);
  };

  const handleNameSearch = async () => {
    if (searchingRef.current) return;
    const q = normalizeName(nameQuery);
    setNameSearched(true);
    if (q.length < 2) {
      setNameTooShort(true);
      setNameResults([]);
      setVisibleCount(NAME_RESULTS_PAGE);
      return;
    }
    setNameTooShort(false);
    setSearching(true);
    searchingRef.current = true;

    let students = studentsCache.current;
    if (!students) {
      students = await fetchAllStudents();
      studentsCache.current = students;
    }

    let counts = countsCache.current;
    if (!counts) {
      const { counts: c, cats } = await fetchCountsMap();
      counts = c;
      countsCache.current = counts;
      setCountsMap(counts);
      prunePending(cats);
    }

    const matches = searchStudents(students, q);
    setNameResults(matches);
    setVisibleCount(NAME_RESULTS_PAGE);
    setSearching(false);
    searchingRef.current = false;
  };

  // Modal openers: pass a result card to target it, or null for the Admission No tab student
  const openStrikeModal = (target: StudentInfo | null) => {
    setModalStudent(
      target
        ? { admissionNo: target["Admission No"], name: target["Name with Initials"] }
        : null
    );
    setStrikeModalOpen(true);
  };
  const openBlackmarkModal = (target: StudentInfo | null) => {
    setModalStudent(
      target
        ? { admissionNo: target["Admission No"], name: target["Name with Initials"] }
        : null
    );
    setBlackmarkModalOpen(true);
  };
  const openGoldMarkModal = (target: StudentInfo | null) => {
    setModalStudent(
      target
        ? { admissionNo: target["Admission No"], name: target["Name with Initials"] }
        : null
    );
    setGoldMarkModalOpen(true);
  };
  const openCommentModal = (target: StudentInfo | null) => {
    setModalStudent(
      target
        ? { admissionNo: target["Admission No"], name: target["Name with Initials"] }
        : null
    );
    setCommentor(issuer);
    setCommentText("");
    setCommentModalOpen(true);
  };

  // The admission number the open modal should write to
  const modalAdmissionNo = modalStudent ? modalStudent.admissionNo : Number(name);
  const modalName = modalStudent?.name || studentName || name;

  const hasPendingBlackmark = (admissionNo: number) => {
    const prefix = `${admissionNo}|`;
    for (const key of pendingBlackmarks) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  };

  const dismissBlackmarkPrompt = () => {
    if (!blackmarkPrompt || promptBusy) return;
    const key = `${blackmarkPrompt.admissionNo}|${blackmarkPrompt.category}`;
    addPendingBlackmark(key);
    setPendingBlackmarks((prev) => new Set(prev).add(key));
    setBlackmarkPrompt(null);
    setPromptIssuedBy("");
  };

  const confirmBlackmarkPrompt = async () => {
    if (!blackmarkPrompt || !promptIssuedBy.trim() || promptBusy) return;
    setPromptBusy(true);
    try {
      const { error: bmErr } = await supabase.from("blackmarks").insert({
        "Admission No": blackmarkPrompt.admissionNo,
        Reason: blackmarkPrompt.category,
        issuedBy: promptIssuedBy.trim(),
      });
      if (bmErr) {
        alert("Failed to create blackmark: " + bmErr.message);
        return;
      }
      const { error: delErr } = await supabase
        .from("strikes")
        .delete()
        .eq("Admission No", blackmarkPrompt.admissionNo)
        .eq("Category", blackmarkPrompt.category);
      if (delErr) {
        console.error("Strike reset error:", delErr);
      }
      const key = `${blackmarkPrompt.admissionNo}|${blackmarkPrompt.category}`;
      removePendingBlackmark(key);
      setPendingBlackmarks((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setBlackmarkPrompt(null);
      setPromptIssuedBy("");
      await refreshRecordCounts();
    } catch (err) {
      alert(
        "Failed to create blackmark: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setPromptBusy(false);
    }
  };

  const showTooShortHint = nameQuery.trim().length > 0 && normalizeName(nameQuery).length < 2;

  if (!authenticated) return null;

  const countLabel =
    visibleCount < nameResults.length
      ? `Showing ${visibleCount} of ${nameResults.length} students`
      : `${nameResults.length} student${nameResults.length === 1 ? "" : "s"} found`;

  return (
    <>
      <Header />
      <div className="page-shell">
        <div className="max-w-6xl mx-auto flex flex-col gap-6 sm:gap-8">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 sm:mb-4">
              Find a student
            </h2>
            <div className="max-w-2xl mx-auto flex flex-col gap-3">
          <div className="card-solid p-3">
            {/* Search mode tabs */}
            <div className="flex gap-1.5 mb-3 pb-3 border-b border-slate-100">
              <button
                onClick={() => setActiveTab("admission")}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer ${
                  activeTab === "admission"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-teal-300"
                }`}
              >
                Admission No
              </button>
              <button
                onClick={() => setActiveTab("name")}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer ${
                  activeTab === "name"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-teal-300"
                }`}
              >
                Name
              </button>
            </div>

            {activeTab === "admission" ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
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
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNotFound(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        fetchStudentData();
                      }
                    }}
                    placeholder="Enter Admission No"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200/70 rounded-xl text-slate-900 placeholder-slate-400 focus:border-teal-400 focus:bg-white"
                  />
                </div>
                <button
                  className="btn-primary px-5 py-2.5"
                  onClick={fetchStudentData}
                >
                  Search
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
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
                    value={nameQuery}
                    onChange={(e) => {
                      setNameQuery(e.target.value);
                      setNameSearched(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleNameSearch();
                      }
                    }}
                    placeholder="Enter student name (min 2 letters)"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200/70 rounded-xl text-slate-900 placeholder-slate-400 focus:border-teal-400 focus:bg-white"
                  />
                </div>
                <button
                  disabled={searching || normalizeName(nameQuery).length < 2}
                  className="btn-primary px-5 py-2.5 disabled:opacity-55"
                  onClick={handleNameSearch}
                >
                  {searching ? "..." : "Search"}
                </button>
              </div>
            )}
          </div>

          {activeTab === "admission" ? (
            notFound ? (
              <div className="card-solid p-6 sm:p-8 text-center">
                <div className="text-4xl sm:text-5xl mb-3">🔍</div>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-1">
                  Student Not Found
                </h2>
                <p className="text-sm text-slate-500">
                  No student found with Admission No:{" "}
                  <span className="font-semibold text-slate-700">{name}</span>
                </p>
                <p className="text-xs text-slate-400 italic mt-3">
                  {"He lied to you, you're not scary, you're a lolla"}
                </p>
              </div>
            ) : studentName ? (
              <Student
                admission={name}
                name={studentName}
                Class={Class}
                house={house}
                strikes={strikes}
                goldmarks={goldmarks}
                onStrikeClick={() => openStrikeModal(null)}
                onBlackmarkClick={() => openBlackmarkModal(null)}
                onGoldMarkClick={() => openGoldMarkModal(null)}
                onCommentClick={() => openCommentModal(null)}
                blackmarks={blackmarks}
                showActions={isAdminOrAbove(user)}
                pendingBlackmark={hasPendingBlackmark(Number(name))}
              />
            ) : (
              <></>
            )
          ) : (
            <>
              {showTooShortHint && !nameSearched && (
                <div className="card-solid p-6 text-center">
                  <p className="text-sm text-slate-500">
                    Type at least 2 letters to search.
                  </p>
                </div>
              )}
              {nameSearched && searching && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-slate-400 text-base animate-pulse">
                    Searching students...
                  </div>
                </div>
              )}
              {nameSearched && !searching && nameTooShort && (
                <div className="card-solid p-6 text-center">
                  <p className="text-sm text-slate-500">
                    Type at least 2 letters to search.
                  </p>
                </div>
              )}
              {nameSearched && !searching && !nameTooShort && nameResults.length === 0 && (
                <div className="card-solid p-6 sm:p-8 text-center">
                  <div className="text-4xl sm:text-5xl mb-3">🔍</div>
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-1">
                    Student Not Found
                  </h2>
                  <p className="text-sm text-slate-500">
                    No student found with name:{" "}
                    <span className="font-semibold text-slate-700">{nameQuery}</span>
                  </p>
                  <p className="text-xs text-slate-400 italic mt-3">
                    {"He lied to you, you're not scary, you're a lolla"}
                  </p>
                </div>
              )}
              {nameSearched && !searching && !nameTooShort && nameResults.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="text-xs text-slate-500 font-medium px-1">
                    {countLabel}
                  </div>
                  {nameResults.slice(0, visibleCount).map((result) => {
                    const counts = countsMap[result["Admission No"]] || {
                      strikes: 0,
                      blackmarks: 0,
                      goldmarks: 0,
                    };
                    return (
                      <Student
                        key={result["Admission No"]}
                        admission={String(result["Admission No"])}
                        name={result["Name with Initials"]}
                        Class={result.Class}
                        house={result["School House"]}
                        strikes={counts.strikes}
                        blackmarks={counts.blackmarks}
                        goldmarks={counts.goldmarks}
                        onStrikeClick={() => openStrikeModal(result)}
                        onBlackmarkClick={() => openBlackmarkModal(result)}
                        onGoldMarkClick={() => openGoldMarkModal(result)}
                        onCommentClick={() => openCommentModal(result)}
                        showActions={isAdminOrAbove(user)}
                        pendingBlackmark={hasPendingBlackmark(result["Admission No"])}
                      />
                    );
                  })}
                  {visibleCount < nameResults.length && (
                    <button
                      onClick={() =>
                        setVisibleCount((c) =>
                          Math.min(c + NAME_RESULTS_PAGE, nameResults.length)
                        )
                      }
                      className="w-full card-solid px-5 py-3 text-sm font-medium text-teal-600 hover:border-teal-300 hover:bg-teal-50 transition-all cursor-pointer"
                    >
                      Load more students ({nameResults.length - visibleCount}{" "}
                      remaining)
                    </button>
                  )}
                </div>
              )}
            </>
          )}
            </div>
          </div>

          <DashboardDailyStats
            refreshKey={statsRefreshKey}
            showReportButton={isAdminOrAbove(user)}
          />
        </div>
        {/* Punishments section commented out for now */}
        {/* <div className="card-solid p-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-slate-900">
              Punishments ongoing
            </h1>
            <button className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add
            </button>
          </div>
        </div> */}
      </div>
      <Modal
        isOpen={blackMarkModalOpen}
        onClose={() => {
          setBlackmarkModalOpen(false);
        }}
        title={`Add black mark to student ${modalName}`}
      >
        <div className="text-sm text-slate-500 mb-3">
          Adding black mark to student{" "}
          <span className="font-semibold text-slate-700">{modalName}</span>
        </div>
        <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-4">
          <span className="text-sm text-rose-700 font-medium">
            Current Strikes
          </span>
          <span className="text-lg font-bold text-rose-600">
            {modalStudent
              ? countsMap[modalStudent.admissionNo]?.strikes ?? 0
              : strikes}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="blackmark-reason"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Reason
            </label>
            <select
              name="cateogory"
              id="blackmark-reason"
              value={blackmarkReason}
              onChange={(e) => setBlackmarkReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 focus:border-teal-400 focus:bg-white"
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
              htmlFor="issuer"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Issued By
            </label>
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              type="text"
              id="issuer"
              placeholder="Enter your name"
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-teal-400 focus:bg-white"
            />
          </div>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-slate-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm"
            onClick={async () => {
              const { error } = await supabase.from("blackmarks").insert({
                "Admission No": modalAdmissionNo,
                Reason: blackmarkReason,
                issuedBy: issuer,
              });
              if (error) {
                console.error("Blackmark insert error:", error);
                alert("Failed to add blackmark: " + error.message);
                return;
              }
              // A blackmark in a rule category consumes that category's strikes (full reset)
              if (hasRule(blackmarkReason)) {
                await supabase
                  .from("strikes")
                  .delete()
                  .eq("Admission No", modalAdmissionNo)
                  .eq("Category", blackmarkReason);
                const key = `${modalAdmissionNo}|${blackmarkReason}`;
                removePendingBlackmark(key);
                setPendingBlackmarks((prev) => {
                  const next = new Set(prev);
                  next.delete(key);
                  return next;
                });
              }

              setBlackmarkModalOpen(false);
              await refreshRecordCounts();
              fetchStudentData();
            }}
          >
            Save
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-slate-700 font-medium px-4 py-2.5 rounded-lg"
            onClick={() => setBlackmarkModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={strikeModalOpen}
        onClose={() => {
          setStrikeModalOpen(false);
        }}
        title={`Add strike to student ${modalName}`}
      >
        <div className="text-sm text-slate-500 mb-4">
          Adding strike to student{" "}
          <span className="font-semibold text-slate-700">{modalName}</span>
        </div>
        <div>
          <label
            htmlFor="strike-category"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Category
          </label>
          <select
            name="cateogory"
            id="strike-category"
            value={strikeType}
            onChange={(e) => setStrikeType(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 focus:border-teal-400 focus:bg-white"
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
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-slate-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm"
            onClick={async () => {
              const { error } = await supabase.from("strikes").insert({
                "Admission No": modalAdmissionNo,
                Category: strikeType,
              });
              if (error) {
                console.error("Strike insert error:", error);
                alert("Failed to add strike: " + error.message);
                return;
              }

              setStrikeModalOpen(false);
              await refreshRecordCounts();
              fetchStudentData();

              // Auto-blackmark threshold check
              const threshold = getThreshold(strikeType);
              if (threshold !== null) {
                const { data: latest } = await supabase
                  .from("strikes")
                  .select("Category")
                  .eq("Admission No", modalAdmissionNo)
                  .eq("Category", strikeType);
                const count = latest?.length || 0;
                if (count >= threshold) {
                  setPromptIssuedBy("");
                  setBlackmarkPrompt({
                    admissionNo: modalAdmissionNo,
                    name: modalName,
                    category: strikeType,
                    count,
                    threshold,
                  });
                }
              }
            }}
          >
            Save
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-slate-700 font-medium px-4 py-2.5 rounded-lg"
            onClick={() => setStrikeModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>

      {/* Auto-blackmark threshold prompt */}
      <Modal
        isOpen={blackmarkPrompt !== null}
        onClose={dismissBlackmarkPrompt}
        title="Blackmark Threshold Reached"
      >
        <div className="flex flex-col gap-4">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
            <span className="font-semibold text-rose-900">
              {blackmarkPrompt?.name}
            </span>{" "}
            has reached the blackmark threshold for{" "}
            <span className="font-semibold text-rose-900">
              {categoryLabels[blackmarkPrompt?.category || ""] ||
                blackmarkPrompt?.category}
            </span>{" "}
            ({blackmarkPrompt?.count}/{blackmarkPrompt?.threshold}). Creating the
            black mark will reset their strikes in this category.
          </div>
          <div>
            <label
              htmlFor="prompt-issued-by"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Issued By
            </label>
            <input
              id="prompt-issued-by"
              type="text"
              value={promptIssuedBy}
              onChange={(e) => setPromptIssuedBy(e.target.value)}
              placeholder="Enter your name"
              autoFocus
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-teal-400 focus:bg-white"
            />
          </div>
          <div className="flex w-full gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={confirmBlackmarkPrompt}
              disabled={promptBusy || !promptIssuedBy.trim()}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            >
              {promptBusy ? "Saving..." : "Create Black Mark"}
            </button>
            <button
              onClick={dismissBlackmarkPrompt}
              disabled={promptBusy}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-slate-700 font-medium px-4 py-2.5 rounded-lg transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      </Modal>

      {/* Gold Mark Modal */}
      <Modal
        isOpen={goldMarkModalOpen}
        onClose={() => setGoldMarkModalOpen(false)}
        title={`Add gold mark to student ${modalName}`}
      >
        <div className="text-sm text-slate-500 mb-3">
          Adding gold mark to student{" "}
          <span className="font-semibold text-slate-700">{modalName}</span>
        </div>
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
          <span className="text-sm text-emerald-700 font-medium">
            Current Gold Marks
          </span>
          <span className="text-lg font-bold text-emerald-600">
            {modalStudent
              ? countsMap[modalStudent.admissionNo]?.goldmarks ?? 0
              : goldmarks}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="goldmark-reason"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Reason
            </label>
            <select
              id="goldmark-reason"
              value={goldMarkReason}
              onChange={(e) => setGoldMarkReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 focus:border-teal-400 focus:bg-white"
            >
              <option value="good-behavior">Good Behavior</option>
              <option value="giving-back">Giving Back to College</option>
              <option value="excellent-academics">Excellent Academics</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="goldmark-issuer"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Issued By
            </label>
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              type="text"
              id="goldmark-issuer"
              placeholder="Enter your name"
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-teal-400 focus:bg-white"
            />
          </div>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-slate-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm"
            onClick={async () => {
              const { error } = await supabase.from("goldmarks").insert({
                "Admission No": modalAdmissionNo,
                Reason: goldMarkReason,
                issuedBy: issuer,
              });
              if (error) {
                console.error("Gold mark insert error:", error);
                alert("Failed to add gold mark: " + error.message);
                return;
              }
              setGoldMarkModalOpen(false);
              await refreshRecordCounts();
              fetchStudentData();
            }}
          >
            Save
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-slate-700 font-medium px-4 py-2.5 rounded-lg"
            onClick={() => setGoldMarkModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>

      {/* Comment Modal */}
      <Modal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        title={`Add comment for student ${modalName}`}
      >
        <div className="text-sm text-slate-500 mb-3">
          Adding comment for student{" "}
          <span className="font-semibold text-slate-700">{modalName}</span>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="commentor"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Commentor
            </label>
            <input
              value={commentor}
              onChange={(e) => setCommentor(e.target.value)}
              type="text"
              id="commentor"
              placeholder="Your name"
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-teal-400 focus:bg-white"
            />
          </div>
          <div>
            <label
              htmlFor="comment-text"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Comment
            </label>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              id="comment-text"
              placeholder="Write your comment..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-teal-400 focus:bg-white resize-none"
            />
          </div>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-slate-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm"
            onClick={async () => {
              await supabase.from("comments").insert({
                "Admission No": modalAdmissionNo,
                commentor: commentor,
                commentText: commentText,
              });
              setCommentModalOpen(false);
              setCommentText("");
              fetchStudentData();
            }}
          >
            Save
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-slate-700 font-medium px-4 py-2.5 rounded-lg"
            onClick={() => setCommentModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>
    </>
  );
}
