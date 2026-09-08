import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabaseServer";
import { validatePassword } from "@/lib/passwordPolicy";

const ROLES = ["superuser", "admin", "room", "view-only"] as const;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Authenticates the caller and returns { supabase, callerId, supabaseAdmin }
 * or a JSON error response when the caller is not a superuser.
 */
async function getSuperuserContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const { data: callerRow } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", caller.id)
    .maybeSingle();
  if (callerRow?.role !== "superuser") {
    return {
      error: NextResponse.json(
        { error: "Only superusers can manage users" },
        { status: 403 }
      ),
    };
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (err) {
    return {
      error: NextResponse.json(
        { error: err instanceof Error ? err.message : "Server misconfigured" },
        { status: 500 }
      ),
    };
  }

  return { supabase, callerId: callerRow.id, supabaseAdmin };
}

/** Fetch the target user row (bypasses RLS via the admin client). */
async function getTargetUser(supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>, id: number) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, auth_id, username, role")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: number; auth_id: string; username: string; role: string };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const ctx = await getSuperuserContext();
  if ("error" in ctx) return ctx.error;
  const { callerId, supabaseAdmin } = ctx;

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const target = await getTargetUser(supabaseAdmin, targetId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: { role?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Username is immutable — only role and password can change.
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role as (typeof ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    // Self-demotion lock: a superuser can never change their own role
    // (prevents removing the last superuser by demoting themselves).
    if (targetId === callerId) {
      return NextResponse.json(
        { error: "You cannot change your own role." },
        { status: 400 }
      );
    }
    if (target.role === "superuser" && body.role !== "superuser") {
      const { data: superusers } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("role", "superuser")
        .neq("id", targetId);
      if (!superusers || superusers.length === 0) {
        return NextResponse.json(
          { error: "At least one superuser must remain in the system." },
          { status: 400 }
        );
      }
    }
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ role: body.role })
      .eq("id", targetId);
    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update user: " + updateError.message },
        { status: 500 }
      );
    }
  }

  if (body.password !== undefined && body.password !== "") {
    // Enforce the password policy server-side — never trust the client.
    const passwordError = validatePassword(body.password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }
    const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(
      target.auth_id,
      { password: body.password }
    );
    if (pwdError) {
      return NextResponse.json(
        { error: pwdError.message },
        { status: 400 }
      );
    }
    // Force-sign-out: without this, a stolen session keeps working after the
    // password reset. updateUserById changes the credentials but does not
    // revoke the target's existing refresh tokens.
    await supabaseAdmin.auth.admin.signOut(target.auth_id, "global");
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const ctx = await getSuperuserContext();
  if ("error" in ctx) return ctx.error;
  const { callerId, supabaseAdmin } = ctx;

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const target = await getTargetUser(supabaseAdmin, targetId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetId === callerId) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }
  if (target.role === "superuser") {
    const { data: superusers } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("role", "superuser")
      .neq("id", targetId);
    if (!superusers || superusers.length === 0) {
      return NextResponse.json(
        { error: "At least one superuser must remain in the system." },
        { status: 400 }
      );
    }
  }

  // Deleting the auth account cascades to the users row (ON DELETE CASCADE on
  // auth_id), but delete both explicitly for clarity. deleteUser also revokes
  // the target's refresh tokens, killing any active session immediately.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
    target.auth_id
  );
  if (authError) {
    return NextResponse.json(
      { error: "Failed to delete user: " + authError.message },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("users").delete().eq("id", targetId);

  return NextResponse.json({ ok: true });
}
