import { useLocales } from 'expo-localization';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getUnitPreference,
  setStoredUnitPreference,
  UnitPreference,
} from '../storage/unit-preference';
import { resolveUnitSystem, UnitSystem } from '../units';

type UnitContextValue = {
  units: UnitSystem;
  preference: UnitPreference;
  setPreference: (next: UnitPreference) => Promise<void>;
};

const UnitContext = createContext<UnitContextValue | null>(null);

export function UnitProvider({ children }: { children: ReactNode }) {
  const locales = useLocales();
  const [preference, setPreferenceState] = useState<UnitPreference>('system');

  useEffect(() => {
    void getUnitPreference()
      .then(setPreferenceState)
      .catch(() => setPreferenceState('system'));
  }, []);

  const measurementSystem = locales[0]?.measurementSystem;

  const units = useMemo(
    () => resolveUnitSystem(preference, measurementSystem),
    [preference, measurementSystem],
  );

  const setPreference = useCallback(async (next: UnitPreference) => {
    setPreferenceState(next);
    await setStoredUnitPreference(next);
  }, []);

  const value = useMemo<UnitContextValue>(
    () => ({
      units,
      preference,
      setPreference,
    }),
    [units, preference, setPreference],
  );

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

export function useUnits(): UnitContextValue {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error('useUnits must be used within UnitProvider');
  }
  return context;
}
