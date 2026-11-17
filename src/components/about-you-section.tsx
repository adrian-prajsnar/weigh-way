import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { DateField } from './date-field';
import { SegmentedControl, SegmentedOption } from './segmented-control';
import { SkeletonBlock } from './skeleton';
import { useTranslation } from '../i18n/language-context';
import { fromDateKey } from '../format';
import { BiologicalSex, HeightEntry } from '../types';
import { useAppStyles } from '../theme/styles';
import { spacing } from '../theme/tokens';
import { HeightHistoryPreview } from './height-timeline';

type SexControlValue = BiologicalSex | 'unset';

type AboutYouSectionProps = {
  birthDate: string | null;
  onBirthDateChange: (date: Date | null) => void;
  onBirthDateDelete: () => void;
  birthDateAutoOpen?: boolean;
  minimumBirthDate: Date;
  maximumBirthDate: Date;
  sex: BiologicalSex | null;
  onSexChange: (sex: BiologicalSex | null) => Promise<boolean>;
  heightEntries: HeightEntry[];
  onOpenHeightHistory: () => void;
};

export function AboutYouSkeleton() {
  const styles = useAppStyles();

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.accountRow}>
        <SkeletonBlock height={12} width="30%" />
        <SkeletonBlock height={44} width="100%" />
      </View>
      <View style={styles.accountRow}>
        <SkeletonBlock height={12} width="20%" />
        <SkeletonBlock height={40} width="100%" />
      </View>
      <View style={styles.accountRow}>
        <SkeletonBlock height={12} width="25%" />
        <SkeletonBlock height={16} width="60%" />
      </View>
    </View>
  );
}

export function AboutYouSection({
  birthDate,
  onBirthDateChange,
  onBirthDateDelete,
  birthDateAutoOpen = false,
  minimumBirthDate,
  maximumBirthDate,
  sex,
  onSexChange,
  heightEntries,
  onOpenHeightHistory,
}: AboutYouSectionProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();

  const sexOptions = useMemo<SegmentedOption<SexControlValue>[]>(
    () => [
      { value: 'unset', label: t('profile.sexNotSet') },
      { value: 'female', label: t('profile.sexFemale') },
      { value: 'male', label: t('profile.sexMale') },
    ],
    [t],
  );

  return (
    <View style={{ gap: spacing.lg }}>
      <DateField
        label={t('profile.birthDate')}
        value={birthDate ? fromDateKey(birthDate) : null}
        onChange={onBirthDateChange}
        onClearPress={onBirthDateDelete}
        clearLabelKey="common.delete"
        optional
        autoOpen={birthDateAutoOpen}
        maximumDate={maximumBirthDate}
        minimumDate={minimumBirthDate}
      />

      <View style={{ gap: spacing.sm }}>
        <Text style={styles.accountLabel}>{t('profile.sex')}</Text>
        <SegmentedControl
          options={sexOptions}
          value={sex ?? 'unset'}
          onChange={(next) => onSexChange(next === 'unset' ? null : next)}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={styles.accountLabel}>{t('profile.height')}</Text>
        <HeightHistoryPreview heightEntries={heightEntries} onShowAll={onOpenHeightHistory} />
      </View>
    </View>
  );
}
