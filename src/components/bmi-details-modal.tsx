import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { ModalSheetDismissArea } from './modal-sheet-dismiss-area';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatAgeDetailed, getAgeOnDate } from '../age';
import { calculateBmi, BmiInfo, classifyBmiValue, formatBmiValue } from '../bmi';
import { useUnits } from '../context/unit-context';
import { useSharedUserProfile } from '../context/user-profile-context';
import {
  formatDateLabel,
  formatDateRange,
  formatDateTime,
  formatHeight,
  formatWeightLabel,
} from '../format';
import { t } from '../i18n';
import { TranslationKey } from '../i18n/translation-keys';
import { getBmiStatsForRange, getHeightAtDate } from '../height';
import { useTranslation } from '../i18n/language-context';
import { useSheetContainerStyle } from '../hooks/use-sheet-container-style';
import { DateRange, WeightEntry } from '../types';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { BmiBadge } from './bmi-badge';

export type WeighInBmiDetails = {
  type: 'weighIn';
  date: string;
  weightKg: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PeriodBmiMetric = 'average' | 'min' | 'max';

export type PeriodBmiDetails = {
  type: 'period';
  metric: PeriodBmiMetric;
  range: DateRange;
  entries: WeightEntry[];
};

export type BmiDetailsPayload = WeighInBmiDetails | PeriodBmiDetails;

type BmiDetailsModalProps = {
  details: BmiDetailsPayload | null;
  onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  const styles = useAppStyles();

  return (
    <View style={styles.bmiDetailsRow}>
      <Text style={styles.bmiDetailsLabel}>{label}</Text>
      <Text style={styles.bmiDetailsValue}>{value}</Text>
    </View>
  );
}

function CategoryRow({ bmi }: { bmi: BmiInfo | null }) {
  const styles = useAppStyles();
  const { t } = useTranslation();

  if (!bmi) {
    return <DetailRow label={t('bmi.category')} value={t('common.emDash')} />;
  }

  return (
    <View style={styles.bmiDetailsRow}>
      <Text style={styles.bmiDetailsLabel}>{t('bmi.category')}</Text>
      <BmiBadge bmi={bmi} compact labelOnly />
    </View>
  );
}

function classificationLabel(bmi: BmiInfo): string {
  if (bmi.classification === 'bmiForAge') {
    return t('bmi.methodBmiForAge');
  }
  if (bmi.classification === 'unclassified') {
    return t('bmi.methodUnclassified');
  }
  return t('bmi.methodAdult');
}

function unclassifiedNote(bmi: BmiInfo): string | null {
  if (bmi.classification !== 'unclassified') {
    return null;
  }
  if (bmi.ageYears !== null && bmi.ageYears < 2) {
    return t('bmi.unclassifiedUnder2');
  }
  if (bmi.ageYears !== null && bmi.ageYears < 20) {
    return t('bmi.unclassifiedNeedSex');
  }
  return t('bmi.unclassifiedNeedBirthDate');
}

function BmiClassificationRows({ bmi }: { bmi: BmiInfo | null }) {
  const styles = useAppStyles();
  const { t } = useTranslation();

  if (!bmi) {
    return <CategoryRow bmi={null} />;
  }

  const note = unclassifiedNote(bmi);

  return (
    <>
      <CategoryRow bmi={bmi} />
      <DetailRow label={t('bmi.method')} value={classificationLabel(bmi)} />
      {bmi.percentile !== null ? (
        <DetailRow label={t('bmi.percentile')} value={String(bmi.percentile)} />
      ) : null}
      {note ? <Text style={styles.bmiDetailsNote}>{note}</Text> : null}
    </>
  );
}

function WeighInDetails({
  date,
  weightKg,
  createdAt,
  updatedAt,
}: Omit<WeighInBmiDetails, 'type'>) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { units } = useUnits();
  const { heightEntries, birthDate, sex } = useSharedUserProfile();
  const heightCm = getHeightAtDate(heightEntries, date);
  const bmi =
    heightCm === null
      ? null
      : calculateBmi(weightKg, heightCm, { date, birthDate, sex });
  const unavailable = t('common.emDash');
  const age = birthDate ? getAgeOnDate(birthDate, date) : null;

  return (
    <>
      <DetailRow label={t('bmi.date')} value={formatDateLabel(date)} />
      {age ? <DetailRow label={t('bmi.age')} value={formatAgeDetailed(age)} /> : null}
      <DetailRow
        label={t('bmi.height')}
        value={heightCm === null ? unavailable : formatHeight(heightCm, units)}
      />
      <DetailRow label={t('bmi.weight')} value={formatWeightLabel(weightKg, units)} />
      <DetailRow
        label={t('bmi.value')}
        value={bmi ? formatBmiValue(bmi.value) : unavailable}
      />
      <BmiClassificationRows bmi={bmi} />
      {createdAt === null && updatedAt === null ? (
        <Text style={styles.bmiDetailsNote}>{t('bmi.notSavedYet')}</Text>
      ) : (
        <>
          <DetailRow label={t('bmi.created')} value={formatDateTime(createdAt)} />
          <DetailRow label={t('bmi.updated')} value={formatDateTime(updatedAt)} />
        </>
      )}
    </>
  );
}

function periodTitleKey(metric: PeriodBmiMetric): TranslationKey {
  if (metric === 'average') {
    return 'bmi.periodAverageTitle';
  }
  if (metric === 'min') {
    return 'bmi.periodMinTitle';
  }
  return 'bmi.periodMaxTitle';
}

function PeriodDetails({ metric, range, entries }: Omit<PeriodBmiDetails, 'type'>) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { heightEntries, birthDate, sex } = useSharedUserProfile();
  const stats = getBmiStatsForRange(entries, heightEntries, range);
  const missing = stats.totalCount - stats.count;
  const unavailable = t('common.emDash');
  const aggregate =
    metric === 'average' ? stats.average : metric === 'min' ? stats.min : stats.max;
  const sourceDate =
    metric === 'min' ? stats.minDate : metric === 'max' ? stats.maxDate : range.end;
  const aggregateBmi =
    aggregate === null
      ? null
      : classifyBmiValue(aggregate, {
          date: sourceDate ?? range.end,
          birthDate,
          sex,
        });
  const sourceEntry = sourceDate ? entries.find((entry) => entry.date === sourceDate) : null;

  return (
    <>
      <Text style={styles.bmiDetailsNote}>{formatDateRange(range)}</Text>
      <DetailRow
        label={t(periodTitleKey(metric))}
        value={aggregate === null ? unavailable : formatBmiValue(aggregate)}
      />
      <BmiClassificationRows bmi={aggregateBmi} />
      {metric === 'average' ? (
        <Text style={styles.bmiDetailsNote}>{t('bmi.periodAverageNote')}</Text>
      ) : null}
      {stats.count === 0 ? (
        <Text style={styles.bmiDetailsNote}>{t('bmi.coverageNone')}</Text>
      ) : (
        <>
          <Text style={styles.bmiDetailsNote}>
            {t('bmi.coverage', { withBmi: stats.count, total: stats.totalCount })}
          </Text>
          {missing > 0 ? (
            <Text style={styles.bmiDetailsNote}>{t('bmi.missingHeight', { count: missing })}</Text>
          ) : null}
        </>
      )}
      {sourceEntry && metric !== 'average' ? (
        <>
          <Text style={styles.bmiDetailsSection}>{t('bmi.sourceEntry')}</Text>
          <WeighInDetails
            date={sourceEntry.date}
            weightKg={sourceEntry.weightKg}
            createdAt={sourceEntry.createdAt}
            updatedAt={sourceEntry.updatedAt}
          />
        </>
      ) : null}
    </>
  );
}

export function BmiDetailsModal({ details, onClose }: BmiDetailsModalProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const sheetContainerStyle = useSheetContainerStyle({ paddingBottom: Math.max(insets.bottom, 16) });
  const { t } = useTranslation();

  if (!details) {
    return null;
  }

  const title = details.type === 'period' ? t(periodTitleKey(details.metric)) : t('bmi.detailsTitle');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalSheetBackdrop}>
        <ModalSheetDismissArea onPress={onClose} />
        <View style={sheetContainerStyle}>
          <View style={styles.datePickerSheetHeader}>
            <Text style={styles.datePickerSheetTitle}>{title}</Text>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          {details.type === 'weighIn' ? (
            <WeighInDetails
              date={details.date}
              weightKg={details.weightKg}
              createdAt={details.createdAt}
              updatedAt={details.updatedAt}
            />
          ) : (
            <PeriodDetails metric={details.metric} range={details.range} entries={details.entries} />
          )}
        </View>
      </View>
    </Modal>
  );
}
