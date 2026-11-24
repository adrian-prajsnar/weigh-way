import { ComponentProps } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { CalendarProps } from 'react-native-calendars';
import { getCalendarDayLabel } from '../i18n/calendar-labels';
import { useLanguage } from '../i18n/language-context';
import { toggleButtonA11y } from '../theme/selection-a11y';
import { useAppStyles } from '../theme/styles';

type CalendarDayProps = ComponentProps<NonNullable<CalendarProps['dayComponent']>>;

export function DateRangeCalendarDay({
  date,
  state,
  marking,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
  markingType,
}: CalendarDayProps) {
  const styles = useAppStyles();
  const { locale } = useLanguage();
  const isRange = markingType === 'period';
  const disabled = marking?.disabled ?? (state === 'disabled' || state === 'inactive');
  const selected = Boolean(isRange ? marking?.color : marking?.selected);
  const endpoint = isRange ? Boolean(marking?.startingDay || marking?.endingDay) : selected;
  const label =
    Platform.OS === 'web' && date
      ? getCalendarDayLabel(locale, date.dateString, marking?.accessibilityLabel)
      : accessibilityLabel;

  return (
    <Pressable
      style={({ pressed }) => [
        isRange ? styles.dateRangeCalendarDay : styles.datePickerSingleDay,
        selected && styles.dateRangeCalendarDaySelected,
        endpoint && styles.dateRangeCalendarDayEndpoint,
        marking?.startingDay && styles.dateRangeCalendarDayStart,
        marking?.endingDay && styles.dateRangeCalendarDayEnd,
        pressed && !disabled && styles.buttonPressed,
      ]}
      onPress={() => onPress?.(date)}
      onLongPress={() => onLongPress?.(date)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-current={state === 'today' ? 'date' : undefined}
      {...toggleButtonA11y(selected)}
      testID={testID}
    >
      <Text
        style={[
          styles.dateRangeCalendarDayText,
          state === 'today' && styles.dateRangeCalendarDayToday,
          disabled && styles.dateRangeCalendarDayDisabled,
          selected && styles.dateRangeCalendarDaySelectedText,
          endpoint && styles.dateRangeCalendarDayEndpointText,
        ]}
      >
        {date?.day}
      </Text>
    </Pressable>
  );
}
