#!/usr/bin/env node
/**
 * One-off bootstrap: creates a superuser in Supabase Auth and links it to the
 * users table. Run BEFORE applying supabase-auth-migration.sql (or re-run after
 * — both are safe to repeat).
 *
 * Usage:
 *   node scripts/create-superuser.mjs <username> <password> [role]
 *   npm run create-superuser -- <username> <password> [role]
 *
 * Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the environment,
 * falling back to .env.local. The service-role key must NEVER be exposed
 * client-side — this script runs on your machine only.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually (Node does not read it for scripts).
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const AUTH_EMAIL_DOMAIN = "prefects.local";

const username = (process.argv[2] || "").trim();
const password = process.argv[3] || "";
const role = process.argv[4] || "superuser";

if (!username || !password) {
  console.error(
    "Usage: node scripts/create-superuser.mjs <username> <password> [role]"
  );
  process.exit(1);
}
if (!["superuser", "admin", "view-only"].includes(role)) {
  console.error(`Invalid role "${role}" — expected superuser, admin or view-only.`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_URL). Add the service-role " +
      "key to .env.local — it must never be exposed client-side."
  );
  process.exit(1);
}

// Mirror lib/emailMap.ts so the auth email matches the app's mapping.
const email = `${username.toLowerCase().replace(/\s+/g, "-")}@${AUTH_EMAIL_DOMAIN}`;

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// getUserByEmail is not available in this supabase-js version, so look up an
// existing auth account by paging through listUsers (max 1000/page).
async function findAuthUserByEmail(targetEmail) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) return null;
    const found = data.users.find(
      (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
    );
    if (found) return found;
    if (data.users.length < 1000) return null; // no more pages
  }
  return null;
}

// 1) Create (or update) the Supabase Auth account.
let authId;
const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createErr) {
  if (/already been registered/i.test(createErr.message)) {
    const existing = await findAuthUserByEmail(email);
    if (!existing) {
      console.error(
        `Auth account for ${email} already exists but could not be found in the user list.`,
        createErr.message
      );
      process.exit(1);
    }
    authId = existing.id;
    console.log(`Auth account already exists for ${email} (${authId}) — updating password.`);
    const { error: updErr } = await supabase.auth.admin.updateUserById(authId, {
      password,
    });
    if (updErr) {
      console.error("Failed to update auth password:", updErr.message);
      process.exit(1);
    }
  } else {
    console.error("Failed to create auth user:", createErr.message);
    process.exit(1);
  }
} else {
  authId = created.user.id;
  console.log(`Created auth account ${email} (${authId}).`);
}

// 2) Link (or create) the app-level users row.
const { data: existingRow } = await supabase
  .from("users")
  .select("id")
  .eq("username", username)
  .maybeSingle();

const failLink = (err) => {
  console.error("Failed to link users row:", err.message);
  if (/column/i.test(err.message)) {
    console.error(
      "\nThis usually means supabase-auth-migration.sql has NOT been run yet —" +
        " it adds the auth_id/email columns.\nRun it in the Supabase SQL editor" +
        " (it is idempotent), then re-run this script."
    );
  }
  process.exit(1);
};

if (existingRow) {
  const { error: updErr } = await supabase
    .from("users")
    .update({ auth_id: authId, email, role })
    .eq("id", existingRow.id);
  if (updErr) failLink(updErr);
  console.log(`Linked existing users row (id ${existingRow.id}) to the auth account.`);
} else {
  const { error: insErr } = await supabase.from("users").insert({
    username,
    auth_id: authId,
    email,
    role,
  });
  if (insErr) failLink(insErr);
  console.log(`Inserted users row for "${username}" (role: ${role}).`);
}

console.log(
  `\nDone. Sign in with username "${username}" and the chosen password.`
);
console.log(
  "Next: apply supabase-auth-migration.sql in the Supabase SQL editor if you haven't already."
);
