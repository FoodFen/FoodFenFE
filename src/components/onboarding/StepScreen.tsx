import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
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
  /**
   * False for a step whose own buttons already advance the wizard (e.g. an
   * Enable/Skip choice) — a generic Continue below it would be redundant.
   */
  showContinue?: boolean;
  /** False for the closing results screen, which has nothing to go back to and isn't part of the counted progress. */
  showHeader?: boolean;
  /**
   * Vertically centers the content instead of packing it below `paddingTop`.
   * Every step but the closing one has enough content (and a header above it)
   * that top-alignment reads fine; a short, header-less screen like the
   * "calculating" beat looks stranded at the top without this.
   */
  centerContent?: boolean;
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
  continueLabel,
  showContinue = true,
  showHeader = true,
  centerContent = false,
  children,
}: StepScreenProps) {
  const insets = useSafeAreaInsets();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-bg">
      {showHeader ? (
        <View
          className="flex-row items-center gap-3 px-4 pb-2"
          style={{ paddingTop: insets.top + 12 }}
        >
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t('common', 'back')}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color={colors.fg} />
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}

          <ProgressBar progress={(stepIndex + 1) / totalSteps} height={10} className="flex-1" />
        </View>
      ) : null}

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingTop: centerContent ? 16 : 48,
          alignItems: 'center',
          justifyContent: centerContent ? 'center' : 'flex-start',
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

      {showContinue ? (
        <View
          className="border-t border-border p-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Button
            label={continueLabel ?? t('common', 'continue')}
            onPress={onContinue}
            fullWidth
            size="lg"
          />
        </View>
      ) : null}
    </View>
  );
}
