import { AppState, AppStateStatus } from 'react-native';
import { supabase } from './client';

let registered = false;
let refreshInFlight: Promise<void> | null = null;

function handleAppStateChange(state: AppStateStatus): void {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
    void refreshSessionOnForeground();
    return;
  }

  supabase.auth.stopAutoRefresh();
}

export function registerSupabaseAppLifecycle(): void {
  if (registered) {
    return;
  }

  registered = true;
  AppState.addEventListener('change', handleAppStateChange);

  if (AppState.currentState === 'active') {
    supabase.auth.startAutoRefresh();
  }
}

export async function refreshSessionOnForeground(): Promise<void> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return;
    }

    await supabase.auth.refreshSession();
  })()
    .catch(() => {
      // Ignore transient refresh failures; the next request or sign-out flow will recover.
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}
