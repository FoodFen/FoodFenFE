import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { useIsPremium } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { fiberTargetG, progressFraction } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

/**
 * Fiber is Premium-gated.
 *
 * Free accounts see the locked card from the screenshots; Premium accounts see
 * the day's fiber total (which is `null` rather than `0` when unknown — see the
 * `fiberG` note in `src/types/models.ts`).
 */
export function FiberSection({ day }: { day: DiaryDay }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const isPremium = useIsPremium();

  if (isPremium) {
    const fiberG = day.totals.fiberG;
    const targetG = fiberTargetG(day.goal.targetKcal);

    return (
      <Card className="flex-row items-center justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text variant="caption" tone="muted">
            {t('dashboard', 'fiber')}
          </Text>
          {fiberG === undefined || fiberG === null ? (
            <Text variant="body" tone="subtle">
              {t('dashboard', 'fiberNoData')}
            </Text>
          ) : (
            <View className="flex-row items-baseline gap-1">
              <Text variant="display" className="text-4xl">
                {Math.round(fiberG)}
              </Text>
              <Text variant="body" tone="muted">
                g
              </Text>
            </View>
          )}
          <Text variant="caption" tone="subtle">
            {t('dashboard', 'fiberGoal').replace('{g}', String(targetG))}
          </Text>
        </View>

        <ProgressRing
          progress={progressFraction(fiberG ?? 0, targetG)}
          size={64}
          strokeWidth={8}
        >
          <Text variant="caption" tone="muted">
            {fiberG === undefined || fiberG === null
              ? '—'
              : `${Math.round(progressFraction(fiberG, targetG) * 100)}%`}
          </Text>
        </ProgressRing>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text variant="caption" tone="muted">
          {t('dashboard', 'fiber')}
        </Text>
        <View className="h-14 w-14 items-center justify-center rounded-full border border-border">
          <Ionicons name="lock-closed" size={20} color={colors.fgSubtle} />
        </View>
      </View>

      <Text variant="display" tone="subtle" className="text-3xl">
        {t('dashboard', 'fiberDailyLevel')}
      </Text>

      <Pressable
        onPress={() => router.push('/premium')}
        accessibilityRole="button"
        className="flex-row items-center justify-center gap-2 border-t border-border pt-3 active:opacity-70"
      >
        <Ionicons name="lock-closed" size={14} color={colors.brand} />
        <Text variant="label" tone="brand">
          {t('dashboard', 'viewFiberIntake')}
        </Text>
      </Pressable>
    </Card>
  );
}
