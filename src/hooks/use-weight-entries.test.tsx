/** @vitest-environment happy-dom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  getEntries: vi.fn(),
  saveEntry: vi.fn(),
  deleteEntry: vi.fn(),
  userId: 'user-a',
  offline: false,
}));
vi.mock('../context/supabase-auth-context', () => ({
  useSupabaseAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    session: { user: { id: mocks.userId } },
  }),
}));
vi.mock('../demo/is-demo-mode', () => ({ isDemoMode: () => false }));
vi.mock('../demo/demo-storage', () => ({
  deleteDemoWeightEntry: vi.fn(),
  getDemoWeightEntries: vi.fn(),
  saveDemoWeightEntry: vi.fn(),
}));
vi.mock('./use-refresh-on-app-foreground', () => ({ useRefreshOnAppForeground: vi.fn() }));
vi.mock('./use-network-status', () => ({ useNetworkStatus: () => ({ isOffline: mocks.offline }) }));
vi.mock('../network/connectivity', () => ({
  shouldBlockSaveForOffline: (offline: boolean) => offline,
}));
vi.mock('../supabase/weight-sync', () => mocks);
// eslint-disable-next-line import/first -- load after vi.mock
import { useWeightEntries } from './use-weight-entries';
const entry = {
  date: '2026-01-01',
  weightKg: 70,
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 'user-a';
  mocks.offline = false;
  mocks.getEntries.mockResolvedValue([]);
  mocks.saveEntry.mockResolvedValue(entry);
  mocks.deleteEntry.mockResolvedValue(undefined);
});
describe('weight state requests and writes', () => {
  it('keeps a committed save when its follow-up read fails', async () => {
    const { result } = renderHook(() => useWeightEntries());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.getEntries.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.upsertEntry(entry.date, entry.weightKg);
    });
    expect(result.current.entries).toEqual([entry]);
    expect(result.current.error).toBe('offline');
  });
  it('keeps a committed delete when its follow-up read fails', async () => {
    mocks.getEntries.mockResolvedValueOnce([entry]);
    const { result } = renderHook(() => useWeightEntries());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.getEntries.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.removeEntry(entry.date);
    });
    expect(result.current.entries).toEqual([]);
  });
  it('ignores an older refresh that completes after a save', async () => {
    const { result } = renderHook(() => useWeightEntries());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const old = deferred<(typeof entry)[]>();
    mocks.getEntries.mockReturnValueOnce(old.promise);
    let refresh!: Promise<void>;
    act(() => {
      refresh = result.current.refreshEntries();
    });
    mocks.getEntries.mockResolvedValueOnce([entry]);
    await act(async () => {
      await result.current.upsertEntry(entry.date, entry.weightKg);
    });
    await act(async () => {
      old.resolve([]);
      await refresh;
    });
    expect(result.current.entries).toEqual([entry]);
  });
  it('ignores another users pending response', async () => {
    const old = deferred<(typeof entry)[]>();
    mocks.getEntries.mockReturnValueOnce(old.promise);
    const { result, rerender } = renderHook(() => useWeightEntries());
    mocks.userId = 'user-b';
    rerender();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await act(async () => {
      old.resolve([entry]);
      await old.promise;
    });
    expect(result.current.entries).toEqual([]);
  });
  it('blocks delete with the latest offline status', async () => {
    const { result, rerender } = renderHook(() => useWeightEntries());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const remove = result.current.removeEntry;
    mocks.offline = true;
    rerender();
    await expect(remove(entry.date)).rejects.toThrow();
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
  });
});
