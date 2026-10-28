import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminState = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock('./client', () => ({
  supabase: {
    auth: {
      admin: {
        signOut: adminState.signOut,
      },
    },
  },
}));

/* eslint-disable import/first -- after vi.mock */
import { revokeSessionOnServer } from './revoke-session-on-server';
/* eslint-enable import/first */

describe('revokeSessionOnServer', () => {
  beforeEach(() => {
    adminState.signOut.mockReset();
    adminState.signOut.mockResolvedValue({ error: null });
  });

  it('calls admin signOut with the access token', async () => {
    await revokeSessionOnServer('token-a', 'global');
    expect(adminState.signOut).toHaveBeenCalledWith('token-a', 'global');
  });

  it('treats session-not-found responses as already revoked', async () => {
    adminState.signOut.mockResolvedValue({
      error: { status: 403, code: 'session_not_found', message: 'not found' },
    });
    await expect(revokeSessionOnServer('token-a')).resolves.toEqual({
      result: 'already_revoked',
    });
  });

  it('treats expired access tokens as needing refresh, not already revoked', async () => {
    adminState.signOut.mockResolvedValue({
      error: { status: 401, code: 'bad_jwt', message: 'token is expired' },
    });
    await expect(revokeSessionOnServer('token-a')).resolves.toEqual({
      result: 'token_expired',
      error: { status: 401, code: 'bad_jwt', message: 'token is expired' },
    });
  });
});
