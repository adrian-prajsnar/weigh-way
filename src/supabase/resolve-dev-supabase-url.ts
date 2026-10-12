import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { isLocalhostSupabaseUrl } from './local-supabase-env';

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function getPackagerHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0]?.trim();
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }

  const legacy = Constants.manifest2 ?? Constants.manifest;
  const debuggerHost =
    legacy && typeof legacy === 'object' && 'debuggerHost' in legacy
      ? String((legacy as { debuggerHost?: string }).debuggerHost ?? '')
      : '';
  if (debuggerHost) {
    const host = debuggerHost.split(':')[0]?.trim();
    if (host) {
      return host;
    }
  }

  return null;
}

/** Map localhost in .env to a host the current device can reach (Expo Go / emulator). */
export function resolveDevSupabaseUrl(url: string): string {
  if (!isDevBuild() || !url || !isLocalhostSupabaseUrl(url)) {
    return url;
  }

  if (Platform.OS === 'web') {
    return url;
  }

  if (Platform.OS === 'android') {
    const packagerHost = getPackagerHost();
    const targetHost = packagerHost ?? '10.0.2.2';
    return url.replace(/127\.0\.0\.1|localhost/i, targetHost);
  }

  if (Platform.OS === 'ios') {
    const packagerHost = getPackagerHost();
    if (packagerHost) {
      return url.replace(/127\.0\.0\.1|localhost/i, packagerHost);
    }
  }

  return url;
}
