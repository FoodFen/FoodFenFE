import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { ActivityLogRow } from '@/db/schema';
import { useEnergy } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { getActivityPreset } from '@/lib/activity';
import { colorsFor } from '@/theme/colors';

/**
 * One logged activity for the day — a manual entry or a health-derived one.
 * Only the automatic case gets a small caption; the manual case is the
 * expected default and needs no callout (mirrors FoodEntryRow's layout).
 */
export function ActivityRow({ activity }: { activity: ActivityLogRow }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const energy = useEnergy();
  const colors = colorsFor(resolved);
  const isAutomatic = activity.source !== 'manual';

  const preset = getActivityPreset(activity.activityType);
  const isSteps = activity.activityType === 'steps';
  const label = preset
    ? t('activityPresets', preset.id)
    : isSteps
      ? t('dashboard', 'steps')
      : activity.activityType;
  const icon = preset ? preset.icon : isSteps ? 'footsteps-outline' : 'fitness-outline';

  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={22}
        color={colors.fgMuted}
      />
      <View className="flex-1 gap-0.5">
        <Text variant="body" numberOfLines={1}>
          {label}
        </Text>
        {isAutomatic ? (
          <Text variant="caption" tone="muted">
            {t('dashboard', 'automaticActivity')}
          </Text>
        ) : null}
      </View>

      <Text variant="mono" tone="muted">
        {energy.format(activity.caloriesBurned)} {energy.unit}
      </Text>
    </View>
  );
}
