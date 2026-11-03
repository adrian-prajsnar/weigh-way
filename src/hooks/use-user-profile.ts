import { useNetworkStatus } from './use-network-status';
import { shouldBlockSaveForOffline } from '../network/connectivity';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { useSupabaseAuth } from '../context/supabase-auth-context';
import { isDemoMode } from '../demo/is-demo-mode';
import {
  deleteDemoHeight,
  getDemoProfile,
  saveDemoHeight,
  saveDemoUserProfile,
} from '../demo/demo-storage';
import { useRefreshOnAppForeground } from './use-refresh-on-app-foreground';
import { getCurrentHeight } from '../height';
import { getUserProfile, saveUserProfile, UserProfileFields } from '../supabase/profile-sync';
import { getHeightEntries, saveHeight, deleteHeight, updateHeight } from '../supabase/height-sync';
import { BiologicalSex, HeightEntry } from '../types';

export function useUserProfile() {
  const { isAuthenticated, isLoading: isAuthLoading, session } = useSupabaseAuth();
  const [heightEntries, setHeightEntries] = useState<HeightEntry[]>([]);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingEffectiveDate, setDeletingEffectiveDate] = useState<string | null>(null);
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
  const isCurrentUser = useCallback(
    () => mounted.current && currentUserId.current === userId,
    [userId],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const id = ++requestId.current;
    const isCurrent = () => isCurrentUser() && id === requestId.current;
    if (isAuthLoading && !isDemoMode()) return;
    if (!isAuthenticated && !isDemoMode()) {
      setHeightEntries([]);
      setBirthDate(null);
      setSex(null);
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
      const [loaded, profile] = isDemoMode()
        ? await getDemoProfile().then((profile) => [profile.heightEntries, profile] as const)
        : await Promise.all([getHeightEntries(), getUserProfile()]);
      if (!isCurrent()) return;
      setHeightEntries(loaded);
      setBirthDate(profile.birthDate);
      setSex(profile.sex);
      setError(null);
      hasLoadedRef.current = true;
      setHasLoaded(true);
    } catch (loadError) {
      if (isCurrent())
        setError(loadError instanceof Error ? loadError.message : t('errors.couldNotLoadProfile'));
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [isAuthenticated, isAuthLoading, isCurrentUser]);

  useEffect(() => {
    void refreshProfile().catch(() => undefined);
  }, [refreshProfile]);

  useRefreshOnAppForeground(refreshProfile, isAuthenticated);

  const persistProfile = useCallback(
    async (patch: Partial<UserProfileFields>) => {
      if (!hasLoadedRef.current) throw new Error(t('errors.couldNotLoadProfile'));
      setIsSaving(true);
      try {
        if (isDemoMode())
          await saveDemoUserProfile(
            patch.birthDate !== undefined ? patch.birthDate : birthDate,
            patch.sex !== undefined ? patch.sex : sex,
          );
        else await saveUserProfile(patch);
        if (!isCurrentUser()) return;
        ++requestId.current;
        if (patch.birthDate !== undefined) setBirthDate(patch.birthDate);
        if (patch.sex !== undefined) setSex(patch.sex);
        await refreshProfile();
      } finally {
        if (isCurrentUser()) setIsSaving(false);
      }
    },
    [birthDate, sex, isCurrentUser, refreshProfile],
  );

  const saveHeightEntry = useCallback(
    async (effectiveDate: string, heightCm: number) => {
      setIsSaving(true);
      try {
        if (isDemoMode()) {
          await saveDemoHeight(effectiveDate, heightCm);
        } else {
          await saveHeight(effectiveDate, heightCm);
        }
        if (!isCurrentUser()) return;
        ++requestId.current;
        setHeightEntries((previous) =>
          [
            ...previous.filter((entry) => entry.effectiveDate !== effectiveDate),
            { effectiveDate, heightCm },
          ].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)),
        );
        await refreshProfile();
      } finally {
        if (isCurrentUser()) setIsSaving(false);
      }
    },
    [refreshProfile, isCurrentUser],
  );

  const updateHeightEntry = useCallback(
    async (previousEffectiveDate: string, effectiveDate: string, heightCm: number) => {
      setIsSaving(true);
      try {
        if (isDemoMode()) {
          await saveDemoHeight(effectiveDate, heightCm);
          if (previousEffectiveDate !== effectiveDate) {
            await deleteDemoHeight(previousEffectiveDate);
          }
        } else {
          await updateHeight(previousEffectiveDate, effectiveDate, heightCm);
        }
        if (!isCurrentUser()) return;
        ++requestId.current;
        setHeightEntries((previous) =>
          [
            ...previous.filter(
              (entry) =>
                entry.effectiveDate !== effectiveDate &&
                entry.effectiveDate !== previousEffectiveDate,
            ),
            { effectiveDate, heightCm },
          ].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)),
        );
        await refreshProfile();
      } finally {
        if (isCurrentUser()) setIsSaving(false);
      }
    },
    [refreshProfile, isCurrentUser],
  );

  const removeHeightEntry = useCallback(
    async (effectiveDate: string) => {
      if (shouldBlockSaveForOffline(offlineRef.current, isDemoMode()))
        throw new Error(t('errors.noConnection'));
      setDeletingEffectiveDate(effectiveDate);
      try {
        if (isDemoMode()) {
          await deleteDemoHeight(effectiveDate);
        } else {
          await deleteHeight(effectiveDate);
        }
        if (!isCurrentUser()) return;
        ++requestId.current;
        setHeightEntries((previous) =>
          previous.filter((entry) => entry.effectiveDate !== effectiveDate),
        );
        await refreshProfile();
      } catch (deleteError) {
        throw deleteError instanceof Error
          ? deleteError
          : new Error(t('profile.deleteHeightFailed'));
      } finally {
        if (isCurrentUser()) setDeletingEffectiveDate(null);
      }
    },
    [refreshProfile, isCurrentUser],
  );

  const saveBirthDateEntry = useCallback(
    async (nextBirthDate: string | null) => {
      await persistProfile({ birthDate: nextBirthDate });
    },
    [persistProfile],
  );

  const saveSexEntry = useCallback(
    async (nextSex: BiologicalSex | null) => {
      await persistProfile({ sex: nextSex });
    },
    [persistProfile],
  );

  const currentHeightCm = getCurrentHeight(heightEntries);

  return {
    heightEntries,
    birthDate,
    sex,
    currentHeightCm,
    isLoading,
    isRefreshing,
    isSaving,
    deletingEffectiveDate,
    error,
    hasLoaded,
    refreshProfile,
    saveBirthDateEntry,
    saveSexEntry,
    saveHeightEntry,
    updateHeightEntry,
    removeHeightEntry,
  };
}
