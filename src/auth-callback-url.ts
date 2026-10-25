import * as Linking from 'expo-linking';

const EXPECTED_SCHEME = 'weigh-way';
const EXPECTED_HOST = 'auth';
const EXPECTED_PATH = '/callback';

export type ParsedAuthCallbackUrl = {
  scheme: string;
  hostname: string | null;
  path: string | null;
};

export function parseAuthCallbackUrl(url: string): ParsedAuthCallbackUrl | null {
  try {
    const parsed = Linking.parse(url);
    if (!parsed.scheme) {
      return null;
    }
    return {
      scheme: parsed.scheme,
      hostname: parsed.hostname ?? null,
      path: parsed.path ?? null,
    };
  } catch {
    return null;
  }
}

function normalizePath(path: string | null): string {
  if (!path) {
    return '';
  }
  const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed ? `/${trimmed}` : '';
}

/** Expo dev URLs end with /--/auth/callback */
function isExpoDevAuthCallback(parsed: ParsedAuthCallbackUrl): boolean {
  if (parsed.scheme !== 'exp') {
    return false;
  }
  const path = normalizePath(parsed.path);
  return path === '/--/auth/callback';
}

export function isAuthCallbackUrl(url: string): boolean {
  const parsed = parseAuthCallbackUrl(url);
  if (!parsed) {
    return false;
  }

  if (parsed.scheme === EXPECTED_SCHEME) {
    const path = normalizePath(parsed.path);
    return parsed.hostname === EXPECTED_HOST && path === EXPECTED_PATH;
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__ && isExpoDevAuthCallback(parsed)) {
    return true;
  }

  return false;
}
