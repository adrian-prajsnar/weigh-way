-- NEW Supabase projects only — run once in SQL Editor to bootstrap tables.
-- Local Supabase CLI also applies this via migrations/20260801000000_bootstrap.sql — keep both in sync.
-- Do NOT re-run on production to apply schema changes (use supabase/migrations/ instead).
-- Safe to re-run only on an empty project: IF NOT EXISTS tables; policies are dropped and recreated.
-- See AGENTS.md → Database migrations.

grant usage on schema public to authenticated, anon;

create table if not exists public.weight_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  weight_kg numeric(6, 2) not null check (weight_kg >= 20 and weight_kg <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_date)
);

alter table public.weight_entries enable row level security;

drop policy if exists "weight_entries_select_own" on public.weight_entries;
drop policy if exists "weight_entries_insert_own" on public.weight_entries;
drop policy if exists "weight_entries_update_own" on public.weight_entries;
drop policy if exists "weight_entries_delete_own" on public.weight_entries;

create policy "weight_entries_select_own"
  on public.weight_entries
  for select
  using (auth.uid() = user_id);

create policy "weight_entries_insert_own"
  on public.weight_entries
  for insert
  with check (auth.uid() = user_id);

create policy "weight_entries_update_own"
  on public.weight_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "weight_entries_delete_own"
  on public.weight_entries
  for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.weight_entries to authenticated;
grant select, insert, update, delete on table public.weight_entries to service_role;

create table if not exists public.height_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_date date not null,
  height_cm smallint not null check (height_cm >= 100 and height_cm <= 250),
  updated_at timestamptz not null default now(),
  primary key (user_id, effective_date)
);

alter table public.height_entries enable row level security;

drop policy if exists "height_entries_select_own" on public.height_entries;
drop policy if exists "height_entries_insert_own" on public.height_entries;
drop policy if exists "height_entries_update_own" on public.height_entries;
drop policy if exists "height_entries_delete_own" on public.height_entries;

create policy "height_entries_select_own"
  on public.height_entries
  for select
  using (auth.uid() = user_id);

create policy "height_entries_insert_own"
  on public.height_entries
  for insert
  with check (auth.uid() = user_id);

create policy "height_entries_update_own"
  on public.height_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "height_entries_delete_own"
  on public.height_entries
  for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.height_entries to authenticated;
grant select, insert, update, delete on table public.height_entries to service_role;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;

-- Optional profile table (legacy height_cm removed; use height_entries).
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  birth_date date,
  sex text check (sex is null or sex in ('female', 'male')),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;
drop policy if exists "user_profiles_delete_own" on public.user_profiles;

create policy "user_profiles_select_own"
  on public.user_profiles
  for select
  using (auth.uid() = user_id);

create policy "user_profiles_insert_own"
  on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "user_profiles_update_own"
  on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_profiles_delete_own"
  on public.user_profiles
  for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.user_profiles to authenticated;
grant select, insert, update, delete on table public.user_profiles to service_role;
