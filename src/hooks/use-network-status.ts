import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { useCallback, useState } from 'react';
import { resolveIsOffline } from '../network/connectivity';

export function useNetworkStatus() {
  const { isConnected, isInternetReachable } = useNetInfo();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await NetInfo.refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return {
    isChecking: isConnected === null,
    isOffline: resolveIsOffline(isConnected, isInternetReachable),
    isRefreshing,
    refresh,
  };
}
