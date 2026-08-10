// Session-scoped registry of dismissed "Pending Black Mark" prompts.
//
// Key format: `${admissionNo}|${category}`.
// Shared across pages (dashboard, student detail, lists) so a prompt dismissed
// on one page shows the badge on the others. Deliberately in-memory only — it
// resets on reload and is never written to the database.

const pending = new Set<string>();

export function addPendingBlackmark(key: string): void {
  pending.add(key);
}

export function removePendingBlackmark(key: string): void {
  pending.delete(key);
}

export function hasPendingBlackmark(key: string): boolean {
  return pending.has(key);
}

export function hasAnyPendingForStudent(admissionNo: number): boolean {
  const prefix = `${admissionNo}|`;
  for (const key of pending) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

export function pendingBlackmarkKeys(): string[] {
  return [...pending];
}

/** Replace the whole set (used when pruning stale entries). */
export function setPendingBlackmarksAll(keys: string[]): void {
  pending.clear();
  keys.forEach((k) => pending.add(k));
}
