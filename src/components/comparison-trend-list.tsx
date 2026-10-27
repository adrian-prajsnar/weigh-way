import { useTranslation } from '../i18n/language-context';
import { TrendGranularity, TrendRow, WeightEntry } from '../types';
import { useAppStyles } from '../theme/styles';
import { AppCard } from './app-card';
import { ComparisonTrendRows } from './comparison-trend-rows';
import { EmptyState } from './empty-state';

type ComparisonTrendListProps = {
  mode: TrendGranularity;
  rows: TrendRow[];
  entries: WeightEntry[];
  isBusy?: boolean;
  embedded?: boolean;
  emptyMessage?: string;
};

export function ComparisonTrendList({
  mode,
  rows,
  entries,
  isBusy = false,
  embedded = false,
  emptyMessage,
}: ComparisonTrendListProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const message = emptyMessage ?? t('comparison.nothingMessage');

  if (rows.length === 0) {
    const empty = (
      <EmptyState
        icon="git-compare-outline"
        title={t('comparison.nothingTitle')}
        message={message}
      />
    );

    if (embedded) {
      return empty;
    }

    return <AppCard animateEntry={false}>{empty}</AppCard>;
  }

  const body = (
    <ComparisonTrendRows rows={rows} entries={entries} isDayMode={mode === 'day'} />
  );

  if (embedded) {
    return body;
  }

  return (
    <AppCard animateEntry={false} isBusy={isBusy} style={styles.comparisonTrendCard}>
      {body}
    </AppCard>
  );
}
