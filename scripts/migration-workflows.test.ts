import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { load } = require('js-yaml');
type Job = {
  uses?: string;
  needs?: string | string[];
  steps?: {
    uses?: string;
    run?: string;
    with?: Record<string, unknown>;
    env?: Record<string, string>;
    if?: string;
  }[];
  with?: Record<string, unknown>;
  concurrency?: { group: string; 'cancel-in-progress': boolean };
  environment?: string;
};
type Workflow = { jobs: Record<string, Job> };
const workflow = (name: string): Workflow =>
  load(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));

describe('migration release integration', () => {
  it('requires verification then database deployment before semantic-release', () => {
    const { jobs } = workflow('release');
    expect(jobs.verify.uses).toBe('./.github/workflows/verify.yml');
    expect(jobs.database.needs).toBe('verify');
    expect(jobs.database.with).toEqual({ mode: 'apply', source_sha: '${{ github.sha }}' });
    expect(jobs.release.needs).toBe('database');
    expect(jobs.apk.needs).toBe('release');
    expect(jobs.ipa.needs).toBe('release');
  });
  it('uses disposable local replay/tests without production credentials', () => {
    const { jobs } = workflow('verify');
    const commands = jobs.database.steps?.map((step) => step.run).filter(Boolean);
    expect(commands).toContain('supabase db reset --no-seed');
    expect(commands).toContain('supabase test db');
    expect(JSON.stringify(jobs)).not.toContain('secrets.');
  });
  it('gates both manual rebuilds on the same resolved source commit', () => {
    const { jobs } = workflow('rebuild-mobile-artifacts');
    expect(jobs.database.with).toEqual({
      mode: 'check',
      source_sha: '${{ needs.meta.outputs.source_sha }}',
    });
    for (const name of ['apk', 'ipa']) {
      expect(jobs[name].needs).toEqual(['meta', 'database']);
      expect(jobs[name].steps?.find((step) => step.uses === 'actions/checkout@v4')?.with?.ref).toBe(
        '${{ needs.meta.outputs.source_sha }}',
      );
    }
    const ios = workflow('ios-ipa').jobs;
    expect(ios['build-ipa'].needs).toBe('database');
    expect(ios.database.with).toEqual({ mode: 'check', source_sha: '${{ github.sha }}' });
  });
  it('serializes production operations and exposes the password only in apply mode', () => {
    const job = workflow('database-migrations').jobs.migrations;
    expect(job.environment).toBe('production-database');
    expect(job.concurrency).toEqual({
      group: 'production-database-migrations',
      'cancel-in-progress': false,
    });
    const gate = job.steps?.find((step) => step.run?.includes('node scripts/db-migrations.cjs'));
    expect(gate?.env?.SUPABASE_DB_PASSWORD).toBe(
      "${{ inputs.mode == 'apply' && secrets.SUPABASE_DB_PASSWORD || '' }}",
    );
    expect(job.steps?.find((step) => step.uses === 'supabase/setup-cli@v3')?.with?.version).toBe(
      '3.0.0',
    );
  });
});
