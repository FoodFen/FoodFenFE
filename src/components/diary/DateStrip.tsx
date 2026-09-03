import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import type { DateKey } from '@/lib/date';
import {
  formatDayOfMonth,
  formatWeekdayInitial,
  isFutureDate,
  todayKey,
  weekAround,
} from '@/lib/date';
import { haptics } from '@/lib/haptics';

export interface DateStripProps {
  selected: DateKey;
  onSelect: (date: DateKey) => void;
  className?: string;
}

/**
 * Seven-day selector centred on the current selection.
 *
 * Future days are rendered but disabled — showing them keeps the strip from
 * shifting under the user's thumb as the week rolls over, while making it
 * obvious that nothing can be logged ahead of time.
 */
export function DateStrip({ selected, onSelect, className }: DateStripProps) {
  const days = weekAround(selected);
  const today = todayKey();

  return (
    <View className={cn('flex-row justify-between gap-1 px-4', className)}>
      {days.map((date) => {
        const isSelected = date === selected;
        const isToday = date === today;
        const disabled = isFutureDate(date);

        return (
          <Pressable
            key={date}
            disabled={disabled}
            onPress={() => {
              haptics.selection();
              onSelect(date);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={date}
            className={cn(
              'h-16 flex-1 items-center justify-center gap-1 rounded-xl',
              isSelected && 'bg-brand',
              !isSelected && isToday && 'bg-brand-soft',
              disabled && 'opacity-30',
            )}
          >
            <Text variant="caption" tone={isSelected ? 'onBrand' : 'subtle'}>
              {formatWeekdayInitial(date)}
            </Text>
            <Text variant="label" tone={isSelected ? 'onBrand' : 'default'}>
              {formatDayOfMonth(date)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
