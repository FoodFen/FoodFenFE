import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

export default function NotFoundScreen() {
  return (
    <Screen className="justify-center">
      <EmptyState
        icon="🧭"
        title="This screen does not exist"
        description="The link you followed may be broken or the page may have moved."
        actionLabel="Go to your diary"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
