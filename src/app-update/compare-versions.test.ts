import { describe, expect, it } from 'vitest';
import { isVersionNewer, normalizeVersion } from './compare-versions';

describe('normalizeVersion', () => {
  it('strips a leading v', () => {
    expect(normalizeVersion('v1.4.0')).toBe('1.4.0');
  });
});

describe('isVersionNewer', () => {
  it('detects patch, minor, and major bumps', () => {
    expect(isVersionNewer('1.4.1', '1.4.0')).toBe(true);
    expect(isVersionNewer('1.5.0', '1.4.0')).toBe(true);
    expect(isVersionNewer('2.0.0', '1.4.0')).toBe(true);
  });

  it('returns false when versions match', () => {
    expect(isVersionNewer('1.4.0', '1.4.0')).toBe(false);
    expect(isVersionNewer('v1.4.0', '1.4.0')).toBe(false);
  });

  it('returns false when current is newer', () => {
    expect(isVersionNewer('1.3.0', '1.4.0')).toBe(false);
  });
});
