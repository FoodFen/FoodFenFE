import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { GLASS_ML } from '@/features/dashboard/constants';
import { useLogSheetStore } from '@/features/logging/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

import { MetricSection } from './MetricSection';

/**
 * Water for the day, drawn as a row of glasses.
 *
 * The glass row is display-only; the card's "+" opens the log sheet on the
 * water panel.
 */
export function WaterSection({ day }: { day: DiaryDay }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const present = useLogSheetStore((state) => state.present);

  const targetMl = day.goal.targetWaterMl;
  const glassCount = Math.max(Math.round(targetMl / GLASS_ML), 1);
  const filled = Math.min(Math.round(day.waterMl / GLASS_ML), glassCount);

  return (
    <MetricSection
      title={t('dashboard', 'water')}
      value={day.waterMl.toLocaleString()}
      unit="ml"
      onAdd={() => present('water')}
    >
      <View className="gap-3 pt-1">
        <View className="flex-row flex-wrap gap-2">
          {Array.from({ length: glassCount }).map((_, index) => (
            <View
              key={index}
              className={cn(
                'h-9 w-7 items-center justify-center rounded-b-lg rounded-t-sm',
                index < filled ? 'bg-fat' : 'bg-surface-alt',
              )}
            >
              {index === filled ? (
                <Ionicons name="add" size={14} color={colors.fgSubtle} />
              ) : null}
            </View>
          ))}
        </View>

        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="subtle">
            {t('dashboard', 'waterGoal').replace('{ml}', targetMl.toLocaleString())}
          </Text>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.fgSubtle} />
        </View>
      </View>
    </MetricSection>
  );
}
