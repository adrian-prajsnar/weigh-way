import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOTES_DIR = path.join(ROOT, 'content', 'releases');
const OUTPUT_PATH = path.join(ROOT, 'src', 'data', 'releases.json');
const REPO = process.env.GITHUB_REPOSITORY || 'adrian-prajsnar/weigh-way';
const APK_NAME = 'weigh-way.apk';
const IPA_NAME = 'weigh-way.ipa';

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

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) {
      return (pb[i] ?? 0) - (pa[i] ?? 0);
    }
  }
  return 0;
}

async function loadGitHubReleaseAssets() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'weigh-way-website',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
      headers,
    });
    if (!response.ok) {
      console.warn(`GitHub releases API failed (${response.status}); download links omitted.`);
      return new Map();
    }

    const releases = await response.json();
    const assetsByVersion = new Map();
    for (const release of releases) {
      if (!release.tag_name) {
        continue;
      }
      const version = release.tag_name.replace(/^v/, '');
      const apkAsset = (release.assets ?? []).find((item) => item.name === APK_NAME);
      const ipaAsset = (release.assets ?? []).find((item) => item.name === IPA_NAME);
      assetsByVersion.set(version, {
        apkUrl: apkAsset?.browser_download_url ?? null,
        ipaUrl: ipaAsset?.browser_download_url ?? null,
      });
    }
    return assetsByVersion;
  } catch (error) {
    console.warn(`GitHub releases API unavailable: ${error.message}`);
    return new Map();
  }
}

const files = (await readdir(NOTES_DIR)).filter((name) => name.endsWith('.en.md'));
const releaseAssets = await loadGitHubReleaseAssets();
const releases = [];

for (const fileName of files) {
  const version = fileName.replace(/\.en\.md$/, '');
  const englishRaw = await readFile(path.join(NOTES_DIR, fileName), 'utf8');
  const english = parseNotesFile(englishRaw);
  const polishFile = path.join(NOTES_DIR, `${version}.pl.md`);
  let notesPl;
  try {
    const polishRaw = await readFile(polishFile, 'utf8');
    notesPl = parseNotesFile(polishRaw).body;
  } catch {
    throw new Error(
      `Missing Polish release notes for ${version} (${path.basename(polishFile)}). Add the file or run: node scripts/snapshot-release-notes.cjs ${version}`,
    );
  }

  const assets = releaseAssets.get(version) ?? { apkUrl: null, ipaUrl: null };
  releases.push({
    version: english.version ?? version,
    date: english.date ?? '',
    notesEn: english.body,
    notesPl,
    apkUrl: assets.apkUrl,
    ipaUrl: assets.ipaUrl,
  });
}

releases.sort((a, b) => compareVersions(a.version, b.version));
await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(releases, null, 2)}\n`);
console.log(`Wrote ${releases.length} releases to src/data/releases.json`);
