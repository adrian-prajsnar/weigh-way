import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  analyzePaths,
  classifyPath,
  isIgnoredCommit,
  parseCommitScope,
  validateCommitScope,
} = require('./validate-commit-scope.cjs') as {
  analyzePaths: (paths: string[]) => { hasWebsite: boolean; hasApp: boolean; paths: string[] };
  classifyPath: (path: string) => 'website' | 'app' | 'neutral';
  isIgnoredCommit: (message: string) => boolean;
  parseCommitScope: (message: string) => string | null;
  validateCommitScope: (
    message: string,
    stagedPaths: string[],
  ) => { valid: boolean; error?: string };
};

describe('validate-commit-scope', () => {
  it('classifies website, app, and neutral paths', () => {
    expect(classifyPath('website/src/pages/index.astro')).toBe('website');
    expect(classifyPath('src/screens/dashboard-screen.tsx')).toBe('app');
    expect(classifyPath('app.json')).toBe('app');
    expect(classifyPath('README.md')).toBe('neutral');
    expect(classifyPath('scripts/user-facing-notes.cjs')).toBe('neutral');
  });

  it('parses conventional commit scopes', () => {
    expect(parseCommitScope('fix(website): center footer')).toBe('website');
    expect(parseCommitScope('feat(dashboard): add BMI badges')).toBe('dashboard');
    expect(parseCommitScope('fix: unify date filters')).toBeNull();
  });

  it('ignores semantic-release chore commits', () => {
    expect(isIgnoredCommit('chore(release): 1.3.0 [skip ci]')).toBe(true);
    expect(isIgnoredCommit('fix(website): center footer')).toBe(false);
  });

  it('requires website scope for website-only commits', () => {
    const result = validateCommitScope('fix: center footer on narrow viewports', [
      'website/src/styles/global.css',
    ]);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/website scope/i);
  });

  it('accepts website scope for website-only commits', () => {
    const result = validateCommitScope('fix(website): center footer on narrow viewports', [
      'website/src/styles/global.css',
      'README.md',
    ]);

    expect(result.valid).toBe(true);
  });

  it('rejects mixed website and app commits', () => {
    const result = validateCommitScope('fix: unify date filters and polish website UX', [
      'website/src/styles/global.css',
      'src/screens/history-screen.tsx',
    ]);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/mixed commit/i);
  });

  it('rejects website scope when app files are staged', () => {
    const result = validateCommitScope('fix(website): polish header', [
      'website/src/components/site-header.astro',
      'src/screens/history-screen.tsx',
    ]);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/mixed commit/i);
  });

  it('allows app-only commits without website scope', () => {
    const result = validateCommitScope('fix(history): improve date filtering', [
      'src/screens/history-screen.tsx',
      'src/i18n/locales/en.ts',
    ]);

    expect(result.valid).toBe(true);
  });

  it('detects mixed paths in analyzePaths', () => {
    expect(
      analyzePaths(['website/src/styles/global.css', 'src/screens/history-screen.tsx']),
    ).toEqual({
      hasWebsite: true,
      hasApp: true,
      paths: ['website/src/styles/global.css', 'src/screens/history-screen.tsx'],
    });
  });
});
