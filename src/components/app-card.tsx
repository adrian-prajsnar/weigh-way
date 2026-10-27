import { ReactNode, useEffect, useState } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import {
  APP_CARD_ENTER_DURATION_MS,
  getAppCardEnterFallbackMs,
} from './app-card-enter-animation';
import { LoadingCardOverlay } from './loading-card-overlay';
import { useAppStyles } from '../theme/styles';
import { radius } from '../theme/tokens';

type AppCardProps = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  isBusy?: boolean;
  elevated?: boolean;
  delay?: number;
  animateEntry?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function AppCard({
  title,
  subtitle,
  right,
  isBusy = false,
  elevated = false,
  delay = 0,
  animateEntry = true,
  style,
  children,
}: AppCardProps) {
  const styles = useAppStyles();
  const reducedMotion = useReducedMotion();
  const hasHeader = Boolean(title || subtitle || right);
  const skipEnterAnimation = !animateEntry || reducedMotion;
  const [enterFallback, setEnterFallback] = useState(skipEnterAnimation);

  useEffect(() => {
    if (skipEnterAnimation) {
      setEnterFallback(true);
      return;
    }

    setEnterFallback(false);
    const fallbackMs = getAppCardEnterFallbackMs(delay);
    const timer = setTimeout(() => setEnterFallback(true), fallbackMs);
    return () => clearTimeout(timer);
  }, [delay, skipEnterAnimation]);

  const entering =
    animateEntry && !reducedMotion && !enterFallback
      ? FadeInDown.duration(APP_CARD_ENTER_DURATION_MS).delay(delay)
      : undefined;

  return (
    <Animated.View
      key={enterFallback ? `card-visible-${delay}` : `card-enter-${delay}`}
      entering={entering}
      style={styles.loadingCard}
    >
      {isBusy ? (
        <LoadingCardOverlay
          style={{ borderRadius: elevated ? radius.xl : radius.lg }}
        />
      ) : null}
      <View style={[elevated ? styles.cardElevated : styles.card, style]}>
        {hasHeader ? (
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, gap: 2 }}>
              {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
              {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
            </View>
            {right}
          </View>
        ) : null}
        {children}
      </View>
    </Animated.View>
  );
}
