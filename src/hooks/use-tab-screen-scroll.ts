import { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getScrollBottomPadding, getTabBarViewportInset } from '../navigation/tab-bar-layout';
import { useAppStyles } from '../theme/styles';

/** Scroll props for main-tab screens with a floating tab bar overlay. */
export function useTabScreenScroll() {
  const styles = useAppStyles();
  const insets = useSafeAreaInsets();

  const scrollViewStyle = useMemo(
    () => [styles.scrollView, { marginBottom: getTabBarViewportInset(insets.bottom) }],
    [styles.scrollView, insets.bottom],
  );

  const contentContainerStyle = useMemo<StyleProp<ViewStyle>>(
    () => [styles.content, { paddingBottom: getScrollBottomPadding(insets.bottom) }],
    [styles.content, insets.bottom],
  );

  return { scrollViewStyle, contentContainerStyle };
}
