import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useInterstitialStore } from '@/features/gamification/interstitialStore';
import { questDescription, questTitle } from '@/features/gamification/selectors';
import { useSettingsStore } from '@/features/settings/store';
import { useTranslation } from '@/hooks/useTranslation';
import { progressFraction } from '@/lib/nutrition';

/**
 * The post-log challenge interstitial (UC-22).
 *
 * Renders whatever `usePostLogInterstitial` already computed and stashed in
 * `useInterstitialStore` — no fetching here, so there is nothing to flash
 * between "just logged" and "here is your progress".
 */
export default function InterstitialScreen() {
  const { t } = useTranslation();
  const quests = useInterstitialStore((state) => state.quests);
  const dismiss = useInterstitialStore((state) => state.dismiss);
  const setHideChallengeProgress = useSettingsStore(
    (state) => state.setHideChallengeProgress,
  );

  const finish = () => {
    dismiss();
    router.dismissAll();
  };

  const hideProgress = () => {
    setHideChallengeProgress(true);
    finish();
  };

  return (
    <View className="flex-1 justify-between bg-bg p-4">
      <View className="gap-4 pt-6">
        <Text variant="title" className="text-center">
          {t('interstitial', 'title')}
        </Text>

        {quests.map((quest) => (
          <Card key={quest.id} className="gap-2">
            <View className="flex-row items-baseline justify-between">
              <Text variant="heading">{questTitle(t, quest.questType)}</Text>
              <Text
                variant="caption"
                tone="brand"
                accessibilityLabel={t('interstitial', 'coinsA11y').replace(
                  '{count}',
                  String(quest.rewardCoins),
                )}
              >
                +{quest.rewardCoins}
              </Text>
            </View>
            <Text variant="body" tone="muted">
              {questDescription(t, quest)}
            </Text>
            <ProgressBar progress={progressFraction(quest.progress, quest.target)} />
            <Text variant="caption" tone="subtle">
              {quest.progress}/{quest.target}
            </Text>
          </Card>
        ))}
      </View>

      <View className="gap-2 pb-4">
        <Button
          label={t('interstitial', 'continue')}
          onPress={finish}
          fullWidth
          size="lg"
        />
        <Button
          label={t('interstitial', 'hideProgress')}
          onPress={hideProgress}
          variant="ghost"
          fullWidth
        />
      </View>
    </View>
  );
}
