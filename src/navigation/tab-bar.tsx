import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppWindowDimensions } from '../hooks/use-app-window-dimensions';
import { getContentFrameWidth } from '../hooks/use-content-frame-width';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { spacing } from '../theme/tokens';
import { getTabBarBottomOffset } from './tab-bar-layout';
import { RootTabParamList } from './types';

type TabIconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<keyof RootTabParamList, { active: TabIconName; inactive: TabIconName }> = {
  Dashboard: { active: 'home', inactive: 'home-outline' },
  History: { active: 'list', inactive: 'list-outline' },
  Comparison: { active: 'git-compare', inactive: 'git-compare-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useAppWindowDimensions();
  const [barWidth, setBarWidth] = useState(0);
  const contentFrameWidth = getContentFrameWidth(windowWidth);
  const tabBarWidth =
    typeof contentFrameWidth === 'number' ? contentFrameWidth : windowWidth - spacing.lg * 2;
  const tabBarLeft = (windowWidth - tabBarWidth) / 2;

  const itemWidth =
    barWidth > 0 ? (barWidth - spacing.sm * 2) / state.routes.length : 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    width: itemWidth,
    opacity: itemWidth > 0 ? 1 : 0,
    transform: [
      {
        translateX: withSpring(spacing.sm + state.index * itemWidth, {
          damping: 20,
          mass: 0.7,
        }),
      },
    ],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      style={{
        position: 'absolute',
        bottom: getTabBarBottomOffset(insets.bottom),
        width: tabBarWidth,
        left: tabBarLeft,
      }}
    >
      <Animated.View
        style={[styles.tabBar, { position: 'relative', width: '100%' }]}
        onLayout={handleLayout}
      >
      <Animated.View style={[styles.tabBarIndicator, indicatorStyle]} />
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.index === index;
        const icons = TAB_ICONS[route.name as keyof RootTabParamList];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            style={styles.tabBarItem}
            onPress={onPress}
            onLongPress={() =>
              navigation.emit({ type: 'tabLongPress', target: route.key })
            }
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
          >
            <Ionicons
              name={isFocused ? icons.active : icons.inactive}
              size={22}
              color={isFocused ? colors.accent : colors.textSubtle}
            />
            <Text
              style={[
                styles.tabBarLabel,
                { color: isFocused ? colors.accentText : colors.textSubtle },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </Animated.View>
    </View>
  );
}
