import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildUserPrompt,
  generateEnglishReleaseNotes,
  generateLocaleReleaseNotesSafely,
  generatePolishReleaseNotes,
  generateReleaseNotes,
} = require('./llm-release-notes.cjs') as {
  buildUserPrompt: (input: { version: string; filteredInput: string; locale: 'en' | 'pl' }) => string;
  generateEnglishReleaseNotes: (input: {
    version: string;
    changelogBody: string;
    fetchImpl?: typeof fetch;
  }) => Promise<string>;
  generateLocaleReleaseNotesSafely: (input: {
    version: string;
    changelogBody: string;
    locale: 'en' | 'pl';
    fetchImpl?: typeof fetch;
  }) => Promise<{ body: string; pending: boolean }>;
  generatePolishReleaseNotes: (input: {
    version: string;
    changelogBody: string;
    fetchImpl?: typeof fetch;
  }) => Promise<string>;
  generateReleaseNotes: (input: {
    version: string;
    changelogBody: string;
    fetchImpl?: typeof fetch;
  }) => Promise<{ notesEn: string; notesPl: string; pendingEn: boolean; pendingPl: boolean }>;
};
const {
  buildPendingReleaseNotes,
  formatNotesFile,
  isInternalBullet,
  parseChangelog,
  parseNotesFile,
  prepareChangelogForLlm,
  toCustomerFacingNotes,
  validateReleaseNotesMarkdown,
} = require('./user-facing-notes.cjs') as {
  buildPendingReleaseNotes: (locale: 'en' | 'pl') => string;
  formatNotesFile: (input: {
    version: string;
    date: string;
    body: string;
    pending?: boolean;
  }) => string;
  isInternalBullet: (scope: string, text: string) => boolean;
  parseChangelog: (content: string) => { version: string; date: string; body: string }[];
  parseNotesFile: (raw: string) => {
    version: string | null;
    date: string | null;
    pending: boolean;
    body: string;
  };
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

  it('drops bullets that mention website in unscoped commit text', () => {
    const notes = toCustomerFacingNotes(`### Bug Fixes

* unify date filters and polish website UX
* **entry-form:** keep edit weight modal above keyboard
`);

    expect(notes).toContain('Editing a weigh-in stays visible above the keyboard.');
    expect(notes).not.toContain('website');
    expect(notes).not.toContain('date filters');
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

  it('drops unscoped website mentions from LLM changelog input', () => {
    const input = prepareChangelogForLlm(`### Bug Fixes

* unify date filters and polish website UX
* **auth:** clarify email rate limit message
`);

    expect(input).toContain('[auth] clarify email rate limit message');
    expect(input).not.toContain('website');
    expect(input).not.toContain('unify date filters');
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

  it('validates Polish release note headings', () => {
    const notes = validateReleaseNotesMarkdown(`### Co nowego

* Nowe listy trendów na ekranie Porównaj.

### Poprawki błędów

* Jaśniejszy komunikat o limicie e-mail.
`, 'pl');

    expect(notes).toContain('### Co nowego');
    expect(notes).toContain('### Poprawki błędów');
  });

  it('marks pending release notes in frontmatter', () => {
    const raw = formatNotesFile({
      version: '1.3.0',
      date: '2026-10-01',
      body: buildPendingReleaseNotes('en'),
      pending: true,
    });

    expect(raw).toContain('pending: true');
    expect(parseNotesFile(raw).pending).toBe(true);
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

    const { notesEn, notesPl, pendingEn, pendingPl } = await generateReleaseNotes({
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
    expect(pendingEn).toBe(false);
    expect(pendingPl).toBe(false);
  });

  it('falls back to pending placeholders when Gemini fails', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const { notesEn, notesPl, pendingEn, pendingPl } = await generateReleaseNotes({
      version: '1.2.0',
      changelogBody: `### Features

* **dashboard:** add BMI badges to weight highlights
`,
      fetchImpl: async () => {
        throw new Error('Gemini returned no release notes (finishReason: SAFETY)');
      },
    });

    expect(pendingEn).toBe(true);
    expect(pendingPl).toBe(true);
    expect(notesEn).toContain('shortly');
    expect(notesPl).toContain('wkrótce');
  });

  it('returns pending placeholder from safe locale generation', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const result = await generateLocaleReleaseNotesSafely({
      version: '1.2.0',
      locale: 'en',
      changelogBody: `### Features

* **dashboard:** add BMI badges to weight highlights
`,
      fetchImpl: async () => {
        throw new Error('Gemini release notes failed');
      },
    });

    expect(result.pending).toBe(true);
    expect(result.body).toContain('shortly');
  });
});
