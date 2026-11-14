import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { VerifiedTick } from '@/components/ui/VerifiedTick';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

import { seg, useTimeline } from './useVignette';
import type { VignetteProps } from './useVignette';

/**
 * Slide 1: a viewfinder, one scan sweep, then two catalog results pop in.
 * Figures are the catalog's own (per100g kcal x default serving, rounded):
 * Phở bò 76 x 500 g = 380 kcal; Bánh mì thịt 250 x 180 g = 450 kcal.
 */

const FRAME_HEIGHT = 100;
const SCAN_HEIGHT = 3;
const CORNERS = [
  'left-2.5 top-2.5 border-l-[3px] border-t-[3px] rounded-tl-[6px]',
  'right-2.5 top-2.5 border-r-[3px] border-t-[3px] rounded-tr-[6px]',
  'bottom-2.5 left-2.5 border-b-[3px] border-l-[3px] rounded-bl-[6px]',
  'bottom-2.5 right-2.5 border-b-[3px] border-r-[3px] rounded-br-[6px]',
];
const ROWS = [
  { dish: 'snapDish1', portion: 'snapPortion1', kcal: 380, from: 0.45 },
  { dish: 'snapDish2', portion: 'snapPortion2', kcal: 450, from: 0.55 },
] as const;

export function SnapVignette({ played, reducedMotion }: VignetteProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const progress = useTimeline(played, reducedMotion, 2000);

  const scanStyle = useAnimatedStyle(() => ({
    opacity: 1 - seg(progress.value, 0.4, 0.5),
    transform: [{ translateY: seg(progress.value, 0, 0.4) * (FRAME_HEIGHT - SCAN_HEIGHT) }],
  }));

  return (
    <View className="w-full items-center gap-3">
      <View
        style={{ height: FRAME_HEIGHT }}
        className="w-full max-w-[224px] items-center justify-center overflow-hidden rounded-card border border-border bg-surface"
      >
        <Ionicons name="restaurant-outline" size={40} color={colors.fgSubtle} />
        {CORNERS.map((corner) => (
          <View key={corner} className={`absolute h-5 w-5 border-brand ${corner}`} />
        ))}
        <Animated.View
          style={scanStyle}
          className="absolute inset-x-2.5 top-0 h-[3px] rounded-full bg-brand"
        />
      </View>

      <View className="w-full max-w-[280px] gap-2">
        {ROWS.map((row) => (
          <ResultRow key={row.dish} {...row} progress={progress} />
        ))}
      </View>
    </View>
  );
}

function ResultRow({
  dish,
  portion,
  kcal,
  from,
  progress,
}: (typeof ROWS)[number] & { progress: ReturnType<typeof useTimeline> }) {
  const { t } = useTranslation();
  const style = useAnimatedStyle(() => {
    const shown = seg(progress.value, from, from + 0.2);
    return {
      opacity: shown,
      transform: [{ translateY: (1 - shown) * 12 }, { scale: 0.94 + 0.06 * shown }],
    };
  });

  return (
    <Animated.View
      style={style}
      className="flex-row items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5"
    >
      <View className="flex-1">
        <Text variant="label" numberOfLines={1}>
          {t('welcome', dish)}
        </Text>
        <Text variant="caption" tone="muted">
          {t('welcome', portion)}
        </Text>
      </View>
      <Text variant="mono">{kcal} kcal</Text>
      <VerifiedTick verified />
    </Animated.View>
  );
}
