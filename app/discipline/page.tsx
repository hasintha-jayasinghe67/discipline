"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth, isAdminOrAbove, isSuperuser } from "@/lib/AuthContext";
import Header from "@/components/Header";
import Modal from "@/components/Modal";
import GenerateReportModal from "@/components/GenerateReportModal";
import ConfirmPasswordModal from "@/components/ConfirmPasswordModal";
import DeleteButton from "@/components/DeleteButton";
import { categoryLabels } from "@/lib/labels";
import { fetchAllRows, fetchStudentsFor } from "@/lib/students";

const punishmentLabels: Record<string, string> = {
  detention: "Detention",
  "weekend-duty": "Weekend Duty",
  cleanup: "Cleanup",
  other: "Other",
};

type RecordType =
  | "all"
  | "strikes"
  | "blackmarks"
  | "goldmarks"
  | "punishments"
  | "comments";

interface StudentInfo {
  "Admission No": number;
  "Name with Initials": string;
  Class: string;
  "School House": string;
}

interface StrikeRecord {
  id: number;
  "Admission No": number;
  Category: string;
  created_at: string;
}

interface BlackmarkRecord {
  id: number;
  "Admission No": number;
  Reason: string;
  issuedBy: string;
  created_at: string;
}

interface GoldmarkRecord {
  id: number;
  "Admission No": number;
  Reason: string;
  issuedBy: string;
  created_at: string;
}

interface PunishmentRecord {
  id: number;
  "Admission No": number;
  Type: string;
  Reason?: string;
  assignedBy?: string;
  Status?: string;
  created_at: string;
}

interface CommentRecord {
  id: number;
  "Admission No": number;
  commentor: string;
  commentText: string;
  created_at: string;
}

interface UnifiedRecord {
  key: string;
  type: Exclude<RecordType, "all">;
  table: "strikes" | "blackmarks" | "goldmarks" | "punishments" | "comments";
  admissionNo: number;
  student?: StudentInfo;
  label: string;
  detail: string;
  issuer: string;
  createdAt: string;
  filterValue: string;
  status?: string;
  recordId?: number;
}

// How many records are revealed at once; "Load more" adds more.
const PAGE_SIZE = 20;

const tabLabels: Record<RecordType, string> = {
  all: "All Records",
  strikes: "Strikes",
  blackmarks: "Blackmarks",
  goldmarks: "Gold Marks",
  punishments: "Punishments",
  comments: "Comments",
};

const typeStyles: Record<
  Exclude<RecordType, "all">,
  { badge: string; chip: string; circle: string; issuer: string; label: string }
> = {
  strikes: {
    badge: "bg-amber-100 text-amber-800",
    chip: "bg-amber-100 text-amber-800",
    circle: "bg-amber-200 text-amber-700",
    issuer: "text-amber-600",
    label: "Strike",
  },
  blackmarks: {
    badge: "bg-rose-100 text-rose-800",
    chip: "bg-rose-100 text-rose-800",
    circle: "bg-rose-200 text-rose-700",
    issuer: "text-rose-600",
    label: "Blackmark",
  },
  goldmarks: {
    badge: "bg-emerald-100 text-emerald-800",
    chip: "bg-emerald-100 text-emerald-800",
    circle: "bg-emerald-200 text-emerald-700",
    issuer: "text-emerald-600",
    label: "Gold Mark",
  },
  punishments: {
    badge: "bg-blue-100 text-blue-800",
    chip: "bg-blue-100 text-blue-800",
    circle: "bg-blue-200 text-blue-700",
    issuer: "text-blue-600",
    label: "Punishment",
  },
  comments: {
    badge: "bg-violet-100 text-violet-800",
    chip: "bg-violet-100 text-violet-800",
    circle: "bg-violet-200 text-violet-700",
    issuer: "text-violet-600",
    label: "Comment",
  },
};

export default function DisciplinePage() {
  const { authenticated, user } = useAuth();
  const router = useRouter();

  const [strikes, setStrikes] = useState<StrikeRecord[]>([]);
  const [blackmarks, setBlackmarks] = useState<BlackmarkRecord[]>([]);
  const [goldmarks, setGoldmarks] = useState<GoldmarkRecord[]>([]);
  const [punishments, setPunishments] = useState<PunishmentRecord[]>([]);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [studentMap, setStudentMap] = useState<Record<number, StudentInfo>>({});
  const [loading, setLoading] = useState(true);

  // Active tab + global filters
  const [activeTab, setActiveTab] = useState<RecordType>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [issuerFilter, setIssuerFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");

  // Per-tab category / type filters
  const [strikeCategoryFilter, setStrikeCategoryFilter] = useState("all");
  const [blackmarkCategoryFilter, setBlackmarkCategoryFilter] = useState("all");
  const [punishmentTypeFilter, setPunishmentTypeFilter] = useState("all");

  // Sorting per tab
  const [strikeSort, setStrikeSort] = useState<"newest" | "oldest" | "category">("newest");
  const [blackmarkSort, setBlackmarkSort] = useState<"newest" | "oldest" | "category">("newest");
  const [punishmentSort, setPunishmentSort] = useState<"newest" | "oldest" | "type">("newest");
  const [simpleSort, setSimpleSort] = useState<"newest" | "oldest">("newest");

  // Display pagination: 20 records at a time, newest first by default
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Clear strikes modal
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState("");
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [clearError, setClearError] = useState("");
  const [clearing, setClearing] = useState(false);

  // Delete single record (superuser-only, password-confirmed)
  const [deleteTarget, setDeleteTarget] = useState<{
    table: "strikes" | "blackmarks" | "goldmarks" | "punishments" | "comments";
    id: number;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!authenticated) {
      router.push("/authenticate");
    }
  }, [authenticated, router]);

  const fetchData = async () => {
    setLoading(true);

    const [strikesRows, blackmarksRows, goldmarksRows, punishmentsRows, commentsRows] =
      await Promise.all([
        fetchAllRows<StrikeRecord>("strikes", "created_at"),
        fetchAllRows<BlackmarkRecord>("blackmarks", "created_at"),
        fetchAllRows<GoldmarkRecord>("goldmarks", "created_at"),
        fetchAllRows<PunishmentRecord>("punishments", "created_at"),
        fetchAllRows<CommentRecord>("comments", "created_at"),
      ]);

    // Load ONLY the students referenced by these records, not the whole table
    const referencedStudents = await fetchStudentsFor([
      ...strikesRows,
      ...blackmarksRows,
      ...goldmarksRows,
      ...punishmentsRows,
      ...commentsRows,
    ].map((r) => r["Admission No"]));

    // Build student lookup map
    const map: Record<number, StudentInfo> = {};
    referencedStudents.forEach((s) => {
      map[s["Admission No"]] = s;
    });
    setStudentMap(map);

    setStrikes(strikesRows);
    setBlackmarks(blackmarksRows);
    setGoldmarks(goldmarksRows);
    setPunishments(punishmentsRows);
    setComments(commentsRows);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset display pagination whenever the tab, filters, or sort change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    activeTab,
    dateFrom,
    dateTo,
    issuerFilter,
    studentFilter,
    strikeCategoryFilter,
    blackmarkCategoryFilter,
    punishmentTypeFilter,
    strikeSort,
    blackmarkSort,
    punishmentSort,
    simpleSort,
  ]);

  const togglePunishmentStatus = async (recordId: number, currentStatus: string) => {
    const { error } = await supabase
      .from("punishments")
      .update({ Status: currentStatus === "completed" ? "ongoing" : "completed" })
      .eq("id", recordId);
    if (error) {
      console.error("Punishment status update error:", error);
      alert("Failed to update punishment: " + error.message);
      return;
    }
    fetchData();
  };

  const openClearModal = () => {
    setClearPassword("");
    setClearConfirmed(false);
    setClearError("");
    setClearModalOpen(true);
  };

  const handleDeleteRecord = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from(deleteTarget.table)
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      throw new Error(error.message);
    }
    setDeleteTarget(null);
    await fetchData();
  };

  const handleClearStrikes = async () => {
    if (!user || clearing) return;
    setClearing(true);
    setClearError("");
    try {
      // Verify the admin's password against their account
      const { data, error } = await supabase
        .from("users")
        .select("password")
        .eq("id", user.id)
        .maybeSingle();
      if (error || !data) {
        setClearError("Could not verify your account. Please try again.");
        return;
      }
      const bcryptjs = await import("bcryptjs");
      const match = bcryptjs.compareSync(clearPassword, data.password);
      if (!match) {
        setClearError("Incorrect password. Action aborted.");
        return;
      }
      // Permanently delete all strike records
      const { error: deleteError } = await supabase.from("strikes").delete().gte("id", 0);
      if (deleteError) {
        setClearError("Failed to clear strikes: " + deleteError.message);
        return;
      }
      setClearModalOpen(false);
      setClearPassword("");
      setClearConfirmed(false);
      await fetchData();
      alert("All strikes have been cleared.");
    } catch (err) {
      setClearError("Failed to clear strikes: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setClearing(false);
    }
  };

  // Build a unified record feed from all sources
  const unifiedRecords: UnifiedRecord[] = [
    ...strikes.map((s, i) => ({
      key: `strike-${s["Admission No"]}-${s.created_at}-${i}`,
      type: "strikes" as const,
      table: "strikes" as const,
      recordId: s.id,
      admissionNo: s["Admission No"],
      student: studentMap[s["Admission No"]],
      label: categoryLabels[s.Category] || s.Category,
      detail: "",
      issuer: "",
      createdAt: s.created_at || "",
      filterValue: s.Category,
    })),
    ...blackmarks.map((bm, i) => ({
      key: `bm-${bm["Admission No"]}-${bm.created_at}-${i}`,
      type: "blackmarks" as const,
      table: "blackmarks" as const,
      recordId: bm.id,
      admissionNo: bm["Admission No"],
      student: studentMap[bm["Admission No"]],
      label: categoryLabels[bm.Reason] || bm.Reason,
      detail: "",
      issuer: bm.issuedBy || "",
      createdAt: bm.created_at || "",
      filterValue: bm.Reason,
    })),
    ...goldmarks.map((gm, i) => ({
      key: `gm-${gm["Admission No"]}-${gm.created_at}-${i}`,
      type: "goldmarks" as const,
      table: "goldmarks" as const,
      recordId: gm.id,
      admissionNo: gm["Admission No"],
      student: studentMap[gm["Admission No"]],
      label: categoryLabels[gm.Reason] || gm.Reason,
      detail: "",
      issuer: gm.issuedBy || "",
      createdAt: gm.created_at || "",
      filterValue: gm.Reason,
    })),
    ...punishments.map((p, i) => ({
      key: `p-${p.id}-${i}`,
      type: "punishments" as const,
      table: "punishments" as const,
      admissionNo: p["Admission No"],
      student: studentMap[p["Admission No"]],
      label: punishmentLabels[p.Type] || p.Type,
      detail: p.Reason || "",
      issuer: p.assignedBy || "",
      createdAt: p.created_at || "",
      filterValue: p.Type,
      status: p.Status || "ongoing",
      recordId: p.id,
    })),
    ...comments.map((c, i) => ({
      key: `c-${c["Admission No"]}-${c.created_at}-${i}`,
      type: "comments" as const,
      table: "comments" as const,
      recordId: c.id,
      admissionNo: c["Admission No"],
      student: studentMap[c["Admission No"]],
      label: "Comment",
      detail: c.commentText || "",
      issuer: c.commentor || "",
      createdAt: c.created_at || "",
      filterValue: "",
    })),
  ];

  // Global filters
  const filterByDate = (createdAt: string) => {
    if (!dateFrom && !dateTo) return true;
    const recordDate = new Date(createdAt);
    if (dateFrom && recordDate < new Date(dateFrom)) return false;
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999); // include the full day
      if (recordDate > endDate) return false;
    }
    return true;
  };

  const filterByIssuer = (issuer: string) => {
    if (!issuerFilter) return true;
    return (issuer || "").toLowerCase().includes(issuerFilter.toLowerCase());
  };

  const filterByStudent = (rec: UnifiedRecord) => {
    if (!studentFilter.trim()) return true;
    const q = studentFilter.trim().toLowerCase();
    const name = rec.student?.["Name with Initials"] || "";
    return name.toLowerCase().includes(q) || String(rec.admissionNo).includes(q);
  };

  const applyCommonFilters = (rec: UnifiedRecord) =>
    filterByDate(rec.createdAt) && filterByIssuer(rec.issuer) && filterByStudent(rec);

  // Per-type filtered lists
  const strikesList = unifiedRecords
    .filter((r) => r.type === "strikes")
    .filter(applyCommonFilters)
    .filter((r) => strikeCategoryFilter === "all" || r.filterValue === strikeCategoryFilter);

  const blackmarksList = unifiedRecords
    .filter((r) => r.type === "blackmarks")
    .filter(applyCommonFilters)
    .filter((r) => blackmarkCategoryFilter === "all" || r.filterValue === blackmarkCategoryFilter);

  const goldmarksList = unifiedRecords
    .filter((r) => r.type === "goldmarks")
    .filter(applyCommonFilters);

  const punishmentsList = unifiedRecords
    .filter((r) => r.type === "punishments")
    .filter(applyCommonFilters)
    .filter((r) => punishmentTypeFilter === "all" || r.filterValue === punishmentTypeFilter);

  const commentsList = unifiedRecords
    .filter((r) => r.type === "comments")
    .filter(applyCommonFilters);

  // Sort helpers
  const sortNewest = (a: UnifiedRecord, b: UnifiedRecord) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  const sortOldest = (a: UnifiedRecord, b: UnifiedRecord) =>
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();

  const sortedStrikes = [...strikesList].sort((a, b) => {
    if (strikeSort === "oldest") return sortOldest(a, b);
    if (strikeSort === "category") return a.label.localeCompare(b.label);
    return sortNewest(a, b);
  });
  const sortedBlackmarks = [...blackmarksList].sort((a, b) => {
    if (blackmarkSort === "oldest") return sortOldest(a, b);
    if (blackmarkSort === "category") return a.label.localeCompare(b.label);
    return sortNewest(a, b);
  });
  const sortedGoldmarks = [...goldmarksList].sort((a, b) =>
    simpleSort === "oldest" ? sortOldest(a, b) : sortNewest(a, b)
  );
  const sortedPunishments = [...punishmentsList].sort((a, b) => {
    if (punishmentSort === "oldest") return sortOldest(a, b);
    if (punishmentSort === "type") return a.label.localeCompare(b.label);
    return sortNewest(a, b);
  });
  const sortedComments = [...commentsList].sort((a, b) =>
    simpleSort === "oldest" ? sortOldest(a, b) : sortNewest(a, b)
  );

  // Unified chronological feed for the "All" tab
  const allRecords = [
    ...sortedStrikes,
    ...sortedBlackmarks,
    ...sortedGoldmarks,
    ...sortedPunishments,
    ...sortedComments,
  ].sort(sortNewest);

  const activeList =
    activeTab === "strikes"
      ? sortedStrikes
      : activeTab === "blackmarks"
      ? sortedBlackmarks
      : activeTab === "goldmarks"
      ? sortedGoldmarks
      : activeTab === "punishments"
      ? sortedPunishments
      : activeTab === "comments"
      ? sortedComments
      : allRecords;

  // Derived filter options (from actual data)
  const strikeCategories = [...new Set(strikes.map((s) => s.Category))].sort((a, b) =>
    (categoryLabels[a] || a).localeCompare(categoryLabels[b] || b)
  );
  const blackmarkCategories = [...new Set(blackmarks.map((bm) => bm.Reason))].sort((a, b) =>
    (categoryLabels[a] || a).localeCompare(categoryLabels[b] || b)
  );
  const punishmentTypes = [...new Set(punishments.map((p) => p.Type))].sort((a, b) =>
    (punishmentLabels[a] || a).localeCompare(punishmentLabels[b] || b)
  );

  const tabCounts = {
    strikes: strikes.length,
    blackmarks: blackmarks.length,
    goldmarks: goldmarks.length,
    punishments: punishments.length,
    comments: comments.length,
  };

  const filtersActive =
    dateFrom !== "" || dateTo !== "" || issuerFilter !== "" || studentFilter.trim() !== "";

  const typeFilterActive =
    (activeTab === "strikes" && strikeCategoryFilter !== "all") ||
    (activeTab === "blackmarks" && blackmarkCategoryFilter !== "all") ||
    (activeTab === "punishments" && punishmentTypeFilter !== "all");

  const showFilteredEmpty = filtersActive || typeFilterActive;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Summary stats
  const ongoingPunishments = punishments.filter(
    (p) => (p.Status || "ongoing") !== "completed"
  ).length;

  const studentsWithRecords = new Set(unifiedRecords.map((r) => r.admissionNo)).size;

  const statCards: {
    tab: RecordType;
    label: string;
    count: number;
    subline?: string;
    sublineClass?: string;
    chipClass: string;
    hoverClass: string;
    icon: ReactNode;
  }[] = [
    {
      tab: "strikes",
      label: "Strikes",
      count: strikes.length,
      chipClass: "bg-amber-100 text-amber-600",
      hoverClass: "hover:border-amber-300",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      tab: "blackmarks",
      label: "Blackmarks",
      count: blackmarks.length,
      chipClass: "bg-rose-100 text-rose-600",
      hoverClass: "hover:border-rose-300",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    {
      tab: "goldmarks",
      label: "Gold Marks",
      count: goldmarks.length,
      chipClass: "bg-emerald-100 text-emerald-600",
      hoverClass: "hover:border-emerald-300",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      tab: "punishments",
      label: "Punishments",
      count: punishments.length,
      subline: `${ongoingPunishments} ongoing`,
      sublineClass: ongoingPunishments > 0 ? "text-amber-600" : "text-emerald-600",
      chipClass: "bg-blue-100 text-blue-600",
      hoverClass: "hover:border-blue-300",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      tab: "comments",
      label: "Comments",
      count: comments.length,
      chipClass: "bg-violet-100 text-violet-600",
      hoverClass: "hover:border-violet-300",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      tab: "all",
      label: "Students",
      count: studentsWithRecords,
      subline: "with records",
      sublineClass: "text-slate-400",
      chipClass: "bg-teal-100 text-teal-600",
      hoverClass: "hover:border-teal-300",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  if (!authenticated) return null;

  const renderRecordCard = (rec: UnifiedRecord, index: number) => {
    const styles = typeStyles[rec.type];
    return (
      <div
        key={rec.key}
        className="card-solid p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${styles.circle}`}
          >
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            {/* Type badge + student + admission */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${styles.badge}`}
              >
                {styles.label}
              </span>
              <a
                href={`/student/${rec.admissionNo}`}
                className="text-sm font-semibold text-slate-900 hover:text-teal-600 transition-colors"
              >
                {rec.student?.["Name with Initials"] || `Student #${rec.admissionNo}`}
              </a>
              <span className="text-xs text-slate-400">#{rec.admissionNo}</span>
            </div>
            {/* Class + House */}
            {rec.student && (
              <div className="text-xs text-slate-500 mt-0.5">
                {rec.student.Class}
                {rec.student["School House"] && (
                  <>
                    <span className="mx-1">•</span>
                    {rec.student["School House"]}
                  </>
                )}
              </div>
            )}
            {/* Label / category chip + punishment status */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${styles.chip}`}
              >
                {rec.label}
              </span>
              {rec.type === "punishments" && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    rec.status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {rec.status === "completed" ? "Completed" : "Ongoing"}
                </span>
              )}
            </div>
            {/* Detail text (punishment reason / comment body) */}
            {rec.detail && <p className="text-sm text-slate-700 mt-1.5">{rec.detail}</p>}
            {/* Issuer + date */}
            <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
              {rec.issuer && (
                <span className={`${styles.issuer} flex items-center gap-1`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  By: {rec.issuer}
                </span>
              )}
              {rec.createdAt && (
                <span className="text-slate-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDate(rec.createdAt)}
                </span>
              )}
              {rec.type === "punishments" && isAdminOrAbove(user) && (
                <button
                  onClick={() => togglePunishmentStatus(rec.recordId!, rec.status || "ongoing")}
                  className={`ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                    rec.status === "completed"
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {rec.status === "completed" ? "Mark ongoing" : "Mark complete"}
                </button>
              )}
              {isSuperuser(user) && (
                <DeleteButton
                  onClick={() =>
                    setDeleteTarget({
                      table: rec.table,
                      id: rec.recordId!,
                      label: typeStyles[rec.type].label.toLowerCase(),
                    })
                  }
                  label={`Delete ${typeStyles[rec.type].label.toLowerCase()}`}
                  className="ml-auto"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const emptyMessage =
    activeTab === "all"
      ? "No records recorded yet"
      : `No ${tabLabels[activeTab].toLowerCase()} recorded yet`;

  const filteredEmptyMessage =
    activeTab === "all"
      ? "No records match the selected filters"
      : `No ${tabLabels[activeTab].toLowerCase()} match the current filters`;

  return (
    <>
      <Header />
      <div className="page-shell">
        <div className="max-w-6xl mx-auto flex flex-col gap-4 sm:gap-6">
          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Discipline Records
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                All strikes, black marks, gold marks, punishments, and comments across students
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isSuperuser(user) && (
                <button
                  onClick={() => setReportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 px-3.5 py-2 rounded-lg shadow-sm transition-all"
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
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Generate Report
                </button>
              )}
              {isAdminOrAbove(user) && (
                <button
                  onClick={openClearModal}
                  disabled={strikes.length === 0}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 disabled:bg-gray-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed px-3.5 py-2 rounded-lg shadow-sm transition-all"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Clear Strikes
                </button>
              )}
              <a
                href="/"
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
                Back to search
              </a>
            </div>
          </div>

          {/* Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map((card) => (
              <button
                key={card.label}
                onClick={() => setActiveTab(card.tab)}
                className={`group card-solid p-4 text-left transition-all cursor-pointer hover-lift ${card.hoverClass}`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${card.chipClass}`}
                >
                  {card.icon}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">
                  {loading ? "–" : card.count}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  {card.label}
                </div>
                {card.subline && (
                  <div className={`text-[11px] font-medium mt-0.5 ${card.sublineClass}`}>
                    {card.subline}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="card-solid p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Filter by date
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <label htmlFor="date-from" className="text-xs text-slate-500 shrink-0">
                    From
                  </label>
                  <input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="flex-1 sm:w-auto bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="date-to" className="text-xs text-slate-500 shrink-0">
                    To
                  </label>
                  <input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="flex-1 sm:w-auto bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:bg-white"
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Student search */}
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
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                  type="text"
                  placeholder="Search by student name or admission no..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200/70 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:border-teal-400 focus:bg-white"
                />
              </div>
              {/* Issuer search */}
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <input
                  value={issuerFilter}
                  onChange={(e) => setIssuerFilter(e.target.value)}
                  type="text"
                  placeholder="Search by who assigned / issued..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200/70 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:border-teal-400 focus:bg-white"
                />
                {filtersActive && (
                  <button
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setIssuerFilter("");
                      setStudentFilter("");
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-teal-600 hover:text-teal-800 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {(["all", "strikes", "blackmarks", "goldmarks", "punishments", "comments"] as RecordType[]).map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-teal-600 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600"
                  }`}
                >
                  {tabLabels[tab]}
                  {tab !== "all" && (
                    <span
                      className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        activeTab === tab
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 text-slate-500"
                      }`}
                    >
                      {tabCounts[tab]}
                    </span>
                  )}
                </button>
              )
            )}
          </div>

          {/* Per-tab filter + sort row */}
          {!loading && activeTab !== "all" && (
            <div className="card-solid p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Type-specific filter */}
              {activeTab === "strikes" && strikeCategories.length > 0 && (
                <div className="relative w-full sm:w-56">
                  <select
                    value={strikeCategoryFilter}
                    onChange={(e) => setStrikeCategoryFilter(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200/70 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-700 focus:border-amber-400 focus:bg-white focus:ring-1 focus:ring-amber-300 cursor-pointer"
                  >
                    <option value="all">All categories</option>
                    {strikeCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {categoryLabels[cat] || cat}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              )}
              {activeTab === "blackmarks" && blackmarkCategories.length > 0 && (
                <div className="relative w-full sm:w-56">
                  <select
                    value={blackmarkCategoryFilter}
                    onChange={(e) => setBlackmarkCategoryFilter(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200/70 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-700 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-300 cursor-pointer"
                  >
                    <option value="all">All categories</option>
                    {blackmarkCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {categoryLabels[cat] || cat}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              )}
              {activeTab === "punishments" && punishmentTypes.length > 0 && (
                <div className="relative w-full sm:w-56">
                  <select
                    value={punishmentTypeFilter}
                    onChange={(e) => setPunishmentTypeFilter(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200/70 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-700 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-300 cursor-pointer"
                  >
                    <option value="all">All punishment types</option>
                    {punishmentTypes.map((type) => (
                      <option key={type} value={type}>
                        {punishmentLabels[type] || type}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              )}
              {/* Sort controls */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() =>
                      activeTab === "strikes"
                        ? setStrikeSort("newest")
                        : activeTab === "blackmarks"
                        ? setBlackmarkSort("newest")
                        : activeTab === "punishments"
                        ? setPunishmentSort("newest")
                        : setSimpleSort("newest")
                    }
                    className={`px-2.5 py-1.5 rounded-l-lg transition-colors ${
                      (activeTab === "strikes" && strikeSort === "newest") ||
                      (activeTab === "blackmarks" && blackmarkSort === "newest") ||
                      (activeTab === "punishments" && punishmentSort === "newest") ||
                      ((activeTab === "goldmarks" || activeTab === "comments") && simpleSort === "newest")
                        ? "bg-teal-600 text-white"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Newest
                  </button>
                  <button
                    onClick={() =>
                      activeTab === "strikes"
                        ? setStrikeSort("oldest")
                        : activeTab === "blackmarks"
                        ? setBlackmarkSort("oldest")
                        : activeTab === "punishments"
                        ? setPunishmentSort("oldest")
                        : setSimpleSort("oldest")
                    }
                    className={`px-2.5 py-1.5 transition-colors ${
                      (activeTab === "strikes" && strikeSort === "oldest") ||
                      (activeTab === "blackmarks" && blackmarkSort === "oldest") ||
                      (activeTab === "punishments" && punishmentSort === "oldest") ||
                      ((activeTab === "goldmarks" || activeTab === "comments") && simpleSort === "oldest")
                        ? "bg-teal-600 text-white"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Oldest
                  </button>
                  {(activeTab === "strikes" || activeTab === "blackmarks" || activeTab === "punishments") && (
                    <button
                      onClick={() =>
                        activeTab === "strikes"
                          ? setStrikeSort("category")
                          : activeTab === "blackmarks"
                          ? setBlackmarkSort("category")
                          : setPunishmentSort("type")
                      }
                      className={`px-2.5 py-1.5 rounded-r-lg transition-colors ${
                        (activeTab === "strikes" && strikeSort === "category") ||
                        (activeTab === "blackmarks" && blackmarkSort === "category") ||
                        (activeTab === "punishments" && punishmentSort === "type")
                          ? "bg-teal-600 text-white"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {activeTab === "punishments" ? "Type" : "Category"}
                    </button>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-medium bg-gray-50 px-2.5 py-1 rounded-full shrink-0">
                  {activeList.length} record{activeList.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}

          {/* Records list */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-slate-400 text-base sm:text-lg animate-pulse">
                Loading discipline records...
              </div>
            </div>
          ) : activeList.length === 0 ? (
            <div className="card-solid p-8 text-center">
              <div className="text-4xl sm:text-5xl mb-3">📋</div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-1">
                {showFilteredEmpty ? filteredEmptyMessage : emptyMessage}
              </h2>
              <p className="text-sm text-slate-500">
                {showFilteredEmpty
                  ? "Try adjusting the date range, student, issuer, or category filters."
                  : activeTab === "all"
                  ? "Records will appear here once strikes, marks, punishments, or comments are added."
                  : `No ${tabLabels[activeTab].toLowerCase()} recorded yet.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeList.slice(0, visibleCount).map((rec, i) => renderRecordCard(rec, i))}
              {visibleCount < activeList.length && (
                <button
                  onClick={() =>
                    setVisibleCount((c) => Math.min(c + PAGE_SIZE, activeList.length))
                  }
                  className="w-full card-solid px-5 py-3 text-sm font-medium text-teal-600 hover:border-teal-300 hover:bg-teal-50 transition-all cursor-pointer"
                >
                  Load more records ({activeList.length - visibleCount} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete record confirmation (superuser only) */}
      <ConfirmPasswordModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.label || "record"}`}
        message={
          <>
            This will permanently delete this{" "}
            <strong>{deleteTarget?.label || "record"}</strong> from the database.
            This <strong>cannot be undone</strong>.
          </>
        }
        confirmLabel="Delete"
        onVerified={handleDeleteRecord}
      />

      {/* Generate report modal (superuser only) */}
      {isSuperuser(user) && (
        <GenerateReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
        />
      )}

      {/* Clear Strikes confirmation modal */}
      <Modal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title="Clear All Strikes"
      >
        <div className="flex flex-col gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            ⚠️ This action will permanently delete <strong>ALL strike records</strong> from the
            database. This <strong>cannot be undone</strong>.
          </div>
          <div>
            <label htmlFor="clear-password" className="block text-sm font-medium text-slate-700 mb-1">
              Enter your password to confirm
            </label>
            <input
              id="clear-password"
              type="password"
              value={clearPassword}
              onChange={(e) => setClearPassword(e.target.value)}
              placeholder="Your password"
              autoFocus
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-red-400 focus:bg-white"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={clearConfirmed}
              onChange={(e) => setClearConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-red-500"
            />
            <span>
              I understand this action is irreversible and permanently deletes all strike records.
            </span>
          </label>
          {clearError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {clearError}
            </div>
          )}
          <div className="flex w-full gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleClearStrikes}
              disabled={clearing || !clearPassword.trim() || !clearConfirmed}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            >
              {clearing ? "Clearing..." : "Delete All Strikes"}
            </button>
            <button
              onClick={() => setClearModalOpen(false)}
              disabled={clearing}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-slate-700 font-medium px-4 py-2.5 rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
