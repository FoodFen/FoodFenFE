import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Fragment, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { GlassSurface } from '@/components/ui/GlassSurface';
import { PressableScale } from '@/components/ui/PressableScale';
import { useLogSheetStore } from '@/features/logging/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

/** The route after which the middle log-button slot is inserted. */
const MIDDLE_AFTER = 'achievements';

const INDICATOR_SPRING = { damping: 20, stiffness: 260, mass: 0.7 };

const LOG_BUTTON_SIZE = 56;
const LOG_BUTTON_SINK = 10;
const NOTCH_RADIUS = LOG_BUTTON_SIZE / 2 + 6;
const SHOULDER_RUN = 8;
const CIRCLE_KAPPA = 0.55;
const STROKE_INSET = 0.5;
const BAR_PADDING = 8;

const LOG_BUTTON_SIZE_STYLE = { width: LOG_BUTTON_SIZE, height: LOG_BUTTON_SIZE };

/**
 * Fill and top-edge stroke of a full-width bar whose top edge is cut by a
 * circular notch of radius `notchRadius` centred `notchSink` below the top edge
 * at `notchCenterX`. Quarter-ellipse shoulders leave the flat edge and meet the
 * circle at its widest point, where both tangents are vertical, so there is no
 * kink.
 */
export function notchedBarPath(
  width: number,
  height: number,
  notchCenterX: number,
  notchRadius: number,
  notchSink: number,
): { fill: string; edge: string } {
  const R = Math.min(notchRadius, height - BAR_PADDING - notchSink);
  const n = (v: number) => Math.round(v * 100) / 100;

  const topEdge = (top: number) => {
    const left = notchCenterX - R;
    const right = notchCenterX + R;
    const mid = top + notchSink;
    const k = CIRCLE_KAPPA;
    return [
      `H${n(left - SHOULDER_RUN)}`,
      `C${n(left - SHOULDER_RUN * (1 - k))} ${n(top)} ${n(left)} ${n(mid - notchSink * k)} ${n(left)} ${n(mid)}`,
      `A${n(R)} ${n(R)} 0 0 0 ${n(right)} ${n(mid)}`,
      `C${n(right)} ${n(mid - notchSink * k)} ${n(right + SHOULDER_RUN * (1 - k))} ${n(top)} ${n(right + SHOULDER_RUN)} ${n(top)}`,
      `H${n(width)}`,
    ].join(' ');
  };

  return {
    fill: `M0 ${n(height)} V0 ${topEdge(0)} V${n(height)} Z`,
    edge: `M0 ${STROKE_INSET} ${topEdge(STROKE_INSET)}`,
  };
}

type IconName = keyof typeof Ionicons.glyphMap;

/** Route name → icon pair. Routes not listed here are left out of the bar. */
const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  achievements: { active: 'star', inactive: 'star-outline' },
  dishes: { active: 'restaurant', inactive: 'restaurant-outline' },
  insights: { active: 'stats-chart', inactive: 'stats-chart-outline' },
};

/**
 * The docked, full-width bar: a flat `surfaceAlt` SVG shape with a circular
 * notch cut into its top edge around the green log button, which sits with its
 * centre `LOG_BUTTON_SINK` below that edge (between the second and third tab). The bar is a plain filled
 * shape, not glass; only the "+" keeps the glass look.
 *
 * Passed to `<Tabs tabBar={...}>`, so it drives the real navigator state. The
 * log button is not a tab — logging is an action that returns you to wherever
 * you were — so it opens the shared log bottom sheet instead of navigating.
 * The disc is a sibling drawn over the bar, sunk into its top edge, and the
 * container's top padding keeps it inside the parent's bounds, which Android
 * needs to deliver touches.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const presentLogSheet = useLogSheetStore((store) => store.present);
  const [tabX, setTabX] = useState<Record<string, number>>({});
  const [barSize, setBarSize] = useState({ width: 0, height: 0 });
  const inactiveColor = colors.fgSubtle;
  const barPath =
    barSize.width > 0
      ? notchedBarPath(
          barSize.width,
          barSize.height,
          barSize.width / 2,
          NOTCH_RADIUS,
          LOG_BUTTON_SINK,
        )
      : null;
  const indicatorX = tabX[state.routes[state.index]?.key ?? ''];

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0"
      style={{ paddingTop: LOG_BUTTON_SIZE / 2 - LOG_BUTTON_SINK }}
    >
      <View
        className="relative"
        style={{
          paddingTop: BAR_PADDING,
          paddingBottom: insets.bottom + BAR_PADDING,
          boxShadow:
            resolved === 'dark' ? '0 -2px 12px rgba(0,0,0,0.4)' : '0 -2px 12px rgba(0,0,0,0.08)',
        }}
        onLayout={({ nativeEvent: { layout } }) =>
          setBarSize((prev) =>
            prev.width === layout.width && prev.height === layout.height
              ? prev
              : { width: layout.width, height: layout.height },
          )
        }
      >
        {barPath && (
          <Svg
            pointerEvents="none"
            width={barSize.width}
            height={barSize.height}
            style={StyleSheet.absoluteFill}
          >
            <Path d={barPath.fill} fill={colors.surfaceAlt} />
            <Path d={barPath.edge} fill="none" stroke={colors.border} strokeWidth={1} />
          </Svg>
        )}
        <View className="flex-row items-center justify-around px-4">
          {indicatorX !== undefined && <TabIndicator x={indicatorX} />}
          {state.routes.map((route, index) => {
            const icons = TAB_ICONS[route.name];
            if (!icons) return null;

            const slot = route.name === MIDDLE_AFTER ? <View className="w-14" /> : null;

            const focused = state.index === index;
            const label = descriptors[route.key]?.options.title ?? route.name;

            return (
              <Fragment key={route.key}>
                <TabButton
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
                {slot}
              </Fragment>
            );
          })}
        </View>
      </View>

      <View pointerEvents="box-none" className="absolute inset-x-0 top-0 items-center">
        <LogButton
          color={colors.onBrand}
          label={t('logSheet', 'openA11y')}
          tint={colors.brand}
          onPress={() => {
            haptics.selection();
            presentLogSheet();
          }}
        />
      </View>
    </View>
  );
}

/** The raised "+" log button: Liquid Glass tinted brand green, a solid green disc elsewhere. */
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
      style={[LOG_BUTTON_SIZE_STYLE, { boxShadow: `0 0 18px ${tint}59` }]}
      className="rounded-full"
    >
      <GlassSurface
        interactive
        tintColor={tint}
        fallbackClassName="bg-brand"
        style={LOG_BUTTON_SIZE_STYLE}
        className="items-center justify-center rounded-full"
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
