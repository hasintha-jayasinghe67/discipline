// Generates supabase-auth-report.pdf — how the application's security changed
// after moving from custom (bcrypt/localStorage) auth to Supabase Auth, the
// pros and cons, and the potential future costs of the new implementation.
// Run: node scripts/supabase-auth-report.mjs

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { writeFileSync } from "node:fs";

const doc = new jsPDF({ unit: "mm", format: "a4" });
const W = 210;
const M = 14;
const CW = W - M * 2;
const PAGE_BOTTOM = 290;

// Palette (matches the app's Apple-inspired design system)
const ACCENT = [0, 122, 255];
const INK = [28, 28, 30];
const GRAY = [108, 108, 116];
const LIGHT = [242, 242, 247];
const GREEN = [52, 199, 89];
const RED = [255, 59, 48];

let y = 0;

function ensure(h) {
  if (y + h > PAGE_BOTTOM) {
    doc.addPage();
    y = M;
  }
}

function sectionTitle(text) {
  ensure(22);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(text, M, y);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(M, y + 1.6, M + 12, y + 1.6);
  y += 8;
  doc.setFont("helvetica", "normal");
}

function subheading(text) {
  ensure(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(text, CW);
  doc.text(lines, M, y);
  y += lines.length * 4.6 + 2;
  doc.setFont("helvetica", "normal");
}

function body(text, { size = 9.5, color = INK, gap = 4.2 } = {}) {
  ensure(10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, CW);
  doc.text(lines, M, y);
  y += lines.length * gap + 2;
}

function bullet(text, { size = 9.5, boldPrefix = null } = {}) {
  ensure(8);
  doc.setFontSize(size);
  doc.setFillColor(...ACCENT);
  doc.circle(M + 1.2, y - 1.15, 0.9, "F");
  doc.setTextColor(...INK);
  const full = boldPrefix ? `${boldPrefix} — ${text}` : text;
  const lines = doc.splitTextToSize(full, CW - 6);
  if (boldPrefix) {
    const prefixW = doc.getTextWidth(`${boldPrefix} — `);
    doc.setFont("helvetica", "bold");
    doc.text(`${boldPrefix} — `, M + 4, y);
    doc.setFont("helvetica", "normal");
    doc.text(lines[0].slice(`${boldPrefix} — `.length), M + 4 + prefixW, y);
    if (lines.length > 1) {
      doc.text(lines.slice(1), M + 4, y + 4.2);
      y += lines.length * 4.2;
    } else {
      y += 4.2;
    }
  } else {
    doc.text(lines, M + 4, y);
    y += lines.length * 4.2;
  }
}

function table(head, rows, opts = {}) {
  ensure(rows.length * 5 + 20);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [head],
    body: rows,
    theme: "striped",
    styles: { font: "helvetica", fontSize: 8.6, cellPadding: 2.2, textColor: INK, lineColor: [228, 228, 233], lineWidth: 0.15 },
    headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: "bold", fontSize: 8.8 },
    alternateRowStyles: { fillColor: [247, 248, 252] },
    columnStyles: opts.columnStyles || {},
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0 && opts.boldFirstCol) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = doc.lastAutoTable.finalY + 6;
}

function proConTable(pros, cons) {
  const rows = [];
  const n = Math.max(pros.length, cons.length);
  for (let i = 0; i < n; i++) {
    rows.push([pros[i] || "", cons[i] || ""]);
  }
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [["Pros ✅", "Cons ⚠️"]],
    body: rows,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.6, cellPadding: 2.4, textColor: INK, lineColor: [228, 228, 233], lineWidth: 0.15, valign: "top" },
    headStyles: { fillColor: [40, 110, 60], textColor: 255, fontStyle: "bold", fontSize: 9 },
    columnStyles: {
      0: { fillColor: [240, 250, 243] },
      1: { fillColor: [253, 242, 242] },
    },
  });
  y = doc.lastAutoTable.finalY + 6;
}

function callout(text, { color = ACCENT, label = null } = {}) {
  ensure(24);
  const lines = doc.splitTextToSize(text, CW - 12);
  const h = lines.length * 4.2 + (label ? 10 : 8);
  doc.setFillColor(...color);
  doc.roundedRect(M, y, 2, h, 0.8, 0.8, "F");
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M + 2, y, CW - 2, h, 1.2, 1.2, "F");
  let ty = y + (label ? 7.5 : 6);
  if (label) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...color);
    doc.text(label, M + 7, ty);
    ty += 4.6;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(lines, M + 7, ty);
  y += h + 5;
}

function pageNumber() {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Prefects Discipline — Supabase Auth Security Analysis · Page ${i} of ${pages}`, W / 2, 296, { align: "center" });
  }
  doc.setPage(pages);
}

/* ========================================================================== */
/* TITLE BLOCK                                                                */
/* ========================================================================== */
y = 26;
doc.setFillColor(...ACCENT);
doc.roundedRect(M, y - 8, 10, 2.4, 1.2, 1.2, "F");
doc.setFont("helvetica", "bold");
doc.setFontSize(22);
doc.setTextColor(...INK);
doc.text("Supabase Auth Migration", M, y + 4);
doc.text("Security Impact Analysis", M, y + 13);
doc.setFont("helvetica", "normal");
doc.setFontSize(10.5);
doc.setTextColor(...GRAY);
doc.text("How the application's security changed, the trade-offs, and future costs", M, y + 22);
doc.setFontSize(9);
doc.text("Prefects Discipline · Discipline Management Dashboard", M, y + 29);
doc.text(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), M, y + 34);

y += 42;

callout(
  "This report covers the move from the previous custom authentication (client-side bcrypt comparison, localStorage sessions, no Row-Level Security) to real Supabase Auth: email/password accounts, server-verified httpOnly-cookie sessions, server-side admin routes, and Row-Level Security on every table. It explains what got safer, what was given up, and what the new implementation is likely to cost going forward.",
  { label: "SUMMARY", color: ACCENT }
);

/* ========================================================================== */
/* 1. WHAT CHANGED                                                             */
/* ========================================================================== */
sectionTitle("1. What changed");
table(
  ["Aspect", "Before", "After"],
  [
    ["Password storage", "bcrypt hash in the users table, compared in the browser (bcryptjs)", "Managed by Supabase Auth in auth.users — hashed server-side, never seen by the browser"],
    ["Session", "Plain {id, username, role} JSON in localStorage — editable by anyone with devtools", "httpOnly cookies via @supabase/ssr; access + refresh tokens managed by Supabase"],
    ["Route protection", "Client-side redirect after hydration (a flash of the login gate)", "proxy.ts refreshes the session and redirects unauthenticated requests server-side"],
    ["Role source of truth", "localStorage user object (re-verified against the DB on mount)", "Fetched from the users table by auth_id on every session start — role changes apply immediately"],
    ["User management", "Client-side inserts/updates with the anon key; any logged-in admin could call them", "Server-side /api/users routes using the service-role key; caller verified as superuser on the server"],
    ["Destructive actions", "Password re-entered and bcrypt-compared in the browser", "Re-verified with a real signInWithPassword call against the user's account"],
    ["Row-Level Security", "None — the public anon key could read/write/delete every table", "Enabled on all 10 tables with role-aware policies (authenticated read; admin/superuser write; superuser-only user management)"],
    ["Config", "Supabase URL + anon key hardcoded in the client bundle", "Env-driven (NEXT_PUBLIC_*); service-role key server-only"],
  ],
  { boldFirstCol: true }
);

/* ========================================================================== */
/* 2. SECURITY HOLES CLOSED                                                   */
/* ========================================================================== */
sectionTitle("2. Security holes closed");
body(
  "Three issues previously flagged as critical in the project's security review are now fixed:"
);
bullet("No RLS / anon-key access. Anyone who fetched the public key from the bundle could call the Supabase REST API directly and read, write, or delete every table without logging in. RLS now denies unauthenticated access entirely, and role-aware policies restrict writes to admins and superusers.", { boldPrefix: "Closed: P0" });
bullet("Role impersonation via localStorage. Editing localStorage to role: \"admin\" granted the admin UI. Sessions are now httpOnly cookies, and the role always comes from the database for the authenticated auth_id.", { boldPrefix: "Closed: P0" });
bullet("Auth was only a UI gate. There was no server-side boundary — the login screen merely hid buttons. There is now a real access boundary: proxy.ts rejects unauthenticated page loads, API routes verify the caller server-side, and RLS enforces the same role matrix at the database.", { boldPrefix: "Closed: P0" });
bullet("Client-side bcrypt. Password hashes were shipped to and compared in the browser. Passwords are now handled entirely by Supabase Auth on the server; bcryptjs was removed from the project.", { boldPrefix: "Closed: P2" });
bullet("Hardcoded credentials in the bundle. The Supabase URL/key now come from environment variables, and the service-role key (which bypasses RLS) exists only server-side.", { boldPrefix: "Closed: P1" });
bullet("Forged issuer names on records (strikes/comments). Not fixed — record tables still store free-text issuer names. Attribution to the real logged-in user is now possible (auth.uid()) but not yet implemented.", { boldPrefix: "Not addressed: P1" });
bullet("No audit trail. Deletes are still permanent and untracked. With authenticated sessions in place, an audit_log table + triggers is now straightforward — but it has not been built yet.", { boldPrefix: "Not addressed: P1" });

/* ========================================================================== */
/* 3. PROS                                                                     */
/* ========================================================================== */
sectionTitle("3. Pros");
bullet("Sessions cannot be forged or stolen from localStorage — httpOnly cookies, token refresh and rotation handled by Supabase.");
bullet("Passwords never touch the browser or the application code; hashing, salting, and storage are managed by Supabase Auth.");
bullet("Row-Level Security is the enforcement layer the app always lacked: even a malicious client can no longer exceed its role at the database.");
bullet("Server-side admin routes mean user creation, role changes, and deletion are authorized on the server, not just hidden in the UI; self-deletion / last-superuser guards are enforced there too.");
bullet("Destructive actions (delete record, clear strikes, CSV upload) are re-verified with a real authentication call — stronger than the old browser-side bcrypt compare.");
bullet("Role changes by a superuser take effect on the affected user's next page load (role is re-fetched from the DB, not cached forever).");
bullet("Users can change their own password without a superuser; sessions stay logged in across restarts; multiple tabs stay in sync via onAuthStateChange.");
bullet("Managed infrastructure: no server to run, patch, or secure for authentication — Supabase owns that surface.");
bullet("The login page, role hierarchy (superuser > admin > view-only), and every role-gated feature behave exactly as before the migration.");

/* ========================================================================== */
/* 4. CONS                                                                     */
/* ========================================================================== */
sectionTitle("4. Cons");
bullet("Usernames are now tied to synthetic emails (username@prefects.local). No real email addresses exist, so email confirmation, 'forgot password', and email invites are not usable without switching to real emails later.");
bullet("Password policy floor: Supabase Auth always requires a password and enforces a minimum length (default 6). The previous 'any non-empty password' behavior is impossible to fully preserve.");
bullet("Usernames are immutable after creation (they define the auth email). Previously a superuser could rename a user.");
bullet("Two sources of truth — auth.users and the users table — must be kept in sync: a user is two rows, and delete/create must touch both (the code does this, but it is more state to reason about).");
bullet("RLS adds a new maintenance surface: every new table, column, or query needs a policy review; mistakes default to 'denied', which can silently break features.");
bullet("Legacy accounts could not be migrated (bcrypt hashes are one-way) — existing users had to be recreated with fresh passwords, and the app is unusable until the migration SQL has been applied.");
bullet("proxy.ts adds an authentication round-trip on every page request (session refresh/validation), a small latency cost at each navigation.");
bullet("The service-role key is now a secret that must be managed (env var in deployment, rotation discipline). Leaking it would bypass all RLS.");
bullet("Tight coupling to a third-party auth service: login availability now depends on Supabase Auth's uptime, and the project depends on @supabase/ssr staying compatible with this custom Next.js version (proxy.ts instead of middleware).");

/* ========================================================================== */
/* 5. POTENTIAL FUTURE COSTS                                                  */
/* ========================================================================== */
sectionTitle("5. Potential future costs");
table(
  ["Item", "Estimate / cost", "Notes"],
  [
    ["Supabase Auth usage", "Free at this scale", "Free tier covers 50,000 monthly active users — far beyond a school's staff. Pricing only matters if the app grows to tens of thousands of users."],
    ["RLS policy maintenance", "≈ 0.5–1 day per schema change", "Every new table/column needs policies. One-time cost each time; ongoing reviews should be part of code review."],
    ["Service-role key management", "≈ minutes per rotation", "Rotate on staff change or suspected leak; store only in server env vars, never client-side."],
    ["Moving to real emails later", "1–2 days + email provider", "Required before email confirmation / password reset / invites become possible. Supabase's built-in email is free at school volume; a custom SMTP provider is optional for better deliverability."],
    ["Password reset / confirmation flow", "0.5–1 day (once real emails exist)", "Supabase supports both out of the box — mostly configuration plus small UI additions."],
    ["Multi-factor authentication", "≈ 0.5 day config", "Supabase supports TOTP MFA; enabling it is configuration plus a small enrollment screen."],
    ["Audit trail (open P1)", "1–2 days", "audit_log table + Postgres triggers using auth.uid() — now feasible since sessions are real. Recommended next step."],
    ["Rate limiting / lockout", "≈ 0.5 day config", "Supabase offers built-in rate limiting and the option to require email confirmation before sign-in to slow brute force."],
    ["Dependency upkeep", "Occasional", "Keep @supabase/ssr and supabase-js updated; verify proxy.ts compatibility on each Next.js major upgrade."],
    ["Operational dependency", "0 (money) / small (risk)", "No self-hosted infrastructure was added — but logins depend on Supabase Auth uptime. No new ops burden."],
  ],
  { boldFirstCol: true }
);

/* ========================================================================== */
/* 6. SUMMARY                                                                  */
/* ========================================================================== */
sectionTitle("6. Summary");
body(
  "The migration converted the application's authentication from a cosmetic, client-side gate into a real security boundary. The three critical findings of the earlier security review — no RLS, forgeable localStorage sessions, and UI-only role enforcement — are closed. Passwords are now handled entirely by a managed auth service, destructive actions are re-verified with real credentials, and user management is authorized server-side."
);
body(
  "The trade-offs are modest and mostly ergonomic: synthetic emails rule out email-based flows for now, usernames are immutable, and Supabase's password floor replaces the old 'any non-empty' rule. The ongoing costs are small — policy maintenance when the schema changes, secret hygiene for the service-role key, and dependency upkeep. At this application's scale, the new implementation is cheaper to operate than the old one was to secure."
);
callout(
  "Verdict: the new authentication is a clear security improvement with low ongoing cost. Recommended next steps — in order of value — are an audit trail (now easy with real authenticated sessions), issuer attribution on records (auto-fill from the logged-in user), and configuring Supabase's rate limiting. Real email addresses are only worth switching to if staff actually need password reset or email invites.",
  { label: "RECOMMENDATION", color: GREEN }
);

pageNumber();
const out = doc.output("arraybuffer");
writeFileSync("supabase-auth-report.pdf", Buffer.from(out));
console.log("Wrote supabase-auth-report.pdf");
