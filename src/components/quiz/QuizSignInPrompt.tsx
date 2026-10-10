import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useTranslation } from '@/hooks/useTranslation';

export function QuizSignInPrompt() {
  const { t } = useTranslation();

  return (
    <Screen>
      <EmptyState
        icon="lock-closed-outline"
        title={t('quiz', 'needsSignIn')}
        actionLabel={t('quiz', 'signIn')}
        onAction={() => router.push('/sign-in')}
      />
    </Screen>
  );
}
