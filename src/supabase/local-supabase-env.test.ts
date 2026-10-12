import { describe, expect, it } from 'vitest';
import { isLocalSupabaseEnvUrl } from './local-supabase-env';

describe('isLocalSupabaseEnvUrl', () => {
  it('detects local CLI URLs', () => {
    expect(isLocalSupabaseEnvUrl('http://127.0.0.1:54321')).toBe(true);
    expect(isLocalSupabaseEnvUrl('http://192.168.0.12:54321')).toBe(true);
    expect(isLocalSupabaseEnvUrl('https://xyz.supabase.co')).toBe(false);
  });
});
