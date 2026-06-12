-- Add JSONB note snapshot and template_id to treatments
alter table public.treatments
  add column if not exists note jsonb,
  add column if not exists template_id text;
