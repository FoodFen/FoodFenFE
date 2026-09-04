import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import type { CalculatedTargets } from '@/lib/nutrition';

export interface GoalsPreviewCardProps {
  targets: CalculatedTargets;
  title?: string;
  /** Rendered under the figures — a caveat, a warning, an explanation. */
  footnote?: React.ReactNode;
}

/** The daily targets, shown identically in onboarding and the goals editor. */
export function GoalsPreviewCard({
  targets,
  title = 'Your daily target',
  footnote,
}: GoalsPreviewCardProps) {
  return (
    <Card className="gap-3">
      <Text variant="heading">{title}</Text>

      <View className="flex-row items-baseline justify-between">
        <Text variant="body" tone="muted">
          Calories
        </Text>
        <Text variant="title">{targets.targetKcal.toLocaleString()}</Text>
      </View>

      <View className="gap-2 border-t border-border pt-3">
        <Row label="Protein" value={`${targets.targetProteinG} g`} />
        <Row label="Carbs" value={`${targets.targetCarbsG} g`} />
        <Row label="Fat" value={`${targets.targetFatG} g`} />
        <Row label="Water" value={`${targets.targetWaterMl.toLocaleString()} ml`} />
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
