import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/super-admins";
import type { MemberRole, MemberStatus } from "@/lib/types";

async function requireAdmin(clinicId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (isSuperAdminEmail(user.email)) return user;
  const { data: member } = await supabase
    .from("clinic_members")
    .select("role")
    .eq("clinic_id", clinicId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!member || !["owner", "admin"].includes(member.role)) return null;
  return user;
}

// Update a member's role or status. Runs with the admin client so clinic
// managers (and the super admin) aren't blocked by RLS.
export async function PATCH(req: Request) {
  const { memberId, clinicId, role, status } = (await req.json()) as {
    memberId: string; clinicId: string; role?: MemberRole; status?: MemberStatus;
  };
  if (!memberId || !clinicId) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  const actor = await requireAdmin(clinicId);
  if (!actor) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminClient();

  // Never allow editing the clinic owner's row through here.
  const { data: target } = await admin
    .from("clinic_members").select("role").eq("id", memberId).eq("clinic_id", clinicId).single();
  if (!target) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "לא ניתן לשנות את בעל הקליניקה" }, { status: 403 });

  const patch: Record<string, unknown> = {};
  if (role) patch.role = role;
  if (status) patch.status = status;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "אין מה לעדכן" }, { status: 400 });

  const { error } = await admin.from("clinic_members").update(patch).eq("id", memberId).eq("clinic_id", clinicId);
  if (error) return NextResponse.json({ error: "העדכון נכשל" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Remove a member from the clinic entirely.
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  const clinicId = searchParams.get("clinicId");
  if (!memberId || !clinicId) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  const actor = await requireAdmin(clinicId);
  if (!actor) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("clinic_members").select("role, user_id").eq("id", memberId).eq("clinic_id", clinicId).single();
  if (!target) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "לא ניתן להסיר את בעל הקליניקה" }, { status: 403 });
  if (target.user_id === actor.id) return NextResponse.json({ error: "לא ניתן להסיר את עצמך" }, { status: 403 });

  const { error } = await admin.from("clinic_members").delete().eq("id", memberId).eq("clinic_id", clinicId);
  if (error) return NextResponse.json({ error: "המחיקה נכשלה" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
