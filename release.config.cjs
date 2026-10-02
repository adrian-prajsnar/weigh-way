/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        releaseRules: [
          { type: 'docs', release: false },
          { type: 'chore', release: false },
          { type: 'style', release: false },
          { type: 'refactor', release: false },
          { type: 'test', release: false },
          { type: 'build', release: false },
          { type: 'ci', release: false },
          { scope: 'ci', release: false },
          { scope: 'dev', release: false },
          { scope: 'deps', release: false },
          { scope: 'build', release: false },
          { scope: 'release', release: false },
          { scope: 'test', release: false },
          { scope: 'tests', release: false },
          { scope: 'lint', release: false },
          { scope: 'husky', release: false },
          { scope: 'commitlint', release: false },
          { scope: 'workflow', release: false },
          { scope: 'github', release: false },
          { scope: 'website', release: false },
          { scope: 'expo', release: false },
          { type: 'fix', release: false },
          { scope: 'auth', release: 'patch' },
          { scope: 'app', release: 'patch' },
          { scope: 'dashboard', release: 'patch' },
          { scope: 'comparison', release: 'patch' },
          { scope: 'history', release: 'patch' },
          { scope: 'profile', release: 'patch' },
          { scope: 'layout', release: 'patch' },
          { scope: 'brand', release: 'patch' },
          { scope: 'connectivity', release: 'patch' },
        ],
      },
    ],
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/bump-expo-version.cjs ${nextRelease.version}',
        successCmd: 'node scripts/write-release-output.cjs ${nextRelease.version}',
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/snapshot-release-notes.cjs ${nextRelease.version}',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'app.json',
          'app.config.ts',
          'package.json',
          'package-lock.json',
          'CHANGELOG.md',
          'website/content/releases',
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
    '@semantic-release/github',
  ],
};
