import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

/* eslint-disable import/first -- after vi.mock */
import { getDismissedDashboardAlerts } from './dashboard-alert-dismissals';
/* eslint-enable import/first */

describe('getDismissedDashboardAlerts', () => {
  beforeEach(() => {
    asyncStorage.getItem.mockReset();
    asyncStorage.setItem.mockReset();
  });

  it('returns an empty list when getItem throws', async () => {
    asyncStorage.getItem.mockRejectedValueOnce(
      new DOMException('The operation is insecure.', 'SecurityError'),
    );

    await expect(getDismissedDashboardAlerts()).resolves.toEqual([]);
  });
});
