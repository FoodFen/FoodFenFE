import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { BounceIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

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
    // Pushed one screen deeper than the manual/search/activity entry point it
    // came from. A `POP` only bubbles to close the whole modal once the local
    // "log" stack is already down to its single first screen — any count is
    // otherwise clamped and handled locally (see expo-router's StackRouter) —
    // so this takes two separate pops, not one `dismiss(2)`: the first lands
    // on that first screen, the second is what actually bubbles and closes
    // the modal. `dismissLogFlow` in `src/features/gamification/queries.ts`
    // is the one-pop version, for the entry points one screen shallower.
    router.dismiss();
    router.dismiss();
  };

  const hideProgress = () => {
    setHideChallengeProgress(true);
    finish();
  };

  return (
    <View className="flex-1 justify-between bg-bg p-4">
      <View className="gap-4 pt-6">
        <Animated.View entering={ZoomIn.duration(300)}>
          <Text variant="title" className="text-center">
            {t('interstitial', 'title')}
          </Text>
        </Animated.View>

        {quests.map((quest, index) => (
          <Animated.View key={quest.id} entering={FadeInDown.delay(index * 90).duration(280)}>
            <Card className="gap-2">
              <View className="flex-row items-baseline justify-between">
                <Text variant="heading">{questTitle(t, quest.questType)}</Text>
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
                {questDescription(t, quest)}
              </Text>
              <ProgressBar progress={progressFraction(quest.progress, quest.target)} />
              <Text variant="caption" tone="subtle">
                {quest.progress}/{quest.target}
              </Text>
            </Card>
          </Animated.View>
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
