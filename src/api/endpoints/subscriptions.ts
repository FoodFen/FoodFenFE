import { api } from '@/api/client';
import { subscriptionMeResponseSchema } from '@/api/schemas';
import type { RemoteSubscriptionMeResponse } from '@/api/schemas';

/**
 * The account's current entitlement — `subscription: null` for an account
 * that has never paid, not a 404. See
 * `docs/backend-contracts/premium-entitlements.md`.
 */
export const subscriptionsApi = {
  getMe: (): Promise<RemoteSubscriptionMeResponse> =>
    api.get('subscriptions/me', { schema: subscriptionMeResponseSchema }),
};
