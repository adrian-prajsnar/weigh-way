import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('bump-expo-version.cjs', () => {
  it('increments android versionCode in app.config.ts', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weigh-way-bump-'));
    const appConfig = `export default { android: { versionCode: 8 }, ios: { buildNumber: '8' } };\n`;
    fs.writeFileSync(path.join(tempDir, 'app.config.ts'), appConfig);
    fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify({ expo: { version: '1.0.0' } }));
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    fs.writeFileSync(
      path.join(tempDir, 'package-lock.json'),
      JSON.stringify({ version: '1.0.0', packages: { '': { version: '1.0.0' } } }),
    );

    execFileSync('node', [path.join(process.cwd(), 'scripts/bump-expo-version.cjs'), '1.0.1'], {
      cwd: tempDir,
    });

    const updated = fs.readFileSync(path.join(tempDir, 'app.config.ts'), 'utf8');
    expect(updated).toContain('versionCode: 9');
  });
});
