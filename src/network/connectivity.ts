import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  getWebReachabilityUrl,
  resolveIsOffline,
  shouldBlockSaveForOffline,
  shouldConfigureWebReachability,
} from './connectivity-status';

export {
  getWebDemoBasePath,
  getWebReachabilityUrl,
  resolveIsOffline,
  shouldBlockSaveForOffline,
  shouldConfigureWebReachability,
} from './connectivity-status';

let netInfoConfigured = false;

export function configureAppNetInfo(): void {
  if (netInfoConfigured || Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  if (!shouldConfigureWebReachability(window.location.pathname, window.location.search)) {
    return;
  }

  netInfoConfigured = true;
  const reachabilityUrl = getWebReachabilityUrl(window.location.origin, window.location.pathname);
  NetInfo.configure({
    reachabilityUrl,
    reachabilityMethod: 'HEAD',
    reachabilityTest: async (response) => response.status >= 200 && response.status < 400,
  });
}
