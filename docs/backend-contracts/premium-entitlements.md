# Premium entitlements — API contract

No design spec companion — small enough to document directly here, like
[`ai-food-capture.md`](./ai-food-capture.md). Treat it as the spec to
implement; if a change is needed, it should come back to a client-side
update, not a silent divergence.

## Context

Premium already gates two features client-side: the fiber breakdown
(`src/components/dashboard/FiberSection.tsx`, `app/entry/[id].tsx`,
`app/log/meal.tsx`, `app/log/search.tsx`) and typing an ingredient's own
macros by hand instead of picking from the catalog (`app/log/ingredient.tsx`).
Both check `useIsPremium()` (`src/features/profile/store.ts`), which reads
`gamification.resolveTier()` — the local `subscription` table's computed
tier, not the raw `user.subscriptionTier` flag directly. That's the right
thing for this contract to write into, not `user.subscriptionTier` alone.

Two things exist ahead of any backend and are what this contract has to
plug into rather than reinvent:

- **`subscription` table** (`src/db/schema.ts`) — `planType`
  (`'monthly' | 'annual'`), `status` (`'active' | 'canceled' | 'expired' |
  'trial'`), `startDate`/`endDate` (`yyyy-MM-dd`), `price`. It has sync
  columns and is already one of `SYNCED_TABLES` in `src/data/sync.ts`, but
  nothing writes to it yet and no pull path exists for it either.
- **`resolveTier()`** (`src/data/gamificationRepository.ts`) — computes the
  effective tier from that table's latest row (`active`/`trial` and not past
  `endDate`), specifically so an expired subscription downgrades on its own
  without a job rewriting `user.subscription_tier`. It is fully implemented,
  tested, and already wired up behind `useIsPremium()`.
- The purchase/payment screens (`app/premium/index.tsx`,
  `app/premium/payment.tsx`) exist today as a **UI mock**: "Subscribe"
  flips `user.subscription_tier` directly with no charge, no receipt, and no
  server call. This contract is what has to replace that mutation.
- `subscriptionTier` is already part of the `User` object returned by every
  auth endpoint ([`auth.md`](./auth.md)) — sign-in, sign-up, refresh, `/me`.
  Once an account exists, the server is that object's source of truth, and
  since push sync doesn't exist yet, any local flip that never reaches the
  server will be silently overwritten back to `'free'` the next time the
  client refreshes its profile. This is exactly why the mock cannot be left
  as-is once a backend exists.

## A product decision this contract assumes

Every other feature in this app works fully offline with no account
(`docs/backend-contracts/README.md`'s framing, and `CLAUDE.md`'s "local-first
is the design"). Premium can't follow that pattern the same way: the
`subscription` table is keyed on `user.id` (a FoodFend account), not on a
device or a store identity — a purchase has to follow the *account*, so it's
recognized the same way on a second device or the other platform.

That means **redeeming a purchase requires a signed-in FoodFend account**,
same as AI chat already does (`canUseRemote()`) — a small, deliberate
addition to the very short list of things that need one.

**Payment provider is PayOS** (payos.vn), not Apple/Google in-app purchase.
PayOS is a Vietnamese payment gateway: bank-transfer/VietQR checkout, no
StoreKit/Play Billing involved, no 15–30% store cut, no App Store/Play Store
review for the purchase flow itself. This is a deliberate choice for a
Vietnam-market app over native IAP — if that's not the intended product
behavior, this is the thing to revisit before a client session builds
against it. Consequences worth knowing before implementing the client side:

- **No native receipt, no "Restore Purchases."** There's nothing for Apple's
  Guideline 3.1.1 to apply to, since nothing is purchased through the App
  Store. Re-entitlement across a reinstall/new device works because
  `GET /subscriptions/me` is keyed on the account, not a local receipt.
- **Currency is VND only**, server-priced (`PAYOS_MONTHLY_PRICE_VND` /
  `PAYOS_ANNUAL_PRICE_VND` — currently 49,000 / 499,000). There is no
  per-store localized pricing to read; show the price `GET /payments/plans`
  returns (below). The paywall fetches it on every open — nothing is
  hard-coded client-side.
- **The payment itself happens outside the app's normal request/response
  cycle.** `POST /payments/checkout` only starts a PayOS checkout — it
  returns a `checkoutUrl` (open in an in-app browser/WebView) and a
  `qrCode` (bank apps can scan it directly) — the user actually pays on
  PayOS's own page, and PayOS calls the backend's webhook server-to-server
  once that completes. **The client never receives a push for this.** After
  sending the user to `checkoutUrl`, poll `GET /payments/{orderCode}` (or
  `GET /subscriptions/me`) — e.g. on an interval while the checkout
  WebView/browser is open, and once more when the app returns to the
  foreground — until `status` leaves `"pending"`.
- **`returnUrl`/`cancelUrl` are app deep links**, configured server-side
  (`PAYOS_RETURN_URL`/`PAYOS_CANCEL_URL`), that PayOS redirects to once the
  user finishes or backs out of the checkout page. The client needs a deep
  link route registered for whatever these are set to (e.g.
  `foodfen://premium/return`, `foodfen://premium/cancel`) — landing there
  should trigger the same "check status" step above rather than assuming
  success, since a `returnUrl` hit only means the checkout page closed, not
  that PayOS's webhook has necessarily been processed yet.

## Auth

`GET /payments/plans` and `GET /coins/bundles` are public; everything else
below is identical to every other authenticated endpoint: `Authorization: Bearer
<accessToken>`, standard `401` handling (client retries once after a token
refresh, same as everywhere else) — **except** `POST /payments/webhook`,
which PayOS calls directly with no bearer token at all (it's verified by a
PayOS signature server-side instead). The client never calls that endpoint.

## `GET /payments/plans`

**Public** — no token needed (a stray or invalid `Authorization` header is
ignored, never a `401`). The prices the paywall shows.

Response `200`:
```json
{
  "plans": [
    { "planType": "monthly", "priceVnd": 49000 },
    { "planType": "annual", "priceVnd": 499000 }
  ]
}
```

- Always exactly two rows, `monthly` then `annual`. `coin_redeem` is never
  listed (not purchasable; `POST /payments/checkout` rejects it with `422`).
- `priceVnd` — whole VND integer, never null. Global: no user, locale or
  promo input. It is the same number checkout charges; changing it is a
  backend config change, not a data edit.
- No `Cache-Control`/`ETag` — every call is a full `200`, so the client
  refetches on each paywall open and keeps the last answer on-device.
- Errors: only generic `5xx`.

## `GET /coins/bundles`

**Public** — no token needed. The coin shop's redeemable bundles;
`POST /coins/redeem` itself still needs a bearer token.

Response `200`:
```json
{
  "bundles": [
    { "id": "uuid", "days": 10, "coinCost": 600 },
    { "id": "uuid", "days": 30, "coinCost": 1500 }
  ]
}
```

- Active rows only, sorted by `days` ascending. The list is data, so count
  and values can change without an app release — render whatever comes
  back.
- `POST /coins/redeem` takes `{ "days": N }` where `N` matches a bundle's
  `days` (not its `id`); `409` means the balance is too low.
- Errors: only generic `5xx`.

## `GET /quests?date=YYYY-MM-DD&language=vi|en`

**Bearer required.** Signed-out → `401` (`{ "message": "…" }`, treat the
text as non-stable). `date` is the client's local day and is required
(`422` if missing or invalid). `language` is `vi` (default when omitted) or
`en`; any other value is a `422`, not a silent fallback.

Reading has side effects: it lazily issues the day's quests, re-measures
progress from the diary rows already synced to the server, and pays coins on
the request that first completes a quest. Refreshing on every open is
idempotent (a quest pays out once).

Response `200`:
```json
{
  "balance": 1250,
  "quests": [
    {
      "id": "uuid",
      "questType": "drink_water",
      "cadence": "daily",
      "questDate": "2026-10-04",
      "progress": 60,
      "target": 100,
      "rewardCoins": 20,
      "completed": false,
      "completionRatio": 0.8,
      "unit": "percent",
      "title": "string",
      "description": "string"
    }
  ]
}
```

- `title` / `description` — non-null, localized by `language`.
- `unit` — `"percent"` for `hit_calorie_goal`, `hit_protein_goal`,
  `drink_water` (progress and target are percent of the user's goal);
  `"count"` for the rest.
- A weekly quest's `questDate` is that week's Monday. A quest counts as
  `completed` once `progress >= target * completionRatio`, so a completed
  quest can show `progress < target`.
- Ordered by `questType` alphabetically, not by reward. New quest types can
  appear without an app release.

## `POST /payments/checkout`

Starts a PayOS checkout for one plan.

Request:
```json
{ "planType": "monthly" | "annual" }
```

Response `200`:
```json
{
  "orderCode": 0,
  "checkoutUrl": "string",
  "qrCode": "string",
  "amount": 0,
  "planType": "monthly" | "annual",
  "status": "pending"
}
```

- `orderCode` — a numeric id for this checkout attempt. Use it to poll
  `GET /payments/{orderCode}` below.
- `checkoutUrl` — PayOS's hosted payment page. Open it (in-app browser or
  WebView); this is where the user actually authorizes the bank transfer.
- `qrCode` — the same payment encoded as a VietQR string, for a "scan with
  your bank app" affordance alongside/instead of `checkoutUrl`.
- `amount` — VND, server-priced (see above). Always freshly created as
  `"pending"`; there is no draft/resume state.

## `GET /payments/{orderCode}`

Reads a checkout's current status, reconciling with PayOS if it's still
`"pending"` locally (covers a webhook that hasn't arrived yet) — this is the
endpoint to poll after sending the user to `checkoutUrl`.

Response `200`:
```json
{
  "orderCode": 0,
  "status": "pending" | "paid" | "cancelled" | "expired" | "failed",
  "amount": 0,
  "planType": "monthly" | "annual",
  "paidAt": "iso-datetime | null",
  "createdAt": "iso-datetime"
}
```

`status: "paid"` is the signal to stop polling and re-fetch
`GET /subscriptions/me` (below) for the now-updated entitlement. `404` if
`orderCode` doesn't exist or belongs to a different account.

## `POST /payments/{orderCode}/cancel`

Cancels a still-`"pending"` checkout (e.g. the user backs out of the flow).

Request:
```json
{ "cancellationReason": "string | null" }
```

Response `200`: same shape as `GET /payments/{orderCode}`, now with
`status: "cancelled"`. `400` if the checkout isn't `"pending"` anymore
(already paid, already cancelled, etc.) — `404` for the same ownership case
as above.

## `GET /subscriptions/me`

The lightweight entitlement check — what to call after a checkout reaches
`"paid"`, on app foreground, or anywhere `resolveTier()`'s local row needs
refreshing against the server.

Response `200`:
```json
{
  "hasActiveSubscription": true,
  "subscription": {
    "planType": "monthly" | "annual",
    "status": "active" | "canceled" | "expired" | "trial",
    "startDate": "yyyy-MM-dd",
    "endDate": "yyyy-MM-dd | null",
    "price": 0
  }
}
```

`subscription` is `null` (and `hasActiveSubscription: false`) for an account
that has never paid — this is the normal free-tier state, not a `404`. Maps
straight onto `src/db/schema.ts`'s `subscription` row (minus sync columns,
which the client fills in itself), same as `auth.md`'s `User` object does
for `subscriptionTier`.

An **early renewal stacks**: paying again before the current period's
`endDate` extends from that `endDate`, not from today — the client doesn't
need to warn against "wasting" a renewal.

There is currently **no server-side push** for renewal/cancellation/expiry
(no cron, no Apple/Google server notification equivalent) — a lapsed
subscription is only reconciled (flipped back to `free`) the next time this
endpoint, or a request through the Premium-gate dependency server-side, is
actually called. In practice that means: call this on app foreground, not
only right after a purchase.

## Errors

Standard error body and status mapping, same as every other endpoint:
- `400` — malformed request, or an operation invalid for the checkout's
  current status (e.g. cancelling something already paid).
- `401` — see Auth above. Also covers `POST /payments/webhook`'s signature
  check failing — not client-visible, PayOS retries its own webhook calls.
- `402` — reserved for a future Premium-only endpoint (nothing currently
  returns it); the client already has generic handling for status codes it
  doesn't specifically branch on, so no special-case needed yet.
- `404` — `orderCode` doesn't exist, or belongs to a different account
  (treated identically, so existence of another user's checkout isn't
  leaked).
- `5xx` — not currently distinguished from a generic failure; PayOS itself
  being down surfaces as whatever `POST /payments/checkout` / the
  reconciliation call returns, same generic retry message as elsewhere.

## Left to the client session's own judgment

- Polling interval/backoff for `GET /payments/{orderCode}` while the
  checkout WebView is open, and exactly when to also re-check on foreground.
- Deep link route names for `returnUrl`/`cancelUrl` — coordinate the actual
  scheme with whoever sets `PAYOS_RETURN_URL`/`PAYOS_CANCEL_URL` server-side;
  they need to match.
- UI for `checkoutUrl` (in-app browser vs. WebView) vs. `qrCode` (show both?
  let the user pick?).
- Whether/how to surface `"expired"` vs `"cancelled"` vs `"failed"`
  differently, or treat all three as "didn't work, try again."
