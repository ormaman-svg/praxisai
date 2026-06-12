create table if not exists public.user_onboarding (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  tour_done    boolean not null default false,
  dismissed_at timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;

create policy "Users manage own onboarding"
  on public.user_onboarding
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
