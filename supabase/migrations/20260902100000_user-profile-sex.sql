-- Migration: add sex to user_profiles
-- Before: select count(*) from public.user_profiles;

alter table public.user_profiles
  add column if not exists sex text;

alter table public.user_profiles
  drop constraint if exists user_profiles_sex_check;

alter table public.user_profiles
  add constraint user_profiles_sex_check
  check (sex is null or sex in ('female', 'male'));

-- After: select count(*) from public.user_profiles;
