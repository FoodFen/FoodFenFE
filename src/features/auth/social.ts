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
