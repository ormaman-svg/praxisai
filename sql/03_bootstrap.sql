-- ============================================================
-- praxisAI — Bootstrap: הקליניקה הראשונה + האדמין הראשון
-- 1) הירשם פעם אחת דרך Supabase Dashboard → Authentication → Add user
--    (או דרך מסך ההזמנות אחרי שיש לך אדמין)
-- 2) החלף את המייל למטה והרץ
-- ============================================================

do $$
declare
  v_user uuid;
  v_clinic uuid;
begin
  select id into v_user from auth.users where lower(email) = lower('YOUR_EMAIL@example.com');
  if v_user is null then
    raise exception 'User not found — create the user first in Authentication → Users';
  end if;

  insert into public.clinics (name, slug)
  values ('הקליניקה שלי', 'main')
  returning id into v_clinic;

  insert into public.profiles (id, full_name)
  values (v_user, 'מנהל המערכת')
  on conflict (id) do nothing;

  insert into public.clinic_members (clinic_id, user_id, role)
  values (v_clinic, v_user, 'owner')
  on conflict (clinic_id, user_id) do update set role = 'owner', status = 'active';
end $$;
