import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';
import type { CalculatedTargets } from '@/lib/nutrition';

export interface GoalsPreviewCardProps {
  targets: CalculatedTargets;
  title?: string;
  /** Rendered under the figures — a caveat, a warning, an explanation. */
  footnote?: React.ReactNode;
}

/** The daily targets, shown identically in onboarding and the goals editor. */
export function GoalsPreviewCard({ targets, title, footnote }: GoalsPreviewCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3">
      <Text variant="heading">{title ?? t('profile', 'dailyTargets')}</Text>

      <View className="flex-row items-baseline justify-between">
        <Text variant="body" tone="muted">
          {t('common', 'calories')}
        </Text>
        <Text variant="title">{targets.targetKcal.toLocaleString()}</Text>
      </View>

      <View className="gap-2 border-t border-border pt-3">
        <Row label={t('dashboard', 'protein')} value={`${targets.targetProteinG} g`} />
        <Row label={t('dashboard', 'carbs')} value={`${targets.targetCarbsG} g`} />
        <Row label={t('dashboard', 'fat')} value={`${targets.targetFatG} g`} />
        <Row
          label={t('common', 'water')}
          value={`${targets.targetWaterMl.toLocaleString()} ml`}
        />
      </View>

      {footnote}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text variant="mono">{value}</Text>
    </View>
  );
}
