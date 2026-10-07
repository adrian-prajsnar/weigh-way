import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, RefreshControl, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppCard } from '../components/app-card';
import { ContentFrame } from '../components/content-frame';
import { ErrorCard } from '../components/error-card';
import { HeightTimelineEditor } from '../components/height-timeline';
import { ScreenHeader } from '../components/screen-header';
import { useConfirm } from '../context/confirm-context';
import { useToast } from '../context/toast-context';
import { useSharedUserProfile } from '../context/user-profile-context';
import { useScrollContentStyle } from '../hooks/use-scroll-content-style';
import { useScrollHeader } from '../hooks/use-scroll-header';
import { useTranslation } from '../i18n/language-context';
import { ProfileStackParamList } from '../navigation/types';
import { formatDateLabel, getHeightRangeMessage } from '../format';
import { useUnits } from '../context/unit-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';

type Props = NativeStackScreenProps<ProfileStackParamList, 'HeightHistory'>;

export function HeightHistoryScreen({ navigation }: Props) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const { units } = useUnits();
  const { confirm } = useConfirm();
  const { showError, showSuccess } = useToast();
  const { scrollY, onScroll } = useScrollHeader();
  const scrollContentStyle = useScrollContentStyle();
  const {
    heightEntries,
    isLoading,
    isRefreshing,
    isSaving,
    deletingEffectiveDate,
    error,
    refreshProfile,
    saveHeightEntry,
    updateHeightEntry,
    removeHeightEntry,
  } = useSharedUserProfile();

  const handleSave = async (effectiveDate: string, heightCm: number) => {
    try {
      await saveHeightEntry(effectiveDate, heightCm);
      showSuccess(t('profile.heightSaved'));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : t('profile.saveFailed');
      showError(message);
      throw saveError;
    }
  };

  const handleUpdate = async (
    previousEffectiveDate: string,
    effectiveDate: string,
    heightCm: number,
  ) => {
    try {
      await updateHeightEntry(previousEffectiveDate, effectiveDate, heightCm);
      showSuccess(t('profile.heightUpdated'));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : t('profile.saveFailed');
      showError(message);
      throw saveError;
    }
  };

  const handleDelete = (effectiveDate: string) => {
    const dateLabel = formatDateLabel(effectiveDate);
    void confirm({
      title: t('profile.deleteHeight'),
      message: t('profile.deleteHeightConfirm', { date: dateLabel }),
      confirmLabel: t('common.delete'),
      destructive: true,
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }
      void (async () => {
        try {
          await removeHeightEntry(effectiveDate);
          showSuccess(t('profile.heightDeleted', { date: dateLabel }));
        } catch (deleteError) {
          const message =
            deleteError instanceof Error ? deleteError.message : t('profile.deleteHeightFailed');
          showError(message);
        }
      })();
    });
  };

  return (
    <View style={styles.screen}>
      <ContentFrame>
        <ScreenHeader
          title={t('profile.heightHistoryTitle')}
          subtitle={t('profile.heightHistorySubtitle')}
          scrollY={scrollY}
          leading={
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          }
        />
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={scrollContentStyle}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void refreshProfile()} />
          }
        >
        {error && !isLoading ? (
          <ErrorCard message={error} onRetry={() => void refreshProfile()} />
        ) : null}

        <AppCard isBusy={isRefreshing || isSaving}>
          {!isLoading ? (
            <HeightTimelineEditor
              heightEntries={heightEntries}
              isSaving={isSaving}
              deletingEffectiveDate={deletingEffectiveDate}
              onSave={handleSave}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onInvalidHeight={() => showError(getHeightRangeMessage(units))}
            />
          ) : null}
        </AppCard>
        </Animated.ScrollView>
      </ContentFrame>
    </View>
  );
}
