import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CLINIC_COOKIE } from "@/lib/clinic";

// Switch active clinic — verifies membership before setting the cookie
export async function POST(req: Request) {
  const { clinicId } = (await req.json()) as { clinicId: string };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { data: member } = await supabase
    .from("clinic_members")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!member) return NextResponse.json({ error: "אינך חבר/ה בקליניקה זו" }, { status: 403 });

  cookies().set(ACTIVE_CLINIC_COOKIE, clinicId, {
    path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true });
}
