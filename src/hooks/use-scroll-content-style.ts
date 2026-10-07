import { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getScrollBottomPadding } from '../navigation/tab-bar-layout';
import { useAppStyles } from '../theme/styles';

export function useScrollContentStyle(): StyleProp<ViewStyle> {
  const styles = useAppStyles();
  const insets = useSafeAreaInsets();

  return useMemo(
    () => [styles.content, { paddingBottom: getScrollBottomPadding(insets.bottom) }],
    [styles.content, insets.bottom],
  );
}
