import { describe, expect, it, vi } from 'vitest';
const upsert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock('./client', () => ({ supabase: { from: () => ({ upsert }) } }));
vi.mock('./auth-user', () => ({ getUserId: async () => 'user-1' }));
// eslint-disable-next-line import/first -- load after vi.mock
import { saveUserProfile } from './profile-sync';
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
