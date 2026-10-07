import { useMemo } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppCard } from '../components/app-card';
import { ContentFrame } from '../components/content-frame';
import { ComparisonModeSelector } from '../components/comparison-mode-selector';
import { ComparisonResult } from '../components/comparison-result';
import { ComparisonResultSkeleton } from '../components/comparison-result-skeleton';
import { ComparisonTrendList } from '../components/comparison-trend-list';
import { DateField } from '../components/date-field';
import { EmptyState } from '../components/empty-state';
import { ErrorCard } from '../components/error-card';
import { HistoryListSkeleton } from '../components/history-list-skeleton';
import { ScreenHeader } from '../components/screen-header';
import { SegmentedControl, SegmentedOption } from '../components/segmented-control';
import { useSharedUserProfile } from '../context/user-profile-context';
import { useSharedWeightEntries } from '../context/weight-entries-context';
import { isTrendMode, useComparison } from '../hooks/use-comparison';
import { useScrollContentStyle } from '../hooks/use-scroll-content-style';
import { useScrollHeader } from '../hooks/use-scroll-header';
import { useWideLayout } from '../hooks/use-wide-layout';
import { useTranslation } from '../i18n/language-context';
import { CustomCompareKind } from '../types';
import { useAppStyles } from '../theme/styles';
import { webFocusTarget } from '../theme/web-focus-target';

type RangePickerProps = {
  title: string;
  delay: number;
  start: Date | null;
  end: Date | null;
  onStartChange: (date: Date | null) => void;
  onEndChange: (date: Date | null) => void;
  invalid?: boolean;
  maximumDate: Date;
};

function RangePicker({
  title,
  delay,
  start,
  end,
  onStartChange,
  onEndChange,
  invalid = false,
  maximumDate,
}: RangePickerProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();

  return (
    <AppCard title={title} delay={delay}>
      <DateField
        label={t('comparison.start')}
        value={start}
        onChange={onStartChange}
        maximumDate={end ?? maximumDate}
        invalid={invalid}
      />
      <DateField
        label={t('comparison.end')}
        value={end}
        onChange={onEndChange}
        maximumDate={maximumDate}
        minimumDate={start ?? undefined}
      />
      {invalid ? <Text style={styles.warningText}>{t('comparison.invalidCustom')}</Text> : null}
    </AppCard>
  );
}

export function ComparisonScreen() {
  const styles = useAppStyles();
  const { t, locale } = useTranslation();
  const { entries, isLoading, isRefreshing, error, refreshEntries } = useSharedWeightEntries();
  const { birthDate } = useSharedUserProfile();
  const { scrollY, onScroll } = useScrollHeader();
  const scrollContentStyle = useScrollContentStyle();
  const isWideLayout = useWideLayout();

  const comparison = useComparison({
    entries,
    isLoading,
    birthDate,
    t,
  });

  const customKindOptions = useMemo<SegmentedOption<CustomCompareKind>[]>(
    () => [
      { value: 'period', label: t('comparison.customKind.period') },
      { value: 'dates', label: t('comparison.customKind.dates') },
    ],
    [locale, t],
  );

  return (
    <View style={styles.screen}>
      <ContentFrame>
        <ScreenHeader
          title={t('comparison.title')}
          subtitle={t('comparison.subtitle')}
          scrollY={scrollY}
        />
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={scrollContentStyle}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void refreshEntries().catch(() => undefined)}
            />
          }
        >
        {error && !isLoading ? (
          <ErrorCard message={error} onRetry={() => void refreshEntries().catch(() => undefined)} />
        ) : null}

        <AppCard delay={0}>
          <View style={styles.comparisonFilterSection}>
            <ComparisonModeSelector
              selected={comparison.mode}
              onSelect={comparison.handleModeChange}
              showAgeYear={Boolean(birthDate)}
            />

            {isTrendMode(comparison.mode) ? (
              <>
                <View
                  style={[
                    styles.historyDateFilters,
                    isWideLayout && styles.historyDateFiltersWide,
                  ]}
                >
                  <View style={isWideLayout ? styles.historyDateFilterField : undefined}>
                    <DateField
                      label={t('comparison.start')}
                      value={comparison.fromDate}
                      onChange={comparison.handleFromChange}
                      maximumDate={comparison.toDate}
                      minimumDate={comparison.filterMinimumFrom}
                      invalid={comparison.rangeFieldHighlight.from}
                    />
                  </View>
                  <View style={isWideLayout ? styles.historyDateFilterField : undefined}>
                    <DateField
                      label={t('comparison.end')}
                      value={comparison.toDate}
                      onChange={comparison.handleToChange}
                      maximumDate={comparison.today}
                      minimumDate={comparison.fromDate}
                      invalid={comparison.rangeFieldHighlight.to}
                    />
                  </View>
                </View>
                {!comparison.isDefaultRange ? (
                  <View style={styles.filterActionsRow}>
                    <Pressable onPress={comparison.resetRange} hitSlop={8} {...webFocusTarget('text-button')}>
                      <Text style={styles.linkText}>{t('history.clearAll')}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {comparison.rangeValidationMessage ? (
                  <Text style={styles.warningText}>{comparison.rangeValidationMessage}</Text>
                ) : null}
              </>
            ) : (
              <SegmentedControl
                options={customKindOptions}
                value={comparison.customKind}
                onChange={comparison.handleCustomKindChange}
              />
            )}
          </View>
        </AppCard>

        {comparison.mode === 'custom' && comparison.customKind === 'period' ? (
          <>
            <RangePicker
              title={t('periods.rangeA')}
              delay={60}
              start={comparison.rangeAStart}
              end={comparison.rangeAEnd}
              onStartChange={comparison.setRangeAStart}
              onEndChange={comparison.setRangeAEnd}
              invalid={comparison.rangeAInvalid}
              maximumDate={comparison.today}
            />
            <RangePicker
              title={t('periods.rangeB')}
              delay={120}
              start={comparison.rangeBStart}
              end={comparison.rangeBEnd}
              onStartChange={comparison.setRangeBStart}
              onEndChange={comparison.setRangeBEnd}
              invalid={comparison.rangeBInvalid}
              maximumDate={comparison.today}
            />
          </>
        ) : null}

        {comparison.mode === 'custom' && comparison.customKind === 'dates' ? (
          <AppCard delay={60}>
            <DateField
              label={t('comparison.dateA')}
              value={comparison.dateA}
              onChange={comparison.setDateA}
              maximumDate={comparison.today}
            />
            <DateField
              label={t('comparison.dateB')}
              value={comparison.dateB}
              onChange={comparison.setDateB}
              maximumDate={comparison.today}
            />
          </AppCard>
        ) : null}

        {isTrendMode(comparison.mode) ? (
          <AppCard
            isBusy={isRefreshing && comparison.showTrendContent}
            delay={60}
            animateEntry={false}
          >
            {comparison.isInvalidRange ? (
              <EmptyState
                icon="git-compare-outline"
                title={t('comparison.nothingTitle')}
                message={comparison.trendEmptyMessage}
              />
            ) : comparison.showTrendContent ? (
              <ComparisonTrendList
                mode={comparison.mode}
                rows={comparison.trendRows}
                entries={entries}
                embedded
                emptyMessage={comparison.trendEmptyMessage}
              />
            ) : (
              <HistoryListSkeleton rows={6} />
            )}
          </AppCard>
        ) : comparison.customIncomplete ? (
          <AppCard delay={60}>
            <EmptyState
              icon="git-compare-outline"
              title={t('comparison.nothingTitle')}
              message={t('comparison.nothingMessage')}
            />
          </AppCard>
        ) : isLoading ? (
          <AppCard delay={60}>
            <ComparisonResultSkeleton />
          </AppCard>
        ) : comparison.customInvalid ? (
          <AppCard delay={60}>
            <EmptyState
              icon="git-compare-outline"
              title={t('comparison.nothingTitle')}
              message={t('comparison.invalidCustom')}
            />
          </AppCard>
        ) : comparison.comparison ? (
          <AppCard delay={60} isBusy={isRefreshing}>
            <ComparisonResult
              labelA={comparison.comparison.labelA}
              labelB={comparison.comparison.labelB}
              rangeA={comparison.comparison.rangeA}
              rangeB={comparison.comparison.rangeB}
              statsA={comparison.comparison.statsA}
              statsB={comparison.comparison.statsB}
              entries={entries}
              difference={comparison.comparison.difference}
              isDayMode={comparison.customKind === 'dates'}
              embedded
            />
          </AppCard>
        ) : (
          <AppCard delay={60}>
            <EmptyState
              icon="git-compare-outline"
              title={t('comparison.nothingTitle')}
              message={t('comparison.nothingMessage')}
            />
          </AppCard>
        )}
        </Animated.ScrollView>
      </ContentFrame>
    </View>
  );
}
