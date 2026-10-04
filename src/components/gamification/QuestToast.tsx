import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  FadeOutUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { questProgressLabel } from '@/features/gamification/selectors';
import type { QuestToastEntry } from '@/features/gamification/toastStore';
import { useQuestToastStore } from '@/features/gamification/toastStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { progressFraction } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';

const PROGRESS_HIDE_MS = 2600;
/** Longer than a plain progress nudge — there's a beat more to read (and more rows, possibly). */
const COMPLETED_HIDE_MS = 3400;
/** A swipe past this fraction of the screen width dismisses early. */
const SWIPE_DISMISS_THRESHOLD = 0.3;

/**
 * The lightweight second tier of UC-22's post-log notification: once every
 * active quest type has already earned its one full-screen interstitial,
 * further progress shows this instead. One instance for the whole app, like
 * `LogSheet` — any screen can trigger it through `useQuestToastStore`.
 *
 * Carries every quest that advanced from the triggering action (already
 * throttled by `usePostLogInterstitial`), so one log that moves several
 * quests shows them together as stacked rows instead of a burst of separate
 * toasts. A completed row gets a checkmark and a brand accent; swiping the
 * card sideways dismisses it early instead of waiting out the timer.
 */
export function QuestToast() {
  const entries = useQuestToastStore((state) => state.entries);
  const token = useQuestToastStore((state) => state.token);
  const hide = useQuestToastStore((state) => state.hide);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const hasEntries = entries.length > 0;
  const anyCompleted = entries.some((entry) => entry.completed);

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (!hasEntries) return;

    translateX.value = 0;
    const timer = setTimeout(hide, anyCompleted ? COMPLETED_HIDE_MS : PROGRESS_HIDE_MS);

    return () => clearTimeout(timer);
  }, [hasEntries, anyCompleted, token, hide, translateX]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      // eslint-disable-next-line react-hooks/immutability -- a worklet mutating a shared value is the standard Reanimated pattern; the rule doesn't recognize it.
      translateX.value = event.translationX;
    })
    .onEnd(() => {
      const dismissed = Math.abs(translateX.value) > width * SWIPE_DISMISS_THRESHOLD;

      if (dismissed) {
        const target = translateX.value > 0 ? width : -width;

        // eslint-disable-next-line react-hooks/immutability -- see onUpdate above.
        translateX.value = withTiming(target, { duration: 180 }, (finished) => {
          if (finished) runOnJS(hide)();
        });
      } else {
        translateX.value = withTiming(0, { duration: 180 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!hasEntries) return null;

  return (
    <Animated.View
      key={token}
      entering={anyCompleted ? ZoomIn.duration(320) : FadeInDown.duration(220)}
      exiting={FadeOutUp.duration(180)}
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 50,
      }}
    >
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <Card className="gap-3">
            {entries.map((entry, index) => (
              <ToastRow
                key={entry.quest.id}
                entry={entry}
                divider={index > 0}
                t={t}
                colors={colors}
              />
            ))}
          </Card>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

function ToastRow({
  entry,
  divider,
  t,
  colors,
}: {
  entry: QuestToastEntry;
  divider: boolean;
  t: ReturnType<typeof useTranslation>['t'];
  colors: ReturnType<typeof colorsFor>;
}) {
  const { quest, completed } = entry;

  return (
    <View className={divider ? 'gap-2 border-t border-border pt-3' : 'gap-2'}>
      <View className="flex-row items-center gap-2">
        {completed ? (
          <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
        ) : null}

        <Text variant="label" numberOfLines={1} className="flex-1">
          {quest.title}
        </Text>

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

      <Text variant="caption" tone="muted" numberOfLines={2}>
        {quest.description}
      </Text>

      <ProgressBar
        progress={progressFraction(quest.progress, quest.target)}
        color={completed ? colors.brand : undefined}
      />

      <Text variant="caption" tone="subtle">
        {questProgressLabel(quest)}
      </Text>
    </View>
  );
}
