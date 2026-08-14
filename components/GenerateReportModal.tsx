"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useAuth, isSuperuser } from "@/lib/AuthContext";
import { generateRangeDisciplineReport } from "@/lib/disciplineReport";

interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GenerateReportModal({
  isOpen,
  onClose,
}: GenerateReportModalProps) {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (generating) return;
    setError("");
    onClose();
  };

  const handleGenerate = async () => {
    if (generating) return;
    if (!isSuperuser(user)) {
      setError("Only superusers can generate reports for a custom date range.");
      return;
    }
    setError("");

    if (!dateFrom || !dateTo) {
      setError("Please select both a start and end date.");
      return;
    }

    if (dateFrom > dateTo) {
      setError("Start date must be on or before the end date.");
      return;
    }

    setGenerating(true);
    try {
      const result = await generateRangeDisciplineReport(dateFrom, dateTo);
      if (result.empty) {
        setError("No strikes or blackmarks found for the selected date range.");
        return;
      }
      setDateFrom("");
      setDateTo("");
      onClose();
    } catch (err) {
      console.error("Report generation failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate report. Please try again."
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Generate Report">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Choose a date range to download a PDF report of strikes and blackmarks.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="report-date-from" className="block text-sm font-medium text-slate-700 mb-1">
              From
            </label>
            <input
              id="report-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={generating}
              className="input-field text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="report-date-to" className="block text-sm font-medium text-slate-700 mb-1">
              To
            </label>
            <input
              id="report-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={generating}
              className="input-field text-sm disabled:opacity-60"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex w-full gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 inline-flex items-center justify-center gap-1.5 btn-primary px-4 py-2.5 disabled:opacity-55"
          >
            <svg
              className="w-4 h-4"
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
            {generating ? "Generating…" : "Download PDF"}
          </button>
          <button
            onClick={handleClose}
            disabled={generating}
            className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-medium px-4 py-2.5 rounded-xl transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
