import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const bumpScript = path.join(import.meta.dirname, 'bump-expo-version.cjs');
const repoRoot = path.join(import.meta.dirname, '..');

function writeMinimalProject(root: string, appConfig: string) {
  fs.writeFileSync(path.join(root, 'app.config.ts'), appConfig);
  fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo: { version: '1.0.0' } }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '1.0.0' }));
  fs.writeFileSync(
    path.join(root, 'package-lock.json'),
    JSON.stringify({ version: '1.0.0', packages: { '': { version: '1.0.0' } } }),
  );
}

function runBump(version: string, projectRoot: string) {
  const env = { ...process.env };
  delete env.WEIGH_WAY_PROJECT_ROOT;
  execFileSync('node', [bumpScript, version, projectRoot], { env });
}

describe('bump-expo-version.cjs', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('increments android versionCode and ios buildNumber in an explicit temp project root', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weigh-way-bump-'));
    tempDirs.push(tempDir);
    writeMinimalProject(
      tempDir,
      `export default { android: { versionCode: 7 }, ios: { buildNumber: '7' } };\n`,
    );

    runBump('1.0.1', tempDir);

    const updated = fs.readFileSync(path.join(tempDir, 'app.config.ts'), 'utf8');
    expect(updated).toContain('versionCode: 8');
    expect(updated).toContain("buildNumber: '8'");

    const repoConfig = fs.readFileSync(path.join(repoRoot, 'app.config.ts'), 'utf8');
    expect(repoConfig).toContain('versionCode: 7');
  });

  it('inserts ios buildNumber when missing and prefers projectRoot arg over empty env', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weigh-way-bump-'));
    tempDirs.push(tempDir);
    writeMinimalProject(tempDir, `export default { android: { versionCode: 3 } };\n`);

    const env = { ...process.env, WEIGH_WAY_PROJECT_ROOT: '' };
    execFileSync('node', [bumpScript, '2.0.0', tempDir], { env });

    const updated = fs.readFileSync(path.join(tempDir, 'app.config.ts'), 'utf8');
    expect(updated).toContain('versionCode: 4');
    expect(updated).toContain("buildNumber: '4'");
    expect(updated).toMatch(/ios:\s*\{/);
  });
});
