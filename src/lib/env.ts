import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Runtime configuration, resolved once at module load.
 *
 * Values come from `EXPO_PUBLIC_*` env vars (inlined into the bundle by Metro)
 * with `expo-constants` extra as a fallback for values set in `app.config.ts`.
 * Nothing secret belongs here — everything in this file ships to the device.
 */

/**
 * The Android emulator runs in its own VM: `localhost` there is the emulator,
 * not the development machine. 10.0.2.2 is the emulator's alias for the host.
 */
function resolveApiUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra?.apiUrl as string | undefined);

  if (!configured) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env.local and restart the dev server.',
    );
  }

  if (Platform.OS === 'android') {
    return configured.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
  }

  return configured;
}

function resolveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  apiUrl: resolveApiUrl(),
  apiTimeoutMs: resolveNumber(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, 15_000),
  variant: (Constants.expoConfig?.extra?.variant as string | undefined) ?? 'development',
  isDev: __DEV__,
} as const;
