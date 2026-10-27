import * as WebBrowser from 'expo-web-browser';

/** Completes an in-progress OAuth redirect without crashing when web storage is blocked. */
export function safeMaybeCompleteAuthSession(): void {
  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch {
    // expo-web-browser reads localStorage synchronously; blocked storage must not block sign-in.
  }
}
