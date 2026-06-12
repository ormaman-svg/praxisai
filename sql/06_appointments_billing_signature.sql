-- Appointments / calendar
create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete cascade,
  therapist_id uuid references auth.users(id) on delete set null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists appointments_clinic_time on public.appointments (clinic_id, starts_at);

alter table public.appointments enable row level security;
create policy appointments_select on public.appointments for select using (public.is_member(clinic_id));
create policy appointments_insert on public.appointments for insert with check (public.is_member(clinic_id));
create policy appointments_update on public.appointments for update using (public.is_member(clinic_id));
create policy appointments_delete on public.appointments for delete using (public.is_member(clinic_id));

-- Digital signature + AI flag on documents
alter table public.documents
  add column if not exists signature_data text,
  add column if not exists signed_by_name text,
  add column if not exists signed_at timestamptz,
  add column if not exists ai_generated boolean not null default false;

-- Billing / subscription per clinic
create table if not exists public.subscriptions (
  clinic_id   uuid primary key references public.clinics(id) on delete cascade,
  plan        text not null default 'free' check (plan in ('free','pro','clinic')),
  status      text not null default 'trial' check (status in ('trial','active','past_due','canceled')),
  seats       int not null default 1,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy subscriptions_select on public.subscriptions for select using (public.is_member(clinic_id));
