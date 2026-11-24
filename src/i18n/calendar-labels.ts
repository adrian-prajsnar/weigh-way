import { AppLocale, getDateLocale } from './resolve-locale';

// Kept free of react-native-calendars so the helpers stay unit-testable.
export const calendarLocales = {
  en: {
    monthNames: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    monthNamesShort: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    today: 'Today',
  },
  pl: {
    monthNames: [
      'Styczeń',
      'Luty',
      'Marzec',
      'Kwiecień',
      'Maj',
      'Czerwiec',
      'Lipiec',
      'Sierpień',
      'Wrzesień',
      'Październik',
      'Listopad',
      'Grudzień',
    ],
    monthNamesShort: [
      'Sty',
      'Lut',
      'Mar',
      'Kwi',
      'Maj',
      'Cze',
      'Lip',
      'Sie',
      'Wrz',
      'Paź',
      'Lis',
      'Gru',
    ],
    dayNames: ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'],
    dayNamesShort: ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'],
    today: 'Dziś',
  },
} as const;

/** Month heading in the calendar's `MMMM yyyy` format; `monthIndex` is 0-based. */
export function getCalendarMonthTitle(locale: AppLocale, year: number, monthIndex: number): string {
  return `${calendarLocales[locale].monthNames[monthIndex]} ${year}`;
}

export function getCalendarDayLabel(locale: AppLocale, dateKey: string, detail?: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const label = date.toLocaleDateString(getDateLocale(locale), { dateStyle: 'full' });
  return detail ? `${label}. ${detail}` : label;
}

/** Short weekday names in display order; `firstDay` 1 starts the week on Monday. */
export function getCalendarWeekdayNames(locale: AppLocale, firstDay = 0): string[] {
  const names = [...calendarLocales[locale].dayNamesShort];
  const shift = ((firstDay % 7) + 7) % 7;
  return [...names.slice(shift), ...names.slice(0, shift)];
}
