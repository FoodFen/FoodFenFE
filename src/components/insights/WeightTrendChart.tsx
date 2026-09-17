import { useState } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Polyline,
  Stop,
} from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
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

/** Width of the y-axis label gutter, in points. */
const AXIS_WIDTH = 34;
/** Past this many points, per-point markers read as noise rather than data. */
const MAX_MARKERS = 14;

/**
 * Weight over time against the goal (UC-19), drawn with plain `react-native-svg`
 * like `CalorieTrendChart` — no charting library.
 *
 * The `viewBox` is sized in real measured pixels (via `onLayout`), not a
 * stretched 0–100 box: a line chart with circular point markers would render
 * them as ellipses under a non-uniform stretch. A single point (or an all-equal
 * series) still renders — the "must not crash" edge case — by padding a
 * zero-width value range.
 *
 * Line-chart conventions rather than a bare polyline: gridlines behind the
 * data, a shaded area under the line to carry the eye along the trend, markers
 * thinned out once the series is long enough that they'd collide, and the
 * latest reading called out as the one number a person actually looks for.
 * Unlike the calorie chart the axis deliberately does **not** start at zero —
 * a 2 kg move inside an 80 kg range would be invisible if it did.
 */
export function WeightTrendChart({
  series,
  goalKg,
  height = 160,
}: WeightTrendChartProps) {
  const { t } = useTranslation();
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

  const points = series.map((point, index) => ({
    x: xFor(index),
    y: yFor(point.weightKg),
  }));
  const last = points[points.length - 1];
  const latestKg = weights[weights.length - 1];
  const goalY = yFor(goalKg);
  const showMarkers = series.length <= MAX_MARKERS;

  // Close the polyline down to the baseline and back, so the same geometry
  // fills as an area without tracing it twice.
  const areaPath =
    points.length > 1
      ? `M${points[0]!.x},${height} ` +
        points.map((point) => `L${point.x},${point.y}`).join(' ') +
        ` L${last!.x},${height} Z`
      : null;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <LegendSwatch
          color={colors.brand}
          dashed={false}
          label={t('insights', 'weightLegend')}
        />
        <LegendSwatch
          color={colors.fgMuted}
          dashed
          label={t('insights', 'goalValue').replace(
            '{weight}',
            round1(goalKg).toLocaleString(),
          )}
        />
      </View>

      <View className="flex-row gap-2">
        <View
          className="items-end justify-between"
          style={{ height, width: AXIS_WIDTH }}
        >
          <Text variant="caption" tone="subtle">
            {round1(scaleMax)}
          </Text>
          <Text variant="caption" tone="subtle">
            {round1(scaleMin)}
          </Text>
        </View>

        <View
          className="flex-1"
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={{ height }}
        >
          {width > 0 ? (
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.brand} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
                </LinearGradient>
              </Defs>

              {[0, 0.5, 1].map((fraction) => (
                <Line
                  key={fraction}
                  x1={0}
                  y1={height * fraction}
                  x2={width}
                  y2={height * fraction}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}

              {areaPath ? <Path d={areaPath} fill="url(#weightArea)" /> : null}

              <Line
                x1={0}
                y1={goalY}
                x2={width}
                y2={goalY}
                stroke={colors.fgMuted}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />

              {points.length > 1 ? (
                <Polyline
                  points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={colors.brand}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {showMarkers
                ? points.map((point, index) => (
                    <Circle
                      key={series[index]?.date}
                      cx={point.x}
                      cy={point.y}
                      r={3}
                      fill={colors.brand}
                    />
                  ))
                : null}

              {/* The latest reading, as a ringed marker — the one point the eye
                  is looking for on a weight chart. */}
              {last ? (
                <Circle
                  cx={last.x}
                  cy={last.y}
                  r={5}
                  fill={colors.surface}
                  stroke={colors.brand}
                  strokeWidth={3}
                />
              ) : null}
            </Svg>
          ) : null}

          {latestKg !== undefined ? (
            <View
              className="absolute rounded-pill bg-brand-soft px-2 py-0.5"
              style={{ right: 0, top: Math.min(Math.max((last?.y ?? 0) - 28, 0), height - 20) }}
            >
              <Text variant="caption" tone="brand">
                {round1(latestKg).toLocaleString()} kg
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="flex-row justify-between" style={{ paddingLeft: AXIS_WIDTH + 8 }}>
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

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function LegendSwatch({
  color,
  dashed,
  label,
}: {
  color: string;
  dashed: boolean;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        className="h-0 w-4"
        style={{
          borderTopWidth: 2,
          borderTopColor: color,
          borderStyle: dashed ? 'dashed' : 'solid',
        }}
      />
      <Text variant="caption" tone="subtle">
        {label}
      </Text>
    </View>
  );
}
