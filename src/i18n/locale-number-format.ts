import { AppLocale, getDateLocale } from './resolve-locale';

const formatterCache = new Map<string, Intl.NumberFormat>();

function getCachedFormatter(
  locale: AppLocale,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
): Intl.NumberFormat {
  const key = `${locale}:${minimumFractionDigits}:${maximumFractionDigits}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(getDateLocale(locale), {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping: false,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export function formatDecimal(
  value: number,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  locale: AppLocale,
): string {
  return getCachedFormatter(locale, minimumFractionDigits, maximumFractionDigits).format(
    value,
  );
}
