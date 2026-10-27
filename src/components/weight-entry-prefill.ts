import { formatWeightValue } from '../format';
import { AppLocale } from '../i18n/resolve-locale';
import { UnitSystem } from '../units';

export type WeightPrefillAnchor = {
  selectedDateKey: string;
  units: UnitSystem;
  locale: AppLocale;
  existingEntryWeightKg: number | undefined;
};

export type WeightPrefillUpdate = {
  nextAnchor: WeightPrefillAnchor;
  nextInput: string | null;
  resetTouched: boolean;
};

export function resolveWeightPrefillUpdate(
  anchor: WeightPrefillAnchor,
  next: WeightPrefillAnchor,
  touched: boolean,
): WeightPrefillUpdate {
  const contextChanged =
    anchor.selectedDateKey !== next.selectedDateKey ||
    anchor.units !== next.units ||
    anchor.existingEntryWeightKg !== next.existingEntryWeightKg;

  const weightOnlyChange =
    touched &&
    anchor.selectedDateKey === next.selectedDateKey &&
    anchor.units === next.units &&
    anchor.locale === next.locale &&
    anchor.existingEntryWeightKg !== next.existingEntryWeightKg;

  if (weightOnlyChange) {
    return { nextAnchor: next, nextInput: null, resetTouched: false };
  }

  if (contextChanged) {
    return {
      nextAnchor: next,
      nextInput:
        next.existingEntryWeightKg !== undefined
          ? formatWeightValue(next.existingEntryWeightKg, next.units, next.locale)
          : '',
      resetTouched: true,
    };
  }

  if (
    !touched &&
    next.existingEntryWeightKg !== undefined &&
    anchor.locale !== next.locale
  ) {
    return {
      nextAnchor: next,
      nextInput: formatWeightValue(next.existingEntryWeightKg, next.units, next.locale),
      resetTouched: false,
    };
  }

  return { nextAnchor: anchor, nextInput: null, resetTouched: false };
}
