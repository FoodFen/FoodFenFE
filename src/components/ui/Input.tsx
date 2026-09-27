import { forwardRef } from 'react';
import { TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';
import { cn } from '@/lib/cn';
import { colorsFor } from '@/theme/colors';

import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  /** Validation message. Its presence puts the field in the error state. */
  error?: string;
  hint?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerClassName?: string;
}

/**
 * Text field with label, hint and error slots.
 *
 * `placeholderTextColor` has to come from JS: React Native does not expose the
 * placeholder as a styleable element, so NativeWind cannot reach it.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, leading, trailing, containerClassName, className, ...props },
  ref,
) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}

      <View
        className={cn(
          'h-12 flex-row items-center gap-2 rounded-card border bg-surface px-3',
          error ? 'border-danger' : 'border-border',
        )}
      >
        {leading}

        <TextInput
          ref={ref}
          className={cn('h-full flex-1 font-sans text-base text-fg', className)}
          placeholderTextColor={colors.fgSubtle}
          // Never let the OS "improve" a food name or an email address.
          autoCorrect={false}
          accessibilityLabel={label}
          {...props}
        />

        {trailing}
      </View>

      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
