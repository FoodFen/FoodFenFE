import { ActivityIndicator, Pressable } from 'react-native';
import type { PressableProps } from 'react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

import { Text } from './Text';
import type { TextTone } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand active:bg-brand/85',
  secondary: 'bg-surface-alt border border-border active:bg-border',
  ghost: 'bg-transparent active:bg-surface-alt',
  danger: 'bg-danger active:bg-danger/85',
};

const VARIANT_TEXT_TONE: Record<ButtonVariant, TextTone> = {
  primary: 'onBrand',
  secondary: 'default',
  ghost: 'brand',
  danger: 'onBrand',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  // 44pt minimum height throughout — the smallest reliable touch target.
  sm: 'h-11 px-4 rounded-xl',
  md: 'h-12 px-5 rounded-card',
  lg: 'h-14 px-6 rounded-card',
};

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** Rendered before the label — an icon, usually. */
  leading?: React.ReactNode;
  className?: string;
  /** Set false for a destructive or repeated action where a buzz would annoy. */
  hapticFeedback?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leading,
  className,
  hapticFeedback = true,
  disabled,
  onPress,
  ...props
}: ButtonProps) {
  // A loading button stays visible but must not fire twice.
  const isDisabled = disabled === true || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={(event) => {
        if (hapticFeedback) haptics.selection();
        onPress?.(event);
      }}
      className={cn(
        'flex-row items-center justify-center gap-2',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          // The spinner has to read against the button's own fill, not the page.
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : undefined}
        />
      ) : (
        <>
          {leading}
          <Text variant="label" tone={VARIANT_TEXT_TONE[variant]} className="text-base">
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
