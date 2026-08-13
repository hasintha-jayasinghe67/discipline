"use client";

import { useState } from "react";
import { generateDailyDisciplineReport } from "@/lib/disciplineReport";

export default function GenerateDailyReportButton() {
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const result = await generateDailyDisciplineReport();
      if (result.empty) {
        alert("No strikes or blackmarks recorded today.");
      }
    } catch (err) {
      console.error("Daily report generation failed:", err);
      alert(
        "Failed to load today's records: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={generating}
      title="Generate and download today's discipline report (PDF)"
      className="inline-flex items-center gap-1.5 bg-teal-500/15 text-teal-300 hover:bg-teal-500/25 hover:text-teal-200 border border-teal-400/25 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span className="hidden sm:inline">
        {generating ? "Generating…" : "Generate Daily Report"}
      </span>
      <span className="sm:hidden">{generating ? "…" : "Report"}</span>
    </button>
  );
}
