import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOTSTRAP_SESSION_DEADLINE_MS,
  runBootstrapAuthSession,
  type BootstrapAuthSessionDeps,
} from './bootstrap-auth-session';

const sampleSession = {
  access_token: 'token-a',
  refresh_token: 'refresh-a',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-1' },
};

function createDeps(overrides: Partial<BootstrapAuthSessionDeps> = {}): BootstrapAuthSessionDeps {
  let generation = 0;
  return {
    getAuthEventGeneration: () => generation,
    getSession: vi.fn().mockResolvedValue({ data: { session: sampleSession } }),
    restoredSessionNeedsServerValidation: vi.fn().mockResolvedValue(false),
    validateRestoredSessionInBackground: vi.fn().mockResolvedValue(undefined),
    applyBootstrapSessionIfGeneration: vi.fn(),
    setRestoredSessionValidationPending: vi.fn(),
    setLoading: vi.fn(),
    onBootstrapComplete: vi.fn(),
    onRestoredSessionBackgroundValidationBegin: vi.fn(),
    onRestoredSessionBackgroundValidationEnd: vi.fn(),
    runFailClosedLocalSignOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runBootstrapAuthSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ends loading within the bootstrap deadline when getSession hangs', async () => {
    const deps = createDeps({
      getSession: vi.fn((): Promise<{ data: { session: null } }> => new Promise(() => {})),
    });

    void runBootstrapAuthSession(deps);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_SESSION_DEADLINE_MS);

    expect(deps.setLoading).toHaveBeenCalledWith(false);
    expect(deps.applyBootstrapSessionIfGeneration).toHaveBeenCalledWith(0, null);
  });

  it('ends loading within the deadline when restored-session validation hangs on an unflagged session', async () => {
    const deps = createDeps({
      validateRestoredSessionInBackground: vi.fn((): Promise<void> => new Promise(() => {})),
    });

    const runPromise = runBootstrapAuthSession(deps);
    await vi.runOnlyPendingTimersAsync();
    await runPromise;

    expect(deps.applyBootstrapSessionIfGeneration).toHaveBeenCalledWith(0, sampleSession);
    expect(deps.setLoading).toHaveBeenCalledWith(false);
  });

  it('ends loading within the deadline when flagged validation and logout hang', async () => {
    const deps = createDeps({
      restoredSessionNeedsServerValidation: vi.fn().mockResolvedValue(true),
      validateRestoredSessionInBackground: vi.fn((): Promise<void> => new Promise(() => {})),
      runFailClosedLocalSignOut: vi.fn((): Promise<void> => new Promise(() => {})),
    });

    void runBootstrapAuthSession(deps);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_SESSION_DEADLINE_MS);

    expect(deps.setLoading).toHaveBeenCalledWith(false);
    expect(deps.runFailClosedLocalSignOut).toHaveBeenCalled();
  });

  it('ends loading when getSession rejects', async () => {
    const deps = createDeps({
      getSession: vi.fn().mockRejectedValue(new Error('storage_read_failed')),
    });

    await runBootstrapAuthSession(deps);

    expect(deps.applyBootstrapSessionIfGeneration).toHaveBeenCalledWith(0, null);
    expect(deps.setLoading).toHaveBeenCalledWith(false);
  });

  it('skips fail-closed sign-out when the access token changed during flagged validation', async () => {
    const deps = createDeps({
      restoredSessionNeedsServerValidation: vi.fn().mockResolvedValue(true),
      validateRestoredSessionInBackground: vi.fn((): Promise<void> => new Promise(() => {})),
      getSession: vi
        .fn()
        .mockResolvedValueOnce({ data: { session: sampleSession } })
        .mockResolvedValue({ data: { session: { ...sampleSession, access_token: 'token-b' } } }),
    });

    void runBootstrapAuthSession(deps);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_SESSION_DEADLINE_MS);

    expect(deps.runFailClosedLocalSignOut).not.toHaveBeenCalled();
  });

  it('skips fail-closed sign-out when the auth generation changed during flagged validation', async () => {
    let generation = 0;
    const deps = createDeps({
      getAuthEventGeneration: () => generation,
      restoredSessionNeedsServerValidation: vi.fn().mockResolvedValue(true),
      validateRestoredSessionInBackground: vi.fn((): Promise<void> => new Promise(() => {})),
    });

    void runBootstrapAuthSession(deps);
    generation = 1;
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_SESSION_DEADLINE_MS);

    expect(deps.runFailClosedLocalSignOut).not.toHaveBeenCalled();
  });
});
