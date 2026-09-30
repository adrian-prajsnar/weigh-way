# WeighWay

Your weight, your progress — a minimal mobile app for iOS and Android for logging daily body weight, with metric (kg) or imperial (lb) display and data stored in Supabase.

## Features

- Sign in / sign up (required — no access without login)
- Profile page — email, height history (effective dates), sign out, delete account
- Log one weight per day (editing the same date overwrites the previous value); metric or imperial units in Profile; BMI uses height at that date (or `"-"` if none)
- Dashboard averages: this week, last week, this month, and more
- Compare periods week/month/year or custom ranges
- Cloud database via Supabase (free tier)

## Development

```bash
npm install
# Copy .env.example to .env (macOS/Linux: cp .env.example .env; Windows: copy .env.example .env)
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npx expo start -c
```

Verify changes before committing:

```bash
npm run lint
npm run typecheck
npm test
```

Coding rules for agents and contributors: [`AGENTS.md`](AGENTS.md).

Local development uses the **same** Supabase project as production. Use a [dev test account](#safe-dev-on-production-one-project) so you don’t mix fake entries with real weigh-ins.

## Supabase setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Create a new project and wait for it to provision

### 2. Create the database tables

1. **SQL Editor** → **New query**
2. Paste and run [`supabase/schema.sql`](supabase/schema.sql) once (new projects only)

**Already have data?** Do not re-run `schema.sql` to apply changes. Add a new file under [`supabase/migrations/`](supabase/migrations/) instead — see **Database migrations** in [`AGENTS.md`](AGENTS.md). If your `weight_entries` table exists without `created_at`, run [`supabase/migrations/2026-09-01-weight-entry-created-at.sql`](supabase/migrations/2026-09-01-weight-entry-created-at.sql).

**Already set up `weight_entries`?** Run only [`supabase/migrate-height-entries.sql`](supabase/migrate-height-entries.sql) to add `height_entries` without touching existing weight policies. That file also copies legacy `height_cm` from `user_profiles` when present.

**Missing `height_entries` on an older database?** Do not re-run the full `schema.sql`. Use [`supabase/migrate-height-entries.sql`](supabase/migrate-height-entries.sql) or an additive file under [`supabase/migrations/`](supabase/migrations/).

### Troubleshooting: "permission denied for table weight_entries"

Your tables exist but API roles lack access. Run [`supabase/grants.sql`](supabase/grants.sql) in the SQL Editor (safe to run again anytime).

```sql
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on table public.weight_entries to authenticated;
grant select, insert, update, delete on table public.height_entries to authenticated;
grant select, insert, update, delete on table public.user_profiles to authenticated;
```

If `height_entries` is missing on an older database, run [`supabase/migrate-height-entries.sql`](supabase/migrate-height-entries.sql) — not the full `schema.sql`.

### 3. Enable email sign-in and confirmation

1. **Authentication** → **Providers** → **Email** → enabled
2. Turn on **Confirm email** (recommended)
3. **Authentication** → **URL Configuration**:
   - **Site URL**: `weigh-way://auth/callback`
   - **Redirect URLs** — add both:
     - `weigh-way://auth/callback`
     - `exp://127.0.0.1:8081/--/auth/callback` (Expo Go on your PC; adjust port if Expo uses another)

Supabase sends confirmation and password-reset emails on the free tier (built-in mailer). For better delivery later, you can add custom SMTP under **Authentication** → **SMTP**.

### 4. Add API keys to `.env`

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Get these from **Project Settings** → **API**.

Restart Expo: `npx expo start -c`

### 5. Create your account

1. Open the app → **Create account**
2. Check your email and tap **Confirm your mail**
3. Return to the app → **Sign in**

**Password reset:** Login → **Forgot password?** → open the email link on your phone → set a new password in the app.

All weight data is stored in Supabase only.

## Safe dev on production (one project)

On the free tier you typically have **one** live Supabase project shared by local dev and friends’ APKs. You can’t isolate the database without a second project, Pro branching, or local Supabase — but you **can** isolate **your** app usage with a dedicated dev account.

### Setup once

1. In the app (Expo Go or dev build), **Create account** with a clearly dev-only email, e.g. `you+dev@yourmail.com`.
2. Confirm the email and sign in. Use this account only when developing on your PC.
3. Keep your **personal / real** account for daily use on the production APK on your phone.
4. `.env` uses the same `EXPO_PUBLIC_SUPABASE_*` keys as production — that is expected.

### What this protects

- **Dev-only sign-in** — in development (`npx expo start`, Expo Go, web dev), only emails containing `+dev` can sign in or stay signed in (e.g. `you+dev@gmail.com`). Set `EXPO_PUBLIC_DEV=false` in `.env` to use any email locally. Production APKs are not affected.
- **Row-level security** — each user only sees their own weight, height, and profile. Your dev account cannot read friends’ rows through the app.
- **Fake data** — log test weights on the dev account; friends’ entries stay untouched.

### What this does *not* protect

- **SQL migrations** — anything you run in Supabase SQL Editor affects the **whole** project (all users). Always use additive migration files; see [Production safety checklist](#production-safety-checklist).
- **Breaking schema** — a bad migration breaks the app for everyone until you fix it.

### Day-to-day habits

| When | Sign in as |
|------|------------|
| `npx expo start` on your PC | Dev test account |
| Production APK on your phone | Your real account |
| Testing a migration | Run SQL in dashboard first; verify with `select count(*)` on affected tables |

Before running SQL in the dashboard, pause and confirm you’re on the right project in the browser tab.

### If you outgrow this

- **Second Supabase project** — pause an unused project to free a slot, then point `.env` at dev and keep prod for APKs.
- **Local Supabase** — Docker + `supabase start` for a fully isolated DB on your PC.
- **Supabase branches** — requires Pro.

## Production safety checklist

This app is used on a live Supabase project with real user data. Follow this before and after any database or release change.

### Backups (code and data)

- [ ] **Code:** commit and push to GitHub so migrations and app changes are saved.
- [ ] **Database:** Supabase keeps daily backups (Dashboard → **Database** → **Backups**). Before a risky migration, export a CSV from SQL Editor or note row counts:
  ```sql
  select count(*) from public.weight_entries;
  select count(*) from public.height_entries;
  select count(*) from public.user_profiles;
  ```

### Database changes (live project with data)

- [ ] **Do not** re-run [`supabase/schema.sql`](supabase/schema.sql) to apply changes — it is for **new projects only**.
- [ ] Copy [`supabase/migration-template.sql`](supabase/migration-template.sql) to `supabase/migrations/YYYY-MM-DD-short-description.sql`.
- [ ] Keep the migration **additive** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, copy-then-alter). No `DROP TABLE`, `TRUNCATE`, or unscoped `DELETE` on data tables.
- [ ] Run the migration in Supabase **SQL Editor** on production **before** (or with) the app update that needs it.
- [ ] Verify row counts unchanged (unless the migration intentionally adds rows).
- [ ] Update [`supabase/schema.sql`](supabase/schema.sql) so new projects match production.
- [ ] Commit the migration file to git.

Full migration rules: [`AGENTS.md`](AGENTS.md) → Database migrations.

### App release

- [ ] `npm run lint`, `npm run typecheck`, and `npm test` pass.
- [ ] `npx expo-doctor` passes (especially after dependency or Expo config changes).
- [ ] Test app changes signed in as your **dev test account** (see [Safe dev on production](#safe-dev-on-production-one-project)), not friends’ data.
- [ ] Migration already applied if the build reads new columns or tables.
- [ ] After `eas env:push`, confirm `EXPO_PUBLIC_SUPABASE_*` still point at the **intended** project (local dev and production APK share the same DB today).

### Never do on production

- Re-run `schema.sql` instead of adding a migration.
- Run ad-hoc destructive SQL without a reviewed migration file.
- Ship an APK that expects columns/tables that do not exist yet.
- Commit `.env` or put the Supabase **service_role** key in the app (only the anon key belongs in the client).

### Safe to re-run anytime

- [`supabase/grants.sql`](supabase/grants.sql) — fixes permission errors, does not delete data.
- `DROP POLICY IF EXISTS` + `CREATE POLICY` in a migration — changes permissions only, not rows.

## Build APK

Cloud build (download link on your phone):

```bash
npx eas-cli login
npx eas-cli env:push --environment production --path .env
npx eas-cli build -p android --profile production
```

`env:push` uploads `EXPO_PUBLIC_*` values from your local `.env` to EAS so the APK can reach Supabase. The build fails early if they are missing.

Local build on your PC (copy the APK to your phone):

```bash
npx eas-cli build -p android --profile production --local
```

Before friends sign up, confirm Supabase **Authentication → URL Configuration** includes `weigh-way://auth/callback`.

## Build iOS IPA (free Apple ID + SideStore)

No paid Apple Developer account required. GitHub Actions builds an **unsigned** IPA on a cloud Mac; SideStore re-signs it with your free Apple ID on your iPhone.

### One-time setup

1. Push this repo to GitHub (if it is not there already).
2. In the repo: **Settings → Secrets and variables → Actions → New repository secret**
   - `EXPO_PUBLIC_SUPABASE_URL` — same value as in your local `.env`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same value as in your local `.env`

### Build

1. GitHub repo → **Actions** → **Build iOS IPA** → **Run workflow**.
2. Wait for the job to finish (~15–25 min on first run).
3. Open the completed run → **Artifacts** → download `weigh-way-ios` (contains `weigh-way.ipa`).

### Install with SideStore

1. Transfer `weigh-way.ipa` to your iPhone (AirDrop, iCloud Drive, or Safari).
2. SideStore → **My Apps** → **+** → select the IPA.
3. If prompted: **Settings → General → VPN & Device Management** → trust the profile.
4. Refresh in SideStore about every **7 days** (free Apple ID limit).

Supabase **Authentication → URL Configuration** must include `weigh-way://auth/callback` (same as Android).

## Marketing site

The public site lives in [`website/`](website/) and deploys to GitHub Pages on every push to `main`:

`https://adrian-prajsnar.github.io/weigh-way/`

Local preview:

```bash
cd website
npm install
npm run dev
```

The dev server is at `http://localhost:4321/weigh-way/`. English is `/`, Polish is `/pl/`. Appearance and language follow **System / Light / Dark** and **System / English / Polski**, same idea as Profile in the app.

### Release notes and app downloads

English and Polish notes come from semantic-release (`CHANGELOG.md`): internal changes (`ci`, `dev`, `website`, `expo`, etc.) are filtered out, then **Google Gemini** (free tier via [Google AI Studio](https://aistudio.google.com/apikey)) writes customer-facing release notes in both languages. CI writes `website/content/releases/{version}.en.md` and `{version}.pl.md`. If Gemini fails, the release fails. Existing `.en.md` or `.pl.md` files are never overwritten (edit them to fix wording).

After a version bump, CI builds both mobile artifacts and uploads them to the GitHub Release:

- **Android** — `weigh-way.apk` (EAS cloud build)
- **iOS** — `weigh-way.ipa` (unsigned build on macOS; install with SideStore)

Latest downloads:

`https://github.com/adrian-prajsnar/weigh-way/releases/latest/download/weigh-way.apk`

`https://github.com/adrian-prajsnar/weigh-way/releases/latest/download/weigh-way.ipa`

Website-only commits still deploy the site; they do not start mobile builds.

### One-time GitHub setup

1. Repo **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions** — add:
   - `EXPO_TOKEN` — Expo access token for EAS cloud builds
   - `EXPO_PUBLIC_SUPABASE_URL` — same value as in your local `.env` (required for automated IPA builds)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same value as in your local `.env` (required for automated IPA builds)
   - `GEMINI_API_KEY` — free Google AI Studio key (English and Polish release notes)

EAS Free includes 15 Android builds per month. Two production releases a week fits; unused quota does not roll over.

## Privacy

- Each user only sees their own entries (Supabase row-level security)
- Friends or others need their own accounts — data is never shared
- Never commit `.env` to git
