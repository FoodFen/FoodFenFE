import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { DateKey } from '@/lib/date';
import { formatDiaryDate } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

export interface WeightTrendPoint {
  date: DateKey;
  weightKg: number;
}

export interface WeightTrendChartProps {
  series: WeightTrendPoint[];
  goalKg: number;
  height?: number;
}

/**
 * Weight over time against the goal (UC-19), drawn with plain `react-native-svg`
 * like `CalorieTrendChart` — no charting library.
 *
 * The `viewBox` is sized in real measured pixels (via `onLayout`), not a
 * stretched 0–100 box: a bar chart doesn't care about aspect ratio, but a line
 * chart with circular point markers would render them as ellipses under a
 * non-uniform stretch. A single point (or an all-equal series) still renders —
 * the "must not crash" edge case — by padding a zero-width value range.
 */
export function WeightTrendChart({ series, goalKg, height = 160 }: WeightTrendChartProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const [width, setWidth] = useState(0);

  if (series.length === 0) return null;

  const weights = series.map((point) => point.weightKg);
  const min = Math.min(...weights, goalKg);
  const max = Math.max(...weights, goalKg);
  // Pad by 20% of the range, floored at 1 kg so a flat or single-point series
  // still gets a visible band instead of dividing by zero.
  const span = Math.max(max - min, 1);
  const mid = (max + min) / 2;
  const scaleMin = mid - (span * 1.2) / 2;
  const scaleMax = mid + (span * 1.2) / 2;

  const yFor = (weightKg: number): number =>
    height - ((weightKg - scaleMin) / (scaleMax - scaleMin)) * height;
  const xFor = (index: number): number =>
    series.length === 1 ? width / 2 : (index / (series.length - 1)) * width;

  const points = series.map((point, index) => ({ x: xFor(index), y: yFor(point.weightKg) }));
  const goalY = yFor(goalKg);

  return (
    <View className="gap-2">
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line
              x1={0}
              y1={goalY}
              x2={width}
              y2={goalY}
              stroke={colors.fgSubtle}
              strokeWidth={1}
              strokeDasharray="3 3"
            />

            {points.length > 1 ? (
              <Polyline
                points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={colors.brand}
                strokeWidth={2}
              />
            ) : null}

            {points.map((point, index) => (
              <Circle
                key={series[index]?.date}
                cx={point.x}
                cy={point.y}
                r={4}
                fill={colors.brand}
              />
            ))}
          </Svg>
        ) : null}
      </View>

      <View className="flex-row justify-between">
        <Text variant="caption" tone="subtle">
          {formatDiaryDate(series[0]!.date)}
        </Text>
        {series.length > 1 ? (
          <Text variant="caption" tone="subtle">
            {formatDiaryDate(series[series.length - 1]!.date)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
