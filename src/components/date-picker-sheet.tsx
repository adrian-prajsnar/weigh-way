import { Ionicons } from '@expo/vector-icons';
import { ComponentRef, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { configureCalendarLocale } from '../i18n/calendar-locale';
import { getDateLocale } from '../i18n/resolve-locale';
import { useTranslation } from '../i18n/language-context';
import { formatDateLabel, getTodayDate, toDateKey } from '../format';
import { waitForPaint } from '../wait-for-paint';
import { useSheetContainerStyle } from '../hooks/use-sheet-container-style';
import { useAppWindowDimensions } from '../hooks/use-app-window-dimensions';
import { ModalSheetDismissArea } from './modal-sheet-dismiss-area';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { fontFamily, spacing } from '../theme/tokens';
import { DateRangeCalendarDay } from './date-range-calendar-day';
import { useDatePickerDraft } from './use-date-picker-draft';
import {
  getRangeDayCount,
  getRangeDaysInMonth,
  getRangeSelectionBounds,
  RangeEndpoint,
  selectRangeDate,
} from './date-range-selection';

type DatePickerSheetProps = {
  visible: boolean;
  title?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  onClose: () => void;
} & (
  | { mode?: 'date'; value: Date; onConfirm: (date: Date) => void | Promise<void> }
  | {
      mode: 'range';
      value: { start: Date | null; end: Date | null };
      onConfirm: (range: { start: Date; end: Date }) => void | Promise<void>;
      validateRange?: (start: Date, end: Date) => string | null;
      getLatestEnd?: (start: Date) => Date;
    }
);

const YEAR_ROW_HEIGHT = 48;

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function parseDateParts(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

function clampDateKey(
  year: number,
  month: number,
  day: number,
  minDate?: string,
  maxDate?: string,
): string {
  const daysInMonth = new Date(year, month, 0).getDate();
  let nextDay = Math.min(day, daysInMonth);
  let date = new Date(year, month - 1, nextDay);
  date.setHours(0, 0, 0, 0);

  if (minDate) {
    const min = parseDateKey(minDate);
    if (date < min) {
      date = min;
    }
  }

  if (maxDate) {
    const max = parseDateKey(maxDate);
    if (date > max) {
      date = max;
    }
  }

  return toDateKey(date);
}

function getMonthCalendarKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function getYearOptions(minDate?: string, maxDate?: string): number[] {
  const minYear = minDate ? parseDateParts(minDate).year : 1900;
  const maxYear = maxDate ? parseDateParts(maxDate).year : new Date().getFullYear();
  return Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index);
}

function isMonthDisabled(year: number, month: number, minDate?: string, maxDate?: string): boolean {
  const monthStart = getMonthCalendarKey(year, month);
  const monthEnd = toDateKey(new Date(year, month, 0));
  if (minDate && monthEnd < minDate) {
    return true;
  }
  if (maxDate && monthStart > maxDate) {
    return true;
  }
  return false;
}

function PickerContent({ children, scrollable }: { children: ReactNode; scrollable: boolean }) {
  const styles = useAppStyles();
  return (
    <ScrollView
      style={styles.datePickerContent}
      contentContainerStyle={styles.datePickerScrollContent}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scrollable}
      nestedScrollEnabled
    >
      {children}
    </ScrollView>
  );
}

export function DatePickerSheet(props: DatePickerSheetProps) {
  const { visible, title, minimumDate, maximumDate, onClose } = props;
  const styles = useAppStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useAppWindowDimensions();
  const sheetContainerStyle = useSheetContainerStyle({
    paddingBottom: Math.max(insets.bottom, 16),
  });
  const { t, locale } = useTranslation();
  const dateLocale = getDateLocale(locale);
  const yearListRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [yearListHeight, setYearListHeight] = useState(240);
  const isRange = props.mode === 'range';
  const startKey =
    props.mode === 'range' && props.value.start ? toDateKey(props.value.start) : null;
  const endKey = props.mode === 'range' && props.value.end ? toDateKey(props.value.end) : null;
  const initialKey =
    props.mode === 'range'
      ? (startKey ?? endKey ?? toDateKey(maximumDate ?? getTodayDate()))
      : toDateKey(props.value);
  const { selectedKey, setSelectedKey, range, setRange, panel, setPanel } = useDatePickerDraft({
    visible,
    initialKey,
    startKey,
    endKey,
  });
  const [isConfirming, setIsConfirming] = useState(false);
  const [monthDirection, setMonthDirection] = useState<'previous' | 'next'>('next');
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!visible) setIsConfirming(false);
  }, [visible]);

  useEffect(() => {
    configureCalendarLocale(locale);
  }, [locale]);

  const minDate = minimumDate ? toDateKey(minimumDate) : undefined;
  const maxDate = maximumDate ? toDateKey(maximumDate) : undefined;
  const { year, month } = parseDateParts(selectedKey);
  const calendarKey = getMonthCalendarKey(year, month);
  const latestEndDate =
    props.mode === 'range' && range.start
      ? props.getLatestEnd?.(parseDateKey(range.start))
      : undefined;
  const latestEnd = latestEndDate ? toDateKey(latestEndDate) : undefined;
  const { minimumDate: rangeMinDate, maximumDate: rangeMaxDate } = getRangeSelectionBounds(
    range,
    minDate,
    maxDate,
    latestEnd,
  );
  const previousMonthDisabled = Boolean(
    rangeMinDate && calendarKey.slice(0, 7) <= rangeMinDate.slice(0, 7),
  );
  const nextMonthDisabled = Boolean(
    rangeMaxDate && calendarKey.slice(0, 7) >= rangeMaxDate.slice(0, 7),
  );
  const selectedDayCount = getRangeDayCount(range.start, range.end);
  const rangeError =
    props.mode === 'range' && range.start && range.end
      ? (props.validateRange?.(parseDateKey(range.start), parseDateKey(range.end)) ?? null)
      : null;
  const cannotConfirm =
    isConfirming ||
    (isRange &&
      (!range.start ||
        !range.end ||
        range.start > range.end ||
        (minDate && range.start < minDate) ||
        (maxDate && range.end > maxDate) ||
        (latestEnd && range.end > latestEnd) ||
        Boolean(rangeError)));
  const rangePrompt = t(range.active === 'start' ? 'dateRange.selectStart' : 'dateRange.selectEnd');

  useEffect(() => {
    if (visible && isRange && Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(rangePrompt);
    }
  }, [visible, isRange, rangePrompt]);

  const { accent: rangeColor, onAccent: rangeTextColor } = colors;
  const rangeStartLabel = t('dateRange.rangeStart');
  const rangeEndLabel = t('dateRange.rangeEnd');
  const rangeSingleDayLabel = t('dateRange.rangeSingleDay');
  const rangeMarkedDates = Object.fromEntries(
    getRangeDaysInMonth(range.start, range.end, calendarKey).map((day) => [
      day,
      {
        startingDay: day === range.start,
        endingDay: day === (range.end ?? range.start),
        color: rangeColor,
        textColor: rangeTextColor,
        accessibilityLabel:
          day === range.start && day === range.end
            ? rangeSingleDayLabel
            : day === range.start
              ? rangeStartLabel
              : day === range.end
                ? rangeEndLabel
                : undefined,
      },
    ]),
  );

  const markedDates = useMemo(
    () => ({
      [selectedKey]: {
        selected: true,
        selectedColor: colors.accent,
        selectedTextColor: colors.onAccent,
      },
    }),
    [colors.accent, colors.onAccent, selectedKey],
  );

  const calendarTheme = useMemo(
    () => ({
      backgroundColor: colors.surface,
      calendarBackground: colors.surface,
      textSectionTitleColor: colors.textMuted,
      textSectionTitleDisabledColor: colors.textSubtle,
      selectedDayBackgroundColor: colors.accent,
      selectedDayTextColor: colors.onAccent,
      todayTextColor: colors.accent,
      dayTextColor: colors.text,
      textDisabledColor: colors.textSubtle,
      monthTextColor: colors.text,
      arrowColor: colors.accent,
      disabledArrowColor: colors.textSubtle,
      dotColor: colors.accent,
      indicatorColor: colors.accent,
      textDayFontFamily: fontFamily.medium,
      textMonthFontFamily: fontFamily.semibold,
      textDayHeaderFontFamily: fontFamily.medium,
      textDayFontSize: 15,
      textMonthFontSize: 16,
      textDayHeaderFontSize: 12,
    }),
    [colors],
  );

  const monthLabels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) =>
        new Date(2000, monthIndex, 1).toLocaleDateString(dateLocale, { month: 'long' }),
      ),
    [dateLocale],
  );

  const monthShortLabels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) =>
        new Date(2000, monthIndex, 1).toLocaleDateString(dateLocale, { month: 'short' }),
      ),
    [dateLocale],
  );

  const yearOptions = useMemo(
    () => getYearOptions(rangeMinDate, rangeMaxDate),
    [rangeMaxDate, rangeMinDate],
  );

  useEffect(() => {
    if (!visible || panel !== 'year') {
      return;
    }

    const selectedIndex = yearOptions.indexOf(year);
    if (selectedIndex < 0) {
      return;
    }

    requestAnimationFrame(() => {
      yearListRef.current?.scrollTo({
        y: Math.max(
          0,
          selectedIndex * (YEAR_ROW_HEIGHT + spacing.xs) - (yearListHeight - YEAR_ROW_HEIGHT) / 2,
        ),
        animated: false,
      });
    });
  }, [panel, visible, year, yearOptions, yearListHeight]);

  const handleDayPress = (day: DateData) => {
    if (
      (rangeMinDate && day.dateString < rangeMinDate) ||
      (rangeMaxDate && day.dateString > rangeMaxDate)
    )
      return;
    setSelectedKey(day.dateString);
    if (isRange) setRange((current) => selectRangeDate(current, day.dateString));
  };

  const handleEndpointPress = (active: RangeEndpoint) => {
    setRange((current) => ({ ...current, active }));
    const date = range[active];
    if (date) {
      setMonthDirection(date < selectedKey ? 'previous' : 'next');
      const bounds = getRangeSelectionBounds({ ...range, active }, minDate, maxDate, latestEnd);
      const parts = parseDateParts(date);
      setSelectedKey(
        clampDateKey(parts.year, parts.month, parts.day, bounds.minimumDate, bounds.maximumDate),
      );
    }
    setPanel('day');
  };

  const handleMonthNavigation = (direction: -1 | 1) => {
    if (direction === -1 ? previousMonthDisabled : nextMonthDisabled) return;
    const next = new Date(year, month - 1 + direction, 1);
    const { day } = parseDateParts(selectedKey);
    setMonthDirection(direction === -1 ? 'previous' : 'next');
    setSelectedKey(
      isRange
        ? toDateKey(next)
        : clampDateKey(next.getFullYear(), next.getMonth() + 1, day, rangeMinDate, rangeMaxDate),
    );
  };

  const handleMonthSelect = (nextMonth: number) => {
    setMonthDirection(nextMonth < month ? 'previous' : 'next');
    const { day } = parseDateParts(selectedKey);
    setSelectedKey(clampDateKey(year, nextMonth, day, rangeMinDate, rangeMaxDate));
    setPanel('day');
  };

  const handleYearSelect = (nextYear: number) => {
    setMonthDirection(nextYear < year ? 'previous' : 'next');
    const { month: currentMonth, day } = parseDateParts(selectedKey);
    setSelectedKey(clampDateKey(nextYear, currentMonth, day, rangeMinDate, rangeMaxDate));
    setPanel('day');
  };

  const handleConfirm = () => {
    if (cannotConfirm) {
      return;
    }
    setIsConfirming(true);
    void (async () => {
      await waitForPaint();
      try {
        if (props.mode === 'range') {
          if (!range.start || !range.end) return;
          await props.onConfirm({ start: parseDateKey(range.start), end: parseDateKey(range.end) });
        } else {
          await props.onConfirm(parseDateKey(selectedKey));
        }
        onClose();
      } finally {
        setIsConfirming(false);
      }
    })();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={isConfirming ? undefined : onClose}
    >
      <View style={styles.modalSheetBackdrop}>
        <ModalSheetDismissArea
          onPress={isConfirming ? undefined : onClose}
          disabled={isConfirming}
        />
        <View
          style={[sheetContainerStyle, { maxHeight: windowHeight - insets.top }]}
          accessibilityViewIsModal
        >
          <PickerContent scrollable={panel !== 'year'}>
            <View style={styles.datePickerSheetHeader}>
              <Text style={styles.datePickerSheetTitle}>{title ?? t('dateField.selectDate')}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.iconButton,
                  isConfirming && styles.buttonDisabled,
                  pressed && !isConfirming && styles.buttonPressed,
                ]}
                onPress={onClose}
                disabled={isConfirming}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {isRange ? (
              <>
                <View style={styles.datePickerPeriodRow}>
                  {(['start', 'end'] as const).map((endpoint) => (
                    <Pressable
                      key={endpoint}
                      style={[
                        styles.dateRangeEndpoint,
                        range.active === endpoint && styles.dateRangeEndpointActive,
                      ]}
                      onPress={() => handleEndpointPress(endpoint)}
                      disabled={endpoint === 'end' && !range.start}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: range.active === endpoint,
                        disabled: endpoint === 'end' && !range.start,
                      }}
                    >
                      <Text
                        style={[
                          styles.fieldLabel,
                          range.active === endpoint && styles.dateRangeEndpointActiveText,
                        ]}
                      >
                        {t(endpoint === 'start' ? 'dateRange.start' : 'dateRange.end')}
                      </Text>
                      <Text
                        style={[
                          styles.datePickerPeriodButtonText,
                          range.active === endpoint && styles.dateRangeEndpointActiveText,
                        ]}
                      >
                        {range[endpoint]
                          ? formatDateLabel(range[endpoint])
                          : t('dateField.selectDate')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.dateRangeStatusRow}>
                  <Text style={styles.fieldLabel} accessibilityLiveRegion="polite">
                    {rangePrompt}
                  </Text>
                  {selectedDayCount !== null ? (
                    <Text style={styles.dateRangeDayCount} accessibilityLiveRegion="polite">
                      {t('dateRange.selectedDays', { count: selectedDayCount })}
                    </Text>
                  ) : null}
                </View>
              </>
            ) : null}

            <View style={styles.datePickerPeriodRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.datePickerPeriodButton,
                  panel === 'month' && styles.datePickerPeriodButtonActive,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setPanel((current) => (current === 'month' ? 'day' : 'month'))}
                accessibilityRole="button"
                accessibilityLabel={t('dateField.selectMonth')}
              >
                <Text
                  style={[
                    styles.datePickerPeriodButtonText,
                    panel === 'month' && styles.datePickerPeriodButtonTextActive,
                  ]}
                >
                  {monthLabels[month - 1]}
                </Text>
                <Ionicons
                  name={panel === 'month' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={panel === 'month' ? colors.accent : colors.textMuted}
                />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.datePickerPeriodButton,
                  panel === 'year' && styles.datePickerPeriodButtonActive,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setPanel((current) => (current === 'year' ? 'day' : 'year'))}
                accessibilityRole="button"
                accessibilityLabel={t('dateField.selectYear')}
              >
                <Text
                  style={[
                    styles.datePickerPeriodButtonText,
                    panel === 'year' && styles.datePickerPeriodButtonTextActive,
                  ]}
                >
                  {year}
                </Text>
                <Ionicons
                  name={panel === 'year' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={panel === 'year' ? colors.accent : colors.textMuted}
                />
              </Pressable>
            </View>

            {panel === 'month' ? (
              <View style={styles.datePickerMonthGrid}>
                {monthLabels.map((label, monthIndex) => {
                  const monthNumber = monthIndex + 1;
                  const disabled = isMonthDisabled(year, monthNumber, rangeMinDate, rangeMaxDate);
                  const selected = monthNumber === month;

                  return (
                    <Pressable
                      key={label}
                      disabled={disabled}
                      style={({ pressed }) => [
                        styles.datePickerMonthCell,
                        selected && styles.datePickerMonthCellSelected,
                        disabled && styles.datePickerMonthCellDisabled,
                        pressed && !disabled && styles.buttonPressed,
                      ]}
                      onPress={() => handleMonthSelect(monthNumber)}
                    >
                      <Text
                        style={[
                          styles.datePickerMonthCellText,
                          selected && styles.datePickerMonthCellTextSelected,
                          disabled && styles.datePickerMonthCellTextDisabled,
                        ]}
                      >
                        {monthShortLabels[monthIndex]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {panel === 'year' ? (
              <ScrollView
                ref={yearListRef}
                nestedScrollEnabled
                onLayout={(event) => setYearListHeight(event.nativeEvent.layout.height)}
                style={styles.datePickerYearList}
                contentContainerStyle={styles.datePickerYearListContent}
                showsVerticalScrollIndicator
              >
                {yearOptions.map((item) => {
                  const selected = item === year;
                  return (
                    <Pressable
                      key={item}
                      style={({ pressed }) => [
                        styles.datePickerYearRow,
                        selected && styles.datePickerYearRowSelected,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => handleYearSelect(item)}
                    >
                      <Text
                        style={[
                          styles.datePickerYearRowText,
                          selected && styles.datePickerYearRowTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {panel === 'day' ? (
              <View style={styles.datePickerCalendarViewport}>
                <Animated.View
                  key={`${calendarKey}-${locale}-${colors.surface}`}
                  entering={
                    reducedMotion
                      ? undefined
                      : (monthDirection === 'next' ? FadeInRight : FadeInLeft).duration(220)
                  }
                  exiting={reducedMotion ? undefined : FadeOut.duration(120)}
                >
                  <Calendar
                    current={calendarKey}
                    minDate={rangeMinDate}
                    maxDate={rangeMaxDate}
                    onDayPress={handleDayPress}
                    markingType={isRange ? 'period' : undefined}
                    dayComponent={isRange ? DateRangeCalendarDay : undefined}
                    markedDates={isRange ? rangeMarkedDates : markedDates}
                    hideArrows={!isRange}
                    enableSwipeMonths
                    disableArrowLeft={previousMonthDisabled}
                    disableArrowRight={nextMonthDisabled}
                    onPressArrowLeft={() => handleMonthNavigation(-1)}
                    onPressArrowRight={() => handleMonthNavigation(1)}
                    disableAllTouchEventsForDisabledDays
                    hideExtraDays
                    firstDay={locale === 'pl' ? 1 : 0}
                    theme={calendarTheme}
                  />
                </Animated.View>
              </View>
            ) : null}

            {rangeError ? (
              <Text style={styles.warningText} accessibilityLiveRegion="polite">
                {rangeError}
              </Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                styles.datePickerSheetConfirm,
                cannotConfirm && styles.buttonDisabled,
                pressed && !cannotConfirm && styles.buttonPressed,
              ]}
              onPress={handleConfirm}
              disabled={cannotConfirm}
              accessibilityRole="button"
              accessibilityLabel={t(isRange ? 'dateRange.apply' : 'common.select')}
              accessibilityState={{ busy: isConfirming, disabled: cannotConfirm }}
            >
              {isConfirming ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {t(isRange ? 'dateRange.apply' : 'common.select')}
                </Text>
              )}
            </Pressable>
          </PickerContent>
        </View>
      </View>
    </Modal>
  );
}
