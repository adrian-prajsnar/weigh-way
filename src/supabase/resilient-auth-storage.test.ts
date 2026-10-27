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
import { createResilientAuthStorage } from './resilient-auth-storage';
/* eslint-enable import/first */

describe('createResilientAuthStorage', () => {
  beforeEach(() => {
    asyncStorage.getItem.mockReset();
    asyncStorage.setItem.mockReset();
    asyncStorage.removeItem.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses AsyncStorage when reads succeed', async () => {
    asyncStorage.getItem.mockResolvedValueOnce('token');
    const storage = createResilientAuthStorage();

    await expect(storage.getItem('sb-key')).resolves.toBe('token');
    expect(asyncStorage.getItem).toHaveBeenCalledWith('sb-key');
  });

  it('falls back to memory when AsyncStorage throws', async () => {
    const securityError = new DOMException('The operation is insecure.', 'SecurityError');
    asyncStorage.getItem.mockRejectedValueOnce(securityError);
    asyncStorage.setItem.mockRejectedValue(securityError);
    asyncStorage.removeItem.mockRejectedValue(securityError);

    const storage = createResilientAuthStorage();
    await storage.setItem('sb-key', 'session');
    await expect(storage.getItem('sb-key')).resolves.toBe('session');
    await storage.removeItem('sb-key');
    await expect(storage.getItem('sb-key')).resolves.toBeNull();

    expect(asyncStorage.setItem).toHaveBeenCalledTimes(1);
    await storage.setItem('sb-key', 'again');
    expect(asyncStorage.setItem).toHaveBeenCalledTimes(1);
  });
});
