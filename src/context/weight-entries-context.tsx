import { createContext, ReactNode, useContext } from 'react';
import { useWeightEntries } from '../hooks/use-weight-entries';
import { WeightEntry } from '../types';

type WeightEntriesContextValue = {
  entries: WeightEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  deletingDate: string | null;
  error: string | null;
  hasLoaded: boolean;
  refreshEntries: () => Promise<void>;
  removeEntry: (date: string) => Promise<void>;
  upsertEntry: (date: string, weightKg: number) => Promise<void>;
};

const WeightEntriesContext = createContext<WeightEntriesContextValue | null>(null);

export function WeightEntriesProvider({ children }: { children: ReactNode }) {
  const value = useWeightEntries();
  return (
    <WeightEntriesContext.Provider value={value}>{children}</WeightEntriesContext.Provider>
  );
}

export function useSharedWeightEntries(): WeightEntriesContextValue {
  const context = useContext(WeightEntriesContext);
  if (!context) {
    throw new Error('useSharedWeightEntries must be used within WeightEntriesProvider');
  }
  return context;
}
