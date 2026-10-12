-- Local development seed only (runs after schema + migrations on `supabase db reset`).
-- Sign in: local.tester@weighway.app / Test123!

create extension if not exists pgcrypto;

-- Fixed UUID so profile and entries can reference the dev user.
-- Password: Test123! (bcrypt via crypt + gen_salt).
do $$
declare
  dev_user_id uuid := 'c3d4e5f6-a7b8-4920-8abc-000000000001';
  dev_email text := 'local.tester@weighway.app';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    dev_user_id,
    'authenticated',
    'authenticated',
    dev_email,
    crypt('Test123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update
  set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    updated_at = now();

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    dev_user_id::text,
    dev_user_id,
    jsonb_build_object(
      'sub', dev_user_id::text,
      'email', dev_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update
  set
    identity_data = excluded.identity_data,
    updated_at = now();
end
$$;

insert into public.user_profiles (user_id, birth_date, sex, updated_at)
values (
  'c3d4e5f6-a7b8-4920-8abc-000000000001',
  date '1988-06-12',
  'male',
  now()
)
on conflict (user_id) do update
set
  birth_date = excluded.birth_date,
  sex = excluded.sex,
  updated_at = excluded.updated_at;

-- Height effective from the first seeded weigh-in (see weight series below).
insert into public.height_entries (user_id, effective_date, height_cm, updated_at)
values
  ('c3d4e5f6-a7b8-4920-8abc-000000000001', current_date - 1099, 181, now())
on conflict (user_id, effective_date) do update
set height_cm = excluded.height_cm, updated_at = excluded.updated_at;

-- 1100 daily weigh-ins (~3 years): slow loss with irregular day-to-day swings (not a flat clamp).
-- created_at: ~95% logged in the morning; updated_at differs on ~3% (same-day edits).
insert into public.weight_entries (user_id, entry_date, weight_kg, created_at, updated_at)
with days as (
  select
    g as day_index,
    current_date - (1099 - g) as entry_date
  from generate_series(0, 1099) as g
),
raw_weights as (
  select
    day_index,
    entry_date,
    (
      91.20
      - (12.40 * day_index::numeric / 1099.0)
      + 0.42 * sin(day_index * 0.93)
      + 0.36 * cos(day_index * 1.61)
      + 0.24 * sin(day_index * 0.17)
      + 0.18 * cos(day_index * 0.41)
      + case
        when day_index % 17 = 4 then 0.30
        when day_index % 23 = 9 then -0.50
        when day_index % 29 = 14 then 0.20
        when day_index % 37 = 21 then -0.90
        when day_index % 53 = 31 then 0.35
        when day_index % 67 = 22 then 0.55
        when day_index % 71 = 8 then -0.65
        else 0.0
      end
      + case (day_index / 30) % 5
        when 3 then 0.35
        when 4 then -0.25
        else 0.0
      end
    )::numeric as raw_kg
  from days
),
weights as (
  select
    day_index,
    entry_date,
    (round(raw_kg / 0.05) * 0.05)::numeric(6, 2) as weight_kg
  from raw_weights
),
timestamps as (
  select
    day_index,
    entry_date,
    weight_kg,
    (
      entry_date::timestamptz
      + case
        when (day_index * 37 + day_index / 11) % 100 < 95 then
          make_interval(
            hours => 6 + ((day_index * 13) % 5),
            mins => (day_index * 17) % 60,
            secs => (day_index * 23) % 60
          )
        else
          make_interval(
            hours => 12 + ((day_index * 7) % 10),
            mins => (day_index * 29) % 60,
            secs => (day_index * 31) % 60
          )
      end
    ) as created_at,
    (day_index * 41 + 13) % 100 < 3 as was_edited
  from weights
)
select
  'c3d4e5f6-a7b8-4920-8abc-000000000001'::uuid,
  entry_date,
  weight_kg,
  created_at,
  case
    when was_edited then
      created_at
      + make_interval(
        hours => 1 + ((day_index * 5) % 8),
        mins => 10 + ((day_index * 19) % 50)
      )
    else
      created_at
  end as updated_at
from timestamps
on conflict (user_id, entry_date) do update
set
  weight_kg = excluded.weight_kg,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
