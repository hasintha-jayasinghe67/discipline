/**
 * Supabase Auth is email-based, but the app is username-based. Each username is
 * mapped to a deterministic email (`username@prefects.local`) so the login form
 * can stay exactly as it is today. This module is the single source of truth
 * for the mapping and for the username charset that keeps emails valid.
 */

/** Domain used for the Supabase Auth email derived from each username. */
export const AUTH_EMAIL_DOMAIN = "prefects.local";

/** Letters, digits, dots, underscores and dashes only (no spaces) — 1–64 chars. */
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim());
}

/** Derive the Supabase Auth email for a username. Must match user creation. */
export function mapUsernameToEmail(username: string): string {
  const normalized = username.trim().toLowerCase().replace(/\s+/g, "-");
  return `${normalized}@${AUTH_EMAIL_DOMAIN}`;
}
