import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  isInternalBullet,
  parseChangelog,
  toCustomerFacingNotes,
} = require('./user-facing-notes.cjs') as {
  isInternalBullet: (scope: string, text: string) => boolean;
  parseChangelog: (content: string) => { version: string; date: string; body: string }[];
  toCustomerFacingNotes: (body: string) => string;
};

describe('user-facing notes', () => {
  it('parses semantic-release changelog headings', () => {
    const changelog = `## [1.1.1](https://github.com/example/compare/v1.1.0...v1.1.1) (2026-09-05)

### Bug Fixes

* **entry-form:** keep modal above keyboard ([d06ddef](https://github.com/example/commit/d06ddef))

# [1.1.0](https://github.com/example/compare/v1.0.0...v1.1.0) (2026-09-04)

### Features

* **history:** improve date filtering ([4906eec](https://github.com/example/commit/4906eec)), closes [wei#in](https://github.com/wei/issues/in)
`;

    const versions = parseChangelog(changelog);
    expect(versions.map((entry) => entry.version)).toEqual(['1.1.1', '1.1.0']);
    expect(versions[0].date).toBe('2026-09-05');
  });

  it('filters internal scopes and rewrites customer-facing bullets', () => {
    const notes = toCustomerFacingNotes(`### Bug Fixes

* **ci:** allow semantic-release commits to pass commitlint ([34826db](https://github.com/example/commit/34826db))
* **entry-form:** keep edit weight modal above keyboard

### Features

* **dev:** add prominent development mode banner
* **connectivity:** show offline screen when internet is unavailable
* **history:** improve date filtering and scroll UX
* **profile:** add copyright footer and app version label
`);

    expect(notes).toContain("### What's new");
    expect(notes).toContain('### Bug fixes');
    expect(notes).toContain('Clear message when the app is offline.');
    expect(notes).toContain('Easier date filtering and scrolling in History.');
    expect(notes).toContain('Profile now shows the app version.');
    expect(notes).toContain('Editing a weigh-in stays visible above the keyboard.');
    expect(notes).not.toContain('commitlint');
    expect(notes).not.toContain('development mode banner');
    expect(notes).not.toContain('**ci:**');
    expect(notes).not.toContain('**dev:**');
  });

  it('marks ci and dev scopes as internal', () => {
    expect(isInternalBullet('ci', 'allow semantic-release commits to pass commitlint')).toBe(true);
    expect(isInternalBullet('dev', 'add prominent development mode banner')).toBe(true);
    expect(isInternalBullet('history', 'improve date filtering')).toBe(false);
  });

  it('drops website-scoped changelog entries from customer notes', () => {
    const notes = toCustomerFacingNotes(`### Bug Fixes

* **website:** center footer on narrow viewports
* **entry-form:** keep edit weight modal above keyboard

### Features

* **website:** add locale and theme aware app screenshots
* **dashboard:** add BMI badges to weight highlights
`);

    expect(notes).toContain('Editing a weigh-in stays visible above the keyboard.');
    expect(notes).toContain('BMI badges');
    expect(notes).not.toContain('footer');
    expect(notes).not.toContain('screenshots');
    expect(notes).not.toContain('**website:**');
  });
});
