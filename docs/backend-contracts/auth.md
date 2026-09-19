# Email/password auth — API contract

No design spec companion — this contract documents an already-implemented
client (`src/features/auth/store.ts`, `src/api/endpoints/auth.ts`), written
after the fact so it sits alongside the other contracts in this folder
rather than only existing as source code. Treat it as the spec to
implement; if the client's behavior and this doc ever disagree, the client
source is the tiebreaker, and this file should be corrected to match.

Every endpoint here is optional in the product sense — the app tracks fully
offline with no account at all — but each one is a hard requirement the
moment an account exists, since `src/data/sync.ts`'s remote-read path and
[`social-sign-in.md`](./social-sign-in.md)'s `POST /auth/social` all return
into the same session shape defined here.

## Auth conventions shared by every endpoint in this API

- `Authorization: Bearer <accessToken>` on every request except the four
  marked `skipAuth` below (they establish or replace the session, so
  sending a stale token first would be pointless).
- `401` on a missing/expired/invalid token. The client retries **once**:
  it calls `POST /auth/refresh` with the stored refresh token, and if that
  succeeds, replays the original request with the new access token. A
  second `401` after that replay means the session is dead — the client
  drops it and treats the user as signed out. There is no third attempt.
- Failure response body (any non-2xx): `{ "message"?: string, "error"?:
  string, "errors"?: Record<string, string | string[]> }`. `message` (or
  `error` as a fallback) is shown to the user; `errors` is field-keyed
  validation detail — for an array value, the client takes only the first
  message. A `400`/`422` maps to a validation failure, `401` to
  unauthorized, `403` to forbidden, `404` to not found, `429` to rate
  limited, `5xx` to a generic server error — no chat/auth-specific status
  codes beyond these.

## Session shape

Every endpoint that establishes or refreshes a session returns exactly
this, referred to below as `AuthSession`:

```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresAt": 0,
  "user": { "...": "the User object below" }
}
```

`expiresAt` is **epoch milliseconds**, not seconds and not an ISO string —
the client compares it directly against `Date.now()`.

## User shape

```json
{
  "id": 0,
  "email": "string",
  "displayName": "string | null",
  "gender": "male" | "female" | "other",
  "birthYear": 0,
  "unitSystem": "metric" | "imperial",
  "height": 0,
  "weightCurrent": 0,
  "weightGoal": 0,
  "activityLevel": "sedentary" | "light" | "moderate" | "active" | "very_active",
  "dietType": "balanced" | "low_carb" | "high_protein" | "keto" | "vegetarian",
  "calorieCalcMode": "auto" | "manual",
  "calorieLeftMode": "smart" | "all_calories",
  "subscriptionTier": "free" | "premium",
  "weeklyRateKg": 0,
  "createdAt": "ISO 8601 string"
}
```

`height`/`weightCurrent`/`weightGoal` must be strictly positive;
`weeklyRateKg` non-negative. This is the server's copy of the user's
profile, not the device's local one — the two are reconciled by push sync,
which does not exist yet (`src/data/sync.ts`'s own documented gap); until
it does, this object can drift from what the device has on disk, and the
client does not currently attempt to merge them.

## `POST /auth/sign-in` — `skipAuth`

Request:
```json
{ "email": "string", "password": "string" }
```

Response `200`: `AuthSession`.

Wrong email/password should be `401` (the client renders this specifically
as "that email and password do not match," not a generic error) — not
`404`, which would leak whether an email is registered.

## `POST /auth/sign-up` — `skipAuth`

Request:
```json
{ "email": "string", "password": "string", "displayName": "string | undefined" }
```

Response `200`: `AuthSession`.

A duplicate email should come back as a validation failure
(`errors.email`) so the client highlights the email field specifically,
not a generic error banner.

## `POST /auth/refresh` — `skipAuth`

Request:
```json
{ "refreshToken": "string" }
```

Response `200`: `AuthSession` — a full session, including (optionally) a
rotated `refreshToken`. The client always stores whatever `refreshToken`
comes back, so refresh-token rotation is safe to implement; reusing the
same refresh token indefinitely is equally fine — the client has no
opinion on this and doesn't hard-code an expectation either way.

A refresh token that is itself invalid or expired should be `401` (or any
non-2xx) — the client interprets any failure here as "log the user out
locally," never retries a refresh call, and does not distinguish the
failure reason.

## `POST /auth/sign-out`

Request:
```json
{ "refreshToken": "string" }
```

Response: any 2xx (client ignores the body). Should invalidate the given
refresh token server-side. The client clears its local session **before**
this call resolves and treats a failure here as best-effort — the user is
signed out on-device regardless of whether this request succeeds, so a
transient failure to reach the server must never block sign-out.

## `POST /auth/password-reset` — `skipAuth`

Request:
```json
{ "email": "string" }
```

Response: any 2xx (client ignores the body). Should always respond success
regardless of whether the email is registered — the client has no path
for "check your inbox" vs. "no account found," and a differing response
would let the endpoint be used to enumerate registered emails.

## `GET /auth/me`

Response `200`: the `User` object above. Used to refresh the client's copy
of the account's server-side profile without re-authenticating.

## Left to the backend session's own judgment

- Password hashing/storage, minimum complexity beyond what the client
  already enforces client-side (8+ characters, at least one digit — the
  server should still not trust the client and apply its own floor).
- Refresh-token rotation vs. reuse, and refresh-token/access-token
  lifetimes (`expiresAt`'s actual duration).
- Whether sign-up requires email verification before the account is
  considered active, and what an unverified account can do in the
  meantime — the client has no "please verify your email" UI today.
- Rate limiting and abuse prevention on sign-in/sign-up/password-reset
  (brute-force and enumeration protection in particular).
- Session/device management (e.g., can a user have multiple concurrent
  refresh tokens for multiple devices, and can they be revoked
  individually) — the client only ever holds one session at a time.
