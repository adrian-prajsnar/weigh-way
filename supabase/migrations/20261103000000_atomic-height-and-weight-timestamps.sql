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
