import { describe, expect, it } from 'vitest';
import { makeTestAccessToken } from './make-test-access-token';
import {
  createGotrueSessionRegistry,
  gotrueLogoutFetchHandler,
  parseLogoutScopeFromUrl,
} from './gotrue-session-logout-mock';

describe('gotrue session logout mock', () => {
  it('revokes only the matching session for scope=local', async () => {
    const registry = createGotrueSessionRegistry();
    const tokenA1 = makeTestAccessToken('sess-a1');
    const tokenA2 = makeTestAccessToken('sess-a2');
    registry.register('user-a', 'sess-a1', tokenA1);
    registry.register('user-a', 'sess-a2', tokenA2);

    const response = await gotrueLogoutFetchHandler(
      registry,
      'https://example.supabase.co/auth/v1/logout?scope=local',
      { headers: { Authorization: `Bearer ${tokenA1}` } },
    );

    expect(response.status).toBe(204);
    expect(registry.isAlive('sess-a1')).toBe(false);
    expect(registry.isAlive('sess-a2')).toBe(true);
  });

  it('revokes other sessions for scope=others', async () => {
    const registry = createGotrueSessionRegistry();
    const tokenA1 = makeTestAccessToken('sess-a1');
    const tokenA2 = makeTestAccessToken('sess-a2');
    registry.register('user-a', 'sess-a1', tokenA1);
    registry.register('user-a', 'sess-a2', tokenA2);

    const response = await gotrueLogoutFetchHandler(
      registry,
      'https://example.supabase.co/auth/v1/logout?scope=others',
      { headers: { Authorization: `Bearer ${tokenA1}` } },
    );

    expect(response.status).toBe(204);
    expect(registry.isAlive('sess-a1')).toBe(true);
    expect(registry.isAlive('sess-a2')).toBe(false);
  });

  it('wipes only that user sessions when JWT has no session_id', async () => {
    const registry = createGotrueSessionRegistry();
    const plain = makeTestAccessToken('');
    registry.register('user-a', 'sess-a1', plain);
    registry.register('user-a', 'sess-a2', makeTestAccessToken('sess-a2'));

    const response = await gotrueLogoutFetchHandler(
      registry,
      'https://example.supabase.co/auth/v1/logout',
      { headers: { Authorization: `Bearer ${plain}` } },
    );

    expect(response.status).toBe(204);
    expect(registry.isAlive('sess-a1')).toBe(false);
    expect(registry.isAlive('sess-a2')).toBe(false);
  });

  it('returns 403 for an unknown session id', async () => {
    const registry = createGotrueSessionRegistry();
    const token = makeTestAccessToken('missing');

    const response = await gotrueLogoutFetchHandler(
      registry,
      'https://example.supabase.co/auth/v1/logout?scope=local',
      { headers: { Authorization: `Bearer ${token}` } },
    );

    expect(response.status).toBe(403);
  });

  it('returns 401 when forceStatus is 401', async () => {
    const registry = createGotrueSessionRegistry();
    const token = makeTestAccessToken('sess-a1');
    registry.register('user-a', 'sess-a1', token);

    const response = await gotrueLogoutFetchHandler(
      registry,
      'https://example.supabase.co/auth/v1/logout',
      { headers: { Authorization: `Bearer ${token}` } },
      { forceStatus: 401 },
    );

    expect(response.status).toBe(401);
  });

  it('parses logout scope from URL', () => {
    expect(parseLogoutScopeFromUrl('https://x/logout?scope=local')).toBe('local');
  });
});
