import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { reloadWhenOnline } from '@/lib/network';
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
  actionLoading?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionLoading,
  className,
}: EmptyStateProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <View className={cn('items-center gap-2', className ?? 'px-8 py-12')}>
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
        <Button
          label={actionLabel}
          onPress={onAction}
          loading={actionLoading}
          className="mt-4"
          size="sm"
        />
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

export interface OfflineStateProps {
  description?: string;
  onRetry?: () => Promise<unknown> | void;
  className?: string;
}

/** Shown where a screen has nothing cached and the device is offline; reload re-probes connectivity before retrying. */
export function OfflineState({ description, onRetry, className }: OfflineStateProps) {
  const { t } = useTranslation();
  const [reloading, setReloading] = useState(false);

  const reload = async () => {
    setReloading(true);
    try {
      await reloadWhenOnline(onRetry);
    } finally {
      setReloading(false);
    }
  };

  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={t('common', 'needsConnection')}
      description={description}
      actionLabel={t('common', 'reload')}
      onAction={() => void reload()}
      actionLoading={reloading}
      className={className}
    />
  );
}
