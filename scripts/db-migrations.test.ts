import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { compareHistory, localVersions, run } = require('./db-migrations.cjs') as {
  compareHistory: (local: string[], remote: unknown, mode: string) => string[];
  localVersions: (directory: string) => string[];
  run: (options: object) => Promise<string[]>;
};
const first = '20260801000000';
const second = '20261103000000';
const newer = '20261201000000';
const ref = 'abcdefghijklmnopqrst';
const env = {
  SUPABASE_PRODUCTION_PROJECT_REF: ref,
  EXPO_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  SUPABASE_ACCESS_TOKEN: 'test-token',
  SUPABASE_DB_PASSWORD: 'test-password',
  SUPABASE_MIGRATIONS_BASELINED: 'true',
  GITHUB_ACTIONS: 'true',
  GITHUB_REF: 'refs/heads/main',
};
const directories: string[] = [];
function fixtures() {
  const directory = mkdtempSync(join(tmpdir(), 'weigh-way-migrations-'));
  directories.push(directory);
  writeFileSync(join(directory, `${first}_bootstrap.sql`), 'select 1;');
  writeFileSync(join(directory, `${second}_height.sql`), 'select 2;');
  const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ version: first }] });
  const cli = vi.fn().mockReturnValue('3.0.0');
  return { directory, fetchImpl, cli, log: vi.fn(), env: { ...env } };
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('migration history', () => {
  it('lists pending versions in order', () => {
    expect(compareHistory([first, second], [{ version: first }], 'apply')).toEqual([second]);
  });
  it.each([null, {}, [], [{ version: 'bad' }], [{ version: first }, { version: first }]])(
    'rejects absent or malformed history: %j',
    (remote) => {
      expect(() => compareHistory([first, second], remote, 'check')).toThrow();
    },
  );
  it('blocks gaps and unknown versions inside the required history', () => {
    expect(() => compareHistory([first, second], [{ version: second }], 'apply')).toThrow(/gaps/);
    expect(() =>
      compareHistory([second], [{ version: first }, { version: second }], 'check'),
    ).toThrow(/unexpected/);
  });
  it('allows newer additive versions for older builds, but rejects stale deployments', () => {
    const remote = [first, second, newer].map((version) => ({ version }));
    expect(compareHistory([first, second], remote, 'check')).toEqual([]);
    expect(() => compareHistory([first, second], remote, 'apply')).toThrow(/unexpected/);
  });
  it('rejects duplicate local versions and invalid SQL filenames', () => {
    const options = fixtures();
    writeFileSync(join(options.directory, `${first}_duplicate.sql`), 'select 1;');
    expect(() => localVersions(options.directory)).toThrow(/duplicate/);
    writeFileSync(join(options.directory, 'bad.sql'), 'select 1;');
    expect(() => localVersions(options.directory)).toThrow(/filename/);
  });
});

describe('production migration gate', () => {
  it('plans using only a read-only GET, without calling the CLI', async () => {
    const options = fixtures();
    await expect(run({ ...options, mode: 'plan' })).resolves.toEqual([second]);
    expect(options.fetchImpl).toHaveBeenCalledWith(
      `https://api.supabase.com/v1/projects/${ref}/database/migrations`,
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
        redirect: 'error',
      }),
    );
    expect(options.cli).not.toHaveBeenCalled();
  });
  it('blocks a build when required migrations are missing', async () => {
    const options = fixtures();
    await expect(run({ ...options, mode: 'check' })).rejects.toThrow(/missing/);
    expect(options.cli).not.toHaveBeenCalled();
  });
  it('succeeds without writes when all migrations are applied', async () => {
    const options = fixtures();
    options.fetchImpl.mockResolvedValue({
      ok: true,
      json: async () => [first, second].map((version) => ({ version })),
    });
    await expect(run({ ...options, mode: 'apply' })).resolves.toEqual([]);
    expect(options.cli).not.toHaveBeenCalled();
  });
  it.each([
    { SUPABASE_ACCESS_TOKEN: '' },
    { SUPABASE_PRODUCTION_PROJECT_REF: '' },
    { EXPO_PUBLIC_SUPABASE_URL: 'https://wrong.supabase.co' },
    { SUPABASE_MIGRATIONS_BASELINED: '' },
    { SUPABASE_DB_PASSWORD: '' },
    { GITHUB_REF: 'refs/heads/develop' },
    { GITHUB_ACTIONS: '' },
  ])('rejects unsafe apply configuration before contacting production: %j', async (override) => {
    const options = fixtures();
    await expect(
      run({ ...options, mode: 'apply', env: { ...options.env, ...override } }),
    ).rejects.toThrow();
    expect(options.fetchImpl).not.toHaveBeenCalled();
    expect(options.cli).not.toHaveBeenCalled();
  });
  it('dry-runs, deploys to the explicit project without seeds/vault updates, and verifies history', async () => {
    const options = fixtures();
    options.fetchImpl
      .mockResolvedValueOnce({ ok: true, json: async () => [{ version: first }] })
      .mockResolvedValue({
        ok: true,
        json: async () => [first, second].map((version) => ({ version })),
      });
    await run({ ...options, mode: 'apply' });
    expect(options.cli.mock.calls.map(([args]) => args)).toEqual([
      ['--version'],
      ['db', 'push', `--remote=${ref}`, '--skip-vault', '--dry-run'],
      ['db', 'push', `--remote=${ref}`, '--skip-vault', '--yes'],
    ]);
    expect(options.fetchImpl).toHaveBeenCalledTimes(2);
    options.cli.mockClear();
    await run({ ...options, mode: 'apply' });
    expect(options.cli).not.toHaveBeenCalled();
  });
  it('fails closed on a network or API error without leaking its raw response', async () => {
    const options = fixtures();
    options.fetchImpl.mockRejectedValueOnce(new Error('test-token private detail'));
    await expect(run(options)).rejects.toThrow(/Could not reach/);
    options.fetchImpl.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: 'private detail' }),
    });
    await expect(run(options)).rejects.toThrow('Migration history request failed (HTTP 403).');
  });
  it('blocks release if CLI execution fails or the post-deploy history is incomplete', async () => {
    const options = fixtures();
    options.cli.mockImplementation((args: string[]) => {
      if (args.includes('--yes')) throw new Error('CLI failed');
      return '3.0.0';
    });
    await expect(run({ ...options, mode: 'apply' })).rejects.toThrow(/CLI failed/);
    options.cli.mockReturnValue('3.0.0');
    await expect(run({ ...options, mode: 'apply' })).rejects.toThrow(/did not apply/);
  });
  it('refuses an unpinned CLI version before deployment', async () => {
    const options = fixtures();
    options.cli.mockReturnValue('4.0.0');
    await expect(run({ ...options, mode: 'apply' })).rejects.toThrow(/3.0.0/);
    expect(options.cli).toHaveBeenCalledOnce();
  });
});
