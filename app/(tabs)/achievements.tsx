import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Placeholder for the achievements tab.
 *
 * The gamification data layer (streaks, quests, coins) exists in
 * `src/data/gamificationRepository.ts` but has no UI yet; this screen is where
 * it will land.
 */
export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-bg">
      <Text variant="title" className="px-4 pt-2">
        {t('achievements', 'title')}
      </Text>
      <EmptyState
        icon="🏅"
        title={t('achievements', 'emptyTitle')}
        description={t('achievements', 'emptyDescription')}
      />
    </View>
  );
}
