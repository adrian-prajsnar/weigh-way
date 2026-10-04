const fs = require('fs');
const { execSync } = require('child_process');

const WEBSITE_PREFIX = /^website\//;
const APP_PATHS = /^(?:src\/|assets\/|app\.tsx$|app\.config\.ts$|app\.json$)/;

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function classifyPath(filePath) {
  const normalized = normalizePath(filePath);
  if (WEBSITE_PREFIX.test(normalized)) {
    return 'website';
  }
  if (APP_PATHS.test(normalized)) {
    return 'app';
  }
  return 'neutral';
}

function analyzePaths(paths) {
  let hasWebsite = false;
  let hasApp = false;

  for (const filePath of paths) {
    const kind = classifyPath(filePath);
    if (kind === 'website') {
      hasWebsite = true;
    }
    if (kind === 'app') {
      hasApp = true;
    }
  }

  return { hasWebsite, hasApp, paths };
}

function parseCommitScope(message) {
  const firstLine = message.trim().split(/\r?\n/)[0] ?? '';
  const match = firstLine.match(/^[a-z]+(?:\(([^)]+)\))?!?:/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function isIgnoredCommit(message) {
  const firstLine = message.trim().split(/\r?\n/)[0] ?? '';
  return /^chore\(release\):/.test(firstLine);
}

function validateCommitScope(message, stagedPaths) {
  if (isIgnoredCommit(message)) {
    return { valid: true };
  }

  const scope = parseCommitScope(message);
  const { hasWebsite, hasApp } = analyzePaths(stagedPaths);

  if (hasWebsite && hasApp) {
    return {
      valid: false,
      error:
        'Mixed commit: website/ and mobile app files are staged together. Split into separate commits (e.g. fix(website): … and fix(dashboard): …).',
    };
  }

  if (hasWebsite && scope !== 'website') {
    return {
      valid: false,
      error:
        'Website-only changes require the website scope (e.g. fix(website): center footer on narrow viewports).',
    };
  }

  if (scope === 'website' && hasApp) {
    return {
      valid: false,
      error:
        'Commits with website scope cannot include mobile app files. Split app changes into a separate commit.',
    };
  }

  return { valid: true };
}

function readCommitMessage(messagePath) {
  return fs.readFileSync(messagePath, 'utf8');
}

function getStagedPaths() {
  const output = execSync('git diff --cached --name-only', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const messagePath = process.argv[2];
  if (!messagePath) {
    console.error('Usage: node scripts/validate-commit-scope.cjs <commit-msg-file>');
    process.exit(1);
  }

  const message = readCommitMessage(messagePath);
  const stagedPaths = getStagedPaths();
  const result = validateCommitScope(message, stagedPaths);

  if (!result.valid) {
    console.error(`commit scope: ${result.error}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzePaths,
  classifyPath,
  isIgnoredCommit,
  parseCommitScope,
  validateCommitScope,
};
