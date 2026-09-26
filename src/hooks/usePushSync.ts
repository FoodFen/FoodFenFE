import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { pushAll } from '@/data/push';
import { canUseRemote } from '@/data/sync';
import { useProfileStore } from '@/features/profile/store';

/**
 * Opportunistic push: drains `pendingChangeCount()` to the server whenever
 * the remote path is usable (`canUseRemote()`), on mount and every time the
 * app returns to the foreground. No retry/backoff queue — a row that fails
 * just stays dirty and gets tried again on the next trigger, which is good
 * enough for how infrequently this fires.
 */
export function usePushSync(): void {
  const profile = useProfileStore((state) => state.profile);
  const pushingRef = useRef(false);

  useEffect(() => {
    const tryPush = () => {
      if (!profile || !canUseRemote() || pushingRef.current) return;

      pushingRef.current = true;
      console.warn('[push] trigger fired for user', profile.id);

      void pushAll(profile).finally(() => {
        pushingRef.current = false;
      });
    };

    tryPush();

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') tryPush();
    });

    return () => subscription.remove();
  }, [profile]);
}
