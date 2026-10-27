import { useEffect, useRef, useState } from 'react';
import { AppLocale } from '../i18n/resolve-locale';
import { UnitSystem } from '../units';
import { resolveWeightPrefillUpdate, WeightPrefillAnchor } from './weight-entry-prefill';

type UseWeightEntryPrefillArgs = {
  selectedDateKey: string;
  units: UnitSystem;
  locale: AppLocale;
  existingEntryWeightKg: number | undefined;
};

export function useWeightEntryPrefill({
  selectedDateKey,
  units,
  locale,
  existingEntryWeightKg,
}: UseWeightEntryPrefillArgs) {
  const [weightInput, setWeightInput] = useState('');
  const weightInputTouchedRef = useRef(false);
  const prefillAnchorRef = useRef<WeightPrefillAnchor>({
    selectedDateKey: '',
    units,
    locale,
    existingEntryWeightKg: undefined,
  });

  useEffect(() => {
    const nextAnchor: WeightPrefillAnchor = {
      selectedDateKey,
      units,
      locale,
      existingEntryWeightKg,
    };
    const update = resolveWeightPrefillUpdate(
      prefillAnchorRef.current,
      nextAnchor,
      weightInputTouchedRef.current,
    );
    prefillAnchorRef.current = update.nextAnchor;
    if (update.resetTouched) {
      weightInputTouchedRef.current = false;
    }
    if (update.nextInput !== null) {
      setWeightInput(update.nextInput);
    }
  }, [selectedDateKey, existingEntryWeightKg, units, locale]);

  return {
    weightInput,
    setWeightInput,
    weightInputTouchedRef,
  };
}
