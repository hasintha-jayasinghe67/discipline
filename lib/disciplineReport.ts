import { categoryLabels } from "@/lib/labels";
import { fetchStudentsFor } from "@/lib/students";
import { supabase } from "@/lib/supabase";

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

export interface ReportDateRange {
  start: Date;
  endExclusive: Date;
}

const labelOf = (key: string): string => categoryLabels[key] || key;

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const pad = (n: number) => String(n).padStart(2, "0");

export const parseDateInputStart = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const parseDateInputEndExclusive = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d + 1);
};

export const formatReportDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export const formatReportFileDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export async function fetchDisciplineRecordsForRange(range: ReportDateRange) {
  const [strikesRes, blackmarksRes] = await Promise.all([
    supabase
      .from("strikes")
      .select("*")
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.endExclusive.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("blackmarks")
      .select("*")
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.endExclusive.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (strikesRes.error) throw strikesRes.error;
  if (blackmarksRes.error) throw blackmarksRes.error;

  return {
    strikes: (strikesRes.data || []) as StrikeRecord[],
    blackmarks: (blackmarksRes.data || []) as BlackmarkRecord[],
  };
}

export async function generateDisciplineReportPdf(options: {
  range: ReportDateRange;
  title: string;
  dateLabel: string;
  fileName: string;
}) {
  const { strikes, blackmarks } = await fetchDisciplineRecordsForRange(options.range);

  if (strikes.length === 0 && blackmarks.length === 0) {
    return { empty: true as const };
  }

  const referencedStudents = await fetchStudentsFor(
    [...strikes, ...blackmarks].map((r) => r["Admission No"])
  );

  const studentMap: Record<number, StudentInfo> = {};
  referencedStudents.forEach((s) => {
    studentMap[s["Admission No"]] = s;
  });

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const bottomMargin = 12;

  let y = 0;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin + 4;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.text(options.title, margin, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(107, 114, 128);
  doc.text(options.dateLabel, margin, 27);

  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);
  doc.text(
    `Total: ${plural(strikes.length, "strike")}, ${plural(blackmarks.length, "blackmark")}`,
    margin,
    33
  );

  doc.setDrawColor(209, 213, 219);
  doc.line(margin, 37, pageWidth - margin, 37);
  y = 44;

  const drawSectionHeader = (label: string) => {
    ensureSpace(18);
    doc.setFillColor(13, 148, 136);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(label, margin + 4, y + 6.1);
    y += 12;
  };

  const drawStudentBlock = (admissionNo: number, recordLabels: string[]) => {
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

  doc.save(options.fileName);
  return { empty: false as const };
}

export function getTodayRange(now = new Date()): ReportDateRange {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    endExclusive: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
  };
}

export async function generateDailyDisciplineReport() {
  const now = new Date();
  const range = getTodayRange(now);

  return generateDisciplineReportPdf({
    range,
    title: "Daily Discipline Report",
    dateLabel: formatReportDate(now),
    fileName: `daily-report-${formatReportFileDate(now)}.pdf`,
  });
}

export async function generateRangeDisciplineReport(dateFrom: string, dateTo: string) {
  const start = parseDateInputStart(dateFrom);
  const endExclusive = parseDateInputEndExclusive(dateTo);
  const endInclusive = new Date(endExclusive);
  endInclusive.setDate(endInclusive.getDate() - 1);

  const dateLabel =
    dateFrom === dateTo
      ? formatReportDate(start)
      : `${formatReportDate(start)} – ${formatReportDate(endInclusive)}`;

  const fileName =
    dateFrom === dateTo
      ? `discipline-report-${dateFrom}.pdf`
      : `discipline-report-${dateFrom}-to-${dateTo}.pdf`;

  return generateDisciplineReportPdf({
    range: { start, endExclusive },
    title: "Discipline Report",
    dateLabel,
    fileName,
  });
}
