/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  registerAuthStoragePersistenceRecovery,
  retryAuthStorageDiskPersistence,
} from './auth-session-storage';

const storageMock = vi.hoisted(() => ({
  retryPendingDiskPersistence: vi.fn(),
}));

vi.mock('./resilient-auth-storage', () => ({
  createResilientAuthStorage: () => storageMock,
}));


describe('registerAuthStoragePersistenceRecovery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not remove a newer visibility listener when an older registration unregisters', () => {
    const removeEventListener = vi.spyOn(document, 'removeEventListener');

    const unregisterFirst = registerAuthStoragePersistenceRecovery();
    const unregisterSecond = registerAuthStoragePersistenceRecovery();

    unregisterFirst();
    expect(removeEventListener).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(storageMock.retryPendingDiskPersistence).toHaveBeenCalled();

    unregisterSecond();
    expect(removeEventListener).toHaveBeenCalledTimes(1);

    removeEventListener.mockRestore();
  });
});

describe('retryAuthStorageDiskPersistence', () => {
  it('delegates to resilient storage', () => {
    retryAuthStorageDiskPersistence();
    expect(storageMock.retryPendingDiskPersistence).toHaveBeenCalled();
  });
});
