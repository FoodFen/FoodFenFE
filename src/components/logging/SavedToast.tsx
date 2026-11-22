import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useSavedToastStore } from '@/features/diary/savedToastStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

const HIDE_MS = 2000;

/**
 * One instance for the whole app, like `QuestToast`: a short, non-interactive
 * "added to your diary" confirmation any food-save flow triggers through
 * `useSavedToastStore`. Sits at the bottom so it never overlaps `QuestToast`
 * at the top, which can appear a few seconds after the same save.
 */
export function SavedToast() {
  const message = useSavedToastStore((state) => state.message);
  const token = useSavedToastStore((state) => state.token);
  const hide = useSavedToastStore((state) => state.hide);
  const insets = useSafeAreaInsets();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  useEffect(() => {
    if (message === null) return;

    const timer = setTimeout(hide, HIDE_MS);

    return () => clearTimeout(timer);
  }, [message, token, hide]);

  if (message === null) return null;

  return (
    <Animated.View
      key={token}
      entering={FadeInDown.duration(220)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        bottom: insets.bottom + 96,
        left: 16,
        right: 16,
        zIndex: 50,
      }}
    >
      <Card className="flex-row items-center gap-3">
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        <Text variant="label" className="flex-1">
          {message}
        </Text>
      </Card>
    </Animated.View>
  );
}
