import { Pressable, View } from 'react-native';

import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import type { RingStatus } from '@/features/dashboard/ringStatus';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { DateKey } from '@/lib/date';
import { formatDayOfMonth, formatWeekdayInitial } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

/** Arc colour per status — matches the "Ring Colors Explained" screen. */
function arcColor(status: RingStatus, colors: ReturnType<typeof colorsFor>): string {
  switch (status) {
    case 'under':
      return colors.fg;
    case 'green':
      return colors.success;
    case 'yellow':
      return colors.warning;
    case 'red':
      return colors.danger;
    default:
      return colors.border;
  }
}

export interface DayRingProps {
  date: DateKey;
  status: RingStatus;
  /** 0–1, the day's calories eaten over its target. Drives how far the arc fills. */
  progress: number;
  selected: boolean;
  onPress: () => void;
}

/**
 * One day in the week strip: the weekday initial above a progress ring.
 *
 * The arc fills with the day's calories-eaten fraction of target and is
 * coloured by `dayRingStatus`. Selecting a day fills the circle behind the
 * ring without hiding it, so a selected day keeps its colour and progress.
 * "Today" has no marker of its own — the dashboard header's "back to today"
 * shortcut is how you tell you've wandered off it.
 */
export function DayRing({ date, status, progress, selected, onPress }: DayRingProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const disabled = status === 'future';
  // Nothing eaten that day → no ring at all, not a grey circle. A selected day
  // keeps a ring so the tapped circle stays outlined.
  const hasRing = !disabled && (progress > 0 || selected);

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={date}
      className="items-center gap-1.5 py-1"
    >
      <Text variant="caption" tone={selected ? 'default' : 'subtle'}>
        {formatWeekdayInitial(date)}
      </Text>

      <View className="h-9 w-9 items-center justify-center">
        {selected ? (
          // Inset a touch so the dark fill does not merge into the coloured ring.
          <View className="absolute inset-1 rounded-full bg-fg" />
        ) : null}

        <ProgressRing
          progress={progress}
          size={36}
          strokeWidth={3}
          color={hasRing && progress > 0 ? arcColor(status, colors) : 'transparent'}
          trackColor={hasRing ? colors.border : 'transparent'}
        >
          <Text
            variant="label"
            tone={disabled ? 'subtle' : 'default'}
            style={selected ? { color: colors.bg } : undefined}
          >
            {formatDayOfMonth(date)}
          </Text>
        </ProgressRing>
      </View>
    </Pressable>
  );
}
