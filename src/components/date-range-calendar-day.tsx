import { ComponentProps } from 'react';
import { Pressable, Text } from 'react-native';
import { CalendarProps } from 'react-native-calendars';
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
}: CalendarDayProps) {
  const styles = useAppStyles();
  const disabled = marking?.disabled ?? (state === 'disabled' || state === 'inactive');
  const selected = Boolean(marking?.color);
  const endpoint = Boolean(marking?.startingDay || marking?.endingDay);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.dateRangeCalendarDay,
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
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
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
