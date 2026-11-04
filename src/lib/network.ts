/**
 * Reload for screens showing a "needs a connection" state. A paused query
 * stays paused while `onlineManager` believes the device is offline, so the
 * connectivity probe has to land in `onlineManager` before the refetch runs.
 */
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

export async function reloadWhenOnline(refetch?: () => Promise<unknown> | void): Promise<void> {
  try {
    const state = await NetInfo.refresh();
    onlineManager.setOnline(state.isInternetReachable ?? state.isConnected ?? false);
  } catch {
    // Probe failed: keep whatever the bridge last reported.
  }

  await refetch?.();
}
