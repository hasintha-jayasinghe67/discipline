// Generates backend-migration-report.pdf — an analysis of moving the app's
// backend from Supabase to a locally hosted server.
// Run: node scripts/backend-migration-report.mjs

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
  // bullet marker
  doc.setFillColor(...ACCENT);
  doc.circle(M + 1.2, y - 1.15, 0.9, "F");
  doc.setTextColor(...INK);
  const full = boldPrefix ? `${boldPrefix} — ${text}` : text;
  const lines = doc.splitTextToSize(full, CW - 6);
  if (boldPrefix) {
    doc.setFont("helvetica", "bold");
    const prefixLines = doc.splitTextToSize(`${boldPrefix} — `, CW - 6);
    doc.setFont("helvetica", "normal");
    // simpler: render whole line normal but prefix bold via two passes
    const prefixW = doc.getTextWidth(`${boldPrefix} — `);
    doc.setFont("helvetica", "bold");
    doc.text(`${boldPrefix} — `, M + 4, y);
    doc.setFont("helvetica", "normal");
    doc.text(lines[0].slice(`${boldPrefix} — `.length), M + 4 + prefixW, y);
    if (lines.length > 1) {
      doc.text(lines.slice(1), M + 4, y + 4.2);
      y += (lines.length) * 4.2;
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
    doc.text(`Prefects Discipline — Backend Migration Analysis · Page ${i} of ${pages}`, W / 2, 296, { align: "center" });
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
doc.text("Moving the Backend from Supabase", M, y + 4);
doc.text("to a Locally Hosted Server", M, y + 13);
doc.setFont("helvetica", "normal");
doc.setFontSize(10.5);
doc.setTextColor(...GRAY);
doc.text("Impact analysis, required services, trade-offs, and a recommendation", M, y + 22);
doc.setFontSize(9);
doc.text("Prefects Discipline · Discipline Management Dashboard", M, y + 29);
doc.text(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), M, y + 34);

y += 42;

callout(
  "This report examines what it would take to replace the Supabase backend (Postgres + REST API + auth) with infrastructure you run yourself, the new services you would have to operate, the trade-offs involved, and whether it is worth the effort for this application.",
  { label: "SUMMARY", color: ACCENT }
);

/* ========================================================================== */
/* 1. CURRENT ARCHITECTURE                                                    */
/* ========================================================================== */
sectionTitle("1. Current architecture");
body(
  "The app is a Next.js (App Router) client that talks directly to Supabase through the supabase-js SDK. There is no server-side API of its own — all data access happens in the browser."
);
table(
  ["Aspect", "Today"],
  [
    ["Database", "Supabase Postgres (10 tables: users, students, strikes, blackmarks, goldmarks, punishments, comments, lists, list_attendance_sessions, list_attendance_records)"],
    ["Data access", "~85 supabase-js query call sites across 12 files (pages, components, lib modules)"],
    ["Auth", "Custom: browser fetches the user row, verifies the bcrypt hash client-side, stores the user object in localStorage. Supabase Auth is NOT used."],
    ["Authorization", "Frontend-only role checks (user.role in localStorage); no RLS, no server-side enforcement"],
    ["Realtime / storage", "None used"],
    ["Configuration", "Supabase URL + anon key hardcoded in lib/supabase.ts"],
  ],
  { boldFirstCol: true }
);

/* ========================================================================== */
/* 2. FRONTEND CHANGES                                                        */
/* ========================================================================== */
sectionTitle("2. Frontend changes required");
subheading("2.1 Data access layer");
bullet("Replace the Supabase client in lib/supabase.ts with a thin API client (a fetch wrapper) pointing at your local server. If you deploy PostgREST (recommended, see §3), postgrest-js can keep the query syntax nearly identical, which minimizes churn.");
bullet("Rewire the ~85 call sites across 12 files from .from(\"table\").select()/.insert()/.update()/.delete() chains to REST calls — app/page.tsx, app/discipline/page.tsx, app/student/[admissionNo]/page.tsx, app/users/page.tsx, app/lists/**, components/DashboardDailyStats.tsx, lib/students.ts, lib/listAttendance.ts, lib/disciplineReport.ts, lib/AuthContext.tsx, components/ConfirmPasswordModal.tsx.");
bullet("Adjust error handling: supabase-js returns { data, error }; a REST API returns HTTP status codes. The ~15 alert/error paths need small rewrites.");

subheading("2.2 Authentication");
bullet("Move password verification to the server. Login becomes POST /auth/login { username, password }; the server verifies the bcrypt hash and returns a session token (JWT or httpOnly cookie).");
bullet("Store the token (plus the user object for UI role gating) instead of storing the user row directly; send the token with every request.");
bullet("Existing bcrypt hashes in users.password carry over unchanged — no password resets are needed for your users.");
bullet("The user-management screens (app/users/page.tsx) currently read/write users.password in the browser; the password column should stop being exposed to the client and be handled server-side only.");

subheading("2.3 Security posture");
bullet("Role checks are frontend-only today (a forged localStorage user object grants admin UI). Since you are doing the work anyway, enforce roles server-side (Row Level Security on Postgres, or middleware in the API) — otherwise the local backend inherits today's weakness.");
bullet("Move the hardcoded URL/anon key out of lib/supabase.ts into an env var (e.g. NEXT_PUBLIC_API_URL).");

subheading("2.4 What does NOT need to change");
bullet("No realtime subscriptions and no file storage exist — nothing to port there.");
bullet("Pages and UI logic (discipline records, lists, attendance, reports, dashboards) stay as-is; only their data-fetching plumbing changes.");

/* ========================================================================== */
/* 3. BACKEND SERVICES                                                        */
/* ========================================================================== */
sectionTitle("3. New services you would need to run");
table(
  ["Service", "Purpose", "Notes / options"],
  [
    ["PostgreSQL", "The database itself", "Postgres 15/16. Restore the existing schema + data (pg_dump from Supabase)."],
    ["API layer", "Expose tables to the app", "Recommended: PostgREST — mirrors Supabase's table API, so most queries keep working with minimal edits. Alternative: custom Node/Express/Fastify API with Prisma/Drizzle — full control, more code to maintain."],
    ["Auth service", "Login + session tokens", "bcrypt verify server-side, issue JWTs or httpOnly cookies. With PostgREST: JWT secret + RLS policies that check the token role."],
    ["Reverse proxy + TLS", "HTTPS in front of the API", "Caddy (auto Let's Encrypt) or nginx. Required if the app is hosted remotely; strongly recommended on LAN too."],
    ["Process manager", "Keep services alive", "systemd unit or pm2: start on boot, restart on crash."],
    ["Backups", "Protect the data", "Scheduled pg_dump (e.g. daily cron) + off-site copy. Supabase does this for you today."],
    ["Monitoring", "Know when it breaks", "At this scale: uptime check, disk-space cron, journald logs are enough."],
    ["Networking", "Make the server reachable", "The Next.js app must reach the API from the browser. If the frontend stays on Vercel, the local server needs a public endpoint — which largely cancels the privacy benefit and adds attack surface. True local hosting means self-hosting the Next.js app too (next start) on the same network."],
  ],
  { boldFirstCol: true }
);
callout(
  "Biggest hidden cost: operations. You now own patching, uptime, TLS, backups, and security for every one of those services. At this app's scale (a handful of tables, a few users, ~2,700 students) the running cost is small, but the responsibility is yours.",
  { color: RED, label: "WATCH OUT" }
);

/* ========================================================================== */
/* 4. MIGRATION STEPS                                                         */
/* ========================================================================== */
sectionTitle("4. High-level migration path");
const steps = [
  "Export the Supabase database (pg_dump or the Supabase dashboard backup) and restore it into local Postgres.",
  "Deploy the API layer (PostgREST or custom) + auth endpoint behind the reverse proxy, with the same table/column names.",
  "Swap the client: new API client + token handling in lib/AuthContext.tsx and the ~85 call sites.",
  "Enforce roles server-side (RLS or middleware) before cutover.",
  "Test each module: login, dashboard, records, student detail, users, lists, attendance, PDF reports.",
  "Cut over (env var or DNS). Keep Supabase read-only as a rollback path until the local stack has been stable for a week.",
];
steps.forEach((s, i) => bullet(s, { boldPrefix: `Step ${i + 1}` }));

/* ========================================================================== */
/* 5. PROS & CONS                                                             */
/* ========================================================================== */
sectionTitle("5. Pros and cons");
proConTable(
  [
    "Full data ownership — student records stay on your hardware, no third party involved.",
    "No dependence on Supabase availability, pricing changes, or vendor roadmap.",
    "Predictable cost: hardware, not per-project SaaS pricing that grows with usage.",
    "Lower latency on a school LAN.",
    "No request rate limits or fair-use caps.",
    "You can add real server-side authorization (RLS), fixing today's frontend-only role checks.",
    "Works even if the internet connection drops (fully on-prem).",
  ],
  [
    "You own operations: patching, uptime, backups, disk space, and security for the whole stack.",
    "Security is now on you — TLS, firewall, auth tokens, RLS. A misconfiguration exposes student data.",
    "You lose Supabase Studio (used today to browse/manage data and users) and managed extras (realtime, storage, edge functions) if ever needed.",
    "One-time effort: ~85 call sites, auth rework, deployment, data migration — plus ongoing maintenance (OS, Postgres, PostgREST updates).",
    "Single point of failure unless you add redundancy.",
    "If the Next.js app stays hosted remotely, the local DB must be exposed publicly — cancelling the privacy win.",
    "Future maintainers need Postgres/Linux ops knowledge.",
  ]
);

/* ========================================================================== */
/* 6. EFFORT ESTIMATE                                                         */
/* ========================================================================== */
sectionTitle("6. Effort estimate (one developer, part-time)");
table(
  ["Work item", "Estimate"],
  [
    ["Data export & import", "0.5 day"],
    ["API layer + client swap (PostgREST path)", "2–3 days"],
    ["Server-side auth + tokens", "1–2 days"],
    ["Server-side role enforcement (RLS)", "0.5–1 day"],
    ["Deployment: VM/LAN, TLS, systemd, backups", "1–2 days"],
    ["Testing every module + cutover", "1–2 days"],
    ["Total", "≈ 1–1.5 weeks"],
    ["Ongoing operations", "≈ 1–2 hours/week"],
  ],
  { boldFirstCol: true }
);

/* ========================================================================== */
/* 7. RECOMMENDATION                                                          */
/* ========================================================================== */
sectionTitle("7. Is it worth it?");
body(
  "For this application — a small, self-contained discipline tracker with 10 tables, a handful of staff users, and the free tier of Supabase — moving to a self-hosted backend is not worth it unless one of these is true:",
);
bullet("School policy or data-protection rules require student records to stay on premises (data residency).");
bullet("You want zero external dependency — no rate limits, no reliance on a third party's uptime, or the app must work with no internet.");
bullet("Cost certainty matters and you expect Supabase's usage-based pricing to grow meaningfully.");
bullet("You (or your team) are comfortable owning Linux/Postgres operations and security long-term.");
body(
  "If none of those apply today, staying on Supabase is the lower-risk, lower-effort choice: it is already running, free at this scale, and its managed Postgres, backups, and TLS are worth more than they cost you."
);
subheading("If you do move");
bullet("Use PostgREST on local Postgres rather than a custom API — it keeps the frontend diff small and the schema portable.");
bullet("Self-host the Next.js app on the same network; don't expose the local DB to the public internet.");
bullet("Add RLS / server-side role enforcement while you're in there — it fixes the current frontend-only authorization weakness.");
bullet("Set up daily pg_dump backups with an off-site copy on day one, not later.");
subheading("Cheapest middle path");
body(
  "Stay on Supabase but schedule a periodic local export (Supabase 'Download backup' or a nightly script that pulls the tables). That gives you an escape hatch — a full, restorable copy of the data — so the move stays cheap and reversible if a concrete driver appears later."
);
callout(
  "Verdict: for a school discipline tracker of this size, the trade-off leans 'stay on Supabase' unless privacy/compliance or independence is an explicit requirement. The migration is very doable (~1–1.5 weeks), but it trades a managed service for a permanent operations job. Revisit only when a concrete driver exists.",
  { label: "RECOMMENDATION", color: GREEN }
);

pageNumber();
const out = doc.output("arraybuffer");
writeFileSync("backend-migration-report.pdf", Buffer.from(out));
console.log("Wrote backend-migration-report.pdf");
