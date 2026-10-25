import { isDemoLocation } from '../demo/demo-location';

/** Base path for the hosted web demo (e.g. `/weigh-way/demo/`). */
export function getWebDemoBasePath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  const demoIndex = segments.indexOf('demo');
  if (demoIndex < 0) {
    return null;
  }
  return `/${segments.slice(0, demoIndex + 1).join('/')}/`;
}

export function getWebReachabilityUrl(origin: string, pathname: string): string {
  const demoBase = getWebDemoBasePath(pathname);
  if (demoBase) {
    return `${origin}${demoBase}index.html`;
  }
  return `${origin}/`;
}

export function resolveIsOffline(
  isConnected: boolean | null,
  isInternetReachable: boolean | null,
): boolean {
  if (isConnected === false) {
    return true;
  }
  if (isInternetReachable === false) {
    return true;
  }
  return false;
}

export function shouldBlockSaveForOffline(isOffline: boolean, demoMode: boolean): boolean {
  if (demoMode) {
    return false;
  }
  return isOffline;
}

export function shouldConfigureWebReachability(pathname: string, search: string): boolean {
  return getWebDemoBasePath(pathname) !== null || isDemoLocation(pathname, search);
}
