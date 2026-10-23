import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface, hasLiquidGlass } from '@/components/ui/GlassSurface';
import { PressableScale } from '@/components/ui/PressableScale';
import { useLogSheetStore } from '@/features/logging/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

const INDICATOR_SPRING = { damping: 20, stiffness: 260, mass: 0.7 };

type IconName = keyof typeof Ionicons.glyphMap;

/** Route name → icon pair. Routes not listed here are left out of the bar. */
const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  achievements: { active: 'star', inactive: 'star-outline' },
  dishes: { active: 'restaurant', inactive: 'restaurant-outline' },
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
  const [tabX, setTabX] = useState<Record<string, number>>({});
  const inactiveColor = hasLiquidGlass ? colors.fgMuted : colors.fgSubtle;
  const indicatorX = tabX[state.routes[state.index]?.key ?? ''];

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 flex-row items-center gap-3 px-6"
      style={{ bottom: insets.bottom + 10 }}
    >
      <GlassSurface className="flex-1 rounded-full px-2 py-2">
        <View className="flex-row items-center justify-around">
          {indicatorX !== undefined && <TabIndicator x={indicatorX} />}
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
                color={focused ? colors.brand : inactiveColor}
                label={label}
                onLayoutX={(x) =>
                  setTabX((prev) =>
                    prev[route.key] === x ? prev : { ...prev, [route.key]: x },
                  )
                }
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
      </GlassSurface>

      <LogButton
        color={colors.onBrand}
        label={t('logSheet', 'openA11y')}
        tint={colors.brand}
        onPress={() => presentLogSheet()}
      />
    </View>
  );
}

/** The floating "+" log button: Liquid Glass tinted brand green, a solid green disc elsewhere. */
function LogButton({
  color,
  tint,
  label,
  onPress,
}: {
  color: string;
  tint: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      pressedScale={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-14 w-14 rounded-full"
    >
      <GlassSurface
        interactive
        tintColor={tint}
        fallbackClassName="bg-brand"
        className="h-14 w-14 items-center justify-center rounded-full"
      >
        <Ionicons name="add" size={30} color={color} />
      </GlassSurface>
    </PressableScale>
  );
}

/** The pill behind the selected tab; springs sideways when the selection changes. */
function TabIndicator({ x }: { x: number }) {
  const reducedMotion = useReducedMotion();
  const translateX = useSharedValue(x);

  useEffect(() => {
    translateX.value = reducedMotion ? x : withSpring(x, INDICATOR_SPRING);
  }, [x, reducedMotion, translateX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={style}
      className="absolute left-0 top-0 h-11 w-14 rounded-full bg-brand/15"
    />
  );
}

/** One tab icon: scales up briefly when it becomes the selected tab. */
function TabButton({
  focused,
  icon,
  color,
  label,
  onLayoutX,
  onPress,
}: {
  focused: boolean;
  icon: IconName;
  color: string;
  label: string;
  onLayoutX: (x: number) => void;
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
      onLayout={(event) => onLayoutX(event.nativeEvent.layout.x)}
      onPress={onPress}
      className="h-11 w-14 items-center justify-center rounded-full"
    >
      <Animated.View style={iconStyle}>
        <Ionicons name={icon} size={24} color={color} />
      </Animated.View>
    </Pressable>
  );
}
