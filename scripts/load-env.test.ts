import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { loadEnv } = require('./load-env.cjs') as {
  loadEnv: (envPath?: string) => void;
};

describe('load-env', () => {
  afterEach(() => {
    delete process.env.LOAD_ENV_TEST_KEY;
    delete process.env.LOAD_ENV_EXISTING;
  });

  it('loads unset keys from a .env file without overriding existing env vars', () => {
    process.env.LOAD_ENV_EXISTING = 'from-shell';

    const dir = mkdtempSync(join(tmpdir(), 'weigh-way-load-env-'));
    const envPath = join(dir, '.env');
    writeFileSync(
      envPath,
      `# comment
LOAD_ENV_TEST_KEY=from-file
LOAD_ENV_EXISTING=from-file
QUOTED="quoted-value"
`,
      'utf8',
    );

    loadEnv(envPath);

    expect(process.env.LOAD_ENV_TEST_KEY).toBe('from-file');
    expect(process.env.LOAD_ENV_EXISTING).toBe('from-shell');
  });
});
