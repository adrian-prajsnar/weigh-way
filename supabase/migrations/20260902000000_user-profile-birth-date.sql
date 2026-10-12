-- Migration: add birth_date to user_profiles
-- Before: select count(*) from public.user_profiles;

alter table public.user_profiles
  add column if not exists birth_date date;

-- After: select count(*) from public.user_profiles;
