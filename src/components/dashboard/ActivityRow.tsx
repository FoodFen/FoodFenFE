import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { ActivityLogRow } from '@/db/schema';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * One logged activity for the day — a manual entry or a health-derived one.
 * Only the automatic case gets a small caption; the manual case is the
 * expected default and needs no callout (mirrors FoodEntryRow's layout).
 */
export function ActivityRow({ activity }: { activity: ActivityLogRow }) {
  const { t } = useTranslation();
  const isAutomatic = activity.source !== 'manual';

  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <View className="flex-1 gap-0.5">
        <Text variant="body" numberOfLines={1}>
          {activity.activityType}
        </Text>
        {isAutomatic ? (
          <Text variant="caption" tone="muted">
            {t('dashboard', 'automaticActivity')}
          </Text>
        ) : null}
      </View>

      <Text variant="mono" tone="muted">
        {activity.caloriesBurned}
      </Text>
    </View>
  );
}
