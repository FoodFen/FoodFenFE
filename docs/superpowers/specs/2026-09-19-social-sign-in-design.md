# Social sign-in (Google + Apple) — design

Status: approved by user, ready for implementation planning.

## Context

`src/features/auth/store.ts` (`useAuthStore`) already handles email/password
sign-in, sign-up, sign-out, session persistence in `expo-secure-store`, and
401-triggered token refresh — but only via `authApi.signIn`/`authApi.signUp`.
Google and Apple sign-in are new native-SDK entry points into that same
session machinery, not a new auth concept: whatever provider the user
authenticates with, the result is the same `RemoteAuthSession` (`accessToken`,
`refreshToken`, `expiresAt`, `user`), stored and refreshed exactly as today.

Like every other server-backed feature in this codebase right now (chat,
and the existing email/password flow itself), the backend endpoint this
depends on **does not exist yet**. This document is split in two for that
reason: a design for the client work this session owns, and a self-contained
contract at
[`docs/backend-contracts/social-sign-in.md`](../../backend-contracts/social-sign-in.md)
written so a future backend session can implement against it directly.

## Scope

**In scope:**
- Google sign-in via `@react-native-google-signin/google-signin` (free
  tier — the standard, well-documented library; its free tier still uses
  Android's legacy, Google-deprecated-but-not-yet-removed Google Sign-In SDK
  rather than Credential Manager, which that library only supports in a paid
  tier. Accepted deliberately: the legacy SDK still works today with no
  removal date announced, and re-evaluating this choice is cheap later since
  it's isolated to one provider file, same shape as `src/lib/health/`'s
  per-platform providers).
- Apple sign-in via `expo-apple-authentication` — the official Expo module,
  required on iOS the moment any other third-party sign-in option exists on
  that platform (App Store Review Guideline 4.8).
- One new button pair ("Continue with Google" / "Continue with Apple") on
  both `app/(auth)/sign-in.tsx` and `app/(auth)/sign-up.tsx` — identical on
  both screens, since a social provider creates-or-signs-in an account in one
  step; there is no meaningful sign-in-vs-sign-up distinction for it.
- One new backend endpoint, `POST /auth/social`, added to `authApi` and
  called by one new `useAuthStore` method, both following the exact shape
  `signIn`/`signUp` already use.

**Explicitly not in scope for this pass:**
- Merging a social provider's profile photo/name into the *local* profile
  (`useProfileStore`). That store is deliberately separate from the account
  session (see `CLAUDE.md`'s "two orthogonal pieces of identity") and
  reconciling them is a `push sync` problem this codebase already documents
  as not built yet — not something social sign-in should reach into.
- Linking/unlinking a social provider from an existing email/password
  account, or supporting multiple linked providers per account. `POST
  /auth/social` always returns a session for whatever account the identity
  token resolves to; account-linking policy (does a Google sign-in with an
  email that already has a password account merge, conflict, or create a
  second account?) is explicitly the backend session's call — see the
  contract's "left to the backend session" section.
- Migrating Google sign-in to Credential Manager (paid tier) or to
  `expo-auth-session`. Flagged as a live trade-off above, not a TODO.
- A merged single "auth" screen replacing the separate sign-in/sign-up
  screens. Out of scope — adding two buttons to each existing screen is a
  much smaller diff and matches how this codebase treats screen structure as
  something to extend, not restructure, absent a reason tied to the current
  task.

## Client architecture

```
app.config.ts                       — + two config plugins, native setup
src/api/
  schemas.ts                        — no change (reuses authSessionSchema)
  endpoints/auth.ts                 — + socialSignIn(payload)
src/features/auth/
  store.ts                          — + signInWithGoogle(), signInWithApple()
  social.ts                         — the two provider-specific native calls
app/(auth)/
  sign-in.tsx, sign-up.tsx          — + <SocialSignInButtons /> above the form
src/components/auth/
  SocialSignInButtons.tsx           — shared by both screens
```

### `src/features/auth/social.ts` — the two provider calls

A new file, parallel to how `src/lib/health/` isolates per-platform native
calls behind plain functions rather than folding them into the store
directly — `useAuthStore` should not need to know Google's and Apple's SDKs
have different call shapes.

```ts
export async function getGoogleIdToken(): Promise<string> {
  // GoogleSignin.hasPlayServices(), GoogleSignin.signIn(), extract idToken.
  // Throws on cancellation/failure — the store maps that to no state change.
}

export interface AppleCredential {
  identityToken: string;
  fullName?: string;
  email?: string;
}

export async function getAppleCredential(): Promise<AppleCredential> {
  // AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL] }).
  // fullName/email are only ever populated on the user's first authorization
  // for this app — must be captured and forwarded here, since Apple never
  // sends them again on a later sign-in with the same Apple ID.
}
```

Nothing here is pure/testable — same reasoning `src/lib/health/*.ts` already
established for thin native-SDK wrappers in this codebase: verified by the
type checker and a real device, not Jest.

### `useAuthStore` additions

```ts
signInWithGoogle: () => Promise<void>;
signInWithApple: () => Promise<void>;
```

Each: call the matching function in `social.ts`, pass the result to
`authApi.socialSignIn({ provider, idToken, fullName?, email? })`, then
`persistSession` + `set({ session, status: 'authenticated' })` — the exact
same two lines `signIn`/`signUp` already end with. A user cancelling the
native picker (tapping outside, pressing back) must not surface as an error
screen: both provider functions' promise rejection for a plain cancellation
(each SDK has its own "user cancelled" error code/type) is caught here and
treated as a no-op, not passed to the caller as a thrown error — only a
genuine failure (network, invalid token, server rejection) propagates.

### UI: `SocialSignInButtons`

One shared component, rendered identically above the existing form in both
`sign-in.tsx` and `sign-up.tsx`, with a "or" divider between it and the
email/password fields below. Both providers require their own official
button, not a hand-rolled recreation — Google's branding guidelines
mandate exact logo/wordmark/color/padding specs and their brand review can
reject a non-conforming custom button, and Apple's Human Interface
Guidelines require the same for its button. Use each SDK's own component
rather than styling a `Pressable` to match:
- Google: `@react-native-google-signin/google-signin`'s own
  `GoogleSigninButton`.
- Apple: `expo-apple-authentication`'s own `AppleAuthenticationButton`.

```tsx
<AppleAuthenticationButton
  buttonType={AppleAuthenticationButtonType.CONTINUE}
  buttonStyle={resolved === 'dark' ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK}
  cornerRadius={/* match this app's existing Button radius token */}
  style={{ height: 48 }}
  onPress={() => void signInWithApple()}
/>
```

Apple's button only renders on iOS (`AppleAuthentication.isAvailableAsync()`
guards it, matching the pattern `src/lib/health/healthKit.ts` already uses
for an iOS-only capability check) — Android renders only the Google button.

Both buttons show a loading state and route failures through the same
inline `formError` state each screen already has, via `isApiError`/
`error.userMessage` — no new error-display pattern.

### Native configuration

Both require `app.config.ts` changes and a dev client rebuild (this
project's existing constraint: native config always needs one):

- `@react-native-google-signin/google-signin`'s config plugin, plus a
  `webClientId` (the OAuth 2.0 client ID the backend will verify the token's
  audience against — obtained from Google Cloud Console, not generated by
  this app).
- `expo-apple-authentication`'s config plugin, which adds the
  "Sign In with Apple" capability entitlement.

**Known sharp edge:** a reported iOS bug on the `expo-apple-authentication`
version pinned to this project's Expo SDK 57 line (fixed in a later release
that isn't installable against this project's `expo-modules-core@57`) —
flagged for a smoke test on a real iOS device once one is available, same
"written now, verified later" treatment `src/lib/health/healthKit.ts` already
carries for its own HealthKit code.

## Testing

- `src/features/auth/social.ts` — nothing pure to unit test (thin native-SDK
  wrappers), same convention as `src/lib/health/*.ts`.
- `useAuthStore`'s two new methods follow the same "not independently unit
  tested, exercised as the rest of this store's methods already are"
  convention — `signIn`/`signUp` don't have their own tests today either.
- `SocialSignInButtons` is presentational; no new pure logic to test beyond
  what's already covered by the store.
