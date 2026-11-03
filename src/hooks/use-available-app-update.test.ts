/** @vitest-environment happy-dom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAvailableAppUpdate } from './use-available-app-update';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  listener: null as ((state: string) => void) | null,
  remove: vi.fn(),
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.listener = listener;
      return { remove: mocks.remove };
    },
  },
}));
vi.mock('../app-update/get-available-app-update', () => ({
  getAvailableAppUpdate: mocks.fetch,
}));

describe('useAvailableAppUpdate', () => {
  it('retries an unavailable check on foreground and keeps a found update', async () => {
    const update = { mode: 'github', currentVersion: '1.0.0', latestVersion: '2.0.0' };
    mocks.fetch.mockResolvedValueOnce(null).mockResolvedValueOnce(update);
    const { result, unmount } = renderHook(() => useAvailableAppUpdate());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.update).toBeNull();
    await act(async () => mocks.listener?.('active'));
    await waitFor(() => expect(result.current.update).toEqual(update));
    await act(async () => mocks.listener?.('active'));
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    unmount();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});
