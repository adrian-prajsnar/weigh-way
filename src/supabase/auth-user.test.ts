import { describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';

const getSession = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  supabase: { auth: { getSession } },
}));

// eslint-disable-next-line import/first -- load after vi.mock
import { getUserId } from './auth-user';
// eslint-disable-next-line import/first -- load after vi.mock
import { SignedOutError } from './errors';

describe('getUserId', () => {
  it('returns the signed-in user', async () => {
    getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    await expect(getUserId()).resolves.toBe('user-1');
  });

  it('keeps a failed refresh so the caller can retry it', async () => {
    const refreshError = Object.assign(new TypeError('Failed to fetch'), {
      name: 'AuthRetryableFetchError',
    });
    getSession.mockResolvedValueOnce({ data: { session: null }, error: refreshError });
    await expect(getUserId()).rejects.toBe(refreshError);
  });

  it('treats a dead refresh token as signed out', async () => {
    const refreshError = Object.assign(
      new Error('Invalid Refresh Token: Refresh Token Not Found'),
      { name: 'AuthApiError', code: 'refresh_token_not_found', status: 400 },
    );
    getSession.mockResolvedValueOnce({ data: { session: null }, error: refreshError });
    await expect(getUserId()).rejects.toBeInstanceOf(SignedOutError);
  });

  it('requires a session when refresh did not fail', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(getUserId()).rejects.toThrow(t('errors.mustBeSignedIn'));
  });
});
