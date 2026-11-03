import { useNetworkStatus } from './use-network-status';
import { shouldBlockSaveForOffline } from '../network/connectivity';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { useSupabaseAuth } from '../context/supabase-auth-context';
import { isDemoMode } from '../demo/is-demo-mode';
import {
  deleteDemoWeightEntry,
  getDemoWeightEntries,
  saveDemoWeightEntry,
} from '../demo/demo-storage';
import { useRefreshOnAppForeground } from './use-refresh-on-app-foreground';
import { deleteEntry, getEntries, saveEntry } from '../supabase/weight-sync';
import { WeightEntry } from '../types';

export function useWeightEntries() {
  const { isAuthenticated, isLoading: isAuthLoading, session } = useSupabaseAuth();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const hasLoadedRef = useRef(false);
  const { isOffline } = useNetworkStatus();
  const offlineRef = useRef(isOffline);
  offlineRef.current = isOffline;
  const requestId = useRef(0);
  const mounted = useRef(true);
  const userId = session?.user.id;
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  const refreshEntries = useCallback(async () => {
    const id = ++requestId.current;
    const isCurrent = () =>
      mounted.current && id === requestId.current && currentUserId.current === userId;
    if (isAuthLoading && !isDemoMode()) return;
    if (!isAuthenticated && !isDemoMode()) {
      setEntries([]);
      setError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      hasLoadedRef.current = false;
      setHasLoaded(false);
      return;
    }
    if (hasLoadedRef.current) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const loaded = await (isDemoMode() ? getDemoWeightEntries() : getEntries());
      if (!isCurrent()) return;
      setEntries(loaded);
      setError(null);
      hasLoadedRef.current = true;
      setHasLoaded(true);
    } catch (loadError) {
      if (!isCurrent()) return;
      const message =
        loadError instanceof Error ? loadError.message : t('errors.couldNotLoadEntries');
      setError(message);
      throw loadError instanceof Error ? loadError : new Error(message);
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [isAuthenticated, isAuthLoading, userId]);

  useEffect(() => {
    void refreshEntries().catch(() => undefined);
  }, [refreshEntries]);
  useRefreshOnAppForeground(refreshEntries, isAuthenticated);

  const removeEntry = useCallback(
    async (date: string) => {
      if (shouldBlockSaveForOffline(offlineRef.current, isDemoMode()))
        throw new Error(t('errors.noConnection'));
      setDeletingDate(date);
      try {
        await (isDemoMode() ? deleteDemoWeightEntry(date) : deleteEntry(date));
        if (!mounted.current || currentUserId.current !== userId) return;
        ++requestId.current;
        setEntries((previous) => previous.filter((entry) => entry.date !== date));
        await refreshEntries().catch(() => undefined);
      } finally {
        if (mounted.current && currentUserId.current === userId) setDeletingDate(null);
      }
    },
    [refreshEntries, userId],
  );

  const upsertEntry = useCallback(
    async (date: string, weightKg: number) => {
      const savedEntry = isDemoMode()
        ? await saveDemoWeightEntry(date, weightKg).then(() => null)
        : await saveEntry(date, weightKg);
      if (!mounted.current || currentUserId.current !== userId) return;
      ++requestId.current;
      // Reflect the committed write even if the subsequent read is unavailable.
      setEntries((previous) => {
        const existing = previous.find((entry) => entry.date === date);
        const timestamp = new Date().toISOString();
        const saved = savedEntry ?? {
          date,
          weightKg,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };
        return [...previous.filter((entry) => entry.date !== date), saved].sort((a, b) =>
          b.date.localeCompare(a.date),
        );
      });
      await refreshEntries().catch(() => undefined);
    },
    [refreshEntries, userId],
  );

  return {
    entries,
    isLoading,
    isRefreshing,
    deletingDate,
    error,
    hasLoaded,
    refreshEntries,
    removeEntry,
    upsertEntry,
  };
}
