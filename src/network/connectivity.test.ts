import { describe, expect, it } from 'vitest';
import {
  getWebDemoBasePath,
  getWebReachabilityUrl,
  resolveIsOffline,
  shouldBlockSaveForOffline,
  shouldConfigureWebReachability,
} from './connectivity-status';

describe('connectivity', () => {
  it('resolves demo base path on GitHub Pages', () => {
    expect(getWebDemoBasePath('/weigh-way/demo/')).toBe('/weigh-way/demo/');
    expect(getWebDemoBasePath('/weigh-way/demo/index.html')).toBe('/weigh-way/demo/');
    expect(getWebDemoBasePath('/app/')).toBeNull();
  });

  it('uses demo index.html for reachability instead of site root', () => {
    expect(
      getWebReachabilityUrl('https://adrian-prajsnar.github.io', '/weigh-way/demo/'),
    ).toBe('https://adrian-prajsnar.github.io/weigh-way/demo/index.html');
  });

  it('configures reachability on demo paths', () => {
    expect(shouldConfigureWebReachability('/weigh-way/demo/', '')).toBe(true);
    expect(shouldConfigureWebReachability('/app/', '')).toBe(false);
  });

  it('treats unknown reachability as online', () => {
    expect(resolveIsOffline(true, null)).toBe(false);
    expect(resolveIsOffline(null, null)).toBe(false);
    expect(resolveIsOffline(true, false)).toBe(true);
  });

  it('does not block demo saves when offline is reported', () => {
    expect(shouldBlockSaveForOffline(true, true)).toBe(false);
    expect(shouldBlockSaveForOffline(true, false)).toBe(true);
  });
});
