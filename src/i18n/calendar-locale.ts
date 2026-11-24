import { LocaleConfig } from 'react-native-calendars';
import { calendarLocales } from './calendar-labels';
import { AppLocale } from './resolve-locale';

export function configureCalendarLocale(locale: AppLocale): void {
  LocaleConfig.locales.en = calendarLocales.en;
  LocaleConfig.locales.pl = calendarLocales.pl;
  LocaleConfig.defaultLocale = locale;
}
