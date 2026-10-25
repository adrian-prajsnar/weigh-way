import { createContext, ReactNode, useContext } from 'react';
import { useUserProfile } from '../hooks/use-user-profile';
import { BiologicalSex, HeightEntry } from '../types';

type UserProfileContextValue = {
  heightEntries: HeightEntry[];
  birthDate: string | null;
  sex: BiologicalSex | null;
  currentHeightCm: number | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isSaving: boolean;
  deletingEffectiveDate: string | null;
  error: string | null;
  hasLoaded: boolean;
  refreshProfile: () => Promise<void>;
  saveBirthDateEntry: (birthDate: string | null) => Promise<void>;
  saveSexEntry: (sex: BiologicalSex | null) => Promise<void>;
  saveHeightEntry: (effectiveDate: string, heightCm: number) => Promise<void>;
  updateHeightEntry: (
    previousEffectiveDate: string,
    effectiveDate: string,
    heightCm: number,
  ) => Promise<void>;
  removeHeightEntry: (effectiveDate: string) => Promise<void>;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const value = useUserProfile();
  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useSharedUserProfile(): UserProfileContextValue {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useSharedUserProfile must be used within UserProfileProvider');
  }
  return context;
}
