import { Text as RNText } from 'react-native';
import type { TextProps as RNTextProps } from 'react-native';

import { cn } from '@/lib/cn';

/**
 * Typography.
 *
 * Every string in the app goes through here rather than raw `<Text>`, so type
 * scale and color stay consistent and a font change is a one-file edit.
 */

export type TextVariant =
  | 'display' // The big calorie number.
  | 'title' // Screen titles.
  | 'heading' // Section headers.
  | 'body'
  | 'label' // Form labels, meal names.
  | 'caption' // Secondary metadata.
  | 'mono'; // Numbers in tables, where alignment matters.

export type TextTone =
  'default' | 'muted' | 'subtle' | 'brand' | 'warning' | 'danger' | 'onBrand';

const VARIANT_CLASSES: Record<TextVariant, string> = {
  display: 'font-bold text-5xl leading-tight',
  title: 'font-bold text-2xl leading-snug',
  heading: 'font-semibold text-lg leading-snug',
  body: 'font-sans text-base leading-relaxed',
  label: 'font-medium text-sm leading-snug',
  caption: 'font-sans text-xs leading-normal',
  mono: 'font-medium text-sm tabular-nums',
};

const TONE_CLASSES: Record<TextTone, string> = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  subtle: 'text-fg-subtle',
  brand: 'text-brand',
  warning: 'text-warning',
  danger: 'text-danger',
  onBrand: 'text-on-brand',
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
}

export function Text({
  variant = 'body',
  tone = 'default',
  className,
  ...props
}: TextProps) {
  return (
    <RNText
      className={cn(VARIANT_CLASSES[variant], TONE_CLASSES[tone], className)}
      // Cap system font scaling: past ~1.4x the diary rows collapse, and an
      // unreadable layout serves accessibility worse than a slightly smaller
      // maximum does.
      maxFontSizeMultiplier={1.4}
      {...props}
    />
  );
}
