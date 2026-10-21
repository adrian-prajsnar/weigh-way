# WeighWay

Your weight, your progress — a minimal mobile app for iOS and Android for logging daily body weight, with metric (kg) or imperial (lb) display and data stored in Supabase.

## Features

- Sign in / sign up (required — no access without login)
- Profile page — email, height history (effective dates), export weigh-ins (JSON + CSV on device), sign out, delete account
- Log one weight per day (editing the same date overwrites the previous value); metric or imperial units in Profile; BMI uses height at that date (or `"-"` if none)
- Dashboard averages: this week, last week, this month, and more
- Compare periods week/month/year or custom ranges
- Cloud database via Supabase (free tier)

## Development

### Local database (recommended)

Local Expo dev uses **Supabase CLI on Docker**, not the live cloud project.

```bash
npm install
# Copy .env.example to .env (macOS/Linux: cp .env.example .env; Windows: copy .env.example .env)
cp .env.example .env
# Defaults in .env.example point at http://127.0.0.1:54341 and the well-known local anon JWT.

npm run db:start          # or: npx supabase start  (requires Docker)
npm run db:reset          # optional: re-apply schema + migrations + seed

npx expo start -c
```

Sign in with the seeded local account:

| Field | Value |
|-------|--------|
| Email | `local.tester@weighway.app` |
| Password | `Test123!` |

What `supabase db reset` does locally:

1. Applies [`supabase/schema.sql`](supabase/schema.sql) (bootstrap for an empty DB)
2. Runs additive files in [`supabase/migrations/`](supabase/migrations/)
3. Runs [`supabase/seed.sql`](supabase/seed.sql)

Test schema changes on this local database first, then apply the same migration file on production (see [Production safety checklist](#production-safety-checklist)).

### Production APK / IPA

Release builds use **EAS production environment variables** (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) pointing at the **live** Supabase project. Do **not** run `eas env:push` from a `.env` that still contains the local CLI URL.

Verify changes before committing:

```bash
npm run lint
npm run typecheck
npm test
```

Coding rules for agents and contributors: [`AGENTS.md`](AGENTS.md).

## Supabase setup

### Local CLI (development)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure it is running.
2. From the repo root: `npm run db:start` (first run downloads images; may take a few minutes).
3. Copy [`.env.example`](.env.example) to `.env` if you have not already — defaults target the local API.
4. After schema or seed changes: `npm run db:reset`.
5. Open Supabase Studio at `http://127.0.0.1:54343` if you need SQL or auth inspection.

**“No internet connection” on sign-in** usually means the app cannot reach Supabase (not that Wi‑Fi is off). Check:

- Docker is running and `npm run db:start` succeeded.
- `.env` uses the **local** URL and anon key from [`.env.example`](.env.example) (not `https://….supabase.co`).
- After changing `.env`: `npx expo start -c`.
- **Expo Go on a physical phone:** `127.0.0.1` is the phone, not your PC. Put your PC’s LAN IP in `EXPO_PUBLIC_SUPABASE_URL` (e.g. `http://192.168.1.42:54341`). Phone and PC must be on the same Wi‑Fi. Expo Go on the same machine often rewrites `127.0.0.1` automatically; a manual IP is the reliable fix on device.
- **Android emulator:** the app maps `127.0.0.1` to `10.0.2.2` in dev when needed.

Configuration lives in [`supabase/config.toml`](supabase/config.toml) (`project_id = "weigh-way"`, seed path, auth redirect URLs for Expo).

### Cloud project (production + friends)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Create a new project and wait for it to provision

### 2. Create the database tables

1. **SQL Editor** → **New query**
2. Paste and run [`supabase/schema.sql`](supabase/schema.sql) once (new projects only)

**Already have data?** Do not re-run `schema.sql` to apply changes. Add a new file under [`supabase/migrations/`](supabase/migrations/) instead — see **Database migrations** in [`AGENTS.md`](AGENTS.md). If your `weight_entries` table exists without `created_at`, run [`supabase/migrations/20260901000000_weight-entry-created-at.sql`](supabase/migrations/20260901000000_weight-entry-created-at.sql).

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

### 4. Production API keys (EAS, not `.env.example`)

Store the live project URL and **anon** key in **EAS production** (and GitHub Actions secrets for CI builds). Never commit production keys to git.

```bash
# Only when your .env intentionally contains PRODUCTION values:
npx eas-cli env:push --environment production --path .env
```

Local `.env` should keep the CLI URL from [`.env.example`](.env.example). Restart Expo after changes: `npx expo start -c`.

### 5. Create your account (production app)

1. Open the production APK → **Create account**
2. Check your email and tap **Confirm your mail**
3. Return to the app → **Sign in**

**Password reset:** Login → **Forgot password?** → open the email link on your phone → set a new password in the app.

All weight data is stored in Supabase only.

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

- [ ] **Do not** re-run [`supabase/schema.sql`](supabase/schema.sql) on production — it is for **new projects** and local CLI bootstrap only.
- [ ] Copy [`supabase/migration-template.sql`](supabase/migration-template.sql) to `supabase/migrations/YYYYMMDDHHmmss_short-description.sql` (or run `npx supabase migration new short-description`).
- [ ] Keep the migration **additive** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, copy-then-alter). No `DROP TABLE`, `TRUNCATE`, or unscoped `DELETE` on data tables.
- [ ] Apply on **local** first: `npm run db:reset` (or run the SQL against the local DB), verify the app, then run the same migration in Supabase **SQL Editor** on production **before** (or with) the app update that needs it.
- [ ] Verify row counts unchanged (unless the migration intentionally adds rows).
- [ ] Update [`supabase/schema.sql`](supabase/schema.sql) so new projects match production.
- [ ] Commit the migration file to git.

Full migration rules: [`AGENTS.md`](AGENTS.md) → Database migrations.

### App release

- [ ] `npm run lint`, `npm run typecheck`, and `npm test` pass.
- [ ] `npx expo-doctor` passes (especially after dependency or Expo config changes).
- [ ] Test app changes against **local Supabase** (`local.tester@weighway.app`) or your own dev data — not friends’ production rows.
- [ ] Migration already applied on production if the build reads new columns or tables.
- [ ] After `eas env:push`, confirm `EXPO_PUBLIC_SUPABASE_*` in EAS production still point at the **live** cloud project (not `http://127.0.0.1:54341`).

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
# Ensure .env contains PRODUCTION Supabase URL/anon key before this step — not the local CLI URL.
npx eas-cli env:push --environment production --path .env
npx eas-cli build -p android --profile production
```

`env:push` uploads `EXPO_PUBLIC_*` values from your local `.env` to EAS so the APK can reach Supabase. The build fails early if they are missing. Day-to-day Expo dev uses [local Supabase](#local-database-recommended) and does not need `env:push`.

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
   - `EXPO_PUBLIC_SUPABASE_URL` — live production project URL (not the local CLI URL)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — production anon key

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

English and Polish notes come from semantic-release (`CHANGELOG.md`): internal changes (`ci`, `dev`, `website`, `expo`, etc.) are filtered out, then **Google Gemini** (free tier via [Google AI Studio](https://aistudio.google.com/apikey)) writes customer-facing release notes in both languages. CI writes `website/content/releases/{version}.en.md` and `{version}.pl.md`. If Gemini fails, the release still completes and the site shows a “coming soon” message with a contact email until notes are regenerated. Existing `.en.md` or `.pl.md` files are never overwritten (edit them to fix wording, or re-run with `--force`).

After a version bump, CI builds both mobile artifacts and uploads them to the GitHub Release:

- **Android** — `weigh-way.apk` (EAS cloud build)
- **iOS** — `weigh-way.ipa` (unsigned build on macOS; install with SideStore)

If the release tag exists but APK/IPA jobs failed (or were skipped), use **Actions → Rebuild mobile artifacts → Run workflow**. It builds from **`main`** (so CI fixes apply), checks that `app.json` matches the target release, uploads `weigh-way.apk` and `weigh-way.ipa` to that GitHub release, and optionally redeploys the site. Leave **version** empty to target the latest release.

Latest downloads:

`https://github.com/adrian-prajsnar/weigh-way/releases/latest/download/weigh-way.apk`

`https://github.com/adrian-prajsnar/weigh-way/releases/latest/download/weigh-way.ipa`

Website-only commits still deploy the site; they do not start mobile builds. Use the `website` commit scope for site-only changes, and never mix `website/` files with mobile app files in the same commit — customer release notes include only app changes.

### One-time GitHub setup

1. Repo **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions** — add:
   - `EXPO_TOKEN` — Expo access token for EAS cloud builds
   - `EXPO_PUBLIC_SUPABASE_URL` — live production project URL (required for automated IPA builds)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — production anon key (required for automated IPA builds)
   - `GEMINI_API_KEY` — free Google AI Studio key (English and Polish release notes)

EAS Free includes 15 Android builds per month. Two production releases a week fits; unused quota does not roll over.

## Privacy

- Each user only sees their own entries (Supabase row-level security)
- Friends or others need their own accounts — data is never shared
- Profile can export weigh-ins on the device (JSON and a CSV of weigh-ins). That action does not upload the file.
- Production builds can report crashes when `EXPO_PUBLIC_SENTRY_DSN` is set in EAS. The report is the app version and an error code. Weigh-ins, height, BMI, and other health data are not included. Local dev and the website demo do not send reports.
- Never commit `.env` to git
