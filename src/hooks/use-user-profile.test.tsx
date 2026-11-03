/** @vitest-environment happy-dom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  userId: 'user-a',
  getHeightEntries: vi.fn(),
  getUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
  saveHeight: vi.fn(),
  deleteHeight: vi.fn(),
  updateHeight: vi.fn(),
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
  deleteDemoHeight: vi.fn(),
  getDemoProfile: vi.fn(),
  saveDemoHeight: vi.fn(),
  saveDemoUserProfile: vi.fn(),
}));
vi.mock('./use-refresh-on-app-foreground', () => ({ useRefreshOnAppForeground: vi.fn() }));
vi.mock('./use-network-status', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
vi.mock('../network/connectivity', () => ({ shouldBlockSaveForOffline: () => false }));
vi.mock('../supabase/profile-sync', () => ({
  getUserProfile: mocks.getUserProfile,
  saveUserProfile: mocks.saveUserProfile,
}));
vi.mock('../supabase/height-sync', () => mocks);
// eslint-disable-next-line import/first -- load after vi.mock
import { useUserProfile } from './use-user-profile';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 'user-a';
  mocks.getHeightEntries.mockResolvedValue([]);
  mocks.getUserProfile.mockResolvedValue({ birthDate: '2000-01-01', sex: 'male' });
  mocks.saveUserProfile.mockResolvedValue(undefined);
  mocks.saveHeight.mockResolvedValue(undefined);
  mocks.deleteHeight.mockResolvedValue(undefined);
  mocks.updateHeight.mockResolvedValue(undefined);
});
describe('profile writes', () => {
  it('rejects an edit after failed initial load instead of wiping stored fields', async () => {
    mocks.getUserProfile.mockRejectedValueOnce(new Error('load failed'));
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await expect(result.current.saveSexEntry('female')).rejects.toThrow();
    expect(mocks.saveUserProfile).not.toHaveBeenCalled();
  });
  it('sends only the changed field and preserves committed state on refresh failure', async () => {
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.getUserProfile.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.saveSexEntry('female');
    });
    expect(mocks.saveUserProfile).toHaveBeenCalledWith({ sex: 'female' });
    expect(result.current.sex).toBe('female');
    expect(result.current.birthDate).toBe('2000-01-01');
  });
  it('uses one atomic move and preserves the committed height when refresh fails', async () => {
    mocks.getHeightEntries.mockResolvedValueOnce([{ effectiveDate: '2026-01-01', heightCm: 176 }]);
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.getHeightEntries.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.updateHeightEntry('2026-01-01', '2026-01-02', 176);
    });
    expect(mocks.updateHeight).toHaveBeenCalledWith('2026-01-01', '2026-01-02', 176);
    expect(mocks.saveHeight).not.toHaveBeenCalled();
    expect(mocks.deleteHeight).not.toHaveBeenCalled();
    expect(result.current.heightEntries).toEqual([{ effectiveDate: '2026-01-02', heightCm: 176 }]);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('profile request ordering', () => {
  it('ignores an older profile refresh that completes after a save', async () => {
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const old = deferred<{ birthDate: string; sex: string }>();
    mocks.getUserProfile.mockReturnValueOnce(old.promise);
    let refresh!: Promise<void>;
    act(() => {
      refresh = result.current.refreshProfile();
    });
    mocks.getUserProfile.mockResolvedValueOnce({ birthDate: '2000-01-01', sex: 'female' });
    await act(async () => {
      await result.current.saveSexEntry('female');
    });
    await act(async () => {
      old.resolve({ birthDate: '2000-01-01', sex: 'male' });
      await refresh;
    });
    expect(result.current.sex).toBe('female');
  });

  it('ignores a previous users pending height and profile reads', async () => {
    const oldProfile = deferred<{ birthDate: string; sex: string }>();
    const oldHeights = deferred<{ effectiveDate: string; heightCm: number }[]>();
    mocks.getUserProfile.mockReturnValueOnce(oldProfile.promise);
    mocks.getHeightEntries.mockReturnValueOnce(oldHeights.promise);
    const { result, rerender } = renderHook(() => useUserProfile());
    mocks.userId = 'user-b';
    mocks.getUserProfile.mockResolvedValueOnce({ birthDate: '1990-01-01', sex: 'female' });
    rerender();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await act(async () => {
      oldProfile.resolve({ birthDate: '2000-01-01', sex: 'male' });
      oldHeights.resolve([{ effectiveDate: '2026-01-01', heightCm: 176 }]);
      await Promise.all([oldProfile.promise, oldHeights.promise]);
    });
    expect(result.current.birthDate).toBe('1990-01-01');
    expect(result.current.sex).toBe('female');
    expect(result.current.heightEntries).toEqual([]);
  });
});
