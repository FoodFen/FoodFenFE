import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { paymentsApi } from '@/api/endpoints/payments';
import { subscriptionsApi } from '@/api/endpoints/subscriptions';
import * as gamification from '@/data/gamificationRepository';
import { useAuthStore } from '@/features/auth/store';
import { useProfileStore } from '@/features/profile/store';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryClient';
import type { PlanType } from '@/types/models';

/** When the current Premium runs out — `null` for no subscription or one with no end date. */
export function usePremiumEndDate() {
  const userId = useProfileStore((state) => state.profile?.id ?? null);

  return useQuery({
    queryKey: [...queryKeys.premium.all, 'endDate'],
    queryFn: () => gamification.getSubscription(userId as string)?.endDate ?? null,
    enabled: userId !== null,
  });
}

/** The plans on sale and their VND prices — the server's, so there is nothing to show offline. */
export function usePaymentPlans() {
  const signedIn = useAuthStore((state) => state.session !== null);

  return useQuery({
    queryKey: queryKeys.premium.plans(),
    queryFn: ({ signal }) => paymentsApi.plans(signal),
    enabled: signedIn && env.hasBackend,
    retry: false,
  });
}

/** Starts a PayOS checkout for one plan. */
export function useCheckout() {
  return useMutation({
    mutationFn: (planType: PlanType) => paymentsApi.checkout(planType),
  });
}

/** Cancels a still-pending checkout, e.g. when the user backs out. */
export function useCancelPayment() {
  return useMutation({
    mutationFn: ({ orderCode, reason }: { orderCode: number; reason?: string }) =>
      paymentsApi.cancel(orderCode, reason),
  });
}

/**
 * Polls one checkout's status while `enabled`. Refetches every 2.5s as long
 * as the last known status is `"pending"`, and again whenever the app
 * returns to the foreground (via `useReactQueryBridge`'s focus-manager
 * bridge) in case that catches a webhook the interval missed.
 */
export function usePaymentStatus(orderCode: number | null, options: { enabled: boolean }) {
  return useQuery({
    queryKey: queryKeys.premium.payment(orderCode ?? 0),
    queryFn: () => paymentsApi.getStatus(orderCode as number),
    enabled: options.enabled && orderCode !== null,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 2500 : false),
    refetchOnWindowFocus: true,
    retry: false,
  });
}

/**
 * Re-checks the account's entitlement against the server and writes it into
 * the local `subscription` table — the row `resolveTier()` actually reads.
 * Called after a checkout reaches `"paid"`, and is the only place a real
 * purchase's end date comes from (never guessed client-side).
 */
export function useRefreshSubscription() {
  const userId = useProfileStore((state) => state.profile?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await subscriptionsApi.getMe();

      if (userId) {
        if (result.subscription) gamification.startSubscription(userId, result.subscription);
        else gamification.clearSubscriptions(userId);
      }

      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.premium.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiQuota });
    },
  });
}
