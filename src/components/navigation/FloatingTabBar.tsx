import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLogSheetStore } from '@/features/logging/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

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
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
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

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
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
              className="h-11 w-14 items-center justify-center rounded-full active:bg-surface-alt"
            >
              <Ionicons
                name={focused ? icons.active : icons.inactive}
                size={24}
                color={focused ? colors.brand : colors.fgSubtle}
              />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          haptics.selection();
          presentLogSheet();
        }}
        accessibilityRole="button"
        accessibilityLabel="Log a meal"
        className="h-14 w-14 items-center justify-center rounded-full bg-brand active:opacity-80"
      >
        <Ionicons name="add" size={30} color={colors.onBrand} />
      </Pressable>
    </View>
  );
}
