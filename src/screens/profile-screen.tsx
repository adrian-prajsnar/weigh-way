import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  type GestureResponderEvent,
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
import { useTabScreenScroll } from '../hooks/use-tab-screen-scroll';
import { useScrollHeader } from '../hooks/use-scroll-header';
import { useTranslation } from '../i18n/language-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList, RootTabParamList } from '../navigation/types';
import { getDateLocale } from '../i18n/resolve-locale';
import { useUnits } from '../context/unit-context';
import { UnitPreference } from '../storage/unit-preference';
import { useSharedUserProfile } from '../context/user-profile-context';
import { isDemoMode } from '../demo/is-demo-mode';
import { BiologicalSex } from '../types';
import { getTodayDate, toDateKey } from '../format';
import { hasAnyHeight } from '../height';
import {
  buildJournalExportFile,
  canExportJournalData,
  JournalExportFormat,
} from '../journal-export';
import { shareJournalExportFile } from '../share-journal-export-file';
import { LanguagePreference } from '../storage/language-preference';
import { ThemePreference } from '../storage/theme-preference';
import { useAppStyles } from '../theme/styles';
import { useColors, useTheme } from '../theme/theme-context';

function waitForExportUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => resolve());
          return;
        }
        setTimeout(() => resolve(), 0);
      });
    });
  });
}

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
  const isFocused = useIsFocused();
  const titleRef = useRef<ComponentRef<typeof View>>(null);
  const heightHistoryButtonRef = useRef<ComponentRef<typeof Pressable>>(null);
  const restoreHeightHistoryFocus = useRef(false);
  useLayoutEffect(() => {
    if (isFocused && restoreHeightHistoryFocus.current) {
      restoreHeightHistoryFocus.current = false;
      heightHistoryButtonRef.current?.focus();
    }
  }, [isFocused]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const tabs = navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();
    return tabs?.addListener('tabPress', (event) => {
      const profileTab = tabs.getState().routes.find((tab) => tab.name === 'Profile');
      if (event.target === profileTab?.key) restoreHeightHistoryFocus.current = false;
    });
  }, [navigation]);
  const styles = useAppStyles();
  const colors = useColors();
  const {
    t,
    locale,
    preference: languagePreference,
    setPreference: setLanguagePreference,
  } = useTranslation();
  const { preference, setPreference } = useTheme();
  const { preference: unitPreference, setPreference: setUnitPreference } = useUnits();
  const { session, signOut, deleteAccount } = useSupabaseAuth();
  const {
    entries,
    error: entriesError,
    hasLoaded: entriesLoaded,
    isLoading: entriesLoading,
  } = useSharedWeightEntries();
  const {
    heightEntries,
    birthDate,
    sex,
    isLoading,
    isRefreshing,
    isSaving,
    error,
    hasLoaded: profileLoaded,
    refreshProfile,
    saveBirthDateEntry,
    saveSexEntry,
  } = useSharedUserProfile();
  const { showBmi, setShowBmi } = useSharedBmiDisplay();
  const { showError, showInfo, showSuccess } = useToast();
  const { confirm } = useConfirm();
  const { scrollY, onScroll } = useScrollHeader();
  const { scrollViewStyle, contentContainerStyle } = useTabScreenScroll();
  const user = session?.user;
  const dateLocale = getDateLocale(locale);
  const emDash = t('common.emDash');
  const appVersion = Constants.expoConfig?.version ?? emDash;
  const [isExporting, setIsExporting] = useState(false);
  const exportInProgress = useRef(false);
  const [exportFormat, setExportFormat] = useState<JournalExportFormat>('json');
  const exportFormatOptions: SegmentedOption<JournalExportFormat>[] = [
    { value: 'json', label: 'JSON' },
    { value: 'csv', label: 'CSV' },
  ];
  const canExport = canExportJournalData({
    weightEntriesError: entriesError,
    profileError: error,
    weightEntriesLoaded: entriesLoaded,
    profileLoaded,
  });
  const exportDisabled = isExporting || !canExport || entriesLoading || isLoading;

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
          const { offlineNotice } = await signOut();
          showInfo(
            offlineNotice ? t('profile.signOutPersistFailedOffline') : t('profile.signedOut'),
          );
        } catch (signOutError) {
          const message =
            signOutError instanceof Error ? signOutError.message : t('profile.signOutFailed');
          showError(message);
        }
      })();
    });
  };

  const handleExportJournal = () => {
    if (exportInProgress.current) {
      return;
    }
    exportInProgress.current = true;
    void (async () => {
      setIsExporting(true);
      try {
        await waitForExportUi();
        if (
          !canExportJournalData({
            weightEntriesError: entriesError,
            profileError: error,
            weightEntriesLoaded: entriesLoaded,
            profileLoaded,
          })
        ) {
          showError(t('profile.exportDataNotLoaded'));
          return;
        }

        const file = buildJournalExportFile(exportFormat, {
          weightEntries: entries,
          heightEntries,
          birthDate,
          sex,
          now: new Date(),
        });
        await shareJournalExportFile(file, t('profile.exportJournal'));
        if (Platform.OS === 'web') {
          showSuccess(t('profile.exportReady'));
        }
      } catch {
        showError(t('profile.exportFailed'));
      } finally {
        exportInProgress.current = false;
        setIsExporting(false);
      }
    })();
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

  const entryCountLabel = entriesLoaded ? t('history.entryCount', { count: entries.length }) : emDash;
  const demoMode = isDemoMode();
  const focusSection = route.params?.focusSection;
  const [shouldOpenBirthDatePicker, setShouldOpenBirthDatePicker] = useState(false);
  const birthDateTriggerRef = useRef<ComponentRef<typeof Pressable>>(null);
  const birthDateDeleteOpener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const opener = birthDateDeleteOpener.current;
    if (!opener) return;
    if (!isFocused || birthDate === null) birthDateDeleteOpener.current = null;
    if (isFocused && birthDate === null) {
      const active = document.activeElement;
      if (active === document.body || active === opener) birthDateTriggerRef.current?.focus();
    }
  }, [birthDate, isFocused]);
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

  const handleBirthDateDelete = (event: GestureResponderEvent) => {
    const target = event.currentTarget;
    const opener = Platform.OS === 'web' && target instanceof HTMLElement ? target : null;
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
        birthDateDeleteOpener.current = opener;
        try {
          await saveBirthDateEntry(null);
          showSuccess(t('profile.birthDateRemoved'));
        } catch (saveError) {
          birthDateDeleteOpener.current = null;
          const message = saveError instanceof Error ? saveError.message : t('profile.saveFailed');
          showError(message);
        }
      })();
    });
  };

  const handleSexChange = async (next: BiologicalSex | null): Promise<boolean> => {
    try {
      await saveSexEntry(next);
      showSuccess(t('profile.sexSaved'));
      return true;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : t('profile.saveFailed');
      showError(message);
      return false;
    }
  };

  return (
    <View style={styles.screen}>
      <PreferenceTransition style={{ flex: 1 }}>
        <ContentFrame>
          <ScreenHeader
            titleRef={titleRef}
            title={t('profile.title')}
            subtitle={user?.email ?? t('profile.subtitleFallback')}
            scrollY={scrollY}
          />
          <Animated.ScrollView
            style={scrollViewStyle}
            contentContainerStyle={contentContainerStyle}
            onScroll={onScroll}
            scrollEventThrottle={16}
            refreshControl={
              Platform.OS === 'web' ? undefined : (
                <RefreshControl refreshing={isRefreshing} onRefresh={() => void refreshProfile()} />
              )
            }
          >
            <ErrorCard
              message={error}
              isLoading={isLoading}
              isRefreshing={isRefreshing}
              recoveryFocusRef={titleRef}
              onRetry={refreshProfile}
            />

            <AppCard title={t('profile.account')} isBusy={isRefreshing}>
              {isLoading ? (
                <ProfileAccountSkeleton />
              ) : (
                <>
                  <ProfileRow
                    icon="mail-outline"
                    label={t('auth.email')}
                    value={user?.email ?? emDash}
                  />
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
              {isLoading || !profileLoaded ? (
                <AboutYouSkeleton />
              ) : (
                <AboutYouSection
                  birthDate={birthDate}
                  onBirthDateChange={handleBirthDateChange}
                  onBirthDateDelete={handleBirthDateDelete}
                  birthDateTriggerRef={birthDateTriggerRef}
                  birthDateAutoOpen={shouldOpenBirthDatePicker}
                  minimumBirthDate={minimumBirthDate}
                  maximumBirthDate={getTodayDate()}
                  sex={sex}
                  onSexChange={handleSexChange}
                  heightEntries={heightEntries}
                  heightHistoryButtonRef={heightHistoryButtonRef}
                  onOpenHeightHistory={() => {
                    restoreHeightHistoryFocus.current = Platform.OS === 'web';
                    navigation.navigate('HeightHistory');
                  }}
                />
              )}
            </AppCard>

            <AppCard title={t('profile.appearance')} delay={120}>
              <Text style={styles.settingHint}>{t('profile.languageHint')}</Text>
              <SegmentedControl
                groupLabel={t('profile.languageHint')}
                options={languageOptions}
                value={languagePreference}
                onChange={(next) => void setLanguagePreference(next)}
              />

              <View style={styles.divider} />

              <Text style={styles.settingHint}>{t('profile.themeHint')}</Text>
              <SegmentedControl
                groupLabel={t('profile.themeHint')}
                options={themeOptions}
                value={preference}
                onChange={(next) => void setPreference(next)}
              />

              <View style={styles.divider} />

              <Text style={styles.settingHint}>{t('profile.unitsHint')}</Text>
              <SegmentedControl
                groupLabel={t('profile.unitsHint')}
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
                    <Text style={styles.settingHintWarning}>
                      {t('profile.showBmiNoHeightHint')}
                    </Text>
                  ) : null}
                </View>
                <SettingSwitch
                  accessibilityLabel={t('profile.showBmi')}
                  value={showBmi}
                  onValueChange={(value) => {
                    void setShowBmi(value);
                  }}
                  trackColor={{ false: colors.borderStrong, true: colors.accentBorder }}
                  thumbColor={showBmi ? colors.accent : colors.surfaceMuted}
                />
              </View>
            </AppCard>

            <AppCard title={t('profile.exportJournal')} delay={180}>
              <Text style={styles.settingLabel}>{t('profile.exportFormat')}</Text>
              <SegmentedControl
                groupLabel={t('profile.exportFormat')}
                options={exportFormatOptions}
                value={exportFormat}
                onChange={setExportFormat}
              />
              <Text style={styles.settingHint}>
                {t(exportFormat === 'json' ? 'profile.exportJsonHint' : 'profile.exportCsvHint')}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  exportDisabled && styles.buttonDisabled,
                  pressed && !exportDisabled && styles.buttonPressed,
                ]}
                onPress={handleExportJournal}
                accessibilityRole="button"
                accessibilityLabel={t('profile.exportJournal')}
                aria-busy={isExporting}
                disabled={exportDisabled && !(Platform.OS === 'web' && isExporting)}
              >
                {isExporting ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={styles.secondaryButtonText}>{t('profile.exportJournal')}</Text>
                )}
              </Pressable>
            </AppCard>

            <AppCard title={t('profile.session')} delay={180}>
              {demoMode ? <Text style={styles.settingHint}>{t('demo.sessionHint')}</Text> : null}
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  demoMode && styles.buttonDisabled,
                  pressed && !demoMode && styles.buttonPressed,
                ]}
                onPress={handleSignOut}
                accessibilityRole="button"
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
                accessibilityRole="button"
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
