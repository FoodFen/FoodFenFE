import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ScrollScreen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import type { RingStatus } from '@/features/dashboard/ringStatus';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';

/** Reference for the week strip's status rings — see `src/features/dashboard/ringStatus.ts`. */
export default function RingColorsScreen() {
  const { t } = useTranslation();

  const legend: { status: Exclude<RingStatus, 'future'>; label: string; description: string }[] = [
    {
      status: 'under',
      label: t('ringColors', 'under'),
      description: t('ringColors', 'underDescription'),
    },
    {
      status: 'green',
      label: t('ringColors', 'green'),
      description: t('ringColors', 'greenDescription'),
    },
    {
      status: 'yellow',
      label: t('ringColors', 'yellow'),
      description: t('ringColors', 'yellowDescription'),
    },
    {
      status: 'red',
      label: t('ringColors', 'red'),
      description: t('ringColors', 'redDescription'),
    },
    {
      status: 'empty',
      label: t('ringColors', 'faint'),
      description: t('ringColors', 'faintDescription'),
    },
  ];

  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: t('ringColors', 'title') }} />

      <Text variant="body" tone="muted">
        {t('ringColors', 'intro')}
      </Text>

      <Card className="gap-4">
        {legend.map((row) => (
          <View key={row.status} className="flex-row items-center gap-3">
            <Swatch status={row.status} />
            <View className="flex-1">
              <Text variant="heading">{row.label}</Text>
              <Text variant="body" tone="muted">
                {row.description}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollScreen>
  );
}

const SWATCH_CLASSES: Record<Exclude<RingStatus, 'future'>, string> = {
  empty: 'border-border',
  under: 'border-fg',
  green: 'border-success',
  yellow: 'border-warning',
  red: 'border-danger',
};

function Swatch({ status }: { status: Exclude<RingStatus, 'future'> }) {
  return <View className={cn('h-9 w-9 rounded-full border-2', SWATCH_CLASSES[status])} />;
}
