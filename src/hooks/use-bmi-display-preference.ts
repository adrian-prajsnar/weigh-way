import { useCallback, useEffect, useState } from 'react';
import {
  getShowBmiPreference,
  setShowBmiPreference,
} from '../storage/bmi-display-preference';

export function useBmiDisplayPreference() {
  const [showBmi, setShowBmiState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void getShowBmiPreference()
      .then((value) => {
        setShowBmiState(value);
        setIsLoading(false);
      })
      .catch(() => {
        setShowBmiState(true);
        setIsLoading(false);
      });
  }, []);

  const setShowBmi = useCallback(async (value: boolean) => {
    setShowBmiState(value);
    await setShowBmiPreference(value);
  }, []);

  return {
    showBmi,
    isLoading,
    setShowBmi,
  };
}
