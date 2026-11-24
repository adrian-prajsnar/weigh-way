import { useContext, useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getScrollBottomPadding,
  getTabBarViewportInset,
  TabBarHeightContext,
} from '../navigation/tab-bar-layout';
import { useAppStyles } from '../theme/styles';

/** Scroll props for main-tab screens with a floating tab bar overlay. */
export function useTabScreenScroll() {
  const styles = useAppStyles();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(TabBarHeightContext);

  const scrollViewStyle = useMemo(
    () => [styles.scrollView, { marginBottom: getTabBarViewportInset(insets.bottom, tabBarHeight) }],
    [styles.scrollView, insets.bottom, tabBarHeight],
  );

  const contentContainerStyle = useMemo<StyleProp<ViewStyle>>(
    () => [
      styles.content,
      { paddingBottom: getScrollBottomPadding(insets.bottom, false) },
    ],
    [styles.content, insets.bottom],
  );

  return { scrollViewStyle, contentContainerStyle };
}
