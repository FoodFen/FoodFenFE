import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

export interface StepScreenProps {
  /** 0-based index of the step being shown. */
  stepIndex: number;
  totalSteps: number;
  /** Unique per step — remounts the animated body so it slides in/out. */
  stepKey: string;
  /** Which way the wizard is moving, so the slide direction matches it. */
  direction: 'forward' | 'backward';
  /** Omitted on the first step, where there is nowhere to go back to. */
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  children: React.ReactNode;
}

/**
 * The frame every onboarding step renders into: a top progress bar with a
 * back button, a scrollable, centered middle for the question and its input,
 * and a footer `Continue` button fixed below it.
 */
export function StepScreen({
  stepIndex,
  totalSteps,
  stepKey,
  direction,
  onBack,
  onContinue,
  continueLabel = 'Continue',
  children,
}: StepScreenProps) {
  const insets = useSafeAreaInsets();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <View className="flex-1 bg-bg">
      <View
        className="flex-row items-center gap-3 px-4 pb-2"
        style={{ paddingTop: insets.top + 12 }}
      >
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.fg} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}

        <ProgressBar progress={(stepIndex + 1) / totalSteps} className="flex-1" />

        <Text variant="caption" tone="muted">
          {stepIndex + 1}/{totalSteps}
        </Text>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingTop: 48,
          alignItems: 'center',
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Animated.View
          key={stepKey}
          entering={direction === 'forward' ? SlideInRight : SlideInLeft}
          exiting={direction === 'forward' ? SlideOutLeft : SlideOutRight}
          style={{ width: '100%', alignItems: 'center' }}
        >
          {children}
        </Animated.View>
      </KeyboardAwareScrollView>

      <View
        className="border-t border-border p-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button label={continueLabel} onPress={onContinue} fullWidth size="lg" />
      </View>
    </View>
  );
}
