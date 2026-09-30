require('./load-env.cjs').loadEnv();

const fs = require('fs');
const path = require('path');
const {
  generateEnglishReleaseNotes,
  generatePolishReleaseNotes,
  generateReleaseNotes,
} = require('./llm-release-notes.cjs');
const {
  NOTES_DIR,
  formatNotesFile,
  loadChangelogVersions,
  notesPath,
} = require('./user-facing-notes.cjs');

async function snapshotVersion(entry) {
  fs.mkdirSync(NOTES_DIR, { recursive: true });

  const englishPath = notesPath(entry.version, 'en');
  const polishPath = notesPath(entry.version, 'pl');
  const needsEn = !fs.existsSync(englishPath);
  const needsPl = !fs.existsSync(polishPath);

  if (!needsEn && !needsPl) {
    console.log(`Kept existing English and Polish notes for ${entry.version}`);
    return;
  }

  if (needsEn && needsPl) {
    const { notesEn, notesPl } = await generateReleaseNotes({
      version: entry.version,
      changelogBody: entry.body,
    });
    fs.writeFileSync(
      englishPath,
      formatNotesFile({ version: entry.version, date: entry.date, body: notesEn }),
      'utf8',
    );
    fs.writeFileSync(
      polishPath,
      formatNotesFile({ version: entry.version, date: entry.date, body: notesPl }),
      'utf8',
    );
    console.log(`Wrote LLM English and Polish release notes for ${entry.version}`);
    return;
  }

  if (needsEn) {
    const notesEn = await generateEnglishReleaseNotes({
      version: entry.version,
      changelogBody: entry.body,
    });
    fs.writeFileSync(
      englishPath,
      formatNotesFile({ version: entry.version, date: entry.date, body: notesEn }),
      'utf8',
    );
    console.log(`Wrote LLM English release notes for ${entry.version}`);
  }

  if (needsPl) {
    const notesPl = await generatePolishReleaseNotes({
      version: entry.version,
      changelogBody: entry.body,
    });
    fs.writeFileSync(
      polishPath,
      formatNotesFile({ version: entry.version, date: entry.date, body: notesPl }),
      'utf8',
    );
    console.log(`Wrote LLM Polish release notes for ${entry.version}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const force = args.includes('--force');
  const versionArg = args.find((arg) => !arg.startsWith('--'));
  const versions = loadChangelogVersions();

  if (versions.length === 0) {
    throw new Error('CHANGELOG.md has no version sections');
  }

  const selected = all
    ? versions
    : versions.filter((entry) => entry.version === versionArg);

  if (!all && !versionArg) {
    throw new Error(
      'Usage: node scripts/snapshot-release-notes.cjs <version> | --all [--force]',
    );
  }

  if (selected.length === 0) {
    throw new Error(`No CHANGELOG section found for ${versionArg}`);
  }

  if (force) {
    for (const entry of selected) {
      for (const locale of ['en', 'pl']) {
        const filePath = notesPath(entry.version, locale);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
  }

  for (const entry of selected) {
    await snapshotVersion(entry);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
