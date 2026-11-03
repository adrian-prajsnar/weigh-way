import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getTodayDate, toDateKey } from '../format';

/** Refresh at local midnight and after the OS resumes a suspended app. */
export function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() => toDateKey(getTodayDate()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      setTodayKey(toDateKey(getTodayDate()));
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 50);
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return todayKey;
}
