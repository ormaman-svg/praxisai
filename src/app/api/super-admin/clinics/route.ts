import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SUPER_ADMIN = "or.maman@gmail.com";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== SUPER_ADMIN) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, slug, ownerEmail } = await request.json();
  if (!name?.trim() || !ownerEmail?.trim()) {
    return Response.json({ error: "שם הקליניקה ומייל הבעלים הם שדות חובה." }, { status: 400 });
  }

  const admin = createAdminClient();
  const trimmedSlug = slug?.trim() || null;

  // Check for duplicate slug before inserting
  if (trimmedSlug) {
    const { data: existing } = await admin
      .from("clinics")
      .select("id")
      .eq("slug", trimmedSlug)
      .maybeSingle();
    if (existing) {
      return Response.json({ error: `קליניקה עם הכתובת "${trimmedSlug}" כבר קיימת — בחר כתובת אחרת.` }, { status: 409 });
    }
  }

  // Check for duplicate name
  const { data: existingName } = await admin
    .from("clinics")
    .select("id")
    .ilike("name", name.trim())
    .maybeSingle();
  if (existingName) {
    return Response.json({ error: `קליניקה בשם "${name.trim()}" כבר קיימת.` }, { status: 409 });
  }

  // Find owner by email
  const { data: users } = await admin.auth.admin.listUsers();
  const owner = users?.users?.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase());
  if (!owner) {
    return Response.json({ error: `לא נמצא משתמש עם המייל ${ownerEmail} — יש ליצור אותו קודם ב-Supabase Auth.` }, { status: 404 });
  }

  // Create clinic
  const { data: clinic, error: clinicErr } = await admin
    .from("clinics")
    .insert({ name: name.trim(), slug: trimmedSlug })
    .select("id")
    .single();

  if (clinicErr) {
    if (clinicErr.code === "23505") {
      return Response.json({ error: "קליניקה עם שם או כתובת זהים כבר קיימת." }, { status: 409 });
    }
    return Response.json({ error: clinicErr.message }, { status: 500 });
  }

  // Ensure profile exists
  await admin.from("profiles").upsert(
    { id: owner.id, full_name: owner.user_metadata?.full_name || ownerEmail },
    { onConflict: "id" }
  );

  // Add owner membership
  const { error: memberErr } = await admin.from("clinic_members").insert({
    clinic_id: clinic.id,
    user_id: owner.id,
    role: "owner",
  });

  if (memberErr) return Response.json({ error: memberErr.message }, { status: 500 });

  return Response.json({ ok: true, clinicId: clinic.id });
}
