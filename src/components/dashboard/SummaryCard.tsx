import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { Card } from '@/components/ui/Card';
import { MacroBarGroup } from '@/components/ui/MacroBar';
import { Text } from '@/components/ui/Text';
import { useIsPremium } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

import { MascotPlaceholder } from './MascotPlaceholder';

/**
 * The day at a glance, as a two-page pager.
 *
 * Page 1 is live — the calorie budget and macro progress. Page 2 is a
 * placeholder for a future fiber / sugar / sodium breakdown; sugar and sodium
 * are not tracked anywhere yet, so it shows nothing real.
 */
export function SummaryCard({ day }: { day: DiaryDay }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const isPremium = useIsPremium();
  const iconSize = 18;
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <Card flush className="overflow-hidden">
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={{ width }} className="gap-4 p-4">
            <View className="flex-row gap-4">
              <MascotPlaceholder className="w-28" />
              <View className="flex-1 justify-center gap-2">
                <StatRow
                  icon={
                    <Ionicons
                      name="flag-outline"
                      size={iconSize}
                      color={colors.fgMuted}
                    />
                  }
                  label={t('dashboard', 'target')}
                  value={day.goal.targetKcal}
                />
                <StatRow
                  icon={
                    <Ionicons
                      name="restaurant-outline"
                      size={iconSize}
                      color={colors.fgMuted}
                    />
                  }
                  label={t('dashboard', 'consumed')}
                  value={day.totals.kcal}
                />
                <StatRow
                  icon={
                    <Ionicons
                      name="flame-outline"
                      size={iconSize}
                      color={colors.fgMuted}
                    />
                  }
                  label={t('dashboard', 'burned')}
                  value={day.exerciseKcal}
                />
              </View>
            </View>

            <View className="h-px bg-border" />

            <MacroBarGroup
              consumed={{
                proteinG: day.totals.proteinG,
                carbsG: day.totals.carbsG,
                fatG: day.totals.fatG,
              }}
              targets={{
                proteinG: day.goal.targetProteinG,
                carbsG: day.goal.targetCarbsG,
                fatG: day.goal.targetFatG,
              }}
            />
          </View>

          <View style={{ width }} className="gap-4 p-4">
            <View className="flex-row gap-4">
              <MascotPlaceholder className="w-28" />
              <View className="flex-1 justify-center gap-2">
                <StatRow
                  icon={
                    <Ionicons
                      name="leaf-outline"
                      size={iconSize}
                      color={colors.fgMuted}
                    />
                  }
                  label={t('dashboard', 'fiber')}
                  value={
                    isPremium && day.totals.fiberG !== undefined && day.totals.fiberG !== null
                      ? Math.round(day.totals.fiberG)
                      : '—'
                  }
                  unit="g"
                />
                <StatRow
                  icon={
                    <MaterialCommunityIcons
                      name="candy-outline"
                      size={iconSize}
                      color={colors.fgMuted}
                    />
                  }
                  label={t('dashboard', 'sugar')}
                  value="—"
                  unit="g"
                />
                <StatRow
                  icon={
                    <MaterialCommunityIcons
                      name="shaker-outline"
                      size={iconSize}
                      color={colors.fgMuted}
                    />
                  }
                  label={t('dashboard', 'sodium')}
                  value="—"
                  unit="mg"
                />
              </View>
            </View>

            <View className="h-px bg-border" />

            <Text variant="caption" tone="subtle" className="text-center">
              {t('dashboard', 'comingSoon')}
            </Text>
          </View>
        </ScrollView>
      </View>

      <View className="flex-row justify-center gap-1.5 pb-3">
        {[0, 1].map((index) => (
          <View
            key={index}
            className={cn(
              'h-1.5 rounded-pill',
              index === page ? 'w-4 bg-fg-muted' : 'w-1.5 bg-border',
            )}
          />
        ))}
      </View>
    </Card>
  );
}

function StatRow({
  icon,
  label,
  value,
  unit = 'kcal',
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      {icon}
      <View className="flex-1">
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <View className="flex-row items-baseline gap-1">
          <Text variant="heading">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Text>
          <Text variant="caption" tone="subtle">
            {unit}
          </Text>
        </View>
      </View>
    </View>
  );
}
