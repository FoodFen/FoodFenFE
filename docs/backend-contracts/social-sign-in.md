# Social sign-in — API contract

Full design and rationale: [`2026-09-19-social-sign-in-design.md`](../superpowers/specs/2026-09-19-social-sign-in-design.md).

This section is the complete interface the client is built against. Treat it
as the spec to implement — not a suggestion to redesign — since the client
code already depends on these exact shapes. If a change is needed, it should
come back to a client-side update, not a silent divergence.

## `POST /auth/social`

Exchanges a Google or Apple identity token for the same session shape
`/auth/sign-in` and `/auth/sign-up` already return. `skipAuth` — no bearer
token on this request, it's what establishes one.

Request body:
```json
{
  "provider": "google" | "apple",
  "idToken": "string",
  "fullName": "string | undefined",
  "email": "string | undefined"
}
```

- `idToken` — Google: the ID token from `GoogleSignin.signIn()`. Apple: the
  `identityToken` from `AppleAuthentication.signInAsync()`. Both are signed
  JWTs the backend must verify (issuer, audience/client ID, signature,
  expiry) against the respective provider's public keys — never trust the
  claims without verifying the signature server-side.
- `fullName` / `email` — **Apple only**, and only present on the user's
  *first-ever* authorization for this app's Apple client ID. Apple does not
  include them again on any later sign-in with the same Apple ID, so the
  backend must persist them against the resolved account the first time
  they arrive, since the client has no way to re-supply them later. Absent
  for Google (the ID token itself already carries name/email claims once
  verified).

Response `200` — identical shape to `/auth/sign-in`:
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresAt": 0,
  "user": { "...": "existing user object" }
}
```

Failure responses use this API's existing error body shape (`message`
and/or `errors`) and status-code conventions — no new error kinds. A token
that fails verification (bad signature, wrong audience, expired) should
respond `401`.

## Left to the backend session's own judgment

- **Account resolution/linking policy.** If the identity token's verified
  email matches an existing email/password account, does this sign in to
  that account, reject with a "use your password instead" error, or create
  a second, separate account? Any of the three is a legitimate product
  decision; the client has no opinion and works the same regardless, since
  it only ever sees a returned session.
- **Apple's private relay email addresses.** Apple can return an
  `@privaterelay.appleid.com` address instead of the user's real one if they
  chose to hide it — decide whether/how this is surfaced to the user
  server-side; the client passes through whatever `email` Apple gave it.
- Google Cloud / Apple Developer configuration (OAuth client IDs, the Sign
  In with Apple service ID/key) needed to verify each token's signature —
  provisioning these is a backend/ops task, not something this contract
  dictates.
- Rate limiting and abuse prevention on this endpoint, same as every other
  endpoint in this API.
