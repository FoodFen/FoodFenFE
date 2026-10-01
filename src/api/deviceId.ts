import * as SecureStore from 'expo-secure-store';

import { generateLocalId } from '@/lib/id';

/**
 * Anonymous device identity, sent as `X-Device-Id` so the server can count a
 * signed-out user's free AI trials. Keychain, not MMKV, so it survives an app
 * reinstall on iOS — a counter the user can reset by reinstalling is no counter.
 */
const DEVICE_ID_KEY = 'foodfen.device-id';

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);

  if (!id) {
    id = globalThis.crypto?.randomUUID?.() ?? generateLocalId('dev');
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }

  cached = id;
  return id;
}
