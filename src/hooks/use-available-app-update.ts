import { useEffect, useState } from 'react';
import type { AvailableAppUpdate } from '../app-update/get-available-app-update';
import { getAvailableAppUpdate } from '../app-update/get-available-app-update';

/**
 * A found update is kept for the JS runtime so remounting the provider does not
 * blank the bar. A null result is not cached: the first check can fail while
 * the network is still coming up, and the next mount should try again.
 */
let cachedResult: Promise<AvailableAppUpdate | null> | null = null;
let lastResult: AvailableAppUpdate | null | undefined;

function loadAvailableAppUpdate(): Promise<AvailableAppUpdate | null> {
  if (!cachedResult) {
    cachedResult = getAvailableAppUpdate().then((result) => {
      lastResult = result;
      if (result === null) {
        cachedResult = null;
      }
      return result;
    });
  }

  return cachedResult;
}

export function useAvailableAppUpdate() {
  const [update, setUpdate] = useState<AvailableAppUpdate | null>(lastResult ?? null);
  const [isLoading, setIsLoading] = useState(lastResult === undefined);

  useEffect(() => {
    let isCancelled = false;

    void loadAvailableAppUpdate().then((result) => {
      if (isCancelled) {
        return;
      }

      setUpdate(result);
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  return { update, isLoading };
}
