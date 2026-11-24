import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { ProfileNavigator } from './profile-navigator';
import { ComparisonScreen } from '../screens/comparison-screen';
import { DashboardScreen } from '../screens/dashboard-screen';
import { HistoryScreen } from '../screens/history-screen';
import { useTranslation } from '../i18n/language-context';
import { AppTabBar } from './tab-bar';
import { TabBarHeightContext } from './tab-bar-layout';
import { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

function WebTabScreen({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const screen = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!focused || !document.hasFocus()) return;

    const active = document.activeElement;
    const inactiveScreen = '[data-web-tab-screen][inert]';
    // Inert can clear focus before this effect runs when a screen control opens another tab.
    if (
      active?.closest(inactiveScreen) ||
      (active === document.body && document.querySelector(inactiveScreen))
    ) {
      screen.current?.focus({ preventScroll: true });
    }
  }, [focused]);

  return (
    <div
      ref={screen}
      data-web-tab-screen
      inert={!focused}
      tabIndex={-1}
      style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0 }}
    >
      {children}
    </div>
  );
}

export function MainTabNavigator() {
  const { t } = useTranslation();
  const [tabBarHeight, setTabBarHeight] = useState<number>();

  return (
    <TabBarHeightContext.Provider value={tabBarHeight}>
      <Tab.Navigator
        initialRouteName="Dashboard"
        tabBar={(props) => (
          <AppTabBar
            {...props}
            onHeightChange={Platform.OS === 'web' ? setTabBarHeight : undefined}
          />
        )}
        screenLayout={
          Platform.OS === 'web'
            ? ({ children }) => <WebTabScreen>{children}</WebTabScreen>
            : undefined
        }
        screenOptions={{ headerShown: false, lazy: true }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: t('navigation.dashboard'), lazy: false }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: t('navigation.history') }}
        />
        <Tab.Screen
          name="Comparison"
          component={ComparisonScreen}
          options={{ title: t('navigation.compare') }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileNavigator}
          options={{ title: t('navigation.profile') }}
        />
      </Tab.Navigator>
    </TabBarHeightContext.Provider>
  );
}
