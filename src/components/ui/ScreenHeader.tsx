import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

import { Text } from './Text';

/**
 * The modal log flow's own header: a round icon button and a centered title,
 * rendered in JS rather than through native header options.
 *
 * `Stack.Screen`-provided `headerLeft` overrides that change between renders
 * (entry-point screen vs. a step within it) have a one-frame gap where React
 * Navigation's default back button is still showing — tappable, but wired to
 * nothing this flow expects. Rendering the header ourselves, always, removes
 * that race and gives every log screen the same look: `close` for a flow's
 * entry point, `arrow-back` for a step within it.
 */
export function ScreenHeader({
  title,
  icon,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  icon: 'close' | 'arrow-back';
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const insets = useSafeAreaInsets();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <View
      style={{ paddingTop: insets.top + 4 }}
      className="flex-row items-center px-4 pb-2"
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full bg-surface-alt active:opacity-70"
      >
        <Ionicons name={icon} size={20} color={colors.fg} />
      </Pressable>
      <Text variant="heading" numberOfLines={1} className="flex-1 text-center">
        {title}
      </Text>
      <View className="h-9 w-9" />
    </View>
  );
}
