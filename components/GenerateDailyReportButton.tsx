"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { categoryLabels } from "@/lib/labels";
import { fetchStudentsFor } from "@/lib/students";

interface StrikeRecord {
  "Admission No": number;
  Category: string;
  created_at: string;
}

interface BlackmarkRecord {
  "Admission No": number;
  Reason: string;
  issuedBy: string;
  created_at: string;
}

interface StudentInfo {
  "Admission No": number;
  "Name with Initials": string;
  Class: string;
  "School House": string;
}

const labelOf = (key: string): string => categoryLabels[key] || key;

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export default function GenerateDailyReportButton() {
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      // "Today" in the user's local timezone, converted to UTC ISO boundaries.
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      const [strikesRes, blackmarksRes] = await Promise.all([
        supabase
          .from("strikes")
          .select("*")
          .gte("created_at", startOfDay.toISOString())
          .lt("created_at", endOfDay.toISOString())
          .order("created_at", { ascending: false }),
        supabase
          .from("blackmarks")
          .select("*")
          .gte("created_at", startOfDay.toISOString())
          .lt("created_at", endOfDay.toISOString())
          .order("created_at", { ascending: false }),
      ]);

      const strikes = (strikesRes.data || []) as StrikeRecord[];
      const blackmarks = (blackmarksRes.data || []) as BlackmarkRecord[];

      if (strikes.length === 0 && blackmarks.length === 0) {
        alert("No strikes or blackmarks recorded today.");
        return;
      }

      // Load only the students referenced by today's records, not the whole table
      const referencedStudents = await fetchStudentsFor([
        ...strikes,
        ...blackmarks,
      ].map((r) => r["Admission No"]));

      const studentMap: Record<number, StudentInfo> = {};
      referencedStudents.forEach((s) => {
        studentMap[s["Admission No"]] = s;
      });

      // Load the PDF libraries only on demand (keeps the initial bundle small).
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const bottomMargin = 12;

      const dateLabel = now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const pad = (n: number) => String(n).padStart(2, "0");
      const fileName = `daily-report-${now.getFullYear()}-${pad(
        now.getMonth() + 1
      )}-${pad(now.getDate())}.pdf`;

      let y = 0;
      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - bottomMargin) {
          doc.addPage();
          y = margin + 4;
        }
      };

      // Title block (first page only)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(17, 24, 39);
      doc.text("Daily Discipline Report", margin, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128);
      doc.text(dateLabel, margin, 27);

      doc.setFontSize(11);
      doc.setTextColor(55, 65, 81);
      doc.text(
        `Total: ${plural(strikes.length, "strike")}, ${plural(
          blackmarks.length,
          "blackmark"
        )}`,
        margin,
        33
      );

      doc.setDrawColor(209, 213, 219);
      doc.line(margin, 37, pageWidth - margin, 37);
      y = 44;

      const drawSectionHeader = (label: string) => {
        ensureSpace(18);
        doc.setFillColor(67, 56, 202); // indigo-700
        doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 1.5, 1.5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(255, 255, 255);
        doc.text(label, margin + 4, y + 6.1);
        y += 12;
      };

      const drawStudentBlock = (
        admissionNo: number,
        recordLabels: string[]
      ) => {
        ensureSpace(16);
        const student = studentMap[admissionNo];
        const name = student?.["Name with Initials"] || `Student #${admissionNo}`;
        const cls = student?.Class || "";
        const house = student?.["School House"] || "";

        autoTable(doc as Parameters<typeof autoTable>[0], {
          startY: y,
          margin: { left: margin, right: margin },
          theme: "grid",
          showHead: "everyPage",
          head: [[name, `Adm: ${admissionNo}`, `Class: ${cls}`, `House: ${house}`]],
          headStyles: {
            fillColor: [243, 244, 246],
            textColor: [17, 24, 39],
            fontStyle: "bold",
            fontSize: 10,
            halign: "left",
            lineColor: [229, 231, 235],
            lineWidth: 0.15,
          },
          body: recordLabels.map((label) => [label, "", "", ""]),
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [55, 65, 81],
            fontSize: 10,
            halign: "left",
            lineColor: [229, 231, 235],
            lineWidth: 0.15,
          },
          columnStyles: {
            0: { cellWidth: 88 },
            1: { cellWidth: 26 },
            2: { cellWidth: 34 },
            3: { cellWidth: 34 },
          },
        });

        const finalY = (
          doc as typeof doc & { lastAutoTable?: { finalY?: number } }
        ).lastAutoTable?.finalY;
        y = (finalY ?? y) + 4;
      };

      const groupByAdmission = <T extends { "Admission No": number }>(
        records: T[]
      ): Map<number, T[]> => {
        const map = new Map<number, T[]>();
        for (const r of records) {
          const list = map.get(r["Admission No"]);
          if (list) list.push(r);
          else map.set(r["Admission No"], [r]);
        }
        return map;
      };

      // Strikes section, then Blackmarks section (only render sections that have records).
      const strikeGroups = groupByAdmission(strikes);
      if (strikeGroups.size > 0) {
        drawSectionHeader(`Strikes (${strikes.length})`);
        strikeGroups.forEach((group, admissionNo) => {
          drawStudentBlock(
            admissionNo,
            group.map((r) => labelOf(r.Category))
          );
        });
      }

      const blackmarkGroups = groupByAdmission(blackmarks);
      if (blackmarkGroups.size > 0) {
        drawSectionHeader(`Blackmarks (${blackmarks.length})`);
        blackmarkGroups.forEach((group, admissionNo) => {
          drawStudentBlock(
            admissionNo,
            group.map((r) => labelOf(r.Reason))
          );
        });
      }

      doc.save(fileName);
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
      className="inline-flex items-center gap-1.5 bg-white text-indigo-700 hover:bg-indigo-50 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-full shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
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
