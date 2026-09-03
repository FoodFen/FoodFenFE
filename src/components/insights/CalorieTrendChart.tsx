import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatWeekdayInitial } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

export interface CalorieTrendPoint {
  date: string;
  calories: number;
  goal: number;
}

export interface CalorieTrendChartProps {
  series: CalorieTrendPoint[];
  height?: number;
}

/**
 * Daily calories against the goal line.
 *
 * Drawn with plain `react-native-svg` rather than a charting library: the chart
 * is a handful of rectangles and one rule, and a dedicated dependency would
 * bring its own theming model to keep in sync with ours.
 *
 * Bars are sized in a 0–100 coordinate space and stretched by `viewBox`, so the
 * component needs no layout measurement to be responsive.
 */
export function CalorieTrendChart({ series, height = 160 }: CalorieTrendChartProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  if (series.length === 0) return null;

  const goal = series[0]?.goal ?? 0;

  // Scale to whichever is larger — the biggest day or the goal — so the goal
  // line is always on the chart, and pad by 15% so the tallest bar has air
  // above it.
  const peak = Math.max(...series.map((point) => point.calories), goal, 1);
  const scaleMax = peak * 1.15;

  const slotWidth = 100 / series.length;
  const barWidth = slotWidth * 0.55;
  const barInset = (slotWidth - barWidth) / 2;

  const goalY = 100 - (goal / scaleMax) * 100;

  return (
    <View className="gap-2">
      <Svg width="100%" height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Goal line. `vectorEffect` keeps it hairline-thin despite the
            non-uniform stretch the viewBox applies. */}
        <Line
          x1={0}
          y1={goalY}
          x2={100}
          y2={goalY}
          stroke={colors.fgSubtle}
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />

        {series.map((point, index) => {
          const barHeight = (point.calories / scaleMax) * 100;
          const isOver = point.calories > goal;

          return (
            <Rect
              key={point.date}
              x={index * slotWidth + barInset}
              y={100 - barHeight}
              width={barWidth}
              height={barHeight}
              rx={1}
              fill={
                point.calories === 0
                  ? colors.surfaceAlt
                  : isOver
                    ? colors.warning
                    : colors.brand
              }
            />
          );
        })}
      </Svg>

      <View className="flex-row">
        {series.map((point) => (
          <View key={point.date} className="flex-1 items-center">
            <Text variant="caption" tone="subtle">
              {formatWeekdayInitial(point.date)}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row items-center gap-4 pt-1">
        <LegendSwatch color={colors.brand} label="On or under goal" />
        <LegendSwatch color={colors.warning} label="Over goal" />
      </View>
    </View>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <Text variant="caption" tone="subtle">
        {label}
      </Text>
    </View>
  );
}
