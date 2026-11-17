import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useAppStyles } from '../theme/styles';
import { webFocusTarget } from '../theme/web-focus-target';
import { shouldRevertSelection } from './segmented-selection';

const TRACK_PADDING = 4;

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void | Promise<boolean | void>;
};

export function SegmentedControl<T extends string>({
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

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.segmentedTrack} onLayout={handleLayout}>
      <Animated.View style={[styles.segmentedIndicator, indicatorStyle]} />
      {options.map((option) => {
        const isActive = option.value === selected;
        return (
          <Pressable
            key={option.value}
            style={styles.segmentedItem}
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
            accessibilityState={{ selected: isActive }}
            {...webFocusTarget('segmented-item')}
          >
            <Text
              style={[styles.segmentedLabel, isActive && styles.segmentedLabelActive]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
