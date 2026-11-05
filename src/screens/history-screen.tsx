import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppCard } from '../components/app-card';
import { ContentFrame } from '../components/content-frame';
import { DateRangeField } from '../components/date-range-field';
import { ErrorCard } from '../components/error-card';
import { HistoryList } from '../components/history-list';
import { HistoryListSkeleton } from '../components/history-list-skeleton';
import { ScreenHeader } from '../components/screen-header';
import { WeightEntryModal } from '../components/weight-entry-modal';
import { useConfirm } from '../context/confirm-context';
import { useToast } from '../context/toast-context';
import { useSharedWeightEntries } from '../context/weight-entries-context';
import { useTabScreenScroll } from '../hooks/use-tab-screen-scroll';
import { useScrollHeader } from '../hooks/use-scroll-header';
import { useTodayKey } from '../hooks/use-today-key';
import { useTranslation } from '../i18n/language-context';
import {
  formatDateLabel,
  getDefaultHistoryDateRange,
  getHistoryDateRangeFieldHighlight,
  getHistoryDateRangeValidationMessageKey,
  getHistoryLatestTo,
  fromDateKey,
  toDateKey,
  validateHistoryDateRange,
} from '../format';
import { filterEntriesByBounds } from '../stats';
import { runWhenIdle } from '../run-when-idle';
import { useAppStyles } from '../theme/styles';
import { webFocusTarget } from '../theme/web-focus-target';
import { useColors } from '../theme/theme-context';
import { waitForInteractions, waitForPaint } from '../wait-for-paint';

export function HistoryScreen() {
  const styles = useAppStyles();
  const colors = useColors();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  const { entries, isLoading, isRefreshing, deletingDate, error, removeEntry, refreshEntries } =
    useSharedWeightEntries();
  const { showError, showSuccess } = useToast();
  const { confirm } = useConfirm();
  const { scrollY, onScroll } = useScrollHeader();
  const { scrollViewStyle, contentContainerStyle } = useTabScreenScroll();
  const todayKey = useTodayKey();
  const today = useMemo(() => fromDateKey(todayKey), [todayKey]);
  const defaultRange = useMemo(() => getDefaultHistoryDateRange(today), [today]);
  const [fromDate, setFromDate] = useState(() => defaultRange.from);
  const [toDate, setToDate] = useState(() => defaultRange.to);
  const previousDefaultRange = useRef(defaultRange);
  useEffect(() => {
    const previous = previousDefaultRange.current;
    setFromDate((date) =>
      toDateKey(date) === toDateKey(previous.from) ? defaultRange.from : date,
    );
    setToDate((date) => (toDateKey(date) === toDateKey(previous.to) ? defaultRange.to : date));
    previousDefaultRange.current = defaultRange;
  }, [defaultRange]);
  const [isListReady, setIsListReady] = useState(false);
  const hasActivatedListRef = useRef(false);
  const [isClearingFilter, setIsClearingFilter] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  useEffect(() => {
    if (!isFocused || hasActivatedListRef.current) {
      return;
    }

    hasActivatedListRef.current = true;
    const task = runWhenIdle(() => {
      setIsListReady(true);
    });
    return () => task.cancel();
  }, [isFocused]);

  const fromKey = toDateKey(fromDate);
  const toKey = toDateKey(toDate);
  const defaultFromKey = toDateKey(defaultRange.from);
  const defaultToKey = toDateKey(defaultRange.to);
  const isFilterCustom = fromKey !== defaultFromKey || toKey !== defaultToKey;
  const rangeValidation = useMemo(
    () => validateHistoryDateRange(fromDate, toDate, today),
    [fromDate, toDate, today],
  );
  const rangeValidationMessage = useMemo(() => {
    if (!rangeValidation) {
      return null;
    }
    return t(getHistoryDateRangeValidationMessageKey(rangeValidation));
  }, [rangeValidation, t]);
  const rangeFieldHighlight = useMemo(
    () => getHistoryDateRangeFieldHighlight(rangeValidation, fromDate, toDate, today),
    [fromDate, rangeValidation, toDate, today],
  );
  const isInvalidRange = rangeValidation !== null;
  const showListContent = !isLoading && isListReady;

  const filteredEntries = useMemo(() => {
    if (isInvalidRange) {
      return [];
    }
    return filterEntriesByBounds(entries, fromKey, toKey);
  }, [entries, fromKey, toKey, isInvalidRange]);

  const handleRangeChange = useCallback(async (start: Date, end: Date) => {
    setFromDate(start);
    setToDate(end);
    await waitForInteractions();
  }, []);

  const validateRange = (start: Date, end: Date) => {
    const error = validateHistoryDateRange(start, end, today);
    return error ? t(getHistoryDateRangeValidationMessageKey(error)) : null;
  };

  const handleEdit = useCallback((date: string) => {
    setEditingDate(date);
  }, []);

  const handleDelete = useCallback(
    (date: string) => {
      const dateLabel = formatDateLabel(date);
      void confirm({
        title: t('history.deleteEntry'),
        message: t('history.deleteConfirm', { date: dateLabel }),
        confirmLabel: t('common.delete'),
        destructive: true,
      }).then((confirmed) => {
        if (!confirmed) {
          return;
        }
        void (async () => {
          try {
            await removeEntry(date);
            showSuccess(t('history.deleted', { date: dateLabel }));
          } catch (deleteError) {
            const message =
              deleteError instanceof Error ? deleteError.message : t('history.deleteFailed');
            showError(message);
          }
        })();
      });
    },
    [confirm, removeEntry, showError, showSuccess, t],
  );

  const clearFilter = useCallback(() => {
    if (isClearingFilter) {
      return;
    }
    void (async () => {
      setIsClearingFilter(true);
      await waitForPaint();
      setFromDate(defaultRange.from);
      setToDate(defaultRange.to);
      await waitForInteractions();
      setIsClearingFilter(false);
    })();
  }, [defaultRange.from, defaultRange.to, isClearingFilter]);

  const emptyMessage = isInvalidRange
    ? (rangeValidationMessage ?? t('history.invalidRangeEmpty'))
    : t('history.emptyFiltered');

  const subtitle = useMemo(() => {
    if (isLoading) {
      return t('history.subtitleLoading');
    }
    const totalLabel = t('history.totalWeighIns', { count: entries.length });
    if (filteredEntries.length === entries.length) {
      return totalLabel;
    }
    return `${totalLabel} · ${t('history.filteredWeighIns', { count: filteredEntries.length })}`;
  }, [entries.length, filteredEntries.length, isLoading, t]);

  return (
    <View style={styles.screen}>
      <ContentFrame>
        <ScreenHeader title={t('history.title')} subtitle={subtitle} scrollY={scrollY} />

        <Animated.ScrollView
          style={scrollViewStyle}
          contentContainerStyle={contentContainerStyle}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            Platform.OS === 'web' ? undefined : (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void refreshEntries().catch(() => undefined)}
              />
            )
          }
        >
          {error && !isLoading ? (
            <ErrorCard
              message={error}
              onRetry={() => void refreshEntries().catch(() => undefined)}
            />
          ) : null}

          <AppCard delay={0}>
            <DateRangeField
              start={fromDate}
              end={toDate}
              onChange={handleRangeChange}
              maximumDate={today}
              invalid={rangeFieldHighlight.from || rangeFieldHighlight.to}
              validateRange={validateRange}
              getLatestEnd={(start) => getHistoryLatestTo(start, today)}
            />
            {isFilterCustom || isClearingFilter ? (
              <View style={styles.filterActionsRow}>
                <Pressable
                  onPress={clearFilter}
                  disabled={isClearingFilter}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ busy: isClearingFilter }}
                  {...webFocusTarget('text-button')}
                >
                  {isClearingFilter ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={styles.linkText}>{t('history.clearAll')}</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
            {rangeValidationMessage ? (
              <Text style={styles.warningText}>{rangeValidationMessage}</Text>
            ) : null}
          </AppCard>

          <AppCard isBusy={isRefreshing && showListContent} delay={60}>
            {showListContent ? (
              <HistoryList
                entries={filteredEntries}
                onEdit={handleEdit}
                onDelete={handleDelete}
                deletingDate={deletingDate}
                emptyMessage={emptyMessage}
                grouped
              />
            ) : (
              <HistoryListSkeleton rows={6} />
            )}
          </AppCard>
        </Animated.ScrollView>
      </ContentFrame>

      <WeightEntryModal
        visible={editingDate !== null}
        date={editingDate}
        entries={entries}
        onClose={() => setEditingDate(null)}

        isDataLoading={isLoading}
      />
    </View>
  );
}
