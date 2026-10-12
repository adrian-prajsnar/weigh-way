-- Migration: add created_at to weight_entries
-- Copy this file to supabase/migrations/ before editing.
--
-- Before:
--   select count(*) from public.weight_entries;
-- After: same count; every row has created_at (copied from updated_at when missing).

alter table public.weight_entries
  add column if not exists created_at timestamptz;

update public.weight_entries
set created_at = updated_at
where created_at is null;

alter table public.weight_entries
  alter column created_at set default now();

alter table public.weight_entries
  alter column created_at set not null;
