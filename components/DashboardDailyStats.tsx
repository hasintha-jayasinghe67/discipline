"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { categoryLabels } from "@/lib/labels";
import { getTodayRange } from "@/lib/disciplineReport";
import GenerateDailyReportButton from "@/components/GenerateDailyReportButton";

interface CategoryCount {
  key: string;
  label: string;
  count: number;
}

interface DailyStats {
  strikes: number;
  blackmarks: number;
  goldmarks: number;
  strikeCategories: CategoryCount[];
  blackmarkCategories: CategoryCount[];
  goldmarkCategories: CategoryCount[];
}

const emptyStats: DailyStats = {
  strikes: 0,
  blackmarks: 0,
  goldmarks: 0,
  strikeCategories: [],
  blackmarkCategories: [],
  goldmarkCategories: [],
};

function buildCategoryCounts(
  records: Record<string, string>[],
  field: string
): CategoryCount[] {
  const map = new Map<string, number>();
  for (const record of records) {
    const key = record[field];
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({
      key,
      label: categoryLabels[key] || key,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

async function fetchTodayStats(): Promise<DailyStats> {
  const range = getTodayRange();
  const start = range.start.toISOString();
  const end = range.endExclusive.toISOString();

  const [strikesRes, blackmarksRes, goldmarksRes] = await Promise.all([
    supabase
      .from("strikes")
      .select("Category")
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("blackmarks")
      .select("Reason")
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("goldmarks")
      .select("Reason")
      .gte("created_at", start)
      .lt("created_at", end),
  ]);

  if (strikesRes.error) throw strikesRes.error;
  if (blackmarksRes.error) throw blackmarksRes.error;
  if (goldmarksRes.error) throw goldmarksRes.error;

  const strikes = strikesRes.data || [];
  const blackmarks = blackmarksRes.data || [];
  const goldmarks = goldmarksRes.data || [];

  return {
    strikes: strikes.length,
    blackmarks: blackmarks.length,
    goldmarks: goldmarks.length,
    strikeCategories: buildCategoryCounts(strikes as Record<string, string>[], "Category"),
    blackmarkCategories: buildCategoryCounts(
      blackmarks as Record<string, string>[],
      "Reason"
    ),
    goldmarkCategories: buildCategoryCounts(goldmarks as Record<string, string>[], "Reason"),
  };
}

function CategoryBreakdown({
  title,
  categories,
  barClass,
  emptyClass,
  loading,
}: {
  title: string;
  categories: CategoryCount[];
  barClass: string;
  emptyClass: string;
  loading: boolean;
}) {
  const max = categories[0]?.count ?? 0;

  return (
    <div className="card-solid p-4 sm:p-5 flex flex-col gap-3 h-full">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400 animate-pulse py-6">
          Loading…
        </div>
      ) : categories.length === 0 ? (
        <div className={`flex-1 flex items-center justify-center text-sm py-6 ${emptyClass}`}>
          None issued today
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {categories.map((cat) => (
            <div key={cat.key}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-slate-600 truncate">{cat.label}</span>
                <span className="text-xs font-semibold text-slate-900 shrink-0">{cat.count}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                  style={{ width: max > 0 ? `${(cat.count / max) * 100}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  count,
  chipClass,
  icon,
  loading,
}: {
  label: string;
  count: number;
  chipClass: string;
  icon: ReactNode;
  loading: boolean;
}) {
  return (
    <div className="card-solid p-4 sm:p-5">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${chipClass}`}
      >
        {icon}
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">
        {loading ? "–" : count}
      </div>
      <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-400 font-medium mt-0.5">Today</div>
    </div>
  );
}

interface DashboardDailyStatsProps {
  refreshKey?: number;
  showReportButton?: boolean;
}

export default function DashboardDailyStats({
  refreshKey = 0,
  showReportButton = false,
}: DashboardDailyStatsProps) {
  const [stats, setStats] = useState<DailyStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetchTodayStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load today's stats");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const totalToday = stats.strikes + stats.blackmarks + stats.goldmarks;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Today&apos;s Overview</h1>
          <p className="page-subtitle mt-0.5">{todayLabel}</p>
        </div>
        {showReportButton && <GenerateDailyReportButton variant="page" />}
      </div>

      {error && (
        <div className="card-solid p-4 text-sm text-rose-600 bg-rose-50 border-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Strikes Issued"
          count={stats.strikes}
          loading={loading}
          chipClass="bg-amber-100 text-amber-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          }
        />
        <StatCard
          label="Blackmarks Issued"
          count={stats.blackmarks}
          loading={loading}
          chipClass="bg-rose-100 text-rose-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          }
        />
        <StatCard
          label="Gold Marks Issued"
          count={stats.goldmarks}
          loading={loading}
          chipClass="bg-emerald-100 text-emerald-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CategoryBreakdown
          title="Strikes by category"
          categories={stats.strikeCategories}
          barClass="bg-amber-400"
          emptyClass="text-amber-600/70"
          loading={loading}
        />
        <CategoryBreakdown
          title="Blackmarks by reason"
          categories={stats.blackmarkCategories}
          barClass="bg-rose-400"
          emptyClass="text-rose-600/70"
          loading={loading}
        />
        <CategoryBreakdown
          title="Gold marks by reason"
          categories={stats.goldmarkCategories}
          barClass="bg-emerald-400"
          emptyClass="text-emerald-600/70"
          loading={loading}
        />
      </div>

      {!loading && totalToday > 0 && (
        <div className="card-solid p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Today&apos;s breakdown</h3>
          <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
            {stats.strikes > 0 && (
              <div
                className="bg-amber-400 transition-all duration-500"
                style={{ width: `${(stats.strikes / totalToday) * 100}%` }}
                title={`Strikes: ${stats.strikes}`}
              />
            )}
            {stats.blackmarks > 0 && (
              <div
                className="bg-rose-400 transition-all duration-500"
                style={{ width: `${(stats.blackmarks / totalToday) * 100}%` }}
                title={`Blackmarks: ${stats.blackmarks}`}
              />
            )}
            {stats.goldmarks > 0 && (
              <div
                className="bg-emerald-400 transition-all duration-500"
                style={{ width: `${(stats.goldmarks / totalToday) * 100}%` }}
                title={`Gold marks: ${stats.goldmarks}`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              Strikes ({stats.strikes})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              Blackmarks ({stats.blackmarks})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Gold marks ({stats.goldmarks})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
