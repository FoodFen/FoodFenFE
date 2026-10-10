import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { colorsFor } from '@/theme/colors';

import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  /** An Ionicons glyph name — reads as an illustration without shipping an asset. */
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <View className={cn('items-center gap-2 px-8 py-12', className)}>
      {icon ? <Ionicons name={icon} size={40} color={colors.fgSubtle} /> : null}

      <Text variant="heading" className="text-center">
        {title}
      </Text>

      {description ? (
        <Text variant="body" tone="muted" className="text-center">
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} className="mt-4" size="sm" />
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}

/** The failure counterpart to `EmptyState`, with a retry affordance. */
export function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="alert-circle-outline"
      title={title ?? t('common', 'somethingWentWrong')}
      description={description}
      actionLabel={onRetry ? t('common', 'retry') : undefined}
      onAction={onRetry}
      className={className}
    />
  );
}
