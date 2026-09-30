import { useRef } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { heatmapLevel } from '@/features/gamification/selectors';
import type { HeatmapCell } from '@/features/gamification/selectors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

const CELL_SIZE = 11;
const CELL_GAP = 3;

const LEVEL_OPACITY: Record<0 | 1 | 2 | 3 | 4, number> = {
  0: 1,
  1: 0.28,
  2: 0.52,
  3: 0.76,
  4: 1,
};

/** A GitHub-style contribution grid: one column per week, one row per weekday. */
export function StreakHeatmap({ weeks }: { weeks: (HeatmapCell | null)[][] }) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const scrollRef = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={(width) => scrollRef.current?.scrollTo({ x: width, animated: false })}
    >
      <View className="flex-row" style={{ gap: CELL_GAP }}>
        {weeks.map((column, columnIndex) => (
          <View key={columnIndex} style={{ gap: CELL_GAP }}>
            {column.map((cell, rowIndex) => {
              const level = cell ? heatmapLevel(cell.count) : null;

              return (
                <View
                  key={cell?.date ?? rowIndex}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    borderRadius: 2,
                    backgroundColor: level && level > 0 ? colors.warning : colors.surfaceAlt,
                    opacity: level !== null ? LEVEL_OPACITY[level] : 0,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function StreakHeatmapLegend({
  lessLabel,
  moreLabel,
}: {
  lessLabel: string;
  moreLabel: string;
}) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <View className="flex-row items-center justify-end gap-1.5">
      <Text variant="caption" tone="subtle">
        {lessLabel}
      </Text>
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <View
          key={level}
          style={{
            width: CELL_SIZE,
            height: CELL_SIZE,
            borderRadius: 2,
            backgroundColor: level > 0 ? colors.warning : colors.surfaceAlt,
            opacity: LEVEL_OPACITY[level],
          }}
        />
      ))}
      <Text variant="caption" tone="subtle">
        {moreLabel}
      </Text>
    </View>
  );
}
