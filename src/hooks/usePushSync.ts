import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { pushAll } from '@/data/push';
import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import { useRefreshQuests } from '@/features/gamification/queries';
import { useProfileStore } from '@/features/profile/store';
import { queryKeys } from '@/lib/queryClient';

const PUSH_INTERVAL_MS = 5 * 60 * 1000;
const PUSH_AFTER_WRITE_MS = 1500;

/**
 * Opportunistic push: drains `pendingChangeCount()` to the server whenever
 * the remote path is usable (`canUseRemote()`), on mount, every time the
 * app returns to the foreground, every 5 minutes while foregrounded, and
 * shortly after any mutation succeeds (debounced, so a burst of edits is one
 * push). A trigger that lands mid-push queues behind it (`pushAll` serializes runs).
 * No retry/backoff queue — a row that fails just stays dirty and gets
 * tried again on the next trigger, which is good enough for how
 * infrequently this fires.
 *
 * Signing in re-runs it at once, and every push ends by re-pulling the quests
 * and refetching the dish list: the server measures quest progress and dish
 * fit from the rows it has been sent.
 */
export function usePushSync(): void {
  const profile = useProfileStore((state) => state.profile);
  const signedIn = useAuthStore((state) => state.session !== null);
  const refreshQuests = useRefreshQuests();
  const refreshQuestsRef = useRef(refreshQuests);
  useEffect(() => {
    refreshQuestsRef.current = refreshQuests;
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    const tryPush = () => {
      if (!profile || !canUseRemote()) return;

      console.warn('[push] trigger fired for user', profile.id);

      void pushAll(profile).finally(() => {
        void refreshQuestsRef.current();
        void queryClient.invalidateQueries({ queryKey: queryKeys.dishes.all });
      });
    };

    let writeTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'success') {
        clearTimeout(writeTimer);
        writeTimer = setTimeout(tryPush, PUSH_AFTER_WRITE_MS);
      }
    });

    tryPush();

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') tryPush();
    });
    const interval = setInterval(tryPush, PUSH_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
      clearTimeout(writeTimer);
      unsubscribeMutations();
    };
  }, [profile, signedIn, queryClient]);
}
