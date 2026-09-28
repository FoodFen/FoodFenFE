import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import { useRefreshSubscription } from '@/features/premium/queries';
import { useProfileStore } from '@/features/profile/store';

/**
 * Keeps the local `subscription` row honest against the server. Per
 * `docs/backend-contracts/premium-entitlements.md`, there is no server-side
 * push for renewal/cancellation/expiry — a lapsed subscription is only ever
 * reconciled the next time `GET /subscriptions/me` is actually called. This
 * refreshes it on sign-in and on every return to the foreground, the same
 * trigger shape `usePushSync` already uses for the opposite direction.
 */
export function useSubscriptionSync(): void {
  const profile = useProfileStore((state) => state.profile);
  const session = useAuthStore((state) => state.session);
  const { mutate: refreshSubscription } = useRefreshSubscription();
  const refreshingRef = useRef(false);

  useEffect(() => {
    const tryRefresh = () => {
      if (!profile || !session || !canUseRemote() || refreshingRef.current) return;

      refreshingRef.current = true;
      refreshSubscription(undefined, {
        onSettled: () => {
          refreshingRef.current = false;
        },
      });
    };

    tryRefresh();

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') tryRefresh();
    });

    return () => subscription.remove();
  }, [profile, session, refreshSubscription]);
}
