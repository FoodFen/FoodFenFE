# Social Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google and Apple sign-in as new entry points into the existing `useAuthStore` session machinery, with official buttons on both `app/(auth)/sign-in.tsx` and `app/(auth)/sign-up.tsx`.

**Architecture:** `src/features/auth/social.ts` isolates the two native SDK calls behind plain async functions (mirroring `src/lib/health/`'s per-platform providers), each returning `null` on a plain user cancellation rather than throwing. `useAuthStore` gains `signInWithGoogle()`/`signInWithApple()`, which call these functions, then `authApi.socialSignIn(...)`, then the exact same `persistSession` + `set({ session, status: 'authenticated' })` `signIn`/`signUp` already end with. `SocialSignInButtons`, a new shared component, renders each provider's own official button and is dropped into both existing auth screens unchanged otherwise.

**Tech Stack:** `@react-native-google-signin/google-signin` (free tier), `expo-apple-authentication`, existing Zustand/Zod/react-hook-form stack.

**Spec:** `docs/superpowers/specs/2026-09-19-social-sign-in-design.md` (client design) and `docs/backend-contracts/social-sign-in.md` (the `POST /auth/social` contract for the backend session).

## Global Constraints

- The backend endpoint this depends on (`POST /auth/social`) does not exist yet — nothing in this plan can be exercised end-to-end against a live server. `npm run verify` (typecheck + lint + tests) is the only automated gate available now.
- Both providers require their own official button component, never a hand-styled `Pressable` — Google's and Apple's brand/HIG guidelines both mandate this, and app/brand review can reject a substitute (spec, "UI: SocialSignInButtons").
- A user cancelling the native picker must be a silent no-op, never a surfaced error (spec, `useAuthStore` additions).
- Apple's `fullName`/`email` are only ever present on a user's first-ever authorization for this app — the client must capture and forward them that one time; they will not come again (contract, `POST /auth/social`).
- No merging of a social provider's name/photo into the local profile (`useProfileStore`) — that's a documented, deliberately out-of-scope reconciliation problem (spec, "Explicitly not in scope").
- Add dependencies with `npx expo install`, never plain `npm install` (CLAUDE.md).
- `android/` and `ios/` are generated and gitignored; every native config change goes through `app.config.ts` (CLAUDE.md).
- Strict TypeScript, no `any` without a justifying comment; `npm run lint` must stay at zero warnings (`--max-warnings=0`); `npm run verify` must pass before any task is considered done.
- Import `src/` through the `@/` alias, never a relative chain across feature boundaries (CLAUDE.md).

---

### Task 1: `authApi.socialSignIn` endpoint

**Files:**
- Modify: `src/api/endpoints/auth.ts`

**Interfaces:**
- Produces: `SocialSignInPayload` interface and `authApi.socialSignIn(payload): Promise<RemoteAuthSession>`, exported from `src/api/endpoints/auth.ts`. Task 4's `useAuthStore` additions call this and nothing else.

No new wire schema — this reuses the existing `authSessionSchema`/`RemoteAuthSession`, already imported in this file. No test file (matches this file's existing convention — `signIn`/`signUp`/etc. have no tests today).

- [ ] **Step 1: Add the payload type and the endpoint**

Add to `src/api/endpoints/auth.ts`, after the existing `SignUpPayload` interface:

```ts
export interface SocialSignInPayload {
  provider: 'google' | 'apple';
  idToken: string;
  /** Apple only, and only present on the user's first-ever authorization —
   * see docs/backend-contracts/social-sign-in.md. */
  fullName?: string;
  email?: string;
}
```

Add to the `authApi` object, after `signUp`:

```ts
  socialSignIn: (payload: SocialSignInPayload): Promise<RemoteAuthSession> =>
    api.post('auth/social', payload, { schema: authSessionSchema, skipAuth: true }),
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/endpoints/auth.ts
git commit -m "Add authApi.socialSignIn, exchanging a provider token for a session"
```

---

### Task 2: Apple sign-in provider

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `app.config.ts`
- Create: `src/features/auth/social.ts`

**Interfaces:**
- Produces: `AppleCredential` interface and `getAppleCredential(): Promise<AppleCredential | null>`, exported from `src/features/auth/social.ts`. Task 4's `useAuthStore.signInWithApple` calls this and nothing else. `null` means the user cancelled; a thrown error means a genuine failure.

Nothing pure to unit-test — a thin wrapper over a native module, same reasoning `src/lib/health/*.ts` already established in this codebase. Verified by the type checker; real behavior verified on a real iOS device later (no such device is available now — same "written now, verified later" treatment `src/lib/health/healthKit.ts` already carries).

- [ ] **Step 1: Install the package**

Run:

```bash
npx expo install expo-apple-authentication
```

- [ ] **Step 2: Wire the config plugin and the iOS capability**

In `app.config.ts`, add `'expo-apple-authentication'` to the `OWN_PLUGINS` array, after `'expo-notifications'`'s entry and before the `expo-build-properties` entry:

```ts
  ['expo-notifications', { color: '#16A34A' }],
  'expo-apple-authentication',
  [
    'expo-build-properties',
```

Add `usesAppleSignIn: true` to the `ios` config block, alongside the existing `bundleIdentifier`/`supportsTablet`/`infoPlist`:

```ts
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
```

- [ ] **Step 3: Implement the provider function**

Create `src/features/auth/social.ts`:

```ts
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Google and Apple sign-in, isolated behind plain async functions so
 * `useAuthStore` never needs to know the two SDKs have different call
 * shapes — same reasoning `src/lib/health/` uses for its per-platform
 * providers. Both return `null` for a plain user cancellation rather than
 * throwing, so the store can treat "the user backed out of the picker" as
 * a no-op instead of a caught error; a genuine failure still throws.
 */

export interface AppleCredential {
  identityToken: string;
  /** Only present on the user's first-ever authorization for this app. */
  fullName?: string;
  email?: string;
}

export async function getAppleCredential(): Promise<AppleCredential | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      // Not a cancellation — a successful resolution with no token is a
      // broken response, not something to silently swallow.
      throw new Error('Apple sign-in did not return an identity token.');
    }

    const fullName = credential.fullName
      ? [credential.fullName.givenName, credential.fullName.familyName]
          .filter((part): part is string => Boolean(part))
          .join(' ')
      : '';

    return {
      identityToken: credential.identityToken,
      fullName: fullName || undefined,
      email: credential.email ?? undefined,
    };
  } catch (error) {
    // Verify this exact code against the installed version's error shape
    // (`node_modules/expo-apple-authentication`'s type declarations) if
    // this check misbehaves — documented as `ERR_REQUEST_CANCELED` at time
    // of writing.
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      return null;
    }

    throw error;
  }
}
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors. If `AppleAuthentication.signInAsync`'s return shape or the cancellation error's `code` field don't match, open
`node_modules/expo-apple-authentication`'s type declarations and adjust only the mismatched field access — the surrounding logic doesn't change.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.config.ts src/features/auth/social.ts
git commit -m "Add the Apple sign-in provider function"
```

---

### Task 3: Google sign-in provider

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `src/lib/env.ts`
- Modify: `app.config.ts`
- Modify: `src/features/auth/social.ts`

**Interfaces:**
- Produces: `getGoogleIdToken(): Promise<string | null>`, exported from `src/features/auth/social.ts` (added alongside Task 2's `getAppleCredential`). Task 4's `useAuthStore.signInWithGoogle` calls this and nothing else. `null` means the user cancelled; a thrown error means a genuine failure (including "not configured").

Same testing note as Task 2 — nothing pure to unit-test, verified by the type checker. **Real device verification additionally needs a live Google Cloud OAuth client**, which does not exist yet; `env.googleWebClientId` is `undefined` until one is provisioned, and this task's code must behave correctly in that state (Google sign-in unavailable, not a crash) rather than assuming a real value is always present.

- [ ] **Step 1: Install the package**

Run:

```bash
npx expo install @react-native-google-signin/google-signin
```

- [ ] **Step 2: Add the optional config value**

In `src/lib/env.ts`, add to the `env` object, after `apiTimeoutMs`:

```ts
  /**
   * The Google Cloud OAuth web client ID `GoogleSignin.configure()` needs to
   * receive an `idToken`. Optional, like `apiUrl` — Google sign-in is simply
   * unavailable (its button hidden) until this is set, rather than crashing.
   */
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
```

- [ ] **Step 3: Wire the config plugin**

In `app.config.ts`, add an entry to the `OWN_PLUGINS` array, after the `'expo-apple-authentication'` entry Task 2 added:

```ts
  'expo-apple-authentication',
  [
    '@react-native-google-signin/google-signin',
    {
      // The reversed form of the iOS OAuth client ID from Google Cloud
      // Console (e.g. "com.googleusercontent.apps.1234567890-abc"). This is
      // a placeholder until a real Google Cloud project exists — Google
      // sign-in on iOS will not work until it's replaced with the real
      // value; this does not block building or running the app otherwise.
      iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME ?? '',
    },
  ],
  [
    'expo-build-properties',
```

- [ ] **Step 4: Implement the provider function**

Add to `src/features/auth/social.ts` (after the existing Apple import and before `AppleCredential`, merge the new import into the top of the file):

```ts
import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
```

Add near the top of the file, before `getAppleCredential`:

```ts
let googleConfigured = false;

function ensureGoogleConfigured(): void {
  if (googleConfigured) return;

  GoogleSignin.configure({ webClientId: env.googleWebClientId });
  googleConfigured = true;
}

export async function getGoogleIdToken(): Promise<string | null> {
  if (!env.googleWebClientId) {
    throw new Error('Google sign-in is not configured for this build.');
  }

  ensureGoogleConfigured();

  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  // Verify `isCancelledResponse`/`isSuccessResponse` and the `response.data`
  // shape against the installed version's type declarations
  // (`node_modules/@react-native-google-signin/google-signin`) — this
  // library has changed its response shape across major versions (a plain
  // thrown "user cancelled" error in older ones, a `{ type, data }`
  // discriminated union in newer ones). Adjust this function's cancellation
  // check and `idToken` field access to match whatever is actually
  // installed; the surrounding control flow (configure once, check Play
  // Services, return `null` on cancellation) doesn't change.
  if (isCancelledResponse(response)) return null;
  if (!isSuccessResponse(response)) return null;

  return response.data.idToken;
}
```

Add `import { env } from '@/lib/env';` to this file's import block if it isn't already there from a prior task.

- [ ] **Step 5: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (after adjusting per Step 4's verification note if the installed version's API differs from what's written above).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/env.ts app.config.ts src/features/auth/social.ts
git commit -m "Add the Google sign-in provider function"
```

---

### Task 4: `useAuthStore` additions

**Files:**
- Modify: `src/features/auth/store.ts`

**Interfaces:**
- Consumes: `getGoogleIdToken` (Task 3), `getAppleCredential` (Task 2), `authApi.socialSignIn` (Task 1).
- Produces: `useAuthStore.getState().signInWithGoogle(): Promise<void>` and `.signInWithApple(): Promise<void>`. Task 5's `SocialSignInButtons` calls these and nothing else.

No new test — `signIn`/`signUp`, the two existing methods with the same shape, have no test today either (matches this store's existing convention).

- [ ] **Step 1: Add the import**

Add to the top of `src/features/auth/store.ts`, alongside the existing imports:

```ts
import { getAppleCredential, getGoogleIdToken } from '@/features/auth/social';
```

- [ ] **Step 2: Add the two methods**

Add to the `AuthState` interface, after `signUp`:

```ts
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
```

Add to the `useAuthStore` store body, after the existing `signUp` implementation and before `signOut`:

```ts
  signInWithGoogle: async () => {
    const idToken = await getGoogleIdToken();
    if (!idToken) return; // User cancelled — not an error.

    const session = await authApi.socialSignIn({ provider: 'google', idToken });

    await persistSession(session);
    set({ session, status: 'authenticated' });
  },

  signInWithApple: async () => {
    const credential = await getAppleCredential();
    if (!credential) return; // User cancelled — not an error.

    const session = await authApi.socialSignIn({
      provider: 'apple',
      idToken: credential.identityToken,
      fullName: credential.fullName,
      email: credential.email,
    });

    await persistSession(session);
    set({ session, status: 'authenticated' });
  },
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/store.ts
git commit -m "Add signInWithGoogle and signInWithApple to useAuthStore"
```

---

### Task 5: `SocialSignInButtons` component

**Files:**
- Modify: `src/lib/i18n/vi.ts`
- Modify: `src/lib/i18n/en.ts`
- Create: `src/components/auth/SocialSignInButtons.tsx`

**Interfaces:**
- Consumes: `useAuthStore().signInWithGoogle`/`.signInWithApple` (Task 4); `isApiError` (existing, from `@/api/errors`); `useAppTheme` (existing, from `@/hooks/useAppTheme`); `env.googleWebClientId` (Task 3, from `@/lib/env`).
- Produces: `export function SocialSignInButtons({ onError }: { onError: (message: string) => void })`, exported from `src/components/auth/SocialSignInButtons.tsx`. Task 6's sign-in/sign-up screens render this and pass their own `formError` setter as `onError`.

- [ ] **Step 1: Add the i18n key**

In `src/lib/i18n/vi.ts`, add one line to the existing `auth` namespace, right after `passwordsMismatchError: 'Mật khẩu không khớp.',` (line 272):

```ts
    orDivider: 'hoặc',
```

In `src/lib/i18n/en.ts`, add the matching line to its own `auth` namespace, right after `passwordsMismatchError: 'Passwords do not match.',` (line 256):

```ts
    orDivider: 'or',
```

- [ ] **Step 2: Write the component**

Create `src/components/auth/SocialSignInButtons.tsx`:

```tsx
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { env } from '@/lib/env';

/**
 * Google and Apple's own official sign-in buttons — never a hand-styled
 * substitute, per both providers' brand/HIG guidelines (see the design
 * spec). Shared by both `app/(auth)/sign-in.tsx` and `sign-up.tsx`, since a
 * social provider creates-or-signs-in an account in one step.
 */
export function SocialSignInButtons({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const signInWithApple = useAuthStore((state) => state.signInWithApple);

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const runProvider = async (provider: 'google' | 'apple', action: () => Promise<void>) => {
    setLoadingProvider(provider);

    try {
      await action();
    } catch (error) {
      onError(isApiError(error) ? error.userMessage : t('auth', 'genericError'));
    } finally {
      setLoadingProvider(null);
    }
  };

  if (!env.googleWebClientId && !appleAvailable) return null;

  return (
    <View className="gap-3">
      {env.googleWebClientId ? (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={isDark ? GoogleSigninButton.Color.Dark : GoogleSigninButton.Color.Light}
          disabled={loadingProvider !== null}
          onPress={() => void runProvider('google', signInWithGoogle)}
        />
      ) : null}

      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            isDark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={8}
          style={{ height: 48, opacity: loadingProvider !== null ? 0.5 : 1 }}
          onPress={() => void runProvider('apple', signInWithApple)}
        />
      ) : null}

      <View className="flex-row items-center gap-3 py-1">
        <View className="h-px flex-1 bg-border" />
        <Text variant="caption" tone="muted">
          {t('auth', 'orDivider')}
        </Text>
        <View className="h-px flex-1 bg-border" />
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Verify it type-checks and lints clean**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings. If `GoogleSigninButton`'s `Size`/`Color` static members or `AppleAuthenticationButton`'s props don't match the installed versions, open each package's type declarations under `node_modules/` and adjust only the mismatched names — the surrounding logic doesn't change.

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/SocialSignInButtons.tsx src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "Add SocialSignInButtons, both providers' official buttons"
```

---

### Task 6: Wire the buttons into the sign-in and sign-up screens

**Files:**
- Modify: `app/(auth)/sign-in.tsx`
- Modify: `app/(auth)/sign-up.tsx`

**Interfaces:**
- Consumes: `SocialSignInButtons` (Task 5).

- [ ] **Step 1: Add to the sign-in screen**

In `app/(auth)/sign-in.tsx`, add the import:

```ts
import { SocialSignInButtons } from '@/components/auth/SocialSignInButtons';
```

Add `<SocialSignInButtons onError={setFormError} />` inside the `<View className="gap-4">` block, as the first child — directly above the existing `<Controller name="email" .../>`:

```tsx
      <View className="gap-4">
        <SocialSignInButtons onError={setFormError} />

        <Controller
          control={control}
          name="email"
          ...
```

- [ ] **Step 2: Add to the sign-up screen**

In `app/(auth)/sign-up.tsx`, make the identical change: add the same import, and add `<SocialSignInButtons onError={setFormError} />` as the first child of its own `<View className="gap-4">` block, directly above the existing `<Controller name="displayName" .../>`.

- [ ] **Step 3: Verify it type-checks and lints clean**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 4: Run the full verify suite**

Run: `npm run verify`
Expected: typecheck, lint, and all unit tests pass — this is the last task, so this is the final gate before the client side of this feature is considered done. There is still no backend to exercise it against, and no live Google Cloud project or real iOS device to fully verify either native path against — those remain manual follow-ups, not blockers for this plan.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/sign-in.tsx" "app/(auth)/sign-up.tsx"
git commit -m "Show Google and Apple sign-in on the sign-in and sign-up screens"
```

---

## After this plan

- The client is code-complete and passes `npm run verify`, but **nothing in
  this feature can be exercised against a live server** — `POST
  /auth/social` does not exist yet. The contract it needs to implement
  against is in `docs/backend-contracts/social-sign-in.md`.
- Three things are flagged rather than guessed at, and should be the first
  things checked once real credentials/devices exist: (1) a real Google
  Cloud OAuth project and web/iOS client IDs need provisioning before
  `env.googleWebClientId`/`GOOGLE_IOS_URL_SCHEME` are anything but
  placeholders (Task 3); (2) `@react-native-google-signin/google-signin`'s
  exact sign-in response shape and cancellation signal, which has changed
  across major versions (Task 3, Step 4); (3) the reported iOS bug on this
  project's pinned `expo-apple-authentication` version, worth a smoke test
  on a real iOS device (design spec, "Native configuration").
- Explicitly out of scope, not gaps: merging a social provider's
  name/photo into the local profile, linking/unlinking multiple providers
  per account, and migrating Google sign-in to Credential Manager — all
  deliberate boundaries per the design spec's "Scope" section.
