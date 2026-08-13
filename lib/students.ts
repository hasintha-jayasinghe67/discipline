import { supabase } from "./supabase";
import type { StudentInfo } from "./nameSearch";

const PAGE = 1000;
// Chunk size for .in() filters — keeps URLs well under server limits.
const IN_CHUNK = 500;

export type RecordTable =
  | "strikes"
  | "blackmarks"
  | "goldmarks"
  | "punishments"
  | "comments";

/**
 * Paginate through an entire table. Supabase's PostgREST caps any single
 * query at 1000 rows (db-max-rows silently clamps larger requests), so a
 * plain `select("*")` silently drops everything past the first 1000 rows.
 * This pages with .range() until everything is loaded.
 *
 * Pass `orderBy` to order by that column descending (stable pagination).
 */
export const fetchAllRows = async <T>(
  table: "students" | RecordTable,
  orderBy?: string
): Promise<T[]> => {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select("*");
    if (orderBy) query = query.order(orderBy, { ascending: false });
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) {
      console.error(`Failed to fetch ${table}:`, error);
      return [];
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return rows;
};

/**
 * Every student in the table. Only used where the full list is genuinely
 * needed (the dashboard name search, which filters client-side).
 */
export const fetchAllStudents = async (): Promise<StudentInfo[]> =>
  fetchAllRows<StudentInfo>("students");

/**
 * Fetch ONLY the students referenced by the given admission numbers —
 * much lighter than loading the whole students table. Records are loaded
 * first, then the students appearing in them.
 */
export const fetchStudentsFor = async (
  admissionNos: number[]
): Promise<StudentInfo[]> => {
  const unique = [...new Set(admissionNos)];
  if (unique.length === 0) return [];
  const rows: StudentInfo[] = [];
  for (let from = 0; from < unique.length; from += IN_CHUNK) {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .in("Admission No", unique.slice(from, from + IN_CHUNK));
    if (error) {
      console.error("Failed to fetch referenced students:", error);
      return [];
    }
    rows.push(...(data as StudentInfo[]));
  }
  return rows;
};
