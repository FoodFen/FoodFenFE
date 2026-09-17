import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import * as diaryRepository from '@/data/diaryRepository';
import * as gamificationRepository from '@/data/gamificationRepository';
import { useInterstitialStore } from '@/features/gamification/interstitialStore';
import { shouldAnnounce } from '@/features/gamification/selectors';
import type { QuestToastEntry } from '@/features/gamification/toastStore';
import { useQuestToastStore } from '@/features/gamification/toastStore';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import { todayKey } from '@/lib/date';
import { queryKeys } from '@/lib/queryClient';

function useUserId(): string | null {
  return useProfileStore((state) => state.profile?.id ?? null);
}

/**
 * Leave the log modal stack and return to the dashboard, called directly
 * from the manual/search/activity/water entry points — always exactly one
 * screen deep in the `log` group, same as those screens' own Cancel buttons.
 *
 * Deliberately the plain `dismiss()` those Cancel buttons already use
 * successfully, not `replace('/')` or `dismissTo('/')`: `replace` swaps the
 * *current* screen for a new instance of the target rather than revealing the
 * dashboard already sitting underneath the modal, so it looked like nothing
 * happened while actually stacking a redundant screen; `dismissTo`/
 * `dismissAll` route through href resolution that can silently no-op from
 * some navigator depths with no error at all. A bare `POP` bubbles to the
 * parent stack when the local one has nothing left to pop, which is exactly
 * "close this modal" here. `app/log/interstitial.tsx`, pushed one screen
 * deeper than this, calls `router.dismiss(2)` directly for the same reason.
 */
export function dismissLogFlow(): void {
  router.dismiss();
}

/**
 * The single exit point every UC-22-triggering log flow calls instead of
 * dismissing the modal stack directly.
 *
 * Reads today straight from the repository rather than a query hook's
 * `data`: `onSuccess` fires as soon as the write commits, before the
 * invalidated `useDiaryDay` query has had a chance to refetch, so a query
 * hook's snapshot here would be one entry behind — missing the very thing
 * that was just logged.
 *
 * Two-tier notification: a quest type gets the full-screen interstitial
 * exactly once, ever (`seenQuestTypes`); every log after that just shows a
 * small toast with whatever progressed, so the mechanic is taught once and
 * then gets out of the way.
 */
export function usePostLogInterstitial() {
  const userId = useUserId();
  const hideChallengeProgress = useSettingsStore((state) => state.hideChallengeProgress);
  const seenQuestTypes = useSettingsStore((state) => state.seenQuestTypes);
  const markQuestTypesSeen = useSettingsStore((state) => state.markQuestTypesSeen);
  const bumpQuestAdvance = useSettingsStore((state) => state.bumpQuestAdvance);
  const present = useInterstitialStore((state) => state.present);
  const showToast = useQuestToastStore((state) => state.show);
  const queryClient = useQueryClient();

  return () => {
    // Getting back to the dashboard must never depend on quest evaluation or
    // the toast succeeding — both are decorative. Whatever goes wrong below,
    // the catch below still gets the user home; `dismissLogFlow()` a second
    // time is harmless if the first one already ran.
    try {
      if (!userId) {
        dismissLogFlow();
        return;
      }

      const day = diaryRepository.getDiaryDay(userId, todayKey());
      const before = gamificationRepository.getActiveQuests(
        userId,
        day.date,
        day.goal.targetKcal,
      );
      const progressBefore = new Map(before.map((q) => [q.id, q.progress]));

      const quests = gamificationRepository.evaluateQuestProgress(userId, day);

      void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.all });

      if (hideChallengeProgress) {
        dismissLogFlow();
        return;
      }

      const unseenTypes = quests
        .map((q) => q.questType)
        .filter((type) => !seenQuestTypes.includes(type));

      if (unseenTypes.length > 0) {
        markQuestTypesSeen(quests.map((q) => q.questType));
        present(quests);
        router.push('/log/interstitial');
        return;
      }

      dismissLogFlow();

      // A quest that's already completed never changes again (`setQuestProgress`
      // no-ops once `completed`), so "progress went up" is exactly "this action
      // moved it" — no separate before/after completion diff needed.
      const activeQuestIds = quests.map((q) => q.id);
      const advanced = quests.filter((q) => q.progress > (progressBefore.get(q.id) ?? 0));

      const entries: QuestToastEntry[] = [];

      for (const quest of advanced) {
        const count = bumpQuestAdvance(quest.id, activeQuestIds);

        if (shouldAnnounce(count, quest.completed)) {
          entries.push({ quest, completed: quest.completed });
        }
      }

      if (entries.length > 0) showToast(entries);
    } catch (error) {
      console.error('[usePostLogInterstitial] failed, dismissing anyway', error);
      dismissLogFlow();
    }
  };
}

/** Every quest active right now — today's daily set plus this week's weekly set (UC-23). */
export function useActiveQuests() {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.gamification.quests(todayKey()),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      const day = diaryRepository.getDiaryDay(userId, todayKey());

      return gamificationRepository.evaluateQuestProgress(userId, day);
    },
    enabled: userId !== null,
    retry: false,
  });
}

/** The logging streak — current run, longest run, and the day it last advanced. */
export function useStreak() {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.gamification.streak(),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      return gamificationRepository.getStreak(userId) ?? null;
    },
    enabled: userId !== null,
    retry: false,
  });
}
