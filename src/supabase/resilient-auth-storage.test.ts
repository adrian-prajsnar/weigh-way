import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  probePersistentAuthStorage,
} from './resilient-auth-storage';
/* eslint-enable import/first */

const securityError = () => new DOMException('The operation is insecure.', 'SecurityError');

function mockProbeSuccess() {
  asyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
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

  it('after a transient set error, remove clears disk for a new storage instance', async () => {
    const disk = new Map<string, string>();

    asyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return;
      }
      if (key === 'sb-session') {
        throw securityError();
      }
      disk.set(key, value);
    });
    asyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return '1';
      }
      return disk.get(key) ?? null;
    });
    asyncStorage.removeItem.mockImplementation(async (key: string) => {
      disk.delete(key);
    });

    const storageA = createResilientAuthStorage();
    disk.set('sb-session', 'user-a');
    await storageA.setItem('sb-session', 'user-a-overlay');
    await storageA.removeItem('sb-session');

    const storageB = createResilientAuthStorage();
    await expect(storageB.getItem('sb-session')).resolves.toBeNull();
    expect(disk.has('sb-session')).toBe(false);
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
});
