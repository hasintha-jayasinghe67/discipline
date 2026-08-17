import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabaseServer";
import { isValidUsername, mapUsernameToEmail } from "@/lib/emailMap";

const ROLES = ["superuser", "admin", "view-only"] as const;

function friendlyAuthError(message: string): string {
  if (/already been registered|duplicate/i.test(message)) {
    return "Username already exists";
  }
  return message;
}

export async function POST(request: Request) {
  // Verify the caller is an authenticated superuser (server-side).
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: callerRow } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", caller.id)
    .maybeSingle();
  if (callerRow?.role !== "superuser") {
    return NextResponse.json(
      { error: "Only superusers can manage users" },
      { status: 403 }
    );
  }

  let body: { username?: string; password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  const role = body.role ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }
  if (!isValidUsername(username)) {
    return NextResponse.json(
      {
        error:
          "Username can only contain letters, numbers, dots, underscores and dashes (no spaces)",
      },
      { status: 400 }
    );
  }
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const email = mapUsernameToEmail(username);

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server misconfigured" },
      { status: 500 }
    );
  }

  // Reject usernames that would map to an existing auth email
  // (e.g. "Admin" vs "admin" both map to admin@prefects.local).
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Username already exists" },
      { status: 409 }
    );
  }

  // Create the Supabase Auth account (email_confirm: true = no confirmation
  // email, the user can sign in immediately with the chosen password).
  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (authError) {
    return NextResponse.json(
      { error: friendlyAuthError(authError.message) },
      { status: 400 }
    );
  }

  // Link the app-level users row.
  const { error: insertError } = await supabaseAdmin.from("users").insert({
    auth_id: authUser!.user.id,
    username,
    email,
    role,
  });
  if (insertError) {
    // Roll back the auth account so a half-created user is never left behind.
    await supabaseAdmin.auth.admin.deleteUser(authUser!.user.id);
    return NextResponse.json(
      {
        error: insertError.message.includes("duplicate")
          ? "Username already exists"
          : insertError.message,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
