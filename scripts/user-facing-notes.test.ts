import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildUserPrompt,
  generateEnglishReleaseNotes,
  generatePolishReleaseNotes,
  generateReleaseNotes,
} = require('./llm-release-notes.cjs') as {
  buildUserPrompt: (input: { version: string; filteredInput: string; locale: 'en' | 'pl' }) => string;
  generateEnglishReleaseNotes: (input: {
    version: string;
    changelogBody: string;
    fetchImpl?: typeof fetch;
  }) => Promise<string>;
  generatePolishReleaseNotes: (input: {
    version: string;
    changelogBody: string;
    fetchImpl?: typeof fetch;
  }) => Promise<string>;
  generateReleaseNotes: (input: {
    version: string;
    changelogBody: string;
    fetchImpl?: typeof fetch;
  }) => Promise<{ notesEn: string; notesPl: string }>;
};
const {
  isInternalBullet,
  parseChangelog,
  prepareChangelogForLlm,
  toCustomerFacingNotes,
  validateReleaseNotesMarkdown,
} = require('./user-facing-notes.cjs') as {
  isInternalBullet: (scope: string, text: string) => boolean;
  parseChangelog: (content: string) => { version: string; date: string; body: string }[];
  prepareChangelogForLlm: (body: string) => string;
  toCustomerFacingNotes: (body: string) => string;
  validateReleaseNotesMarkdown: (text: string, locale?: 'en' | 'pl') => string;
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

  it('prepares filtered changelog input for the LLM', () => {
    const input = prepareChangelogForLlm(`### Features

* **website:** center footer on narrow viewports
* **dashboard:** add BMI badges to weight highlights ([bb14318](https://github.com/example/commit/bb14318)), closes [wei#in](https://github.com/wei/issues/in)
* **expo:** align SDK 57 config and dependency versions
`);

    expect(input).toContain('[dashboard] add BMI badges to weight highlights');
    expect(input).not.toContain('website');
    expect(input).not.toContain('expo');
    expect(input).not.toContain('wei#in');
  });

  it('validates and normalizes LLM markdown output', () => {
    const notes = validateReleaseNotesMarkdown(`## What's new

* Compare your weight with custom date ranges.
* BMI badges on Dashboard highlights.

## Bug fixes

* Clearer sign-up email rate limit message.
`, 'en');

    expect(notes).toContain("### What's new");
    expect(notes).toContain('### Bug fixes');
    expect(notes).toContain('* Compare your weight with custom date ranges.');
  });

  it('maps performance improvements to Improvements', () => {
    const notes = validateReleaseNotesMarkdown(`### Performance Improvements

* Faster startup and tab switching.
`, 'en');

    expect(notes).toContain('### Improvements');
    expect(notes).toContain('Faster startup and tab switching.');
  });

  it('validates Polish release note headings', () => {
    const notes = validateReleaseNotesMarkdown(`### Co nowego

* Nowe listy trendów na ekranie Porównaj.

### Poprawki błędów

* Jaśniejszy komunikat o limicie e-mail.
`, 'pl');

    expect(notes).toContain('### Co nowego');
    expect(notes).toContain('### Poprawki błędów');
  });
});

describe('llm release notes', () => {
  it('builds a version-specific user prompt', () => {
    const prompt = buildUserPrompt({
      version: '1.2.0',
      filteredInput: '## Features\n- [dashboard] add BMI badges',
      locale: 'en',
    });

    expect(prompt).toContain('WeighWay version 1.2.0');
    expect(prompt).toContain('[dashboard] add BMI badges');
  });

  const mockGeminiResponse = (text: string) =>
    ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text }] } }],
      }),
    }) as Response;

  it('calls Gemini and returns validated English notes', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const notes = await generateEnglishReleaseNotes({
      version: '1.2.0',
      changelogBody: `### Features

* **dashboard:** add BMI badges to weight highlights
`,
      fetchImpl: async () =>
        mockGeminiResponse(`### What's new

* BMI badges on Dashboard weight highlights.`),
    });

    expect(notes).toContain("### What's new");
    expect(notes).toContain('BMI badges on Dashboard weight highlights.');
  });

  it('fails when Gemini returns no text', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    await expect(
      generateEnglishReleaseNotes({
        version: '1.2.0',
        changelogBody: `### Features

* **dashboard:** add BMI badges to weight highlights
`,
        fetchImpl: async () =>
          ({
            ok: true,
            json: async () => ({ candidates: [{ finishReason: 'SAFETY' }] }),
          }) as Response,
      }),
    ).rejects.toThrow(/Gemini returned no release notes/i);
  });

  it('generates English and Polish notes in parallel', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    let calls = 0;

    const { notesEn, notesPl } = await generateReleaseNotes({
      version: '1.2.0',
      changelogBody: `### Features

* **dashboard:** add BMI badges to weight highlights
`,
      fetchImpl: async () => {
        calls += 1;
        return calls === 1
          ? mockGeminiResponse(`### What's new

* BMI badges on Dashboard weight highlights.`)
          : mockGeminiResponse(`### Co nowego

* Odznaki BMI na ekranie Dashboard.`);
      },
    });

    expect(calls).toBe(2);
    expect(notesEn).toContain("### What's new");
    expect(notesPl).toContain('### Co nowego');
  });

  it('generates Polish notes from the changelog', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const notes = await generatePolishReleaseNotes({
      version: '1.2.0',
      changelogBody: `### Features

* **dashboard:** add BMI badges to weight highlights
`,
      fetchImpl: async () =>
        mockGeminiResponse(`### Co nowego

* Odznaki BMI na ekranie Dashboard.`),
    });

    expect(notes).toContain('### Co nowego');
  });
});
