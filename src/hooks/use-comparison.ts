import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fromDateKey,
  getDefaultTrendDateRange,
  getTrendDateRangeValidationMessageKey,
  toDateKey,
  getTrendDateRangeFieldHighlight,
  validateTrendDateRange,
  getTrendLatestTo,
} from '../format';
import { getComparison, getEarliestEntryDate, getTrendRows } from '../stats';
import { ComparisonMode, CustomCompareKind, TrendGranularity, WeightEntry } from '../types';
import { runWhenIdle } from '../run-when-idle';
import { useTodayKey } from './use-today-key';
import { TranslationKey } from '../i18n/translation-keys';

function isTrendMode(mode: ComparisonMode): mode is TrendGranularity {
  return mode !== 'custom';
}

type UseComparisonOptions = {
  entries: WeightEntry[];
  isLoading: boolean;
  birthDate: string | null;
  t: (scope: TranslationKey, options?: Record<string, unknown>) => string;
};

export function useComparison({ entries, isLoading, birthDate, t }: UseComparisonOptions) {
  const listReadyTaskRef = useRef<ReturnType<typeof runWhenIdle> | null>(null);
  const todayKey = useTodayKey();
  const today = useMemo(() => fromDateKey(todayKey), [todayKey]);
  const [isListReady, setIsListReady] = useState(false);
  const [mode, setMode] = useState<ComparisonMode>('day');

  const earliestWeighInDate = useMemo(() => getEarliestEntryDate(entries), [entries]);
  const defaultTrendRange = useMemo(
    () => getDefaultTrendDateRange('day', today, birthDate, earliestWeighInDate),
    [birthDate, earliestWeighInDate, today],
  );
  const [fromDate, setFromDate] = useState(defaultTrendRange.from);
  const [toDate, setToDate] = useState(defaultTrendRange.to);

  const previousTodayRef = useRef(today);
  useEffect(() => {
    const previousToday = previousTodayRef.current;
    previousTodayRef.current = today;
    if (!isTrendMode(mode) || toDateKey(previousToday) === todayKey) return;
    const previous = getDefaultTrendDateRange(mode, previousToday, birthDate, earliestWeighInDate);
    if (
      toDateKey(fromDate) === toDateKey(previous.from) &&
      toDateKey(toDate) === toDateKey(previous.to)
    ) {
      const next = getDefaultTrendDateRange(mode, today, birthDate, earliestWeighInDate);
      setFromDate(next.from);
      setToDate(next.to);
    }
  }, [birthDate, earliestWeighInDate, fromDate, mode, toDate, today, todayKey]);

  const [customKind, setCustomKind] = useState<CustomCompareKind>('period');

  const [rangeAStart, setRangeAStart] = useState<Date | null>(null);
  const [rangeAEnd, setRangeAEnd] = useState<Date | null>(null);
  const [rangeBStart, setRangeBStart] = useState<Date | null>(null);
  const [rangeBEnd, setRangeBEnd] = useState<Date | null>(null);
  const [dateA, setDateA] = useState<Date | null>(null);
  const [dateB, setDateB] = useState<Date | null>(null);

  const beginListLoading = useCallback(() => {
    listReadyTaskRef.current?.cancel();
    setIsListReady(false);
    listReadyTaskRef.current = runWhenIdle(() => {
      setIsListReady(true);
      listReadyTaskRef.current = null;
    });
  }, []);

  useEffect(() => {
    const task = runWhenIdle(() => {
      setIsListReady(true);
    });
    return () => task.cancel();
  }, []);

  const resetCustomRanges = () => {
    setRangeAStart(null);
    setRangeAEnd(null);
    setRangeBStart(null);
    setRangeBEnd(null);
  };

  const resetCustomDates = () => {
    setDateA(null);
    setDateB(null);
  };

  useEffect(() => {
    if (!birthDate && mode === 'ageYear') {
      setMode('day');
    }
  }, [birthDate, mode]);

  const applyDefaultRange = useCallback(
    (granularity: TrendGranularity) => {
      const next = getDefaultTrendDateRange(granularity, today, birthDate, earliestWeighInDate);
      setFromDate(next.from);
      setToDate(next.to);
    },
    [birthDate, earliestWeighInDate, today],
  );

  const fromKey = toDateKey(fromDate);
  const toKey = toDateKey(toDate);

  const rangeValidation = useMemo(() => {
    if (!isTrendMode(mode)) {
      return null;
    }
    return validateTrendDateRange(fromDate, toDate, mode, today, birthDate);
  }, [birthDate, fromDate, mode, today, toDate]);

  const rangeValidationMessage = useMemo(() => {
    if (!rangeValidation || !isTrendMode(mode)) {
      return null;
    }
    return t(getTrendDateRangeValidationMessageKey(rangeValidation, mode));
  }, [mode, rangeValidation, t]);

  const rangeFieldHighlight = useMemo(() => {
    if (!rangeValidation || !isTrendMode(mode)) {
      return { from: false, to: false };
    }
    return getTrendDateRangeFieldHighlight(
      rangeValidation,
      fromDate,
      toDate,
      mode,
      today,
      birthDate,
    );
  }, [birthDate, fromDate, mode, rangeValidation, today, toDate]);

  const isInvalidRange = rangeValidation !== null;

  const isDefaultRange = useMemo(() => {
    if (!isTrendMode(mode)) {
      return true;
    }
    const defaultRange = getDefaultTrendDateRange(mode, today, birthDate, earliestWeighInDate);
    return fromKey === toDateKey(defaultRange.from) && toKey === toDateKey(defaultRange.to);
  }, [birthDate, earliestWeighInDate, fromKey, mode, today, toKey]);

  const appliedEarliestWeighInRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isLoading || !isTrendMode(mode)) {
      return;
    }
    if (appliedEarliestWeighInRef.current === earliestWeighInDate) {
      return;
    }

    const entryAwareDefault = getDefaultTrendDateRange(mode, today, birthDate, earliestWeighInDate);
    if (
      fromKey === toDateKey(entryAwareDefault.from) &&
      toKey === toDateKey(entryAwareDefault.to)
    ) {
      appliedEarliestWeighInRef.current = earliestWeighInDate;
      return;
    }

    const preDataDefault = getDefaultTrendDateRange(mode, today, birthDate);
    if (fromKey !== toDateKey(preDataDefault.from) || toKey !== toDateKey(preDataDefault.to)) {
      appliedEarliestWeighInRef.current = earliestWeighInDate;
      return;
    }

    appliedEarliestWeighInRef.current = earliestWeighInDate;
    applyDefaultRange(mode);
  }, [applyDefaultRange, birthDate, earliestWeighInDate, fromKey, isLoading, mode, today, toKey]);

  const filterRange = useMemo(() => ({ start: fromKey, end: toKey }), [fromKey, toKey]);

  const trendRows = useMemo(() => {
    if (!isListReady || !isTrendMode(mode) || isInvalidRange) {
      return [];
    }
    return getTrendRows(entries, mode, filterRange, birthDate);
  }, [birthDate, entries, filterRange, isInvalidRange, isListReady, mode]);

  const showTrendContent = !isLoading && isListReady && !isInvalidRange;

  const filterMinimumFrom = useMemo(() => {
    if (!birthDate || !isTrendMode(mode) || mode === 'day') {
      return undefined;
    }
    return fromDateKey(birthDate);
  }, [birthDate, mode]);

  const customRanges = useMemo(() => {
    if (mode !== 'custom') {
      return null;
    }
    if (customKind === 'dates') {
      if (!dateA || !dateB) {
        return null;
      }
      const dateAKey = toDateKey(dateA);
      const dateBKey = toDateKey(dateB);
      return {
        rangeA: { start: dateAKey, end: dateAKey },
        rangeB: { start: dateBKey, end: dateBKey },
      };
    }
    if (!rangeAStart || !rangeAEnd || !rangeBStart || !rangeBEnd) {
      return null;
    }
    return {
      rangeA: { start: toDateKey(rangeAStart), end: toDateKey(rangeAEnd) },
      rangeB: { start: toDateKey(rangeBStart), end: toDateKey(rangeBEnd) },
    };
  }, [customKind, dateA, dateB, mode, rangeAStart, rangeAEnd, rangeBStart, rangeBEnd]);

  const customIncomplete =
    mode === 'custom' &&
    (customKind === 'period'
      ? !rangeAStart || !rangeAEnd || !rangeBStart || !rangeBEnd
      : !dateA || !dateB);

  const comparison = useMemo(() => {
    if (mode !== 'custom' || !customRanges) {
      return null;
    }
    return getComparison(entries, 'custom', customRanges, birthDate, customKind);
  }, [birthDate, customKind, customRanges, entries, mode]);

  const customInvalid =
    mode === 'custom' &&
    customKind === 'period' &&
    customRanges &&
    (customRanges.rangeA.start > customRanges.rangeA.end ||
      customRanges.rangeB.start > customRanges.rangeB.end);

  const rangeAInvalid = Boolean(
    rangeAStart && rangeAEnd && toDateKey(rangeAStart) > toDateKey(rangeAEnd),
  );
  const rangeBInvalid = Boolean(
    rangeBStart && rangeBEnd && toDateKey(rangeBStart) > toDateKey(rangeBEnd),
  );

  const handleModeChange = (nextMode: ComparisonMode) => {
    if (nextMode === 'custom' && mode !== 'custom') {
      setCustomKind('period');
      resetCustomRanges();
      resetCustomDates();
    }
    if (isTrendMode(nextMode)) {
      applyDefaultRange(nextMode);
      beginListLoading();
    }
    setMode(nextMode);
  };

  const handleCustomKindChange = (nextKind: CustomCompareKind) => {
    if (nextKind === customKind) {
      return;
    }
    if (nextKind === 'period') {
      resetCustomDates();
    } else {
      resetCustomRanges();
    }
    setCustomKind(nextKind);
  };

  const handleRangeChange = (start: Date, end: Date) => {
    if (!isTrendMode(mode)) {
      return;
    }
    beginListLoading();
    setFromDate(start);
    setToDate(end);
  };

  const validateRange = (start: Date, end: Date) => {
    if (!isTrendMode(mode)) return null;
    const error = validateTrendDateRange(start, end, mode, today, birthDate);
    return error ? t(getTrendDateRangeValidationMessageKey(error, mode)) : null;
  };

  const getLatestEnd = (start: Date) =>
    isTrendMode(mode) ? getTrendLatestTo(start, mode, today) : today;

  const handleRangeAChange = (start: Date, end: Date) => {
    setRangeAStart(start);
    setRangeAEnd(end);
  };

  const handleRangeBChange = (start: Date, end: Date) => {
    setRangeBStart(start);
    setRangeBEnd(end);
  };

  const resetRange = () => {
    if (isTrendMode(mode)) {
      applyDefaultRange(mode);
      beginListLoading();
    }
  };

  const trendEmptyMessage = isInvalidRange
    ? (rangeValidationMessage ?? t('comparison.invalidRange'))
    : t('comparison.nothingMessage');

  return {
    today,
    mode,
    customKind,
    fromDate,
    toDate,
    rangeAStart,
    rangeAEnd,
    rangeBStart,
    rangeBEnd,
    dateA,
    dateB,
    isDefaultRange,
    rangeValidationMessage,
    rangeFieldHighlight,
    isInvalidRange,
    trendRows,
    showTrendContent,
    filterMinimumFrom,
    customIncomplete,
    comparison,
    customInvalid,
    rangeAInvalid,
    rangeBInvalid,
    trendEmptyMessage,
    handleModeChange,
    handleCustomKindChange,
    handleRangeChange,
    validateRange,
    getLatestEnd,
    resetRange,
    handleRangeAChange,
    handleRangeBChange,
    setDateA,
    setDateB,
  };
}

export { isTrendMode };
