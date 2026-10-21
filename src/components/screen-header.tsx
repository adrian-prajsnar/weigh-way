import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppUpdateBar } from './app-update-bar';
import { useSharedAppUpdate } from '../context/app-update-context';
import { useAppStyles } from '../theme/styles';
import { spacing } from '../theme/tokens';

type ScreenHeaderProps = {
  title: string;
  subtitle: string;
  scrollY?: SharedValue<number>;
  leading?: ReactNode;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, scrollY, leading, right }: ScreenHeaderProps) {
  const styles = useAppStyles();
  const insets = useSafeAreaInsets();
  const { update } = useSharedAppUpdate();
  const hasUpdateBar = Boolean(update);
  // The update bar carries the safe-area inset itself when it is shown.
  const topPadding = hasUpdateBar ? spacing.md : insets.top + spacing.md;

  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: scrollY ? interpolate(scrollY.value, [0, 24], [0, 1], 'clamp') : 0,
  }));

  return (
    <View>
      <AppUpdateBar />
      <View style={[styles.screenHeader, { paddingTop: topPadding }]}>
        <View style={styles.screenHeaderRow}>
          {leading ? <View style={{ marginRight: 8 }}>{leading}</View> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {right}
        </View>
      </View>
      <Animated.View style={[styles.screenHeaderHairline, hairlineStyle]} />
    </View>
  );
}
