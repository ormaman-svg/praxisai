import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_onboarding")
    .select("tour_done, dismissed_at")
    .eq("user_id", user.id)
    .single();

  return Response.json(data ?? { tour_done: false, dismissed_at: null });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const patch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  if (typeof body.tour_done === "boolean") patch.tour_done = body.tour_done;
  if ("dismissed_at" in body) patch.dismissed_at = body.dismissed_at;

  const { error } = await supabase
    .from("user_onboarding")
    .upsert(patch, { onConflict: "user_id" });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
