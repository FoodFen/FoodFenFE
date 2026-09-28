import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Runtime configuration, resolved once at module load.
 *
 * Values come from `EXPO_PUBLIC_*` env vars (inlined into the bundle by Metro)
 * with `expo-constants` extra as a fallback for values set in `app.config.ts`.
 * Nothing secret belongs here — everything in this file ships to the device.
 *
 * `apiUrl` is optional on purpose: the app is fully usable offline, with no
 * backend configured at all. Code that talks to the server (auth, and later,
 * sync) must check `env.hasBackend` — or just call `api.*` and handle the
 * resulting `ApiError`, since `src/api/client.ts` fails fast with a clear
 * error when no URL is configured rather than crashing on a malformed one.
 */

/**
 * The Android emulator runs in its own VM: `localhost` there is the emulator,
 * not the development machine. 10.0.2.2 is the emulator's alias for the host.
 */
function resolveApiUrl(): string | undefined {
  const configured =
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra?.apiUrl as string | undefined);

  if (!configured) return undefined;

  if (Platform.OS === 'android') {
    return configured.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
  }

  return configured;
}

function resolveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const apiUrl = resolveApiUrl();

if (__DEV__) {
  console.warn('[env] API URL:', apiUrl ?? '(none configured — offline-only build)');
}

export const env = {
  apiUrl,
  hasBackend: apiUrl !== undefined,
  apiTimeoutMs: resolveNumber(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, 15_000),
  /**
   * The Google Cloud OAuth web client ID `GoogleSignin.configure()` needs to
   * receive an `idToken`. Optional, like `apiUrl` — Google sign-in is simply
   * unavailable (its button hidden) until this is set, rather than crashing.
   */
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  /**
   * The iOS OAuth client ID `GoogleSignin.configure()` needs for the native
   * iOS sign-in flow, separate from `googleWebClientId`. Optional, like
   * `apiUrl` — iOS Google sign-in simply won't work correctly without it.
   */
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  variant: (Constants.expoConfig?.extra?.variant as string | undefined) ?? 'development',
  isDev: __DEV__,
} as const;
