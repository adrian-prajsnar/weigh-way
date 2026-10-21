import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { useSupabaseAuth } from '../context/supabase-auth-context';

/** Hides the native splash when fonts and auth are ready. Returns true once it is gone. */
export function useHideSplashWhenReady(fontsLoaded: boolean): boolean {
  const { isLoading: isAuthLoading, isCompletingOAuth } = useSupabaseAuth();
  const [isSplashHidden, setIsSplashHidden] = useState(false);
  const hasHiddenRef = useRef(false);

  useEffect(() => {
    if (!fontsLoaded || isAuthLoading || isCompletingOAuth || hasHiddenRef.current) {
      return;
    }

    hasHiddenRef.current = true;
    void SplashScreen.hideAsync().finally(() => setIsSplashHidden(true));
  }, [fontsLoaded, isAuthLoading, isCompletingOAuth]);

  return isSplashHidden;
}
