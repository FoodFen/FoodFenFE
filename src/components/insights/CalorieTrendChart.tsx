import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatWeekdayInitial, todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

export interface CalorieTrendPoint {
  date: string;
  kcal: number;
  target: number;
}

export interface CalorieTrendChartProps {
  series: CalorieTrendPoint[];
  height?: number;
}

/** Width of the y-axis label gutter, in points. */
const AXIS_WIDTH = 34;
/** How much of each day's slot the bar fills; the rest is the gap between bars. */
const BAR_FILL = 0.52;
/** Height of the stub drawn for a day with nothing logged, so it still reads as a day. */
const EMPTY_STUB = 2;

/**
 * Daily calories against the goal line.
 *
 * Drawn with plain `react-native-svg` rather than a charting library: it is a
 * handful of paths and three rules, and a dedicated dependency would bring its
 * own theming model to keep in sync with ours.
 *
 * The `viewBox` is sized in real measured pixels (via `onLayout`) rather than a
 * stretched 0–100 box — under a non-uniform stretch the rounded bar tops come
 * out as lopsided ellipses and the stroke widths differ per axis.
 *
 * Conventions borrowed from the usual bar-chart grammar: a quantitative axis
 * that starts at zero and tops out at a round number, gridlines behind the
 * marks rather than over them, the goal as a dashed reference line, and colour
 * used only to encode over/under rather than for decoration.
 */
export function CalorieTrendChart({ series, height = 150 }: CalorieTrendChartProps) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const [width, setWidth] = useState(0);

  if (series.length === 0) return null;

  const target = series[0]?.target ?? 0;
  const today = todayKey();

  // Zero-based axis topped at a round number at or above both the tallest day
  // and the goal, so the goal line is always on the chart and the tick labels
  // read as figures a person would say out loud.
  const scaleMax = niceCeil(Math.max(...series.map((point) => point.kcal), target, 1));

  const yFor = (kcal: number): number => height - (kcal / scaleMax) * height;

  const slotWidth = width / series.length;
  const barWidth = slotWidth * BAR_FILL;
  const barInset = (slotWidth - barWidth) / 2;
  const targetY = yFor(target);

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <View
          className="items-end justify-between"
          style={{ height, width: AXIS_WIDTH }}
        >
          <Text variant="caption" tone="subtle">
            {scaleMax.toLocaleString()}
          </Text>
          <Text variant="caption" tone="subtle">
            {(scaleMax / 2).toLocaleString()}
          </Text>
          <Text variant="caption" tone="subtle">
            0
          </Text>
        </View>

        <View
          className="flex-1"
          style={{ height }}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          {width > 0 ? (
            <Svg width={width} height={height}>
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

              {series.map((point, index) => {
                const logged = point.kcal > 0;
                const y = logged ? yFor(point.kcal) : height - EMPTY_STUB;

                return (
                  <Path
                    key={point.date}
                    d={barPath(
                      index * slotWidth + barInset,
                      y,
                      barWidth,
                      height - y,
                      barWidth / 2.5,
                    )}
                    fill={
                      !logged
                        ? colors.surfaceAlt
                        : point.kcal > target
                          ? colors.warning
                          : colors.brand
                    }
                  />
                );
              })}

              {/* The goal, drawn over the bars so it stays readable where a bar
                  crosses it. */}
              <Line
                x1={0}
                y1={targetY}
                x2={width}
                y2={targetY}
                stroke={colors.fgMuted}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            </Svg>
          ) : null}
        </View>
      </View>

      <View className="flex-row" style={{ paddingLeft: AXIS_WIDTH + 8 }}>
        {series.map((point) => (
          <View key={point.date} className="flex-1 items-center">
            <Text variant="caption" tone={point.date === today ? 'brand' : 'subtle'}>
              {formatWeekdayInitial(point.date)}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1 pt-1">
        <LegendSwatch color={colors.brand} label={t('insights', 'onOrUnderGoal')} />
        <LegendSwatch color={colors.warning} label={t('insights', 'overGoal')} />
        <LegendSwatch color={colors.surfaceAlt} label={t('insights', 'notLogged')} />
        <LegendSwatch
          color={colors.fgMuted}
          dashed
          label={`${t('insights', 'targetLegend')} · ${target.toLocaleString()}`}
        />
      </View>
    </View>
  );
}

/** Round the axis top up to a round number so the tick labels read cleanly. */
function niceCeil(value: number): number {
  const step = value > 4000 ? 1000 : value > 1500 ? 500 : value > 600 ? 250 : 100;

  return Math.max(Math.ceil(value / step) * step, step);
}

/** A rectangle with only its top corners rounded, so it sits flush on the axis. */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(Math.min(r, w / 2, h), 0);

  return [
    `M${x},${y + h}`,
    `L${x},${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `L${x + w - radius},${y}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `L${x + w},${y + h}`,
    'Z',
  ].join(' ');
}

function LegendSwatch({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      {dashed ? (
        <View
          className="h-0 w-4"
          style={{ borderTopWidth: 2, borderTopColor: color, borderStyle: 'dashed' }}
        />
      ) : (
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      <Text variant="caption" tone="subtle">
        {label}
      </Text>
    </View>
  );
}
