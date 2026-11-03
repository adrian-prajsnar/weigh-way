const parserOpts = {
  headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
  breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
};

/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        parserOpts,
        releaseRules: [
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
        ],
      },
    ],
    ['@semantic-release/release-notes-generator', { parserOpts }],
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
