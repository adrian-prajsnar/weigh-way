import { useEffect, useRef } from 'react';
import { useSharedUserProfile } from '../context/user-profile-context';
import { useSharedWeightEntries } from '../context/weight-entries-context';
import { isDemoMode } from '../demo/is-demo-mode';
import { useNetworkStatus } from '../hooks/use-network-status';

/** Refetch synced data after connectivity returns (replaces old NetworkGate remount). */
export function ReconnectDataSync() {
  const { isOffline } = useNetworkStatus();
  const wasOfflineRef = useRef(isOffline);
  const { refreshEntries } = useSharedWeightEntries();
  const { refreshProfile } = useSharedUserProfile();

  useEffect(() => {
    if (isDemoMode()) {
      wasOfflineRef.current = isOffline;
      return;
    }

    if (wasOfflineRef.current && !isOffline) {
      void refreshEntries().catch(() => undefined);
      void refreshProfile().catch(() => undefined);
    }
    wasOfflineRef.current = isOffline;
  }, [isOffline, refreshEntries, refreshProfile]);

  return null;
}
