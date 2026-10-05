# MoMo as a second Premium payment method — design

Status: design approved by user (sections 1 + 2); pending written-spec review.

## Context

Premium is bought through PayOS today (`docs/backend-contracts/premium-entitlements.md`):
`POST /payments/checkout` returns a VietQR `qrCode` that `app/premium/payment.tsx`
renders inline, and the screen polls `GET /payments/{orderCode}` until the PayOS
webhook lands. On a phone that is awkward — the user has to scan a QR shown on
the same device they would pay with.

Goal: let the user **choose how to pay**, PayOS or MoMo, where MoMo is its own
gateway (not paid through PayOS). With MoMo the app hands off to the MoMo app,
the user confirms there, MoMo sends them back to FoodFen, and FoodFen detects the
payment on its own.

ZaloPay is the intended third method but is **out of this spec**. This spec builds
the multi-provider seams once, so ZaloPay later is one adapter plus one webhook
route.

## Scope

In:

- Backend (FoodFenBE): a `provider` dimension on payments, a `MomoProvider`
  adapter, a MoMo IPN route, `providers` in the plans response.
- Client (FoodFenFE): a payment-method picker, the MoMo app hand-off with a web
  fallback, one navigation owner on return.
- Contract update in `docs/backend-contracts/premium-entitlements.md`.

Out (not built, no stubs):

- ZaloPay.
- Remembering the user's last chosen method.
- MoMo refunds, recurring/tokenized payments.
- Renaming `PAYOS_MONTHLY_PRICE_VND` / `PAYOS_ANNUAL_PRICE_VND` (they are the
  price for every provider now; the name is cosmetic).
- `app.config.ts` changes — no `canOpenURL`, so no `LSApplicationQueriesSchemes`
  or Android `<queries>` entry.
- New FE tests (manual device test only). Backend tests follow FoodFenBE's own
  conventions.

## Wire contract changes

Unchanged unless listed. Old clients keep working: every addition is optional or
defaulted.

### `GET /payments/plans`

Adds `providers`, the methods currently enabled server-side, in display order:

```json
{
  "plans": [ … unchanged … ],
  "providers": ["payos", "momo"]
}
```

A provider is listed only when its credentials are configured, so enabling or
disabling MoMo is a backend config change, not an app release.

### `POST /payments/checkout`

Request adds `provider` (`"payos" | "momo"`, default `"payos"` when omitted).
A provider that isn't enabled → `422`.

Response:

```json
{
  "orderCode": 0,
  "provider": "payos" | "momo",
  "checkoutUrl": "string",
  "qrCode": "string | null",
  "deeplink": "string | null",
  "amount": 0,
  "planType": "monthly" | "annual",
  "status": "pending"
}
```

- `checkoutUrl` — the provider's hosted web page (PayOS checkout page, or MoMo's
  `payUrl`). Always present.
- `qrCode` — VietQR string; PayOS only, `null` for MoMo.
- `deeplink` — opens the provider's app with the order prefilled; MoMo only,
  `null` for PayOS.

### `GET /payments/{orderCode}`, `POST /payments/{orderCode}/cancel`

Shapes unchanged. Both route to the provider the payment was created with.

MoMo has no cancel API for an unpaid order (it expires on MoMo's side), so
cancelling a MoMo payment only marks our row `cancelled`.

### `POST /payments/webhook/momo` (new, server-to-server)

MoMo's IPN. No bearer token; verified by MoMo's HMAC-SHA256 signature. The
existing `POST /payments/webhook` stays PayOS's route unchanged (it is already
registered at PayOS).

## Backend design (FoodFenBE)

- **`PaymentProvider` enum** (`payos`, `momo`) in `src/domain/enums.py`;
  `Payment.provider` field; `payments.provider` column via an Alembic migration,
  backfilled `payos`, non-null.
- **Port** (`src/application/ports/payment_provider.py`): `CheckoutLinkResult`
  gains `deeplink: str | None`; `qr_code` becomes `str | None`.
  `PaymentProviderProtocol` stays one protocol for all providers.
- **Provider lookup**: the use cases that take a `provider` today
  (`CreateCheckoutUseCase`, `HandlePaymentWebhookUseCase`, the status and cancel
  use cases) take a `dict[PaymentProvider, PaymentProviderProtocol]` holding only
  the configured providers. Create picks by the request, everything else by
  `payment.provider`. The webhook route picks by its path.
- **`MomoProvider`** (`src/infrastructure/payments/momo_provider.py`), against
  MoMo's v2 gateway, `requestType = "captureWallet"`:
  - create: `POST /v2/gateway/api/create`, signed HMAC-SHA256 with the secret
    key over MoMo's alphabetical raw-signature string. Returns `payUrl` →
    `checkout_url`, `deeplink` → `deeplink`.
  - `orderId` = `"FF" + str(order_code)`. The prefix keeps our ids apart from
    other merchants on MoMo's shared sandbox partner code; the epoch-based
    `order_code` (migration 0015) already prevents reuse across our own DBs.
  - `redirectUrl` = `foodfen://premium/return` (config); `ipnUrl` = the public
    URL of `/payments/webhook/momo` (config).
  - status: `POST /v2/gateway/api/query`; `resultCode 0` → paid, MoMo's
    still-pending codes → pending, anything else → failed. The exact
    pending-code list is fixed during implementation from MoMo's result-code
    table.
  - `verify_webhook`: recompute the IPN signature, raise
    `InvalidWebhookSignatureException` on mismatch, map `orderId` back to
    `order_code`.
  - The IPN route answers MoMo with `204 No Content`, as MoMo's IPN contract
    expects.
- **Config**: `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`,
  `MOMO_ENDPOINT` (sandbox vs production base URL), `MOMO_REDIRECT_URL`,
  `MOMO_IPN_URL`. MoMo is enabled only when partner code, access key and secret
  key are all set.
- **Plans**: `ListPlansUseCase` also returns the enabled provider keys, PayOS
  first.

## Client design (FoodFenFE)

### Schemas (`src/api/schemas.ts`)

- `paymentPlansResponseSchema.providers`: parsed as a string array, **unknown
  values filtered out**, defaulting to `['payos']` when absent (an older
  backend). A strict enum would make every installed app fail to parse the
  paywall the day the backend adds `zalopay`.
- `checkoutResponseSchema`: adds `provider`, `deeplink` (nullable); `qrCode`
  becomes nullable.
- The provider type is `z.infer`'d from the schema, not declared separately.

### Endpoint + hook

`paymentsApi.checkout` and `useCheckout` take `{ planType, provider }`.

### `app/premium/payment.tsx`

- **Idle**: a method picker built from `usePaymentPlans().data.providers` (cached
  on-device, so no network wait). The first entry is preselected. Hidden when
  there is only one method, so the screen looks exactly as today for a
  PayOS-only backend.
- **PayOS**: unchanged (inline QR).
- **MoMo**: after checkout, `Linking.openURL(deeplink)`; if that rejects (MoMo
  not installed, or `deeplink` null) →
  `WebBrowser.openAuthSessionAsync(checkoutUrl, 'foodfen://premium/return')`.
  The awaiting stage shows "waiting for payment in MoMo" with **Open MoMo
  again**, **Check status**, **Cancel**, and no QR.
- Status detection is the existing `usePaymentStatus`: a 2.5 s poll while
  pending, plus a refetch on app foreground (`refetchOnWindowFocus`). Nothing
  new is needed there.
- A MoMo `failed`/`cancelled` result renders the existing error state with
  retry.

### `app/premium/return.tsx` — one navigation owner

MoMo's redirect to `foodfen://premium/return` pushes this screen on top of an
open payment screen, and both would then navigate to `/premium/welcome`. Rule:
**while the payment screen is mounted, it alone navigates.** `return.tsx` does
`router.back()` when `router.canGoBack()`; only on a cold launch (nothing to
go back to) does it keep today's refresh-and-route logic.

### Strings

About 5 new keys in `src/lib/i18n/vi.ts` and `src/lib/i18n/en.ts`: method
labels, the MoMo waiting title/description, "Open MoMo again".

## Error handling

| Case | Behaviour |
|---|---|
| MoMo not installed | Web fallback via `openAuthSessionAsync(checkoutUrl)` |
| User cancels inside MoMo | Status becomes `failed`/`cancelled` → existing error state + retry |
| User returns before the IPN arrives | `GET /payments/{orderCode}` reconciles via MoMo's query API |
| User switches back by hand, no redirect | Foreground refetch picks the status up |
| User never returns | Row stays `pending`; MoMo expires the order; a new checkout makes a new row |
| MoMo disabled server-side | Not in `providers`, so not shown; a stale client sending it gets `422` → error state |
| Bad IPN signature | `401`, not applied; MoMo retries |

## Risks to verify first, in the MoMo sandbox

1. **Custom-scheme `redirectUrl`.** If MoMo rejects `foodfen://premium/return`
   as a `redirectUrl`, add a backend HTTPS route that 302s to that deep link
   and use it as `MOMO_REDIRECT_URL`. No client change.
2. **App hand-off on a real device.** Sandbox orders open only in MoMo's UAT
   test app, not the store app.

## Testing

- Backend: per FoodFenBE conventions — signature build/verify and the result-code
  mapping in `MomoProvider` are the logic worth covering.
- Client: `npm run verify`, then a manual run on a device with the MoMo UAT app:
  pay → auto-return → welcome; cancel in MoMo → error + retry; MoMo uninstalled
  → web fallback; PayOS path unchanged.

## Build order

Backend first (the client needs the new contract to exercise anything), then the
client. Coding is delegated to Sonnet subagents per `CLAUDE.md`.
