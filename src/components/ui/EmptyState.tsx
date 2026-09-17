import { View } from 'react-native';

import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';

import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  /** A single emoji reads as an illustration without shipping an asset. */
  icon?: string;
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
  return (
    <View className={cn('items-center gap-2 px-8 py-12', className)}>
      {icon ? <Text className="mb-1 text-4xl">{icon}</Text> : null}

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
      icon="⚠️"
      title={title ?? t('common', 'somethingWentWrong')}
      description={description}
      actionLabel={onRetry ? t('common', 'retry') : undefined}
      onAction={onRetry}
      className={className}
    />
  );
}
