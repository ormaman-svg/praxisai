-- Migration 08: PROM kind support, AI co-pilot insights, outcome reports
-- Run after 07_whatsapp_hep_billing.sql

-- Extend measurements.kind constraint to include PROM and functional scores
ALTER TABLE measurements
  DROP CONSTRAINT IF EXISTS measurements_kind_check;

ALTER TABLE measurements
  ADD CONSTRAINT measurements_kind_check
  CHECK (kind IN ('ROM', 'VAS', 'strength', 'PROM', 'functional', 'other'));

-- Add optional display label for the scale used (e.g. "NDI", "DASH", "PSS")
ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS scale_label text;

-- Add description to program_items (was queried but didn't exist in schema)
ALTER TABLE program_items
  ADD COLUMN IF NOT EXISTS description text;

-- ── Outcome reports (for referring doctor / kupah / Bituach Leumi) ────────────
CREATE TABLE IF NOT EXISTS outcome_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  report_type   text NOT NULL DEFAULT 'referrer', -- 'referrer' | 'insurer' | 'bituach_leumi'
  referrer_name text,
  generated_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content_html  text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outcome_reports_patient_idx ON outcome_reports(patient_id, created_at DESC);

ALTER TABLE outcome_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic members can manage outcome reports" ON outcome_reports;
CREATE POLICY "clinic members can manage outcome reports"
  ON outcome_reports FOR ALL
  USING (EXISTS (
    SELECT 1 FROM clinic_members cm
    WHERE cm.clinic_id = outcome_reports.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
  ));

-- ── AI co-pilot insights cache ────────────────────────────────────────────────
-- Invalidated when treatment_count changes (new treatment added)
CREATE TABLE IF NOT EXISTS copilot_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_count int NOT NULL DEFAULT 0,
  flags           jsonb, -- [{type, severity, message_he}]
  suggestions     jsonb, -- [{title_he, body_he, evidence_level}]
  generated_at    timestamptz DEFAULT now(),
  UNIQUE (patient_id)
);

ALTER TABLE copilot_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic members can access copilot insights" ON copilot_insights;
CREATE POLICY "clinic members can access copilot insights"
  ON copilot_insights FOR ALL
  USING (EXISTS (
    SELECT 1 FROM clinic_members cm
    WHERE cm.clinic_id = copilot_insights.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
  ));
