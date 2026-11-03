-- Runs only against the disposable local database; everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id) values
  ('ffffffff-ffff-4fff-8fff-000000000001'),
  ('ffffffff-ffff-4fff-8fff-000000000002');
insert into public.weight_entries (user_id, entry_date, weight_kg) values
  ('ffffffff-ffff-4fff-8fff-000000000001', '2026-01-01', 70);
insert into public.height_entries (user_id, effective_date, height_cm) values
  ('ffffffff-ffff-4fff-8fff-000000000001', '2026-01-01', 176),
  ('ffffffff-ffff-4fff-8fff-000000000001', '2026-01-02', 180),
  ('ffffffff-ffff-4fff-8fff-000000000002', '2026-01-03', 190);

select ok((select created_at = updated_at from public.weight_entries
  where user_id = 'ffffffff-ffff-4fff-8fff-000000000001'), 'new entry has matching server timestamps');
select ok(not has_function_privilege('anon', 'public.move_height_entry(date,date,smallint)', 'execute'), 'anonymous users cannot move heights');
select ok(has_function_privilege('authenticated', 'public.move_height_entry(date,date,smallint)', 'execute'), 'authenticated users can move heights');

select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-000000000001', true);
set local role authenticated;
update public.weight_entries set weight_kg = 71, created_at = '2099-01-01', updated_at = '2099-01-01'
  where entry_date = '2026-01-01';
select ok((select updated_at <= clock_timestamp() from public.weight_entries), 'server overrides a future phone timestamp');
select ok((select created_at = transaction_timestamp() from public.weight_entries), 'editing preserves creation time');

select throws_ok($$select public.move_height_entry('2026-01-01', '2026-01-02', 99::smallint)$$,
  '23514', null, 'invalid height move fails');
select is((select height_cm::integer from public.height_entries where effective_date = '2026-01-01'), 176, 'failed move preserves source');
select is((select height_cm::integer from public.height_entries where effective_date = '2026-01-02'), 180, 'failed move preserves target');
select lives_ok($$select public.move_height_entry('2026-01-01', '2026-01-02', 176::smallint)$$, 'valid move replaces target atomically');
select is((select count(*)::integer from public.height_entries where effective_date = '2026-01-01'), 0, 'successful move removes source');
select is((select height_cm::integer from public.height_entries where effective_date = '2026-01-02'), 176, 'successful move updates target');
select throws_ok($$select public.move_height_entry('2026-01-03', '2026-01-04', 185::smallint)$$,
  'P0002', null, 'cannot move another user height');
select is((select count(*)::integer from public.height_entries), 1, 'RLS exposes only own height');

reset role;
select is((select height_cm::integer from public.height_entries
  where user_id = 'ffffffff-ffff-4fff-8fff-000000000002'), 190, 'other user measurement is unchanged');
select * from finish();
rollback;
