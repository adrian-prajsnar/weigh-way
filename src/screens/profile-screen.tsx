import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { AppCard } from '../components/app-card';
import { ContentFrame } from '../components/content-frame';
import { ErrorCard } from '../components/error-card';
import { AboutYouSection, AboutYouSkeleton } from '../components/about-you-section';
import { PreferenceTransition } from '../components/preference-transition';
import { ProfileAccountSkeleton } from '../components/profile-details-skeleton';
import { ScreenHeader } from '../components/screen-header';
import { SegmentedControl, SegmentedOption } from '../components/segmented-control';
import { SettingSwitch } from '../components/setting-switch';
import { useSharedBmiDisplay } from '../context/bmi-display-context';
import { useConfirm } from '../context/confirm-context';
import { useToast } from '../context/toast-context';
import { useSupabaseAuth } from '../context/supabase-auth-context';
import { useSharedWeightEntries } from '../context/weight-entries-context';
import { useScrollContentStyle } from '../hooks/use-scroll-content-style';
import { useScrollHeader } from '../hooks/use-scroll-header';
import { useTranslation } from '../i18n/language-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../navigation/types';
import { getDateLocale } from '../i18n/resolve-locale';
import { useUnits } from '../context/unit-context';
import { UnitPreference } from '../storage/unit-preference';
import { useSharedUserProfile } from '../context/user-profile-context';
import { isDemoMode } from '../demo/is-demo-mode';
import { BiologicalSex } from '../types';
import { getTodayDate, toDateKey } from '../format';
import { hasAnyHeight } from '../height';
import { LanguagePreference } from '../storage/language-preference';
import { ThemePreference } from '../storage/theme-preference';
import { useAppStyles } from '../theme/styles';
import { useColors, useTheme } from '../theme/theme-context';

function formatMemberSince(isoDate: string | undefined, localeTag: string, emDash: string): string {
  if (!isoDate) {
    return emDash;
  }

  return new Date(isoDate).toLocaleDateString(localeTag, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const styles = useAppStyles();
  const colors = useColors();

  return (
    <View style={styles.profileRow}>
      <View style={styles.profileRowIcon}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
      </View>
      <View style={styles.profileRowText}>
        <Text style={styles.accountLabel}>{label}</Text>
        <Text style={styles.accountValue}>{value}</Text>
      </View>
    </View>
  );
}

export function ProfileScreen({
  navigation,
  route,
}: NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t, locale, preference: languagePreference, setPreference: setLanguagePreference } =
    useTranslation();
  const { preference, setPreference } = useTheme();
  const { units, preference: unitPreference, setPreference: setUnitPreference } = useUnits();
  const { session, signOut, deleteAccount } = useSupabaseAuth();
  const { entries } = useSharedWeightEntries();
  const { heightEntries, birthDate, sex, isLoading, isRefreshing, isSaving, error, refreshProfile, saveBirthDateEntry, saveSexEntry } =
    useSharedUserProfile();
  const { showBmi, setShowBmi } = useSharedBmiDisplay();
  const { showError, showInfo, showSuccess } = useToast();
  const { confirm } = useConfirm();
  const { scrollY, onScroll } = useScrollHeader();
  const scrollContentStyle = useScrollContentStyle();
  const user = session?.user;
  const dateLocale = getDateLocale(locale);
  const emDash = t('common.emDash');
  const appVersion = Constants.expoConfig?.version ?? emDash;

  const languageOptions = useMemo<SegmentedOption<LanguagePreference>[]>(
    () => [
      { value: 'system', label: t('profile.languageSystem') },
      { value: 'en', label: t('profile.languageEnglish') },
      { value: 'pl', label: t('profile.languagePolish') },
    ],
    [t],
  );

  const themeOptions = useMemo<SegmentedOption<ThemePreference>[]>(
    () => [
      { value: 'system', label: t('profile.themeSystem') },
      { value: 'light', label: t('profile.themeLight') },
      { value: 'dark', label: t('profile.themeDark') },
    ],
    [t],
  );

  const unitOptions = useMemo<SegmentedOption<UnitPreference>[]>(
    () => [
      { value: 'system', label: t('profile.unitsSystem') },
      { value: 'metric', label: t('profile.unitsMetric') },
      { value: 'imperial', label: t('profile.unitsImperial') },
    ],
    [t],
  );

  const handleSignOut = () => {
    void confirm({
      title: t('profile.signOut'),
      message: t('profile.signOutConfirm'),
      confirmLabel: t('profile.signOut'),
      destructive: true,
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }
      void (async () => {
        try {
          await signOut();
          showInfo(t('profile.signedOut'));
        } catch (signOutError) {
          const message =
            signOutError instanceof Error ? signOutError.message : t('profile.signOutFailed');
          showError(message);
        }
      })();
    });
  };

  const handleDeleteAccount = () => {
    const confirmationPhrase = t('profile.deleteAccountConfirmPhrase');
    void confirm({
      title: t('profile.deleteAccount'),
      message: t('profile.deleteAccountConfirm'),
      confirmLabel: t('profile.deleteAccount'),
      confirmationPhrase,
      confirmationPhraseHint: t('profile.deleteAccountTypeToConfirm', {
        phrase: confirmationPhrase,
      }),
      destructive: true,
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }
      void (async () => {
        try {
          await deleteAccount();
          showSuccess(t('profile.accountDeleted'));
        } catch (deleteError) {
          const message =
            deleteError instanceof Error ? deleteError.message : t('profile.deleteFailed');
          showError(message);
        }
      })();
    });
  };

  const entryCountLabel = t('history.entryCount', { count: entries.length });
  const demoMode = isDemoMode();
  const focusSection = route.params?.focusSection;
  const [shouldOpenBirthDatePicker, setShouldOpenBirthDatePicker] = useState(false);
  const minimumBirthDate = useMemo(() => {
    const date = getTodayDate();
    date.setFullYear(date.getFullYear() - 120);
    return date;
  }, []);

  useEffect(() => {
    if (isLoading || !focusSection) {
      return;
    }

    if (focusSection === 'birthDate' && !birthDate) {
      setShouldOpenBirthDatePicker(true);
    }

    if (focusSection === 'height' && heightEntries.length === 0) {
      navigation.navigate('HeightHistory');
    }

    navigation.setParams({ focusSection: undefined });
  }, [focusSection, isLoading, birthDate, heightEntries.length, navigation]);

  const handleBirthDateChange = (date: Date | null) => {
    if (!date) {
      return;
    }
    void (async () => {
      try {
        await saveBirthDateEntry(toDateKey(date));
        showSuccess(t('profile.birthDateSaved'));
      } catch (saveError) {
        const message = saveError instanceof Error ? saveError.message : t('profile.saveFailed');
        showError(message);
      }
    })();
  };

  const handleBirthDateDelete = () => {
    void confirm({
      title: t('profile.deleteBirthDate'),
      message: t('profile.deleteBirthDateConfirm'),
      confirmLabel: t('common.delete'),
      destructive: true,
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }
      void (async () => {
        try {
          await saveBirthDateEntry(null);
          showSuccess(t('profile.birthDateRemoved'));
        } catch (saveError) {
          const message = saveError instanceof Error ? saveError.message : t('profile.saveFailed');
          showError(message);
        }
      })();
    });
  };

  const handleSexChange = (next: BiologicalSex | null) => {
    void (async () => {
      try {
        await saveSexEntry(next);
        showSuccess(t('profile.sexSaved'));
      } catch (saveError) {
        const message = saveError instanceof Error ? saveError.message : t('profile.saveFailed');
        showError(message);
      }
    })();
  };

  return (
    <View style={styles.screen}>
      <PreferenceTransition style={{ flex: 1 }}>
        <ContentFrame>
          <ScreenHeader
            title={t('profile.title')}
            subtitle={user?.email ?? t('profile.subtitleFallback')}
            scrollY={scrollY}
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

        <AppCard title={t('profile.account')} isBusy={isRefreshing}>
          {isLoading ? (
            <ProfileAccountSkeleton />
          ) : (
            <>
              <ProfileRow icon="mail-outline" label={t('auth.email')} value={user?.email ?? emDash} />
              <ProfileRow
                icon="calendar-outline"
                label={t('profile.memberSince')}
                value={formatMemberSince(user?.created_at, dateLocale, emDash)}
              />
              <ProfileRow
                icon="list-outline"
                label={t('profile.weightEntries')}
                value={entryCountLabel}
              />
            </>
          )}
        </AppCard>

        <AppCard title={t('profile.aboutYou')} isBusy={isRefreshing || isSaving} delay={60}>
          {isLoading ? (
            <AboutYouSkeleton />
          ) : (
            <AboutYouSection
              birthDate={birthDate}
              onBirthDateChange={handleBirthDateChange}
              onBirthDateDelete={handleBirthDateDelete}
              birthDateAutoOpen={shouldOpenBirthDatePicker}
              minimumBirthDate={minimumBirthDate}
              maximumBirthDate={getTodayDate()}
              sex={sex}
              onSexChange={handleSexChange}
              heightEntries={heightEntries}
              onOpenHeightHistory={() => navigation.navigate('HeightHistory')}
            />
          )}
        </AppCard>

        <AppCard title={t('profile.appearance')} delay={120}>
          <Text style={styles.settingHint}>{t('profile.languageHint')}</Text>
          <SegmentedControl
            options={languageOptions}
            value={languagePreference}
            onChange={(next) => void setLanguagePreference(next)}
          />

          <View style={styles.divider} />

          <Text style={styles.settingHint}>{t('profile.themeHint')}</Text>
          <SegmentedControl
            options={themeOptions}
            value={preference}
            onChange={(next) => void setPreference(next)}
          />

          <View style={styles.divider} />

          <Text style={styles.settingHint}>{t('profile.unitsHint')}</Text>
          <SegmentedControl
            options={unitOptions}
            value={unitPreference}
            onChange={(next) => void setUnitPreference(next)}
          />

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>{t('profile.showBmi')}</Text>
              <Text style={styles.settingHint}>{t('profile.showBmiHint')}</Text>
              {!hasAnyHeight(heightEntries) ? (
                <Text style={styles.settingHintWarning}>{t('profile.showBmiNoHeightHint')}</Text>
              ) : null}
            </View>
            <SettingSwitch
              value={showBmi}
              onValueChange={(value) => {
                void setShowBmi(value);
              }}
              trackColor={{ false: colors.borderStrong, true: colors.accentBorder }}
              thumbColor={showBmi ? colors.accent : colors.surfaceMuted}
            />
          </View>
        </AppCard>

        <AppCard title={t('profile.session')} delay={180}>
          {demoMode ? (
            <Text style={styles.settingHint}>{t('demo.sessionHint')}</Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              demoMode && styles.buttonDisabled,
              pressed && !demoMode && styles.buttonPressed,
            ]}
            onPress={handleSignOut}
            disabled={demoMode}
          >
            <Text style={styles.secondaryButtonText}>{t('profile.signOut')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.dangerButton,
              demoMode && styles.buttonDisabled,
              pressed && !demoMode && styles.buttonPressed,
            ]}
            onPress={handleDeleteAccount}
            disabled={demoMode}
          >
            <Text style={styles.dangerButtonText}>{t('profile.deleteAccount')}</Text>
          </Pressable>
        </AppCard>

        <View style={styles.versionFooterContainer}>
          <Text style={styles.versionFooter}>
            {t('profile.appVersion', { version: appVersion })}
          </Text>
          <Text style={styles.versionFooter}>
            {t('profile.copyright', { year: new Date().getFullYear() })}
          </Text>
        </View>
          </Animated.ScrollView>
        </ContentFrame>
      </PreferenceTransition>
    </View>
  );
}
