import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
}));

/* eslint-disable import/first -- after vi.mock */
import * as WebBrowser from 'expo-web-browser';
import { safeMaybeCompleteAuthSession } from './auth-web-session-complete';
/* eslint-enable import/first */

describe('safeMaybeCompleteAuthSession', () => {
  beforeEach(() => {
    vi.mocked(WebBrowser.maybeCompleteAuthSession).mockReset();
  });

  afterEach(() => {
    vi.mocked(WebBrowser.maybeCompleteAuthSession).mockReset();
  });

  it('delegates to maybeCompleteAuthSession on the happy path', () => {
    safeMaybeCompleteAuthSession();
    expect(WebBrowser.maybeCompleteAuthSession).toHaveBeenCalledTimes(1);
  });

  it('swallows SecurityError from maybeCompleteAuthSession', () => {
    vi.mocked(WebBrowser.maybeCompleteAuthSession).mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    expect(() => safeMaybeCompleteAuthSession()).not.toThrow();
  });

  it('rethrows non-security errors', () => {
    vi.mocked(WebBrowser.maybeCompleteAuthSession).mockImplementation(() => {
      throw new Error('ERR_WEB_BROWSER_REDIRECT');
    });

    expect(() => safeMaybeCompleteAuthSession()).toThrow('ERR_WEB_BROWSER_REDIRECT');
  });
});
