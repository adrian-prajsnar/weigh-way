const { readdirSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const SUPABASE_CLI_VERSION = '3.0.0';

function localVersions(directory) {
  const files = readdirSync(directory).filter((name) => name.endsWith('.sql'));
  const versions = files
    .map((name) => {
      if (!/^\d{14}_[a-z0-9_-]+\.sql$/.test(name)) {
        throw new Error(`Invalid migration filename: ${name}`);
      }
      return name.slice(0, 14);
    })
    .sort();
  if (!versions.length || new Set(versions).size !== versions.length) {
    throw new Error('Migration files are missing or contain duplicate versions.');
  }
  return versions;
}

function compareHistory(local, remote, mode) {
  if (
    !Array.isArray(remote) ||
    remote.some((row) => typeof row?.version !== 'string' || !/^\d{14}$/.test(row.version))
  ) {
    throw new Error('Unexpected migration history response. Release blocked.');
  }
  const applied = remote.map((row) => row.version).sort();
  if (!applied.length || new Set(applied).size !== applied.length) {
    throw new Error(
      'Production migration history is empty or duplicated. Reconcile the baseline first.',
    );
  }
  const known = new Set(applied);
  const pending = local.filter((version) => !known.has(version));
  const latestLocal = local.at(-1);
  // Older builds may use a database with newer additive migrations. Unknown
  // migrations inside this checkout's history still require reconciliation.
  if (
    applied.some(
      (version) => !local.includes(version) && (mode === 'apply' || version <= latestLocal),
    )
  ) {
    throw new Error(
      'Production contains unexpected migration versions. Reconcile history before continuing.',
    );
  }
  if (pending.some((version) => version < applied.at(-1))) {
    throw new Error(
      'Production history has gaps. Do not automatically repair or replay old migrations.',
    );
  }
  return pending;
}

function validateTarget(env) {
  const ref = env.SUPABASE_PRODUCTION_PROJECT_REF;
  if (!/^[a-z]{20}$/.test(ref ?? '')) {
    throw new Error(
      'Set SUPABASE_PRODUCTION_PROJECT_REF to the confirmed production project reference.',
    );
  }
  if (env.EXPO_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`) {
    throw new Error('Production project reference does not match EXPO_PUBLIC_SUPABASE_URL.');
  }
  if (!env.SUPABASE_ACCESS_TOKEN) {
    throw new Error('SUPABASE_ACCESS_TOKEN is required to read production migration history.');
  }
  return ref;
}

async function readHistory(ref, env, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/database/migrations`, {
      headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(
      'Could not reach Supabase migration history. Release blocked; retry after connectivity recovers.',
    );
  }
  if (!response.ok) {
    throw new Error(
      `Migration history request failed (HTTP ${response.status}). Check token permissions and baseline setup.`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid migration history response. Release blocked.');
  }
}

function runCli(args, env) {
  const result = spawnSync('supabase', args, {
    env,
    encoding: 'utf8',
    timeout: 5 * 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Do not echo raw CLI errors: they can contain SQL or connection details.
  if (result.error || result.status !== 0) {
    throw new Error(
      'Supabase CLI failed. Release blocked; inspect the pending migration locally before retrying.',
    );
  }
  return result.stdout.trim();
}

async function run({
  mode = 'check',
  env = process.env,
  directory = join(__dirname, '../supabase/migrations'),
  fetchImpl = fetch,
  cli = runCli,
  log = console.log,
} = {}) {
  if (!['plan', 'check', 'apply'].includes(mode)) {
    throw new Error('Usage: node scripts/db-migrations.cjs [plan|check|apply]');
  }
  const ref = validateTarget(env);
  if (mode === 'apply') {
    if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== 'refs/heads/main') {
      throw new Error(
        'Production migrations may only be applied by the main GitHub Actions release workflow.',
      );
    }
    if (env.SUPABASE_MIGRATIONS_BASELINED !== 'true') {
      throw new Error(
        'Automatic migration deployment is disabled until production history is verified and SUPABASE_MIGRATIONS_BASELINED=true.',
      );
    }
    if (!env.SUPABASE_DB_PASSWORD) {
      throw new Error('SUPABASE_DB_PASSWORD is required for production migration deployment.');
    }
  }
  const local = localVersions(directory);
  const pending = compareHistory(local, await readHistory(ref, env, fetchImpl), mode);
  log(`Production project: ${ref}`);
  log(
    pending.length
      ? `Pending migrations: ${pending.join(', ')}`
      : 'All required migrations are applied.',
  );
  if (mode === 'check' && pending.length) {
    throw new Error(
      'Required migrations are missing. Run the main release migration job before building.',
    );
  }
  if (mode === 'apply' && pending.length) {
    if (cli(['--version'], env) !== SUPABASE_CLI_VERSION) {
      throw new Error(`Migration deployment requires Supabase CLI ${SUPABASE_CLI_VERSION}.`);
    }
    const args = ['db', 'push', `--remote=${ref}`, '--skip-vault'];
    cli([...args, '--dry-run'], env);
    cli([...args, '--yes'], env);
    const remaining = compareHistory(local, await readHistory(ref, env, fetchImpl), mode);
    if (remaining.length) {
      throw new Error('Migration deployment did not apply all required versions. Release blocked.');
    }
    log(`Applied and verified ${pending.length} migration(s).`);
  }
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `### Database migrations\nProject: \`${ref}\`\n\nMode: ${mode}. ${mode === 'plan' ? `${pending.length} pending` : 'Required versions verified'}.\n`,
    );
  }
  return pending;
}

module.exports = { SUPABASE_CLI_VERSION, localVersions, compareHistory, validateTarget, run };

if (require.main === module) {
  run({ mode: process.argv[2] ?? 'check' }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
