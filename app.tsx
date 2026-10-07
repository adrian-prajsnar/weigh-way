import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme,
} from '@react-navigation/native';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineScreen } from './src/components/offline-screen';
import { SupabaseAuthProvider, useSupabaseAuth } from './src/context/supabase-auth-context';
import { useToast, ToastProvider } from './src/context/toast-context';
import { useNetworkStatus } from './src/hooks/use-network-status';
import { useHideSplashWhenReady } from './src/hooks/use-hide-splash';
import { DemoWebDesktopInteractions } from './src/demo/demo-web-desktop-interactions';
import { DemoWebShell } from './src/demo/demo-web-shell';
import { isDemoMode } from './src/demo/is-demo-mode';
import { BmiDetailsProvider } from './src/context/bmi-details-context';
import { BmiDisplayProvider } from './src/context/bmi-display-context';
import { ConfirmProvider } from './src/context/confirm-context';
import { UserProfileProvider } from './src/context/user-profile-context';
import { WeightEntriesProvider } from './src/context/weight-entries-context';
import { RootNavigator } from './src/navigation/root-navigator';
import { LanguageProvider } from './src/i18n/language-context';
import { UnitProvider } from './src/context/unit-context';
import { ThemeProvider, useTheme } from './src/theme/theme-context';
import { fontFamily } from './src/theme/tokens';

function AppNavigation({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { colors, scheme } = useTheme();
  useHideSplashWhenReady(fontsLoaded);

  const navigationTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [colors, scheme]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

function AuthLinkErrorHandler() {
  const { authLinkError, clearAuthLinkError } = useSupabaseAuth();
  const { showError } = useToast();

  useEffect(() => {
    if (!authLinkError) {
      return;
    }

    showError(authLinkError);
    clearAuthLinkError();
  }, [authLinkError, clearAuthLinkError, showError]);

  return null;
}

function ThemedApp({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SupabaseAuthProvider>
        <ToastProvider>
          <AuthLinkErrorHandler />
          <ConfirmProvider>
            <UserProfileProvider>
              <BmiDisplayProvider>
                <WeightEntriesProvider>
                  <BmiDetailsProvider>
                    <AppNavigation fontsLoaded={fontsLoaded} />
                  </BmiDetailsProvider>
                </WeightEntriesProvider>
              </BmiDisplayProvider>
            </UserProfileProvider>
          </ConfirmProvider>
        </ToastProvider>
      </SupabaseAuthProvider>
    </View>
  );
}

function NetworkGate({ children }: { children: React.ReactNode }) {
  const { isOffline, isRefreshing, refresh } = useNetworkStatus();

  if (isOffline) {
    return <OfflineScreen isRefreshing={isRefreshing} onRefresh={() => void refresh()} />;
  }

  return <>{children}</>;
}

function AppShell() {
  const [fontsLoaded] = useFonts({
    [fontFamily.regular]: Inter_400Regular,
    [fontFamily.medium]: Inter_500Medium,
    [fontFamily.semibold]: Inter_600SemiBold,
    [fontFamily.bold]: Inter_700Bold,
  });

  return isDemoMode() ? (
    <ThemedApp fontsLoaded={fontsLoaded} />
  ) : (
    <NetworkGate>
      <ThemedApp fontsLoaded={fontsLoaded} />
    </NetworkGate>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DemoWebDesktopInteractions />
        <LanguageProvider>
          <UnitProvider>
            <DemoWebShell>
              <AppShell />
            </DemoWebShell>
          </UnitProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
