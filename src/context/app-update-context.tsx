import { createContext, ReactNode, useContext } from 'react';
import type { AvailableAppUpdate } from '../app-update/get-available-app-update';
import { useAvailableAppUpdate } from '../hooks/use-available-app-update';

type AppUpdateContextValue = {
  update: AvailableAppUpdate | null;
  isLoading: boolean;
};

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const value = useAvailableAppUpdate();
  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
}

/** Shared across all screens so switching tabs does not reset the check. */
export function useSharedAppUpdate(): AppUpdateContextValue {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error('useSharedAppUpdate must be used within AppUpdateProvider');
  }
  return context;
}
