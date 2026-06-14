-- Migration 07: WhatsApp patient assistant, HEP, patient invoices
-- Run after 06_appointments_billing_signature.sql

-- ── Patient opt-in/opt-out per channel ──────────────────────────────────────

create table if not exists patient_consents (
  patient_id   uuid not null references patients(id) on delete cascade,
  channel      text not null,              -- 'whatsapp' | 'sms' | 'email'
  opted_in     boolean not null default false,
  source       text,                       -- 'manual' | 'reply_start' | 'reply_stop' | 'form'
  consented_at timestamptz,
  updated_at   timestamptz default now(),
  primary key (patient_id, channel)
);

alter table patient_consents enable row level security;
create policy "clinic members can manage consents"
  on patient_consents for all
  using (exists (
    select 1 from patients p
    join clinic_members cm on cm.clinic_id = p.clinic_id
    where p.id = patient_consents.patient_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ));

-- ── Unified conversation inbox ───────────────────────────────────────────────

create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid references patients(id) on delete set null,
  channel         text not null default 'whatsapp',
  wa_contact      text,                   -- phone E.164 of the remote party
  status          text not null default 'bot',  -- 'bot' | 'human' | 'closed'
  assigned_to     uuid references profiles(id) on delete set null,
  last_message_at timestamptz,
  created_at      timestamptz default now()
);
create index on conversations(clinic_id, last_message_at desc);

alter table conversations enable row level security;
create policy "clinic members can access conversations"
  on conversations for all
  using (exists (
    select 1 from clinic_members cm
    where cm.clinic_id = conversations.clinic_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ));

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction       text not null,           -- 'inbound' | 'outbound'
  body            text,
  template_key    text,                    -- e.g. 'reminder_24h'
  wa_message_id   text unique,             -- 360dialog id; used for dedup + status updates
  status          text not null default 'queued',  -- queued/sent/delivered/read/failed
  sent_at         timestamptz,
  created_at      timestamptz default now()
);
create index on messages(conversation_id, created_at);

alter table messages enable row level security;
create policy "clinic members can access messages"
  on messages for all
  using (exists (
    select 1 from conversations c
    join clinic_members cm on cm.clinic_id = c.clinic_id
    where c.id = messages.conversation_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ));

-- ── Outbound message scheduler queue ────────────────────────────────────────

create table if not exists scheduled_messages (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  appointment_id  uuid references appointments(id) on delete cascade,
  channel         text not null default 'whatsapp',
  template_key    text not null,
  template_vars   jsonb,
  scheduled_for   timestamptz not null,
  status          text not null default 'pending',  -- pending/sent/failed/cancelled
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz default now()
);
create index on scheduled_messages(status, scheduled_for);
create index on scheduled_messages(appointment_id);

alter table scheduled_messages enable row level security;
create policy "clinic members can manage scheduled messages"
  on scheduled_messages for all
  using (exists (
    select 1 from clinic_members cm
    where cm.clinic_id = scheduled_messages.clinic_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ));

-- ── Home Exercise Programs (HEP) ─────────────────────────────────────────────

create table if not exists exercise_programs (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references clinics(id) on delete cascade,
  patient_id   uuid not null references patients(id) on delete cascade,
  treatment_id uuid references treatments(id) on delete set null,
  title        text not null,
  instructions text,
  active       boolean not null default true,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz default now()
);
create index on exercise_programs(patient_id);

alter table exercise_programs enable row level security;
create policy "clinic members can manage exercise programs"
  on exercise_programs for all
  using (exists (
    select 1 from clinic_members cm
    where cm.clinic_id = exercise_programs.clinic_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ));

create table if not exists program_items (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references exercise_programs(id) on delete cascade,
  name        text not null,
  sets        int,
  reps        int,
  hold_sec    int,
  frequency   text,                        -- 'daily' | '2x_daily' | 'alternate_days'
  video_url   text,
  sort_order  int not null default 0
);

alter table program_items enable row level security;
create policy "clinic members can manage program items"
  on program_items for all
  using (exists (
    select 1 from exercise_programs ep
    join clinic_members cm on cm.clinic_id = ep.clinic_id
    where ep.id = program_items.program_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ));

create table if not exists hep_logs (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references exercise_programs(id) on delete cascade,
  patient_id  uuid not null references patients(id) on delete cascade,
  logged_via  text not null default 'whatsapp',   -- 'whatsapp' | 'app'
  completed   boolean not null default true,
  pain_score  smallint check (pain_score between 0 and 10),
  notes       text,
  logged_at   timestamptz not null default now()
);
create index on hep_logs(patient_id, logged_at desc);
create index on hep_logs(program_id, logged_at desc);

alter table hep_logs enable row level security;
create policy "clinic members can view hep logs"
  on hep_logs for all
  using (exists (
    select 1 from exercise_programs ep
    join clinic_members cm on cm.clinic_id = ep.clinic_id
    where ep.id = hep_logs.program_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ));

-- ── Patient Invoices (clinic→patient billing) ────────────────────────────────
-- Separate from subscriptions (which is SaaS billing clinic→PraxisAI)

create table if not exists patient_invoices (
  id                   uuid primary key default gen_random_uuid(),
  clinic_id            uuid not null references clinics(id) on delete cascade,
  patient_id           uuid not null references patients(id) on delete cascade,
  appointment_id       uuid references appointments(id) on delete set null,
  amount_ils           numeric(10,2) not null check (amount_ils > 0),
  description          text,
  status               text not null default 'pending',  -- pending/paid/cancelled
  stripe_payment_link  text,
  stripe_session_id    text,
  paid_at              timestamptz,
  created_by           uuid references profiles(id) on delete set null,
  created_at           timestamptz default now()
);
create index on patient_invoices(patient_id, created_at desc);
create index on patient_invoices(clinic_id, status);

alter table patient_invoices enable row level security;
create policy "clinic members can manage patient invoices"
  on patient_invoices for all
  using (exists (
    select 1 from clinic_members cm
    where cm.clinic_id = patient_invoices.clinic_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ));
