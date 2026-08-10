// Strike → Blackmark threshold rules.
// A student who accumulates `threshold` strikes in one of these categories
// "owes" a blackmark for that category.

export const STRIKE_TO_BLACKMARK: Record<string, number> = {
  grooming: 2, // Personal Grooming
  "repeated-punish": 3, // Repeated Punishments
  late: 3, // Getting Late Often
  classfuckup: 3, // Classroom Behavior
};

/** Threshold for a category, or null if the category has no rule. */
export function getThreshold(category: string): number | null {
  return STRIKE_TO_BLACKMARK[category] ?? null;
}

/** Whether a category has a strike → blackmark rule. */
export function hasRule(category: string): boolean {
  return getThreshold(category) !== null;
}

/** Whether a strike count is at or above the category's threshold. */
export function isAtOrAboveThreshold(count: number, category: string): boolean {
  const t = getThreshold(category);
  return t !== null && count >= t;
}

/** Group strikes into per-category counts. */
export function strikeCountByCategory(
  strikes: { Category: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  strikes.forEach((s) => {
    counts[s.Category] = (counts[s.Category] || 0) + 1;
  });
  return counts;
}
