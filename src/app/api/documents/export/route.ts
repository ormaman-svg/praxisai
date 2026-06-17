import { createClient } from "@/lib/supabase/server";
import { DOC_TYPE_HE } from "@/lib/types";

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const format = searchParams.get("format");

  if (!id || !["word", "pdf-html"].includes(format ?? "")) {
    return new Response("Bad Request", { status: 400 });
  }

  const { data: doc, error } = await supabase
    .from("documents")
    .select(`
      id, title, content, type, created_at, status,
      signed_by_name, signed_at, signature_data, ai_generated,
      patients(first_name, last_name),
      clinics(name)
    `)
    .eq("id", id)
    .single();

  if (error || !doc) return new Response("Not found", { status: 404 });

  // Verify caller is a member of this clinic
  const { data: clinic } = await supabase
    .from("documents")
    .select("clinic_id")
    .eq("id", id)
    .single();

  const { data: membership } = await supabase
    .from("clinic_members")
    .select("id")
    .eq("clinic_id", (clinic as any)?.clinic_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return new Response("Forbidden", { status: 403 });

  const patientName = (doc.patients as any)
    ? `${(doc.patients as any).first_name} ${(doc.patients as any).last_name}`
    : "";
  const clinicName = (doc.clinics as any)?.name ?? "";
  const docTypeHe = DOC_TYPE_HE[doc.type as string] ?? doc.type;
  const dateStr = new Date(doc.created_at).toLocaleDateString("he-IL");

  const signatureBlock = doc.signature_data
    ? `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;align-items:center;gap:24px;">
        <img src="${doc.signature_data}" style="height:56px;border:1px solid #e2e8f0;border-radius:4px;padding:4px;background:#fff;" />
        <div style="font-size:11px;color:#555;">
          <div><b>נחתם דיגיטלית</b></div>
          <div>${doc.signed_by_name ?? ""}</div>
          <div>${doc.signed_at ? new Date(doc.signed_at).toLocaleString("he-IL") : ""}</div>
        </div>
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${doc.title}</title>
<style>
  @page { margin: 2cm; }
  body {
    font-family: Arial, "Noto Sans Hebrew", sans-serif;
    font-size: 12pt;
    line-height: 1.7;
    color: #1a1a2e;
    direction: rtl;
    unicode-bidi: embed;
    margin: 0;
    padding: 0;
  }
  .header {
    border-bottom: 2px solid #2563eb;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .clinic-name { font-size: 10pt; color: #64748b; margin-bottom: 4px; }
  h1 { font-size: 17pt; margin: 0 0 4px; color: #1e293b; }
  .meta { font-size: 9.5pt; color: #64748b; margin-top: 4px; }
  .content {
    white-space: pre-wrap;
    font-size: 11.5pt;
    line-height: 1.85;
    margin-top: 20px;
  }
  .footer {
    margin-top: 40px;
    font-size: 9pt;
    color: #94a3b8;
    border-top: 1px solid #e2e8f0;
    padding-top: 10px;
  }
</style>
</head>
<body>
<div class="header">
  <div class="clinic-name">${clinicName}</div>
  <h1>${doc.title}</h1>
  <div class="meta">
    ${docTypeHe}${patientName ? ` &middot; ${patientName}` : ""} &middot; ${dateStr}
    ${doc.status === "final" ? " &middot; <b style='color:#059669'>סופי</b>" : " &middot; <span style='color:#d97706'>טיוטה</span>"}
  </div>
</div>

<div class="content">${escapeHtml(doc.content ?? "")}</div>

${signatureBlock}

<div class="footer">נוצר על ידי praxisAI &middot; ${new Date().toLocaleDateString("he-IL")}</div>
${searchParams.get("print") === "1" ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},350);});</script>` : ""}
</body>
</html>`;

  if (format === "pdf-html") {
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Word format
  const filename = encodeURIComponent((doc.title as string).replace(/[<>:"/\\|?*]/g, "_"));
  return new Response(html, {
    headers: {
      "Content-Type": "application/vnd.ms-word; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.doc"`,
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
