import { api } from '@/api/client';
import {
  checkoutResponseSchema,
  paymentPlansResponseSchema,
  paymentStatusResponseSchema,
} from '@/api/schemas';
import type {
  PaymentProvider,
  RemoteCheckoutResponse,
  RemotePaymentStatusResponse,
} from '@/api/schemas';
import type { PlanType } from '@/types/models';

/**
 * PayOS (VietQR) or MoMo checkout — not native Apple/Google IAP. See
 * `docs/backend-contracts/premium-entitlements.md` for the full wire
 * contract this is built against, including why completion arrives via a
 * server-side webhook rather than a push to the client.
 */
export const paymentsApi = {
  /** The plans on sale and what each costs, in VND — the same prices checkout charges. */
  plans: (signal?: AbortSignal) =>
    api.get('payments/plans', { schema: paymentPlansResponseSchema, signal }),

  checkout: (planType: PlanType, provider: PaymentProvider): Promise<RemoteCheckoutResponse> =>
    api.post('payments/checkout', { planType, provider }, { schema: checkoutResponseSchema }),

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
