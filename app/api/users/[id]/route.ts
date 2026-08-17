import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabaseServer";

const ROLES = ["superuser", "admin", "view-only"] as const;

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
    if (targetId === callerId && body.role !== target.role) {
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
  // auth_id), but delete both explicitly for clarity.
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
