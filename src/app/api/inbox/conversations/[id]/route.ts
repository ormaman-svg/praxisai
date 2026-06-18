// Delete a conversation (and its messages, via ON DELETE CASCADE) from the inbox.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!m) return Response.json({ error: "אין הרשאה" }, { status: 403 });
    clinicId = m.clinic_id;
  }

  const admin = createAdminClient();

  // Verify the conversation belongs to this clinic before deleting
  const { data: conv } = await admin
    .from("conversations")
    .select("id, clinic_id")
    .eq("id", params.id)
    .eq("clinic_id", clinicId)
    .single();
  if (!conv) return Response.json({ error: "שיחה לא נמצאה." }, { status: 404 });

  const { error } = await admin.from("conversations").delete().eq("id", params.id);
  if (error) return Response.json({ error: "מחיקה נכשלה." }, { status: 500 });

  return Response.json({ ok: true });
}
