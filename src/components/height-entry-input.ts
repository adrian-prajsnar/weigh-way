import { heightToInputParts, parseHeightInput } from '../format';
import { UnitSystem } from '../units';
import { HeightEntry } from '../types';

export function hasHeightDateCollision(
  entries: HeightEntry[],
  effectiveDate: string,
  editingEffectiveDate: string | null,
): boolean {
  return (
    effectiveDate !== editingEffectiveDate &&
    entries.some((entry) => entry.effectiveDate === effectiveDate)
  );
}

export function resolveHeightCmForSave(
  units: UnitSystem,
  primary: string,
  secondary: string,
  storedHeightCm?: number,
): number | null {
  if (storedHeightCm !== undefined) {
    const formatted = heightToInputParts(storedHeightCm, units);
    if (primary.trim() === formatted.primary && secondary.trim() === formatted.secondary) {
      return storedHeightCm;
    }
  }
  return parseHeightInput(units, primary, secondary);
}
