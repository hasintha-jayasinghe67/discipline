"use client";

import { useState } from "react";
import { generateDailyDisciplineReport } from "@/lib/disciplineReport";

type GenerateDailyReportButtonProps = {
  variant?: "header" | "page";
};

const variantClasses = {
  header:
    "inline-flex items-center gap-1.5 btn-tinted text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0",
  page: "inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold btn-tinted px-3.5 py-2 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0 w-fit",
};

export default function GenerateDailyReportButton({
  variant = "header",
}: GenerateDailyReportButtonProps) {
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
      className={variantClasses[variant]}
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
