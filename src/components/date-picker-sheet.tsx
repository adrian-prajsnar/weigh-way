import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { configureCalendarLocale } from '../i18n/calendar-locale';
import { getDateLocale } from '../i18n/resolve-locale';
import { useTranslation } from '../i18n/language-context';
import { toDateKey } from '../format';
import { waitForPaint } from '../wait-for-paint';
import { useSheetContainerStyle } from '../hooks/use-sheet-container-style';
import { ModalSheetDismissArea } from './modal-sheet-dismiss-area';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { fontFamily } from '../theme/tokens';

type DatePickerSheetProps = {
  visible: boolean;
  value: Date;
  title?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void | Promise<void>;
};

type PickerPanel = 'day' | 'month' | 'year';

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
  const monthEnd = clampDateKey(year, month, new Date(year, month, 0).getDate(), minDate, maxDate);
  if (minDate && monthEnd < minDate) {
    return true;
  }
  if (maxDate && monthStart > maxDate) {
    return true;
  }
  return false;
}

export function DatePickerSheet({
  visible,
  value,
  title,
  minimumDate,
  maximumDate,
  onClose,
  onConfirm,
}: DatePickerSheetProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const sheetContainerStyle = useSheetContainerStyle({ paddingBottom: Math.max(insets.bottom, 16) });
  const { t, locale } = useTranslation();
  const dateLocale = getDateLocale(locale);
  const yearListRef = useRef<FlatList<number>>(null);
  const [selectedKey, setSelectedKey] = useState(toDateKey(value));
  const [panel, setPanel] = useState<PickerPanel>('day');
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedKey(toDateKey(value));
      setPanel('day');
    } else {
      setIsConfirming(false);
    }
  }, [value, visible]);

  useEffect(() => {
    configureCalendarLocale(locale);
  }, [locale]);

  const minDate = minimumDate ? toDateKey(minimumDate) : undefined;
  const maxDate = maximumDate ? toDateKey(maximumDate) : undefined;
  const { year, month } = parseDateParts(selectedKey);
  const calendarKey = getMonthCalendarKey(year, month);

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

  const yearOptions = useMemo(() => getYearOptions(minDate, maxDate), [maxDate, minDate]);

  useEffect(() => {
    if (!visible || panel !== 'year') {
      return;
    }

    const selectedIndex = yearOptions.indexOf(year);
    if (selectedIndex < 0) {
      return;
    }

    requestAnimationFrame(() => {
      yearListRef.current?.scrollToIndex({
        index: selectedIndex,
        animated: false,
        viewPosition: 0.5,
      });
    });
  }, [panel, visible, year, yearOptions]);

  const handleDayPress = (day: DateData) => {
    setSelectedKey(day.dateString);
  };

  const handleMonthSelect = (nextMonth: number) => {
    const { day } = parseDateParts(selectedKey);
    setSelectedKey(clampDateKey(year, nextMonth, day, minDate, maxDate));
    setPanel('day');
  };

  const handleYearSelect = (nextYear: number) => {
    const { month: currentMonth, day } = parseDateParts(selectedKey);
    setSelectedKey(clampDateKey(nextYear, currentMonth, day, minDate, maxDate));
    setPanel('day');
  };

  const handleConfirm = () => {
    if (isConfirming) {
      return;
    }
    setIsConfirming(true);
    void (async () => {
      await waitForPaint();
      try {
        await onConfirm(parseDateKey(selectedKey));
        onClose();
      } finally {
        setIsConfirming(false);
      }
    })();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={isConfirming ? undefined : onClose}>
      <View style={styles.modalSheetBackdrop}>
        <ModalSheetDismissArea onPress={isConfirming ? undefined : onClose} disabled={isConfirming} />
        <View style={sheetContainerStyle}>
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
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

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
                const disabled = isMonthDisabled(year, monthNumber, minDate, maxDate);
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
            <FlatList
              ref={yearListRef}
              data={yearOptions}
              keyExtractor={(item) => String(item)}
              style={styles.datePickerYearList}
              contentContainerStyle={styles.datePickerYearListContent}
              showsVerticalScrollIndicator
              getItemLayout={(_, index) => ({
                length: YEAR_ROW_HEIGHT,
                offset: YEAR_ROW_HEIGHT * index,
                index,
              })}
              onScrollToIndexFailed={() => undefined}
              renderItem={({ item }) => {
                const selected = item === year;
                return (
                  <Pressable
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
              }}
            />
          ) : null}

          {panel === 'day' ? (
            <Calendar
              key={calendarKey}
              current={calendarKey}
              minDate={minDate}
              maxDate={maxDate}
              onDayPress={handleDayPress}
              markedDates={markedDates}
              hideArrows
              hideExtraDays
              firstDay={locale === 'pl' ? 1 : 0}
              theme={calendarTheme}
            />
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              styles.datePickerSheetConfirm,
              isConfirming && styles.buttonDisabled,
              pressed && !isConfirming && styles.buttonPressed,
            ]}
            onPress={handleConfirm}
            disabled={isConfirming}
            accessibilityRole="button"
            accessibilityLabel={t('common.select')}
            accessibilityState={{ busy: isConfirming }}
          >
            {isConfirming ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.primaryButtonText}>{t('common.select')}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
