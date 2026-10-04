# WeighWay — Agent Guide

Personal Android app (Expo SDK 57). Supabase-backed, auth required.

## Stack

- Expo + React Native + TypeScript
- Supabase (`@supabase/supabase-js`) — auth + database
- React Navigation (auth stack + bottom tabs)
- `expo-localization` + `i18n-js` — English and Polish
- EAS Build for APK
- Vitest for unit tests; ESLint + Prettier for lint/format

## File naming

**Always use kebab-case** for files and folders. React component names stay PascalCase.

Colocate unit tests as `*.test.ts` next to the module they cover (e.g. `stats.test.ts` beside `stats.ts`).

## Project layout

```
app.tsx
src/
  screens/              # login-screen, sign-up-screen, dashboard-screen, ...
  components/
  hooks/                # use-weight-entries.ts, use-comparison.ts, ...
  context/              # supabase-auth-context, weight-entries-context, user-profile-context
  navigation/           # root-navigator, auth-navigator, main-tab-navigator
  supabase/             # client.ts, weight-sync.ts, height-sync.ts (all data I/O)
  storage/              # theme, language, unit, BMI display preferences (AsyncStorage)
  i18n/                 # language-context.tsx, translation-keys.ts, locales/en.ts, locales/pl.ts
  theme/
    tokens.ts           # palettes (light + dark)
    theme-context.tsx
    styles.ts           # useAppStyles() facade only
    styles/             # screen.ts, auth.ts, forms.ts, dashboard.ts, lists.ts, ...
  stats.ts, height.ts, format.ts, types.ts, ...
website/                # separate Astro marketing site — do not change unless the task is the site
supabase/schema.sql          # bootstrap for NEW projects only
supabase/grants.sql          # safe to re-run anytime
supabase/migrations/         # one dated .sql file per change on live databases
supabase/migration-template.sql
```

## Database migrations

**Never delete or break existing user data.** Entries belong to real users.

Before touching production: follow **Production safety checklist** in [`README.md`](README.md). Local dev uses the same Supabase project as the APK; use a `+dev` email for sign-in in development (`src/dev-auth-guard.ts` enforces this by default; set `EXPO_PUBLIC_DEV=false` to disable). That guard is a **dev UX guard only** — not a security boundary. Do not describe or extend it as access control.

- **New Supabase project:** run `supabase/schema.sql` once.
- **Project with data (you and friends):** add `supabase/migrations/YYYY-MM-DD-description.sql` (copy `supabase/migration-template.sql`). **Do not** re-run `schema.sql` on production to apply changes.

### Rules for every migration

1. **Additive first** — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` (nullable or with a default), new indexes/policies/grants.
2. **Never** on live data tables: `DROP TABLE`, `TRUNCATE`, unscoped `DELETE`, or `DROP COLUMN` until data was copied elsewhere and the app no longer reads the column.
3. **Copy before reshape** — `INSERT … SELECT` with `ON CONFLICT DO NOTHING` (see `migrate-height-entries.sql`). Prefer several safe steps over one destructive step.
4. **Policies** — `DROP POLICY IF EXISTS` then `CREATE POLICY` does not delete rows; safe when permissions change.
5. **`grants.sql`** — safe to re-run anytime.
6. **CHECK constraints** — tightening can reject existing rows; migrate or widen data first, then add the stricter check.
7. **Keep `schema.sql` in sync** after a migration so new projects match production — but apply live changes only via `supabase/migrations/`.
8. **Verify** — in migration comments, note `SELECT count(*)` (or similar) before and after on affected tables.

When changing app code that reads/writes Supabase, ensure the migration ships **before** or **with** the app update so users never hit missing columns or tables.

## Data

- **No local weight storage** — all entries read/write via `src/supabase/weight-sync.ts`
- **Weight writes from UI** go through `upsertEntry` on `useWeightEntries` / `useSharedWeightEntries()`. **Deletes** use `removeEntry`. Do not call `saveEntry` from a component.
- Height history in `height_entries` via `src/supabase/height-sync.ts` (one row per effective date; upsert overwrites same day). Weight can be logged without height. BMI is computed in the app from height effective on each weigh-in date (`getHeightAtDate` in `src/height.ts`); if no height covers that date, BMI shows as `"-"`
- AsyncStorage is only used by Supabase for auth session persistence, the BMI display preference (`src/storage/bmi-display-preference.ts`), the theme preference (`src/storage/theme-preference.ts`), the language preference (`src/storage/language-preference.ts`), and the unit preference (`src/storage/unit-preference.ts`)
- One weight entry per date per user; save overwrites same day
- RLS enforces `user_id = auth.uid()`
- **User-facing data errors** must come from mapped i18n strings in `src/supabase/errors.ts`. Do not show raw PostgREST or Postgres `error.message` in the UI.

## Localization

- Supported locales: English (`en`) and Polish (`pl`)
- Profile → Appearance: System / English / Polski (stored in `@weigh-way/language`)
- System follows the device locale; non-Polish devices default to English
- Components use `useTranslation()` from `src/i18n/language-context.tsx`
- Non-React modules use `t()` from `src/i18n/index.ts`
- Do not hardcode user-facing strings in components
- Date formatting uses `getDateLocale()` from `src/i18n/resolve-locale.ts` (not `undefined`)
- `t()` and `useTranslation().t` take a `TranslationKey` from `src/i18n/translation-keys.ts`. Add strings to `src/i18n/locales/en.ts` and `pl.ts`. For dynamic keys, use a `Record<..., TranslationKey>` map — not a template string.

## Theming

- All colors come from `src/theme/tokens.ts` (light + dark palettes). Never hardcode a hex value in a component.
- Components call `const styles = useAppStyles()` from `src/theme/styles.ts`. For props that cannot take a stylesheet (`placeholderTextColor`, `ActivityIndicator`, icons), read `useColors()`.
- Style definitions live in `src/theme/styles/` (`screen.ts`, `auth.ts`, `forms.ts`, etc.). Add new keys to the matching module — do not grow a single god file.
- Custom fonts mean `fontWeight` is ignored on Android — always set `fontFamily` from `fontFamily` in tokens.
- Scheme follows the device unless overridden on the profile screen.

## Auth

- App blocked until signed in (`root-navigator.tsx`)
- Login and sign-up are separate screens
- Sign out on profile screen

## Testing

- Pure logic (stats, format, units, auth-errors, etc.) gets colocated `*.test.ts` files run by Vitest.
- Do not add component or snapshot tests unless explicitly asked.

## Releases

Versions are managed by [semantic-release](https://github.com/semantic-release/semantic-release) on push to `main`.

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:` (minor), `fix:` (patch), `feat!:` or `BREAKING CHANGE:` (major). `chore:`, `ci:`, and `docs:` do not trigger a release.
- **Website vs app commits:** marketing-site work under `website/` must use the `website` scope (e.g. `fix(website): …`). Never mix `website/` and mobile app files (`src/`, `app.json`, `app.config.ts`, `app.tsx`, `assets/`) in one commit — split them so release notes stay app-only. Husky enforces this via `scripts/validate-commit-scope.cjs`.
- Husky runs commitlint on each local commit.
- CI bumps `app.json`, `package.json`, Android `versionCode`, and iOS `buildNumber`, then tags the release (e.g. `v1.1.0`).
- Tag the current `1.0.0` baseline once before the first automated release: `git tag v1.0.0 && git push origin v1.0.0`.
- After merging releasable commits, build a new APK/IPA so users get the bumped version shown on Profile.

## Before finishing

Run these on every code change (matches [`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

```bash
npm run lint
npm run typecheck
npm test
```

Also run `npx expo-doctor` when changing dependencies or Expo config.

Never commit `.env` or personal data.
