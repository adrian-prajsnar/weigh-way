import * as WebBrowser from 'expo-web-browser';
import { isSecurityError } from './security-error';
import { isDevWarningsEnabled } from './storage/preference-storage-fallback';

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
