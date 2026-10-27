import { beforeEach, describe, expect, it, vi } from 'vitest';

const disk = vi.hoisted(() => new Map<string, string>());
const storageBroken = vi.hoisted(() => ({ current: false }));

const securityError = () => new DOMException('The operation is insecure.', 'SecurityError');

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(async (key: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return '1';
    }
    if (storageBroken.current) {
      throw securityError();
    }
    return disk.get(key) ?? null;
  }),
  setItem: vi.fn(async (key: string, value: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return;
    }
    if (storageBroken.current) {
      throw securityError();
    }
    disk.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    if (storageBroken.current) {
      throw securityError();
    }
    disk.delete(key);
  }),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

describe('resilient auth storage reload', () => {
  const sessionKey = 'sb-localhost-auth-token';

  beforeEach(() => {
    vi.resetModules();
    disk.clear();
    storageBroken.current = false;
    asyncStorage.getItem.mockClear();
    asyncStorage.setItem.mockClear();
    asyncStorage.removeItem.mockClear();
    disk.set(sessionKey, 'user-a-session');
  });

  it('reloads the stale disk session when sign-out never persisted to storage', async () => {
    const first = await import('./resilient-auth-storage');
    const storageA = first.createResilientAuthStorage();
    await expect(storageA.getItem(sessionKey)).resolves.toBe('user-a-session');

    storageBroken.current = true;
    await storageA.removeItem(sessionKey);

    vi.resetModules();
    storageBroken.current = false;

    const reloaded = await import('./resilient-auth-storage');
    const storageB = reloaded.createResilientAuthStorage();
    await expect(storageB.getItem(sessionKey)).resolves.toBe('user-a-session');
  });

  it('reloads with no session after pending sign-out persistence flushes once storage recovers', async () => {
    const first = await import('./resilient-auth-storage');
    const storageA = first.createResilientAuthStorage();
    await expect(storageA.getItem(sessionKey)).resolves.toBe('user-a-session');

    storageBroken.current = true;
    await storageA.removeItem(sessionKey);

    storageBroken.current = false;
    await storageA.retryPendingDiskPersistence();

    vi.resetModules();
    const reloaded = await import('./resilient-auth-storage');
    const storageB = reloaded.createResilientAuthStorage();
    await expect(storageB.getItem(sessionKey)).resolves.toBeNull();
  });
});
