import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useAppStyles } from '../theme/styles';
import { toggleButtonA11y } from '../theme/selection-a11y';
import { webFocusTarget } from '../theme/web-focus-target';
import { shouldRevertSelection } from './segmented-selection';

const TRACK_PADDING = 4;
const MIN_THREE_OPTION_TRACK_WIDTH = 260;

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  groupLabel?: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void | Promise<boolean | void>;
};

export function SegmentedControl<T extends string>({
  groupLabel,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const styles = useAppStyles();
  const [trackWidth, setTrackWidth] = useState(0);
  const [selected, setSelected] = useState(value);
  const latestValue = useRef(value);
  const mounted = useRef(false);
  const changeId = useRef(0);
  latestValue.current = value;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setSelected(value);
  }, [value]);

  const itemWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selected),
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    width: itemWidth,
    transform: [{ translateX: withTiming(TRACK_PADDING + activeIndex * itemWidth, { duration: 220 }) }],
    opacity: itemWidth > 0 ? 1 : 0,
  }));
  const stackOptions =
    Platform.OS === 'web' &&
    options.length > 2 &&
    trackWidth > 0 &&
    trackWidth < MIN_THREE_OPTION_TRACK_WIDTH;

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      style={[styles.segmentedTrack, stackOptions && styles.segmentedTrackStacked]}
      onLayout={handleLayout}
      {...(Platform.OS === 'web' && groupLabel
        ? { role: 'group' as const, 'aria-label': groupLabel }
        : {})}
    >
      {!stackOptions ? <Animated.View style={[styles.segmentedIndicator, indicatorStyle]} /> : null}
      {options.map((option) => {
        const isActive = option.value === selected;
        return (
          <Pressable
            key={option.value}
            style={[
              styles.segmentedItem,
              stackOptions && styles.segmentedItemStacked,
              stackOptions && isActive && styles.segmentedItemStackedActive,
            ]}
            onPress={() => {
              if (option.value === selected) return;
              const currentChangeId = ++changeId.current;
              setSelected(option.value);
              const result = onChange(option.value);
              if (result) {
                const settle = (success: boolean | void) => {
                  if (
                    mounted.current &&
                    shouldRevertSelection(success, currentChangeId, changeId.current)
                  ) {
                    setSelected(latestValue.current);
                  }
                };
                void result.then(settle, () => settle(false));
              }
            }}
            accessibilityRole="button"
            {...toggleButtonA11y(isActive)}
            {...webFocusTarget('segmented-item')}
          >
            <Text style={[styles.segmentedLabel, isActive && styles.segmentedLabelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
