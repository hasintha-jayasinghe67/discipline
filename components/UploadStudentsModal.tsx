"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import Modal from "@/components/Modal";
import PasswordInput from "@/components/PasswordInput";

// Column names in the `students` table. The CSV is expected to use these
// names in its header row (a full Supabase export may also include `id` /
// `created_at` — those extra columns are ignored).
interface StudentRow {
  "Admission No": number;
  "Name with Initials": string;
  Class: string;
  "School House": string;
  Grade: string;
}

interface ParsedFile {
  fileName: string;
  rows: StudentRow[];
  matchedColumns: string[];
  ignoredColumns: string[];
  skippedCount: number;
}

const INSERT_CHUNK = 500;

/**
 * RFC-4180-style CSV parser: handles quoted fields containing commas,
 * escaped quotes (""), and embedded newlines.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty rows (e.g. a trailing newline).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

type ParseResult = { data: ParsedFile } | { error: string };

function parseFileContent(fileName: string, text: string): ParseResult {
  const lines = parseCSV(text.replace(/^\uFEFF/, "")); // strip BOM
  if (lines.length < 2) {
    return { error: "The file has no data rows." };
  }

  const headers = lines[0].map((h) => h.trim());
  const columnIndex: Partial<Record<keyof StudentRow, number>> = {};
  const matchedColumns: string[] = [];
  const ignoredColumns: string[] = [];

  headers.forEach((header, i) => {
    const key = header.toLowerCase();
    if (key === "admission no") {
      columnIndex["Admission No"] = i;
      matchedColumns.push(header);
    } else if (key === "name with initials") {
      columnIndex["Name with Initials"] = i;
      matchedColumns.push(header);
    } else if (key === "class") {
      columnIndex["Class"] = i;
      matchedColumns.push(header);
    } else if (key === "grade") {
      columnIndex["Grade"] = i;
      matchedColumns.push(header);
    } else if (key === "school house") {
      columnIndex["School House"] = i;
      matchedColumns.push(header);
    } else {
      ignoredColumns.push(header);
    }
  });

  if (columnIndex["Admission No"] === undefined) {
    return { error: 'The CSV must include an "Admission No" column.' };
  }
  if (columnIndex["Name with Initials"] === undefined) {
    return { error: 'The CSV must include a "Name with Initials" column.' };
  }

  const rows: StudentRow[] = [];
  const seen = new Set<number>();
  let skippedCount = 0;
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r];
    const cell = (idx: number | undefined) =>
      idx !== undefined && idx < cells.length ? cells[idx].trim() : "";

    const admissionRaw = cell(columnIndex["Admission No"]);
    // Records whose Admission No starts with "N" are skipped entirely —
    // they are not added to the table.
    if (/^n/i.test(admissionRaw)) {
      skippedCount++;
      continue;
    }

    const admissionNo = Number(admissionRaw);
    if (admissionRaw === "" || Number.isNaN(admissionNo)) {
      return {
        error: `Row ${r + 1} has an invalid Admission No (${admissionRaw ? `"${admissionRaw}"` : "empty"}).`,
      };
    }
    if (seen.has(admissionNo)) {
      return { error: `Admission No ${admissionNo} appears more than once in the file.` };
    }
    seen.add(admissionNo);

    rows.push({
      "Admission No": admissionNo,
      "Name with Initials": cell(columnIndex["Name with Initials"]),
      Class: cell(columnIndex["Class"]),
      "School House": cell(columnIndex["School House"]),
      Grade: cell(columnIndex["Grade"]),
    });
  }
  if (rows.length === 0) {
    return { error: "The file has no data rows." };
  }

  return { data: { fileName, rows, matchedColumns, ignoredColumns, skippedCount } };
}

interface UploadStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded?: () => void;
}

export default function UploadStudentsModal({
  isOpen,
  onClose,
  onUploaded,
}: UploadStudentsModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadedCount, setUploadedCount] = useState<number | null>(null);

  // Reset state each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setFileName("");
      setParseError("");
      setParsed(null);
      setConfirmed(false);
      setPassword("");
      setUploading(false);
      setUploadError("");
      setUploadedCount(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [isOpen]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName("");
    setParseError("");
    setParsed(null);
    setConfirmed(false);
    setUploadError("");
    setUploadedCount(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileName(file.name);
      setParseError("Please choose a .csv file.");
      return;
    }

    const text = await file.text();
    const result = parseFileContent(file.name, text);
    if ("error" in result) {
      setFileName(file.name);
      setParseError(result.error);
      return;
    }
    setParsed(result.data);
  };

  const handleUpload = async () => {
    if (!parsed || !confirmed || uploading || !user) return;
    setUploading(true);
    setUploadError("");
    try {
      // 0) Verify the user's password via a real Supabase Auth sign-in.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (verifyError) {
        throw new Error("Incorrect password. Action aborted.");
      }

      // 1) Clear the students table.
      const { error: clearError } = await supabase
        .from("students")
        .delete()
        .neq("Admission No", -1);
      if (clearError) {
        throw new Error("Could not clear the students table: " + clearError.message);
      }

      // 2) Insert the new rows in chunks.
      let inserted = 0;
      for (let i = 0; i < parsed.rows.length; i += INSERT_CHUNK) {
        const chunk = parsed.rows.slice(i, i + INSERT_CHUNK);
        const { error } = await supabase.from("students").insert(chunk);
        if (error) {
          throw new Error(
            `Failed to insert students (rows ${i + 1}–${Math.min(
              i + INSERT_CHUNK,
              parsed.rows.length
            )}): ${error.message}`
          );
        }
        inserted += chunk.length;
      }

      setUploadedCount(inserted);
      onUploaded?.();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Student Details">
      <div className="flex flex-col gap-4">
        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-label mb-1.5">
            CSV file
          </label>
          <input
            ref={fileInputRef}
            id="students-csv-input"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="students-csv-input"
            className="w-full flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-hairline-strong rounded-xl px-4 py-6 text-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-all"
          >
            <svg
              className="w-6 h-6 text-label-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm font-medium text-label">
              {fileName || "Choose a CSV file"}
            </span>
            <span className="text-xs text-label-tertiary">
              The header row must use the students table column names
            </span>
          </label>
        </div>

        {parseError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {parseError}
          </div>
        )}

        {parsed && uploadedCount === null && (
          <>
            {/* Parsed summary */}
            <div className="bg-surface-secondary border border-hairline rounded-xl p-3 flex flex-col gap-1 text-sm">
              <div className="text-label">
                Rows to import: <strong>{parsed.rows.length}</strong>
              </div>
              <div className="text-label-secondary">
                Columns: <span className="font-medium text-label">{parsed.matchedColumns.join(", ")}</span>
              </div>
              {parsed.skippedCount > 0 && (
                <div className="text-label-tertiary">
                  Skipped {parsed.skippedCount} row{parsed.skippedCount === 1 ? "" : "s"} with "N"-prefixed Admission No
                </div>
              )}
              {parsed.ignoredColumns.length > 0 && (
                <div className="text-label-tertiary">
                  Ignored: {parsed.ignoredColumns.join(", ")}
                </div>
              )}
            </div>

            {/* Destructive-action warning */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              ⚠️ Uploading will first <strong>delete ALL existing students</strong> from the
              database, then insert the {parsed.rows.length} row
              {parsed.rows.length === 1 ? "" : "s"} from this file. This{" "}
              <strong>cannot be undone</strong>.
            </div>

            {/* Format acknowledgment */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              I understand that if the uploaded csv file is not in the correct format
              the application will not work. I have verified that the file is in the
              correct working format
            </div>

            {/* Password verification */}
            <div>
              <label htmlFor="upload-password" className="block text-sm font-medium text-label mb-1">
                Enter your password to confirm
              </label>
              <PasswordInput
                id="upload-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoFocus
                className="bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-red-400 focus:bg-white"
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-label cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-red-500"
              />
              <span>I understand all existing students will be replaced.</span>
            </label>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {uploadError}
              </div>
            )}

            <div className="flex w-full gap-2 pt-2 border-t border-hairline">
              <button
                onClick={handleUpload}
                disabled={!confirmed || !password.trim() || uploading}
                className="btn-primary flex-1 px-4 py-2.5"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
              <button
                onClick={onClose}
                disabled={uploading}
                className="btn-secondary flex-1 px-4 py-2.5"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {uploadedCount !== null && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
              ✅ Successfully replaced the students table with{" "}
              <strong>{uploadedCount}</strong> student
              {uploadedCount === 1 ? "" : "s"}.
            </div>
            <div className="flex w-full gap-2 pt-2 border-t border-hairline">
              <button onClick={onClose} className="btn-primary flex-1 px-4 py-2.5">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
