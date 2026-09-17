import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLogSheetStore } from '@/features/logging/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_SCALE = 0.9;

type IconName = keyof typeof Ionicons.glyphMap;

/** Route name → icon pair. Routes not listed here are left out of the bar. */
const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  achievements: { active: 'star', inactive: 'star-outline' },
  insights: { active: 'stats-chart', inactive: 'stats-chart-outline' },
};

/**
 * The floating pill bar from the design, plus the green log button beside it.
 *
 * Passed to `<Tabs tabBar={...}>`, so it drives the real navigator state. The
 * log button is not a tab — logging is an action that returns you to wherever
 * you were — so it opens the shared log bottom sheet instead of navigating.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const presentLogSheet = useLogSheetStore((store) => store.present);

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 flex-row items-center gap-3 px-6"
      style={{ bottom: insets.bottom + 10 }}
    >
      <View className="flex-1 flex-row items-center justify-around rounded-full border border-border bg-surface px-2 py-2">
        {state.routes.map((route, index) => {
          const icons = TAB_ICONS[route.name];
          if (!icons) return null;

          const focused = state.index === index;
          const label = descriptors[route.key]?.options.title ?? route.name;

          return (
            <TabButton
              key={route.key}
              focused={focused}
              icon={focused ? icons.active : icons.inactive}
              color={focused ? colors.brand : colors.fgSubtle}
              label={label}
              onPress={() => {
                haptics.selection();
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!focused && !event.defaultPrevented) {
                  // `route.name` is a known tab route; the navigator's own
                  // param list is not narrowed here.
                  navigation.navigate(route.name as never);
                }
              }}
            />
          );
        })}
      </View>

      <LogButton
        color={colors.onBrand}
        label={t('logSheet', 'openA11y')}
        onPress={() => {
          haptics.selection();
          presentLogSheet();
        }}
      />
    </View>
  );
}

/** The floating "+" log button: scales down while held, springs back on release. */
function LogButton({
  color,
  label,
  onPress,
}: {
  color: string;
  label: string;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withTiming(pressed ? PRESS_SCALE : 1, { duration: pressed ? 100 : 150 });
  }, [pressed, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={style}
      className="h-14 w-14 items-center justify-center rounded-full bg-brand"
    >
      <Ionicons name="add" size={30} color={color} />
    </AnimatedPressable>
  );
}

/** One tab icon: scales up briefly when it becomes the selected tab. */
function TabButton({
  focused,
  icon,
  color,
  label,
  onPress,
}: {
  focused: boolean;
  icon: IconName;
  color: string;
  label: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(withSpring(1.25, { duration: 180 }), withSpring(1));
    }
  }, [focused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      className="h-11 w-14 items-center justify-center rounded-full active:bg-surface-alt"
    >
      <Animated.View style={iconStyle}>
        <Ionicons name={icon} size={24} color={color} />
      </Animated.View>
    </Pressable>
  );
}
