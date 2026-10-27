import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const bumpScript = path.join(import.meta.dirname, 'bump-expo-version.cjs');

describe('bump-expo-version.cjs', () => {
  it('increments android versionCode and ios buildNumber in a temp project root', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weigh-way-bump-'));
    const appConfig = `export default { android: { versionCode: 7 }, ios: { buildNumber: '7' } };\n`;
    fs.writeFileSync(path.join(tempDir, 'app.config.ts'), appConfig);
    fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify({ expo: { version: '1.0.0' } }));
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    fs.writeFileSync(
      path.join(tempDir, 'package-lock.json'),
      JSON.stringify({ version: '1.0.0', packages: { '': { version: '1.0.0' } } }),
    );

    execFileSync('node', [bumpScript, '1.0.1', tempDir]);

    const updated = fs.readFileSync(path.join(tempDir, 'app.config.ts'), 'utf8');
    expect(updated).toContain('versionCode: 8');
    expect(updated).toContain("buildNumber: '8'");
  });
});
