import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';

/**
 * React Query assumes a browser: it listens for `window` focus and
 * `navigator.onLine`. Neither exists here, so both signals are supplied from
 * React Native primitives instead.
 *
 * Without this, `refetchOnReconnect` never fires and paused mutations never
 * resume — the app silently stops syncing after a tunnel.
 */
export function useReactQueryBridge(): void {
  // Connectivity. `isInternetReachable` is null until the first probe
  // completes; fall back to `isConnected` so we do not report offline on boot.
  useEffect(() => {
    return onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => {
        setOnline(state.isInternetReachable ?? state.isConnected ?? false);
      }),
    );
  }, []);

  // Foreground/background stands in for window focus.
  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      // The web focus manager handles this itself; only native needs the bridge.
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    };

    const subscription = AppState.addEventListener('change', onChange);

    return () => subscription.remove();
  }, []);
}
