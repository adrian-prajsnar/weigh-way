import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../demo/is-demo-mode', () => ({
  isDemoMode: vi.fn(() => false),
}));

describe('shouldRunAppUpdateCheck', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', true);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('runs when mock is enabled in dev', async () => {
    vi.stubEnv('EXPO_PUBLIC_APP_UPDATE_MOCK', 'true');
    vi.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
    const { shouldRunAppUpdateCheck } = await import('./should-run-app-update-check');
    expect(shouldRunAppUpdateCheck()).toBe(true);
  });

  it('skips in dev when mock is off', async () => {
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    const { shouldRunAppUpdateCheck } = await import('./should-run-app-update-check');
    expect(shouldRunAppUpdateCheck()).toBe(false);
  });

  it('runs on native in production builds', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    const { shouldRunAppUpdateCheck } = await import('./should-run-app-update-check');
    expect(shouldRunAppUpdateCheck()).toBe(true);
  });
});
