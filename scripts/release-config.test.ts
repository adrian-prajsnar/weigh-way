import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../release.config.cjs');

describe('release rules', () => {
  it.each([
    ['fix: correct a defect', 'patch'],
    ['fix(auth): correct a defect', 'patch'],
    ['feat(app): add a feature', 'minor'],
    ['feat(app)!: incompatible feature', 'major'],
    ['fix: change contract\n\nBREAKING CHANGE: incompatible', 'major'],
    ['refactor(auth): simplify implementation', null],
    ['chore(app): housekeeping', null],
    ['fix(website): site correction', null],
    ['feat(website): new site feature', null],
  ])('analyzes %s as %s', async (message, expected) => {
    // The installed analyzer is JavaScript and does not publish declarations.
    // @ts-expect-error -- exercising the real release plugin rather than duplicating its rules
    const { analyzeCommits } = await import('@semantic-release/commit-analyzer');
    const options = config.plugins[0][1];
    const result = await analyzeCommits(options, {
      cwd: process.cwd(),
      commits: [{ hash: 'abc123', message }],
      logger: { log: vi.fn() },
    });
    expect(result).toBe(expected);
  });
});
