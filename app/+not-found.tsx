import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useTranslation } from '@/hooks/useTranslation';

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <Screen className="justify-center">
      <EmptyState
        icon="🧭"
        title={t('notFound', 'title')}
        description={t('notFound', 'description')}
        actionLabel={t('notFound', 'action')}
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
