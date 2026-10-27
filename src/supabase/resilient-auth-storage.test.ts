import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSecurityError } from '../security-error';

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

/* eslint-disable import/first -- after vi.mock */
import {
  createResilientAuthStorage,
  isPrimaryAuthSessionStorageKey,
  probePersistentAuthStorage,
} from './resilient-auth-storage';
/* eslint-enable import/first */

const securityError = () => new DOMException('The operation is insecure.', 'SecurityError');

function mockProbeSuccess() {
  asyncStorage.setItem.mockImplementation(async (key: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return;
    }
  });
  asyncStorage.getItem.mockImplementation(async (key: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return '1';
    }
    return null;
  });
  asyncStorage.removeItem.mockImplementation(async () => {});
}

describe('isSecurityError', () => {
  it('detects SecurityError when DOMException exists', () => {
    expect(isSecurityError(securityError())).toBe(true);
    expect(isSecurityError(new Error('other'))).toBe(false);
  });
});

describe('isPrimaryAuthSessionStorageKey', () => {
  it('matches the auth token but not the PKCE verifier key', () => {
    expect(isPrimaryAuthSessionStorageKey('sb-localhost-auth-token')).toBe(true);
    expect(isPrimaryAuthSessionStorageKey('sb-localhost-auth-token-code-verifier')).toBe(false);
  });
});

describe('probePersistentAuthStorage', () => {
  beforeEach(() => {
    asyncStorage.getItem.mockReset();
    asyncStorage.setItem.mockReset();
    asyncStorage.removeItem.mockReset();
  });

  it('returns false when the probe write throws', async () => {
    asyncStorage.setItem.mockRejectedValueOnce(securityError());
    await expect(probePersistentAuthStorage()).resolves.toBe(false);
  });
});

describe('createResilientAuthStorage', () => {
  beforeEach(() => {
    asyncStorage.getItem.mockReset();
    asyncStorage.setItem.mockReset();
    asyncStorage.removeItem.mockReset();
    mockProbeSuccess();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses disk when reads succeed', async () => {
    asyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return '1';
      }
      if (key === 'sb-key') {
        return 'token';
      }
      return null;
    });

    const storage = createResilientAuthStorage();
    await expect(storage.getItem('sb-key')).resolves.toBe('token');
  });

  it('returns null after a failed remove without reading disk again in the same instance', async () => {
    const disk = new Map<string, string>([['sb-localhost-auth-token', 'user-a']]);

    asyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return '1';
      }
      return disk.get(key) ?? null;
    });
    asyncStorage.removeItem.mockImplementation(async (key: string) => {
      if (key === 'sb-localhost-auth-token') {
        throw securityError();
      }
      disk.delete(key);
    });

    const storage = createResilientAuthStorage();
    await storage.removeItem('sb-localhost-auth-token');

    await expect(storage.getItem('sb-localhost-auth-token')).resolves.toBeNull();
    expect(storage.consumeSignOutPersistWarning()).toBe(true);
    expect(disk.has('sb-localhost-auth-token')).toBe(true);
  });

  it('clears stale disk session on the next successful write after a failed remove', async () => {
    const disk = new Map<string, string>([['sb-localhost-auth-token', 'user-a']]);
    let removeAttempts = 0;

    asyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return '1';
      }
      return disk.get(key) ?? null;
    });
    asyncStorage.removeItem.mockImplementation(async (key: string) => {
      if (key === 'sb-localhost-auth-token') {
        removeAttempts += 1;
        if (removeAttempts === 1) {
          throw securityError();
        }
      }
      disk.delete(key);
    });
    asyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return;
      }
      disk.set(key, value);
    });

    const storageA = createResilientAuthStorage();
    await storageA.removeItem('sb-localhost-auth-token');
    await expect(storageA.getItem('sb-localhost-auth-token')).resolves.toBeNull();

    await storageA.setItem('sb-localhost-auth-token', 'user-b');

    const storageB = createResilientAuthStorage();
    await expect(storageB.getItem('sb-localhost-auth-token')).resolves.toBe('user-b');
    expect(disk.get('sb-localhost-auth-token')).toBe('user-b');
  });

  it('does not permanently hide disk after a transient get error', async () => {
    let getAttempts = 0;
    asyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return '1';
      }
      if (key === 'sb-session') {
        getAttempts += 1;
        if (getAttempts === 1) {
          throw securityError();
        }
        return 'still-on-disk';
      }
      return null;
    });

    const storage = createResilientAuthStorage();
    await expect(storage.getItem('sb-session')).resolves.toBeNull();
    await expect(storage.getItem('sb-session')).resolves.toBe('still-on-disk');
  });

  it('clears the disk-blocked flag after a successful disk write', async () => {
    const disk = new Map<string, string>();
    asyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        throw securityError();
      }
      disk.set(key, value);
    });
    asyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return disk.get(key) ?? null;
      }
      return disk.get(key) ?? null;
    });
    asyncStorage.removeItem.mockImplementation(async (key: string) => {
      disk.delete(key);
    });

    const storage = createResilientAuthStorage();
    await storage.setItem('sb-session', 'overlay-only');

    asyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      disk.set(key, value);
    });
    asyncStorage.getItem.mockImplementation(async (key: string) => disk.get(key) ?? null);

    await storage.getItem('unrelated-key');
    await storage.setItem('sb-session', 'persisted');
    expect(disk.get('sb-session')).toBe('persisted');
  });
});
