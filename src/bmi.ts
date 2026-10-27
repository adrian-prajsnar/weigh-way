import { getAgeOnDate } from './age';
import { CDC_BMI_LMS_FEMALE, CDC_BMI_LMS_MALE } from './bmi/cdc-bmi-lms';
import { t } from './i18n';
import { formatDecimal } from './i18n/locale-number-format';
import { AppLocale } from './i18n/resolve-locale';
import { TranslationKey } from './i18n/translation-keys';
import { ColorScheme, palettes } from './theme/tokens';
import { BiologicalSex } from './types';

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese' | 'unclassified';

export type BmiClassification = 'adult' | 'bmiForAge' | 'unclassified';

export type BmiInfo = {
  value: number;
  category: BmiCategory;
  label: string;
  classification: BmiClassification;
  percentile: number | null;
  ageYears: number | null;
};

export type BmiContext = {
  date: string;
  birthDate: string | null;
  sex: BiologicalSex | null;
};

export type BmiTheme = {
  backgroundColor: string;
  textColor: string;
};

const BMI_THEMES: Record<ColorScheme, Record<BmiCategory, BmiTheme>> = {
  light: {
    underweight: {
      backgroundColor: palettes.light.accentSoft,
      textColor: palettes.light.accentText,
    },
    normal: {
      backgroundColor: palettes.light.successSoft,
      textColor: palettes.light.successText,
    },
    overweight: {
      backgroundColor: palettes.light.warningSoft,
      textColor: palettes.light.warningText,
    },
    obese: {
      backgroundColor: palettes.light.dangerSoft,
      textColor: palettes.light.dangerText,
    },
    unclassified: {
      backgroundColor: palettes.light.surfaceMuted,
      textColor: palettes.light.textMuted,
    },
  },
  dark: {
    underweight: {
      backgroundColor: palettes.dark.accentSoft,
      textColor: palettes.dark.accentText,
    },
    normal: {
      backgroundColor: palettes.dark.successSoft,
      textColor: palettes.dark.successText,
    },
    overweight: {
      backgroundColor: palettes.dark.warningSoft,
      textColor: palettes.dark.warningText,
    },
    obese: {
      backgroundColor: palettes.dark.dangerSoft,
      textColor: palettes.dark.dangerText,
    },
    unclassified: {
      backgroundColor: palettes.dark.surfaceMuted,
      textColor: palettes.dark.textMuted,
    },
  },
};

const BMI_CATEGORY_KEYS: Record<BmiCategory, TranslationKey> = {
  underweight: 'bmi.underweight',
  normal: 'bmi.normal',
  overweight: 'bmi.overweight',
  obese: 'bmi.obese',
  unclassified: 'bmi.unclassified',
};

function getCategoryLabel(category: BmiCategory): string {
  return t(BMI_CATEGORY_KEYS[category]);
}

function adultCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) {
    return 'underweight';
  }
  if (bmi < 25) {
    return 'normal';
  }
  if (bmi < 30) {
    return 'overweight';
  }
  return 'obese';
}

function percentileCategory(percentile: number): BmiCategory {
  if (percentile < 5) {
    return 'underweight';
  }
  if (percentile < 85) {
    return 'normal';
  }
  if (percentile < 95) {
    return 'overweight';
  }
  return 'obese';
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * abs);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-abs * abs);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function interpolateLms(
  table: readonly (readonly [number, number, number, number])[],
  ageMonths: number,
): { l: number; m: number; s: number } | null {
  if (table.length === 0) {
    return null;
  }

  if (ageMonths < table[0][0] || ageMonths > table[table.length - 1][0]) {
    return null;
  }

  let lo = 0;
  let hi = table.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (table[mid][0] < ageMonths) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const next = table[lo];
  if (next[0] === ageMonths || lo === 0) {
    return { l: next[1], m: next[2], s: next[3] };
  }

  const prev = table[lo - 1];
  const span = next[0] - prev[0];
  const tFrac = span === 0 ? 0 : (ageMonths - prev[0]) / span;
  return {
    l: prev[1] + (next[1] - prev[1]) * tFrac,
    m: prev[2] + (next[2] - prev[2]) * tFrac,
    s: prev[3] + (next[3] - prev[3]) * tFrac,
  };
}

function bmiForAgePercentile(bmi: number, ageMonths: number, sex: BiologicalSex): number | null {
  const table = sex === 'male' ? CDC_BMI_LMS_MALE : CDC_BMI_LMS_FEMALE;
  const lms = interpolateLms(table, ageMonths);
  if (!lms || lms.m <= 0 || lms.s <= 0) {
    return null;
  }

  const ratio = bmi / lms.m;
  if (ratio <= 0) {
    return null;
  }

  const z =
    Math.abs(lms.l) < 1e-8 ? Math.log(ratio) / lms.s : (Math.pow(ratio, lms.l) - 1) / (lms.l * lms.s);

  const percentile = normalCdf(z) * 100;
  return Math.round(Math.min(99.9, Math.max(0.1, percentile)) * 10) / 10;
}

function makeInfo(
  value: number,
  category: BmiCategory,
  classification: BmiClassification,
  percentile: number | null,
  ageYears: number | null,
): BmiInfo {
  return {
    value,
    category,
    label: getCategoryLabel(category),
    classification,
    percentile,
    ageYears,
  };
}

export function classifyBmiValue(value: number, context?: BmiContext | null): BmiInfo {
  const hasBirthDate = context?.birthDate != null;
  const age = hasBirthDate ? getAgeOnDate(context!.birthDate!, context!.date) : null;
  const ageYears = age?.years ?? null;

  if (hasBirthDate && age === null) {
    return makeInfo(value, 'unclassified', 'unclassified', null, null);
  }

  if (!age) {
    const category = adultCategory(value);
    return makeInfo(value, category, 'adult', null, null);
  }

  if (age.years < 2) {
    return makeInfo(value, 'unclassified', 'unclassified', null, age.years);
  }

  if (age.years < 20) {
    if (!context?.sex) {
      return makeInfo(value, 'unclassified', 'unclassified', null, age.years);
    }

    const percentile = bmiForAgePercentile(value, age.ageMonths, context.sex);
    if (percentile === null) {
      return makeInfo(value, 'unclassified', 'unclassified', null, age.years);
    }

    return makeInfo(value, percentileCategory(percentile), 'bmiForAge', percentile, age.years);
  }

  const category = adultCategory(value);
  return makeInfo(value, category, 'adult', null, ageYears);
}

export function calculateBmi(
  weightKg: number,
  heightCm: number,
  context?: BmiContext | null,
): BmiInfo | null {
  if (weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const heightM = heightCm / 100;
  const value = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  return classifyBmiValue(value, context);
}

export function getBmiTheme(category: BmiCategory, scheme: ColorScheme): BmiTheme {
  return BMI_THEMES[scheme][category];
}

export function formatBmiValue(value: number, locale: AppLocale): string {
  return formatDecimal(value, 1, 1, locale);
}
