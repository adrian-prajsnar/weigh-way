import { StyleProp, ViewStyle } from 'react-native';
import { useAppStyles } from '../theme/styles';
import { layoutWidth } from '../theme/tokens';
import { useAppWindowDimensions } from './use-app-window-dimensions';

export function useSheetContainerStyle(extra?: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  const styles = useAppStyles();
  const { width } = useAppWindowDimensions();
  const isFloating = width > layoutWidth.sheet;

  return [styles.datePickerSheet, isFloating && styles.datePickerSheetFloating, extra];
}

export function useFloatingSheet(): boolean {
  const { width } = useAppWindowDimensions();
  return width > layoutWidth.sheet;
}
