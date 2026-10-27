import * as WebBrowser from 'expo-web-browser';
import { isDevWarningsEnabled } from './storage/preference-storage-fallback';

function isSecurityError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'SecurityError';
}

/** Completes an in-progress OAuth redirect without crashing when web storage is blocked. */
export function safeMaybeCompleteAuthSession(): void {
  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch (error) {
    if (isSecurityError(error)) {
      return;
    }
    if (isDevWarningsEnabled()) {
      console.warn('[weigh-way] maybeCompleteAuthSession failed:', error);
    }
    throw error;
  }
}
