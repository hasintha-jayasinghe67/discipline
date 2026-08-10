export interface StudentInfo {
  "Admission No": number;
  "Name with Initials": string;
  Class: string;
  "School House": string;
}

/**
 * Normalize a name for comparison: uppercase, strip everything except
 * A-Z and 0-9. Removes dots (e.g. "K.G.S." -> "KGS"), spaces
 * (e.g. "DE SILVA ES" -> "DESILVAES", "COORAY M T S" -> "COORAYMTS"),
 * hyphens, apostrophes, etc.
 */
export const normalizeName = (input: string): string =>
  (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Case/space/dot-insensitive substring search across the full
 * "Name with Initials" value (surname + initials). Requires at least
 * 2 normalized characters. Results are sorted alphabetically by name.
 */
export const searchStudents = (
  students: StudentInfo[],
  query: string
): StudentInfo[] => {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  return students
    .filter((s) => normalizeName(s["Name with Initials"]).includes(q))
    .sort((a, b) =>
      a["Name with Initials"].localeCompare(b["Name with Initials"])
    );
};
