import { createClient } from "@/lib/supabase/server";

// GET /api/reports/referrer?patient_id=<uuid>&type=referrer|insurer|bituach_leumi&print=1
// Generates a structured outcome report for referring physicians, kupah, or Bituach Leumi.
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patient_id");
  const reportType = searchParams.get("type") ?? "referrer";

  if (!patientId) return new Response("Bad Request", { status: 400 });

  // Load patient with clinic
  const { data: patient } = await supabase
    .from("patients")
    .select("*, clinics(name)")
    .eq("id", patientId)
    .single();

  if (!patient) return new Response("Not found", { status: 404 });

  // Verify membership
  const { data: membership } = await supabase
    .from("clinic_members")
    .select("id")
    .eq("clinic_id", patient.clinic_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return new Response("Forbidden", { status: 403 });

  // Load all treatments
  const { data: treatments } = await supabase
    .from("treatments")
    .select("*, profiles:therapist_id(full_name)")
    .eq("patient_id", patientId)
    .order("treated_at", { ascending: true });

  // Load measurements
  const { data: measurements } = await supabase
    .from("measurements")
    .select("kind, joint, movement, value, unit, recorded_at, scale_label")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: true });

  // Load HEP programs
  const { data: programs } = await supabase
    .from("exercise_programs")
    .select("title, active, hep_logs(completed, pain_score, logged_at)")
    .eq("patient_id", patientId);

  const clinicName = (patient.clinics as any)?.name ?? "";
  const patientName = `${patient.first_name} ${patient.last_name}`;
  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / 3.15576e10)
    : null;

  const treatmentCount = treatments?.length ?? 0;
  const firstTx = treatments?.[0];
  const lastTx = treatments?.[treatmentCount - 1];

  const firstDate = firstTx ? new Date(firstTx.treated_at).toLocaleDateString("he-IL") : "—";
  const lastDate = lastTx ? new Date(lastTx.treated_at).toLocaleDateString("he-IL") : "—";

  // VAS trend
  const vasMeasurements = (treatments ?? []).filter((t) => t.vas !== null);
  const firstVas = vasMeasurements[0]?.vas ?? null;
  const lastVas = vasMeasurements[vasMeasurements.length - 1]?.vas ?? null;
  const vasImprovement = firstVas !== null && lastVas !== null ? firstVas - lastVas : null;

  // ROM changes: first vs last per joint/movement
  const romMap = new Map<string, { first: number; last: number; unit: string }>();
  for (const m of (measurements ?? []).filter((m) => m.kind === "ROM")) {
    const key = `${m.joint} ${m.movement}`;
    if (!romMap.has(key)) {
      romMap.set(key, { first: m.value, last: m.value, unit: m.unit ?? "°" });
    } else {
      romMap.get(key)!.last = m.value;
    }
  }

  // PROM scores
  const promScores = (measurements ?? []).filter((m) => m.kind === "PROM");

  // HEP adherence
  let hepTotal = 0, hepCompleted = 0;
  for (const p of (programs ?? [])) {
    const logs = (p.hep_logs as any[]) ?? [];
    hepTotal += logs.length;
    hepCompleted += logs.filter((l) => l.completed).length;
  }
  const adherencePct = hepTotal > 0 ? Math.round((hepCompleted / hepTotal) * 100) : null;

  // Last treatment plan/assessment
  const lastAssessment = lastTx?.assessment ??
    lastTx?.note?.sections?.find((s: any) => s.key === "assessment")?.content ?? "";
  const lastPlan = lastTx?.plan ??
    lastTx?.note?.sections?.find((s: any) => s.key === "plan")?.content ?? "";

  // Report titles
  const reportTitles: Record<string, string> = {
    referrer: "דוח תוצאות לגורם המפנה",
    insurer: "דוח תוצאות לקופת חולים",
    bituach_leumi: "דוח טיפולי לביטוח לאומי",
  };
  const reportTitle = reportTitles[reportType] ?? reportTitles.referrer;
  const reportNo = `${(patientId as string).slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  const todayStr = new Date().toLocaleDateString("he-IL");
  const therapistName = (lastTx as any)?.profiles?.full_name ?? "";

  // ROM table rows HTML
  const romRows = Array.from(romMap.entries()).map(([key, { first, last, unit }]) => {
    const diff = last - first;
    const color = diff > 0 ? "#059669" : diff < 0 ? "#dc2626" : "#64748b";
    const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "=";
    return `<tr>
      <td>${escapeHtml(key)}</td>
      <td style="text-align:center;">${first}${unit}</td>
      <td style="text-align:center;">${last}${unit}</td>
      <td style="text-align:center;color:${color};font-weight:bold;">${arrow} ${Math.abs(diff)}${unit}</td>
    </tr>`;
  }).join("");

  const promRows = promScores.map((m) =>
    `<tr>
      <td>${escapeHtml(m.scale_label ?? "PROM")}</td>
      <td>${new Date(m.recorded_at).toLocaleDateString("he-IL")}</td>
      <td style="text-align:center;">${m.value}</td>
    </tr>`
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${reportTitle}</title>
<style>
  @page { margin: 2cm; }
  body {
    font-family: Arial, "Noto Sans Hebrew", sans-serif;
    color: #1a1a2e; direction: rtl; unicode-bidi: embed;
    margin: 0; padding: 0; font-size: 11.5pt;
    line-height: 1.65;
  }
  .header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;
  }
  .clinic-name { font-size: 16pt; font-weight: bold; color: #1e293b; }
  .doc-title { font-size: 20pt; font-weight: bold; color: #7c3aed; }
  .doc-meta { font-size: 9.5pt; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 24px; }
  .section-title {
    font-size: 11pt; font-weight: bold; color: #7c3aed;
    border-bottom: 1px solid #ddd6fe; padding-bottom: 4px; margin-bottom: 12px;
    text-transform: uppercase; letter-spacing: .04em;
  }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
  .info-item .label { font-size: 9pt; color: #64748b; margin-bottom: 2px; }
  .info-item .value { font-size: 11pt; color: #1e293b; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  th {
    text-align: right; background: #f5f3ff; color: #5b21b6;
    padding: 8px 10px; font-size: 9.5pt; border-bottom: 1.5px solid #ddd6fe;
  }
  td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; }
  .kpi-row {
    display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px;
  }
  .kpi {
    flex: 1; min-width: 120px; background: #f5f3ff;
    border: 1px solid #ddd6fe; border-radius: 10px; padding: 12px 16px;
  }
  .kpi .num { font-size: 22pt; font-weight: bold; color: #5b21b6; }
  .kpi .lbl { font-size: 9pt; color: #6d28d9; margin-top: 2px; }
  .vas-pill {
    display: inline-block; padding: 3px 10px; border-radius: 99px;
    font-weight: bold; font-size: 10pt; color: #fff;
  }
  .notes { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 10.5pt; }
  .footer {
    margin-top: 40px; font-size: 9pt; color: #94a3b8;
    border-top: 1px solid #e2e8f0; padding-top: 12px;
  }
  .sig-block {
    margin-top: 32px; display: flex; justify-content: flex-end;
  }
  .sig-area {
    text-align: center; min-width: 200px;
    border-top: 1px solid #1e293b; padding-top: 8px;
    font-size: 9.5pt; color: #1e293b;
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="clinic-name">${escapeHtml(clinicName)}</div>
    <div class="doc-meta">מס׳ דוח: ${reportNo}</div>
    <div class="doc-meta">תאריך הפקה: ${todayStr}</div>
  </div>
  <div style="text-align:left">
    <div class="doc-title">${reportTitle}</div>
    ${reportType === "bituach_leumi" ? `<div class="doc-meta" style="color:#dc2626;font-weight:bold;">לשימוש ביטוח לאומי בלבד</div>` : ""}
  </div>
</div>

<!-- Patient info -->
<div class="section">
  <div class="section-title">פרטי מטופל</div>
  <div class="info-grid">
    <div class="info-item"><div class="label">שם מלא</div><div class="value">${escapeHtml(patientName)}</div></div>
    ${age !== null ? `<div class="info-item"><div class="label">גיל</div><div class="value">${age}</div></div>` : ""}
    ${patient.national_id ? `<div class="info-item"><div class="label">ת.ז.</div><div class="value" dir="ltr">${escapeHtml(patient.national_id)}</div></div>` : ""}
    ${patient.phone ? `<div class="info-item"><div class="label">טלפון</div><div class="value" dir="ltr">${escapeHtml(patient.phone)}</div></div>` : ""}
    ${patient.kupah ? `<div class="info-item"><div class="label">קופת חולים</div><div class="value">${escapeHtml(patient.kupah)}</div></div>` : ""}
    ${patient.referral_source ? `<div class="info-item"><div class="label">גורם מפנה</div><div class="value">${escapeHtml(patient.referral_source)}</div></div>` : ""}
    ${patient.diagnosis ? `<div class="info-item" style="grid-column: span 2"><div class="label">אבחנה / בעיה עיקרית</div><div class="value">${escapeHtml(patient.diagnosis)}</div></div>` : ""}
  </div>
</div>

<!-- Treatment summary KPIs -->
<div class="section">
  <div class="section-title">סיכום מהלך הטיפול</div>
  <div class="kpi-row">
    <div class="kpi">
      <div class="num">${treatmentCount}</div>
      <div class="lbl">סה״כ טיפולים</div>
    </div>
    <div class="kpi">
      <div class="num" style="font-size:14pt;">${firstDate}</div>
      <div class="lbl">תחילת טיפול</div>
    </div>
    <div class="kpi">
      <div class="num" style="font-size:14pt;">${lastDate}</div>
      <div class="lbl">טיפול אחרון</div>
    </div>
    ${vasImprovement !== null ? `
    <div class="kpi">
      <div class="num" style="color:${vasImprovement > 0 ? "#059669" : vasImprovement < 0 ? "#dc2626" : "#64748b"}">
        ${vasImprovement > 0 ? "↓" : vasImprovement < 0 ? "↑" : "="} ${Math.abs(vasImprovement)}
      </div>
      <div class="lbl">שיפור ב-VAS (${firstVas}→${lastVas})</div>
    </div>` : ""}
    ${adherencePct !== null ? `
    <div class="kpi">
      <div class="num">${adherencePct}%</div>
      <div class="lbl">ציות לתרגילי בית (${hepCompleted}/${hepTotal})</div>
    </div>` : ""}
  </div>
</div>

${romMap.size > 0 ? `
<!-- ROM changes -->
<div class="section">
  <div class="section-title">שינויי טווח תנועה (ROM)</div>
  <table>
    <thead><tr><th>פרק / תנועה</th><th style="text-align:center">ערך ראשוני</th><th style="text-align:center">ערך נוכחי</th><th style="text-align:center">שינוי</th></tr></thead>
    <tbody>${romRows}</tbody>
  </table>
</div>` : ""}

${promScores.length > 0 ? `
<!-- PROM scores -->
<div class="section">
  <div class="section-title">מדדי תוצאה (PROM)</div>
  <table>
    <thead><tr><th>מדד</th><th>תאריך</th><th style="text-align:center">ציון</th></tr></thead>
    <tbody>${promRows}</tbody>
  </table>
</div>` : ""}

${lastAssessment || lastPlan ? `
<!-- Clinical summary -->
<div class="section">
  <div class="section-title">הערכה קלינית וסיכום</div>
  ${lastAssessment ? `<div class="notes" style="margin-bottom:10px;"><strong>הערכה:</strong> ${escapeHtml(lastAssessment)}</div>` : ""}
  ${lastPlan ? `<div class="notes"><strong>תוכנית המשך:</strong> ${escapeHtml(lastPlan)}</div>` : ""}
</div>` : ""}

<!-- Therapist signature -->
<div class="sig-block">
  <div class="sig-area">
    <div style="height:48px;"></div>
    <div>${therapistName ? escapeHtml(therapistName) : "חתימת המטפל"}</div>
    <div style="font-size:8.5pt;color:#94a3b8;">תאריך: ${todayStr}</div>
  </div>
</div>

<div class="footer">
  הופק על ידי praxisAI · ${clinicName} · ${todayStr}
  ${reportType === "bituach_leumi" ? " · מסמך זה מהווה דוח רשמי לצורכי ביטוח לאומי" : ""}
</div>

${searchParams.get("print") === "1" ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},350);});</script>` : ""}
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
