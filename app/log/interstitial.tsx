import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import Animated, { BounceIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useInterstitialStore } from '@/features/gamification/interstitialStore';
import { questProgressFraction, questProgressLabel } from '@/features/gamification/selectors';
import { useSettingsStore } from '@/features/settings/store';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * The post-log challenge interstitial (UC-22).
 *
 * Opened only by the quest toast's "See more"; renders whatever the toast
 * was announcing, stashed in `useInterstitialStore` — no fetching here.
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
    router.dismiss();
  };

  const hideProgress = () => {
    setHideChallengeProgress(true);
    finish();
  };

  return (
    <View className="flex-1 bg-bg p-4">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 pb-4 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={ZoomIn.duration(300)}>
          <Text variant="title" className="text-center">
            {t('interstitial', 'title')}
          </Text>
        </Animated.View>

        {quests.map((quest, index) => (
          <Animated.View key={quest.id} entering={FadeInDown.delay(index * 90).duration(280)}>
            <Card className="gap-2">
              <View className="flex-row items-baseline justify-between">
                <Text variant="heading">{quest.title}</Text>
                <Animated.View entering={BounceIn.delay(index * 90 + 200)}>
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
                </Animated.View>
              </View>
              <Text variant="body" tone="muted">
                {quest.description}
              </Text>
              <ProgressBar progress={questProgressFraction(quest)} />
              <Text variant="caption" tone="subtle">
                {questProgressLabel(quest)}
              </Text>
            </Card>
          </Animated.View>
        ))}
      </ScrollView>

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
