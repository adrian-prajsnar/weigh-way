import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  getThemePreference,
  setStoredThemePreference,
  ThemePreference,
} from '../storage/theme-preference';
import { ColorScheme, Palette, palettes } from './tokens';

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const deviceScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void getThemePreference()
      .then(setPreferenceState)
      .catch(() => setPreferenceState('system'));
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    await setStoredThemePreference(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: ColorScheme =
      preference === 'system' ? (deviceScheme === 'dark' ? 'dark' : 'light') : preference;
    return { scheme, colors: palettes[scheme], preference, setPreference };
  }, [deviceScheme, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export function useColors(): Palette {
  return useTheme().colors;
}
