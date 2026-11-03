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

-- Additive migration: no existing measurements are rewritten or removed.
-- Before AND after applying, verify unchanged counts:
-- select count(*) from public.weight_entries;
-- select count(*) from public.height_entries;

create or replace function public.set_weight_entry_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists weight_entry_updated_at on public.weight_entries;
create trigger weight_entry_updated_at
before update on public.weight_entries
for each row execute function public.set_weight_entry_updated_at();

-- Security invoker retains the caller's RLS restrictions; no user id is accepted.
create or replace function public.move_height_entry(previous_date date, target_date date, target_height_cm smallint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform 1 from public.height_entries
    where user_id = auth.uid() and effective_date = previous_date for update;
  if not found then
    raise exception 'Height entry no longer exists' using errcode = 'P0002';
  end if;
  insert into public.height_entries (user_id, effective_date, height_cm, updated_at)
    values (auth.uid(), target_date, target_height_cm, now())
    on conflict (user_id, effective_date) do update
      set height_cm = excluded.height_cm, updated_at = excluded.updated_at;
  if previous_date <> target_date then
    delete from public.height_entries where user_id = auth.uid() and effective_date = previous_date;
  end if;
end;
$$;
revoke all on function public.move_height_entry(date, date, smallint) from public, anon;
grant execute on function public.move_height_entry(date, date, smallint) to authenticated;
