import { afterEach, describe, expect, it, vi } from 'vitest';

const DEV_FLAG_ENV = 'EXPO_PUBLIC_DEV';

async function loadGuard(dev: boolean, envValue?: string) {
  vi.stubGlobal('__DEV__', dev);
  if (envValue === undefined) {
    vi.unstubAllEnvs();
  } else {
    vi.stubEnv(DEV_FLAG_ENV, envValue);
  }
  vi.resetModules();
  return import('./dev-auth-guard');
}

describe('isDevAuthGuardActive', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is active in local dev when env is unset', async () => {
    const { isDevAuthGuardActive } = await loadGuard(true);
    expect(isDevAuthGuardActive()).toBe(true);
  });

  it('is inactive when EXPO_PUBLIC_DEV=false', async () => {
    const { isDevAuthGuardActive } = await loadGuard(true, 'false');
    expect(isDevAuthGuardActive()).toBe(false);
  });

  it('is inactive in production builds', async () => {
    const { isDevAuthGuardActive } = await loadGuard(false);
    expect(isDevAuthGuardActive()).toBe(false);
  });
});

describe('isDevAllowedEmail', () => {
  it('accepts emails containing +dev', async () => {
    const { isDevAllowedEmail } = await loadGuard(true);
    expect(isDevAllowedEmail('you+dev@example.com')).toBe(true);
    expect(isDevAllowedEmail('  YOU+DEV@test.com  ')).toBe(true);
    expect(isDevAllowedEmail('you@example.com')).toBe(false);
  });
});

describe('assertDevAllowedEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('allows any email when the guard is disabled', async () => {
    const { assertDevAllowedEmail } = await loadGuard(true, 'false');
    expect(() => assertDevAllowedEmail('you@example.com')).not.toThrow();
  });

  it('rejects non-dev emails when the guard is active', async () => {
    const { assertDevAllowedEmail } = await loadGuard(true);
    expect(() => assertDevAllowedEmail('you@example.com')).toThrow(
      'Local dev requires a "+dev" email (e.g. you+dev@example.com).',
    );
  });
});
