-- ============================================================
-- praxisAI — Phase 2: Auth, Multi-Tenant, Invitations, Clinical Data
-- Target: Supabase (PostgreSQL 15+)
-- Run in: SQL Editor → New query → Run
-- ============================================================

-- ---------- ENUMS ----------
do $$ begin
  create type member_role as enum ('owner','admin','therapist','receptionist');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_status as enum ('active','disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_status as enum ('pending','accepted','revoked','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type patient_status as enum ('active','discharged','on_hold');
exception when duplicate_object then null; end $$;

do $$ begin
  create type treatment_type as enum ('initial_eval','follow_up','discharge','telehealth','home_visit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type doc_type as enum ('bituach_leumi','referral','status_report','discharge_summary','insurance','sick_leave');
exception when duplicate_object then null; end $$;

do $$ begin
  create type doc_status as enum ('draft','final');
exception when duplicate_object then null; end $$;

-- ---------- TABLES ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  locale text not null default 'he',
  created_at timestamptz not null default now()
);

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null default 'therapist',
  status member_status not null default 'active',
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  email text not null,
  role member_role not null default 'therapist',
  status invitation_status not null default 'pending',
  invited_by uuid references public.profiles(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invitations_email_idx on public.invitations (lower(email)) where status = 'pending';

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  national_id text,
  dob date,
  phone text,
  email text,
  kupah text,                       -- כללית / מכבי / מאוחדת / לאומית / פרטי
  diagnosis text,
  referral_source text,
  bituach_leumi_case boolean not null default false,
  primary_therapist_id uuid references public.profiles(id),
  status patient_status not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists patients_clinic_idx on public.patients (clinic_id);

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  therapist_id uuid references public.profiles(id),
  treated_at timestamptz not null default now(),
  type treatment_type not null default 'follow_up',
  subjective text,
  objective text,
  assessment text,
  plan text,
  vas smallint check (vas between 0 and 10),
  created_at timestamptz not null default now()
);
create index if not exists treatments_patient_idx on public.treatments (patient_id, treated_at desc);
create index if not exists treatments_clinic_idx on public.treatments (clinic_id, treated_at desc);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_id uuid references public.treatments(id) on delete set null,
  kind text not null check (kind in ('ROM','VAS','strength')),
  joint text,                       -- e.g. כתף ימין
  movement text,                    -- e.g. אבדוקציה
  value numeric not null,
  unit text not null default 'deg',
  recorded_at timestamptz not null default now()
);
create index if not exists measurements_patient_idx on public.measurements (patient_id, recorded_at);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  type doc_type not null,
  title text not null,
  content text not null default '',
  status doc_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists documents_clinic_idx on public.documents (clinic_id, created_at desc);

-- ---------- HELPER FUNCTIONS (security definer → no RLS recursion) ----------

create or replace function public.is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clinic_members
    where clinic_id = cid and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.clinic_role(cid uuid)
returns member_role language sql stable security definer set search_path = public as $$
  select role from clinic_members
  where clinic_id = cid and user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.is_clinic_admin(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.clinic_role(cid) in ('owner','admin'), false);
$$;

-- ---------- NEW USER TRIGGER ----------
-- Creates profile + attaches membership when the user was created via an invitation
-- (invite metadata is set by the API route: invited_clinic_id / invited_role / full_name)

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  cid uuid;
  r member_role;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(meta->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  if meta ? 'invited_clinic_id' then
    cid := (meta->>'invited_clinic_id')::uuid;
    r   := coalesce((meta->>'invited_role')::member_role, 'therapist');
    insert into public.clinic_members (clinic_id, user_id, role, invited_by)
    values (cid, new.id, r, nullif(meta->>'invited_by','')::uuid)
    on conflict (clinic_id, user_id) do nothing;

    update public.invitations
       set status = 'accepted', accepted_at = now()
     where lower(email) = lower(new.email)
       and clinic_id = cid and status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------

alter table public.profiles       enable row level security;
alter table public.clinics        enable row level security;
alter table public.clinic_members enable row level security;
alter table public.invitations    enable row level security;
alter table public.patients       enable row level security;
alter table public.treatments     enable row level security;
alter table public.measurements   enable row level security;
alter table public.documents      enable row level security;

-- profiles: own profile + profiles of people who share a clinic with you
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from clinic_members me
    join clinic_members them on them.clinic_id = me.clinic_id
    where me.user_id = auth.uid() and them.user_id = profiles.id
  )
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- clinics
drop policy if exists clinics_select on public.clinics;
create policy clinics_select on public.clinics for select using (public.is_member(id));
drop policy if exists clinics_update on public.clinics;
create policy clinics_update on public.clinics for update using (public.is_clinic_admin(id));

-- clinic_members
drop policy if exists members_select on public.clinic_members;
create policy members_select on public.clinic_members for select using (public.is_member(clinic_id));
drop policy if exists members_write on public.clinic_members;
create policy members_write on public.clinic_members for all
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

-- invitations (admin-only)
drop policy if exists invitations_all on public.invitations;
create policy invitations_all on public.invitations for all
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

-- clinical data: every member reads; therapist+ writes; admin deletes
drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients for select using (public.is_member(clinic_id));
drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients for insert with check (public.is_member(clinic_id));
drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients for update using (public.is_member(clinic_id));
drop policy if exists patients_delete on public.patients;
create policy patients_delete on public.patients for delete using (public.is_clinic_admin(clinic_id));

drop policy if exists treatments_select on public.treatments;
create policy treatments_select on public.treatments for select using (public.is_member(clinic_id));
drop policy if exists treatments_write on public.treatments;
create policy treatments_write on public.treatments for insert with check (public.is_member(clinic_id));
drop policy if exists treatments_update on public.treatments;
create policy treatments_update on public.treatments for update using (public.is_member(clinic_id));
drop policy if exists treatments_delete on public.treatments;
create policy treatments_delete on public.treatments for delete using (public.is_clinic_admin(clinic_id));

drop policy if exists measurements_select on public.measurements;
create policy measurements_select on public.measurements for select using (public.is_member(clinic_id));
drop policy if exists measurements_write on public.measurements;
create policy measurements_write on public.measurements for insert with check (public.is_member(clinic_id));
drop policy if exists measurements_delete on public.measurements;
create policy measurements_delete on public.measurements for delete using (public.is_clinic_admin(clinic_id));

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select using (public.is_member(clinic_id));
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents for insert with check (public.is_member(clinic_id));
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update using (public.is_member(clinic_id));
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete using (public.is_clinic_admin(clinic_id));
