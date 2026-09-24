import { api } from '@/api/client';
import { checkoutResponseSchema, paymentStatusResponseSchema } from '@/api/schemas';
import type { RemoteCheckoutResponse, RemotePaymentStatusResponse } from '@/api/schemas';
import type { PlanType } from '@/types/models';

/**
 * PayOS checkout — VietQR/bank-transfer, not native Apple/Google IAP. See
 * `docs/backend-contracts/premium-entitlements.md` for the full wire
 * contract this is built against, including why completion arrives via a
 * server-side webhook rather than a push to the client.
 */
export const paymentsApi = {
  checkout: (planType: PlanType): Promise<RemoteCheckoutResponse> =>
    api.post('payments/checkout', { planType }, { schema: checkoutResponseSchema }),

  getStatus: (orderCode: number): Promise<RemotePaymentStatusResponse> =>
    api.get(`payments/${orderCode}`, { schema: paymentStatusResponseSchema }),

  cancel: (
    orderCode: number,
    cancellationReason?: string,
  ): Promise<RemotePaymentStatusResponse> =>
    api.post(
      `payments/${orderCode}/cancel`,
      { cancellationReason: cancellationReason ?? null },
      { schema: paymentStatusResponseSchema },
    ),
};
