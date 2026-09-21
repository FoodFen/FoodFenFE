import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

import { env } from '@/lib/env';

/**
 * Google and Apple sign-in, isolated behind plain async functions so
 * `useAuthStore` never needs to know the two SDKs have different call
 * shapes — the store just awaits a function and gets back a token or
 * `null`. Both return `null` for a plain user cancellation rather than
 * throwing, so the store can treat "the user backed out of the picker" as
 * a no-op instead of a caught error; a genuine failure still throws.
 */

let googleConfigured = false;

function ensureGoogleConfigured(): void {
  if (googleConfigured) return;

  // `iosClientId` is iOS-specific (Android only needs `webClientId`) — it's
  // what makes the native iOS sign-in flow work; `webClientId` is what makes
  // `idToken` available on the response for both platforms.
  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId,
  });
  googleConfigured = true;
}

export async function getGoogleIdToken(): Promise<string | null> {
  if (!env.googleWebClientId) {
    throw new Error('Google sign-in is not configured for this build.');
  }

  ensureGoogleConfigured();

  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  // Verified against the installed version (16.1.5)'s type declarations:
  // `signIn()` resolves `SignInSuccessResponse | CancelledResponse`, a real
  // discriminated union — no thrown-error cancellation path exists here.
  if (isCancelledResponse(response)) return null;

  if (!isSuccessResponse(response)) {
    // Unreachable given the current two-member union, but keeps this
    // resilient if a future version adds a third response type.
    throw new Error('Google sign-in returned an unrecognized response.');
  }

  if (!response.data.idToken) {
    // A resolved, non-cancelled response with no token is a broken
    // response (e.g. misconfigured webClientId), not a cancellation —
    // same distinction `getAppleCredential` draws below.
    throw new Error('Google sign-in did not return an identity token.');
  }

  return response.data.idToken;
}

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
    // Verified against the installed version (expo-apple-authentication@57.0.2):
    // cancellation rejects with an `Error` whose `code` is `ERR_REQUEST_CANCELED`.
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
