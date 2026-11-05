import { addDays, fromDateKey, toDateKey } from '../format';

export type RangeEndpoint = 'start' | 'end';

export type RangeSelection = {
  start: string | null;
  end: string | null;
  active: RangeEndpoint;
};

export function getRangeSelectionBounds(
  selection: RangeSelection,
  minimumDate?: string,
  maximumDate?: string,
  latestEnd?: string,
): { minimumDate: string | undefined; maximumDate: string | undefined } {
  if (selection.active !== 'end' || !selection.start) return { minimumDate, maximumDate };
  return {
    minimumDate: minimumDate && minimumDate > selection.start ? minimumDate : selection.start,
    maximumDate: latestEnd && (!maximumDate || latestEnd < maximumDate) ? latestEnd : maximumDate,
  };
}

export function getRangeDayCount(start: string | null, end: string | null): number | null {
  if (!start || (end !== null && end < start)) return null;
  const dayNumber = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    // Count calendar dates, independently of local daylight-saving changes.
    return Date.UTC(year, month - 1, day) / 86400000;
  };
  return dayNumber(end ?? start) - dayNumber(start) + 1;
}

export function selectRangeDate(selection: RangeSelection, date: string): RangeSelection {
  if (selection.active === 'start' || selection.start === null) {
    return {
      start: date,
      end: selection.end !== null && selection.end >= date ? selection.end : null,
      active: 'end',
    };
  }
  if (date < selection.start) {
    return selection;
  }
  return { ...selection, end: date };
}

// Only mark the visible month, even when a range spans many years.
export function getRangeDaysInMonth(
  start: string | null,
  end: string | null,
  month: string,
): string[] {
  if (!start) return [];
  const monthStart = `${month.slice(0, 7)}-01`;
  const date = fromDateKey(monthStart);
  const monthEnd = toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  const first = start > monthStart ? start : monthStart;
  const last = (end ?? start) < monthEnd ? (end ?? start) : monthEnd;
  const days: string[] = [];
  for (let day = first; day <= last; day = toDateKey(addDays(fromDateKey(day), 1))) {
    days.push(day);
  }
  return days;
}
