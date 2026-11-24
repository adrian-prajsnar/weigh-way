import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { getCalendarMonthTitle, getCalendarWeekdayNames } from '../i18n/calendar-labels';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';

type CalendarWebHeaderProps = {
  year: number;
  month: number;
  firstDay: number;
  hideArrows: boolean;
  disableArrowLeft: boolean;
  disableArrowRight: boolean;
  onNavigate: (direction: -1 | 1) => void;
};

/**
 * Web replacement for the react-native-calendars header. The library header is
 * an `adjustable` view, which react-native-web renders as an unnamed,
 * unfocusable slider, with unlabeled month arrows. This keeps the same layout
 * with named buttons and plain text.
 */
export function CalendarWebHeader({
  year,
  month,
  firstDay,
  hideArrows,
  disableArrowLeft,
  disableArrowRight,
  onNavigate,
}: CalendarWebHeaderProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t, locale } = useTranslation();

  const renderArrow = (direction: -1 | 1) => {
    if (hideArrows) {
      return <View style={styles.calendarHeaderArrowSpacer} />;
    }
    const disabled = direction === -1 ? disableArrowLeft : disableArrowRight;
    return (
      <button
        type="button"
        style={styles.calendarHeaderArrow}
        onClick={() => {
          if (!disabled) onNavigate(direction);
        }}
        aria-disabled={disabled}
        aria-label={t(direction === -1 ? 'dateField.previousMonth' : 'dateField.nextMonth')}
      >
        <Ionicons
          name={direction === -1 ? 'chevron-back' : 'chevron-forward'}
          size={20}
          color={disabled ? colors.textSubtle : colors.accent}
        />
      </button>
    );
  };

  return (
    <View style={styles.calendarWebHeader}>
      <View style={styles.calendarHeaderRow}>
        {renderArrow(-1)}
        <Text style={styles.calendarHeaderTitle} accessibilityLiveRegion="polite">
          {getCalendarMonthTitle(locale, year, month - 1)}
        </Text>
        {renderArrow(1)}
      </View>
      {/* Day cells carry full date labels, so the weekday row is visual only. */}
      <View style={styles.calendarHeaderWeekdays} aria-hidden>
        {getCalendarWeekdayNames(locale, firstDay).map((name) => (
          <Text key={name} style={styles.calendarHeaderWeekday} numberOfLines={1}>
            {name}
          </Text>
        ))}
      </View>
    </View>
  );
}
