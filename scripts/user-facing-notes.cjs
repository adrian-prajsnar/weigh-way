const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');
const NOTES_DIR = path.join(ROOT, 'website', 'content', 'releases');

const INTERNAL_SCOPES = new Set([
  'ci',
  'dev',
  'deps',
  'chore',
  'build',
  'release',
  'test',
  'tests',
  'lint',
  'husky',
  'commitlint',
  'workflow',
  'github',
  'website',
]);

const SECTION_TITLES = {
  'bug fixes': 'Bug fixes',
  features: "What's new",
  'breaking changes': 'Breaking changes',
  performance: 'Improvements',
  improvements: 'Improvements',
};

const BULLET_REWRITES = [
  [/show offline screen when internet is unavailable/i, 'Clear message when the app is offline.'],
  [/improve date filtering and scroll ux/i, 'Easier date filtering and scrolling in History.'],
  [/improve date filtering/i, 'Easier date filtering in History.'],
  [/add copyright footer and app version label/i, 'Profile now shows the app version.'],
  [
    /keep edit weight modal above keyboard/i,
    'Editing a weigh-in stays visible above the keyboard.',
  ],
  [/keep modal above keyboard/i, 'Editing a weigh-in stays visible above the keyboard.'],
];

const INTERNAL_TEXT = /\b(commitlint|semantic-release|husky|github actions|workflow)\b/i;

function parseChangelog(content) {
  const heading =
    /^(#{1,2}) \[(\d+\.\d+\.\d+)\]\([^)]+\) \((\d{4}-\d{2}-\d{2})\)/gm;
  const matches = [...content.matchAll(heading)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : content.length;
    return {
      version: match[2],
      date: match[3],
      body: content.slice(start, end).trim(),
    };
  });
}

function stripTechnicalArtifacts(body) {
  return body
    .replace(/\s*\(\[([a-f0-9]{7,40})\]\([^)]+\)\)/gi, '')
    .replace(/,?\s*closes\s+\[[^\]]+\]\([^)]+\)/gi, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseSections(body) {
  const sections = [];
  const lines = body.split(/\r?\n/);
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      if (current) {
        sections.push(current);
      }
      current = { title: heading[1].trim(), bullets: [] };
      continue;
    }

    const bullet = line.match(/^\*\s+(.+)$/);
    if (bullet && current) {
      current.bullets.push(bullet[1]);
    }
  }

  if (current) {
    sections.push(current);
  }

  return sections;
}

function parseBullet(raw) {
  const scoped = raw.match(/^\*\*([^*]+):\*\*\s*(.+)$/);
  if (scoped) {
    return { scope: scoped[1].trim().toLowerCase(), text: scoped[2].trim() };
  }
  return { scope: '', text: raw.trim() };
}

function isInternalBullet(scope, text) {
  if (scope && INTERNAL_SCOPES.has(scope)) {
    return true;
  }
  return INTERNAL_TEXT.test(text);
}

function humanizeBullet(scope, text) {
  for (const [pattern, replacement] of BULLET_REWRITES) {
    if (pattern.test(text)) {
      return replacement;
    }
  }

  let line = text.trim();
  line = line.replace(/^add\s+(a\s+)?/i, '');
  line = line.replace(/^show\s+/i, '');
  line = line.replace(/^improve\s+/i, 'Improved ');

  if (scope === 'history' && !/^history/i.test(line)) {
    line = `History: ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
  }
  if (scope === 'profile' && !/^profile/i.test(line)) {
    line = `Profile: ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
  }
  if (scope === 'connectivity' && !/^when\b/i.test(line)) {
    line = `When offline: ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
  }

  line = line.charAt(0).toUpperCase() + line.slice(1);
  if (!/[.!?]$/.test(line)) {
    line += '.';
  }

  return line;
}

function mapSectionTitle(title) {
  const key = title.trim().toLowerCase();
  return SECTION_TITLES[key] ?? title;
}

function serializeSections(sections) {
  return sections
    .map((section) => {
      const bullets = section.bullets.map((bullet) => `* ${bullet}`).join('\n');
      return `### ${section.title}\n\n${bullets}`;
    })
    .join('\n\n');
}

function toCustomerFacingNotes(body) {
  const cleaned = stripTechnicalArtifacts(body);
  const sections = parseSections(cleaned)
    .map((section) => {
      const bullets = section.bullets
        .map((raw) => parseBullet(raw))
        .filter(({ scope, text }) => !isInternalBullet(scope, text))
        .map(({ scope, text }) => humanizeBullet(scope, text));

      return {
        title: mapSectionTitle(section.title),
        bullets,
      };
    })
    .filter((section) => section.bullets.length > 0);

  return serializeSections(sections);
}

/** @deprecated Use toCustomerFacingNotes */
function toUserFacingNotes(body) {
  return stripTechnicalArtifacts(body);
}

function formatNotesFile({ version, date, body }) {
  return `---\nversion: ${version}\ndate: ${date}\n---\n\n${body}\n`;
}

function notesPath(version, locale) {
  return path.join(NOTES_DIR, `${version}.${locale}.md`);
}

function parseNotesFile(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { version: null, date: null, body: raw.trim() };
  }
  const frontmatter = Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.split(/:\s*/))
      .filter((parts) => parts.length >= 2)
      .map(([key, ...rest]) => [key.trim(), rest.join(':').trim()]),
  );
  return {
    version: frontmatter.version ?? null,
    date: frontmatter.date ?? null,
    body: match[2].trim(),
  };
}

async function translateToPolish(text) {
  const key = process.env.DEEPL_API_KEY;
  if (!key) {
    throw new Error('DEEPL_API_KEY is required to generate Polish release notes');
  }

  const endpoint = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
  const params = new URLSearchParams();
  params.set('text', text);
  params.set('source_lang', 'EN');
  params.set('target_lang', 'PL');
  params.set('preserve_formatting', '1');
  params.set(
    'context',
    'Mobile app release notes for end users. Keep section headings and bullet lists. Use natural Polish.',
  );

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepL translation failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const translated = data.translations?.[0]?.text;
  if (!translated) {
    throw new Error('DeepL returned no translation');
  }
  return translated.trim();
}

function loadChangelogVersions() {
  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  return parseChangelog(changelog).map((entry) => ({
    ...entry,
    body: toCustomerFacingNotes(entry.body),
  }));
}

module.exports = {
  CHANGELOG_PATH,
  INTERNAL_SCOPES,
  NOTES_DIR,
  ROOT,
  formatNotesFile,
  humanizeBullet,
  isInternalBullet,
  loadChangelogVersions,
  notesPath,
  parseBullet,
  parseChangelog,
  parseNotesFile,
  parseSections,
  stripTechnicalArtifacts,
  toCustomerFacingNotes,
  toUserFacingNotes,
  translateToPolish,
};
