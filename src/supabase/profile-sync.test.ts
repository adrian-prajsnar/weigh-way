import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const maybeSingle = vi.fn();
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle,
    upsert,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { upsert, maybeSingle, query };
});

vi.mock('./client', () => ({
  supabase: {
    from: () => mocks.query,
    auth: { refreshSession: vi.fn().mockResolvedValue({ error: null }) },
  },
}));
vi.mock('./auth-user', () => ({ getUserId: async () => 'user-1' }));
// eslint-disable-next-line import/first -- load after vi.mock
import { getUserProfile, saveUserProfile } from './profile-sync';

const upsert = mocks.upsert;

describe('profile reads after a cold start', () => {
  afterEach(() => {
    vi.useRealTimers();
    mocks.maybeSingle.mockReset();
  });

  it('loads the profile when the refreshed token is rejected once', async () => {
    vi.useFakeTimers();
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST303', message: 'JWT issued at future' },
      })
      .mockResolvedValueOnce({ data: { birth_date: '1988-06-10', sex: 'male' }, error: null });

    const pending = getUserProfile();
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toEqual({ birthDate: '1988-06-10', sex: 'male' });
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(2);
  });
});

describe('partial profile writes', () => {
  it('does not send birth_date when changing sex', async () => {
    await saveUserProfile({ sex: 'female' });
    expect(upsert.mock.calls.at(-1)?.[0]).toMatchObject({ user_id: 'user-1', sex: 'female' });
    expect(upsert.mock.calls.at(-1)?.[0]).not.toHaveProperty('birth_date');
  });
  it('can explicitly clear birth_date without changing sex', async () => {
    await saveUserProfile({ birthDate: null });
    expect(upsert.mock.calls.at(-1)?.[0]).toMatchObject({ birth_date: null });
    expect(upsert.mock.calls.at(-1)?.[0]).not.toHaveProperty('sex');
  });
});
