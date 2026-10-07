import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { gamificationApi } from '@/api/endpoints/gamification';
import { getEntryCountsByDay } from '@/data/entryRepository';
import * as gamificationRepository from '@/data/gamificationRepository';
import { pushAll } from '@/data/push';
import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import { useInterstitialStore } from '@/features/gamification/interstitialStore';
import { loggingHeatmap, shouldAnnounce } from '@/features/gamification/selectors';
import type { QuestToastEntry } from '@/features/gamification/toastStore';
import { useQuestToastStore } from '@/features/gamification/toastStore';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import { shiftDateKey, todayKey } from '@/lib/date';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryClient';
import type { Quest } from '@/types/models';

function useUserId(): string | null {
  return useProfileStore((state) => state.profile?.id ?? null);
}

/**
 * The `leave` to pass from the routed `log/manual`, `log/search` and
 * `log/activity` screens — always exactly one screen deep in the `log`
 * group, same as those screens' own Cancel buttons.
 *
 * Deliberately the plain `dismiss()` those Cancel buttons already use
 * successfully, not `replace('/')` or `dismissTo('/')`: `replace` swaps the
 * *current* screen for a new instance of the target rather than revealing the
 * dashboard already sitting underneath the modal, so it looked like nothing
 * happened while actually stacking a redundant screen; `dismissTo`/
 * `dismissAll` route through href resolution that can silently no-op from
 * some navigator depths with no error at all. A bare `POP` bubbles to the
 * parent stack when the local one has nothing left to pop, which is exactly
 * "close this modal" here.
 */
export function dismissLogFlow(): void {
  router.dismiss();
}

const announcedCompletions = new Set<string>();

/**
 * True the first time a quest's completion is announced this session. The
 * post-log check and the background pull can both observe the same completion
 * (whichever lands first), and the user must see it once, not twice.
 */
function claimCompletion(questId: string): boolean {
  if (announcedCompletions.has(questId)) return false;

  announcedCompletions.add(questId);

  return true;
}

/**
 * Toast for quests that completed in a pull nobody was waiting on — a push
 * that landed late (an offline log syncing later, or the post-log push losing
 * the race with a foreground one). A quest absent from `before` is the first
 * sync after sign-in/restore, not a fresh completion, so it stays silent.
 */
function announceBackgroundCompletions(quests: Quest[], before: Map<string, Quest>): void {
  if (useSettingsStore.getState().hideChallengeProgress) return;

  const entries: QuestToastEntry[] = quests
    .filter((q) => {
      const prev = before.get(q.id);

      return prev !== undefined && !prev.completed && q.completed && claimCompletion(q.id);
    })
    .map((quest) => ({ quest, completed: true }));

  if (entries.length > 0) useQuestToastStore.getState().show(entries);
}

/**
 * The single exit point every UC-22-triggering log flow calls instead of
 * dismissing the modal stack directly.
 *
 * `leave` is how *this specific caller* gets back to where it started once
 * gamification bookkeeping is done — it has no universal answer, because
 * callers sit at different navigation depths: the routed log screens need
 * `dismissLogFlow` to close the modal stack, while `LogSheet`'s panels and a
 * direct dashboard action (the water cups) never pushed anything and need no
 * navigation at all, so they pass nothing and get the default no-op. Calling
 * `router.dismiss()` unconditionally here — the previous approach — crashed
 * with "POP ... not handled by any navigator" from exactly those callers.
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
 *
 * Quest completion is server-side now (`gamificationRepository.pullQuests`),
 * so it is a network round-trip — and per CLAUDE.md, server sync may never
 * block the UI. `leave()` therefore always fires immediately; the push+pull
 * runs in the background, and whatever it reports (toast, or the full-screen
 * interstitial for a quest type seen for the first time) surfaces once it
 * resolves, a beat after the caller has already moved on.
 */
export function usePostLogInterstitial(leave: () => void = () => {}) {
  const profile = useProfileStore((state) => state.profile);
  const userId = profile?.id ?? null;
  const locale = useSettingsStore((state) => state.locale);
  const present = useInterstitialStore((state) => state.present);
  const showToast = useQuestToastStore((state) => state.show);
  const signedIn = useAuthStore((state) => state.session !== null);
  const queryClient = useQueryClient();

  return () => {
    if (!profile || !userId || !signedIn || !canUseRemote()) {
      leave();
      return;
    }

    const today = todayKey();
    const questsBefore = new Map(
      gamificationRepository.getActiveQuests(userId, today).map((q) => [q.id, q]),
    );

    leave();

    // The server scores quests from the rows it has been sent, so the new log
    // must be pushed before the pull or the pull reports the old progress.
    pushAll(profile)
      .then(() => gamificationRepository.pullQuests(userId, today, locale))
      .then((quests) => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.all });

        // Read at resolve time, not render time: this fires seconds after the
        // log, by which point the closed-over settings can be stale.
        const settings = useSettingsStore.getState();

        if (settings.hideChallengeProgress) return;

        // Completion can flip without progress moving (a ratio quest, or the
        // server settling it), so completion is diffed separately.
        const activeQuestIds = quests.map((q) => q.id);
        const advanced = quests.filter((q) => {
          const prev = questsBefore.get(q.id);

          return q.progress > (prev?.progress ?? 0) || (q.completed && !prev?.completed);
        });

        const unseenTypes = advanced
          .map((q) => q.questType)
          .filter((type) => !settings.seenQuestTypes.includes(type));

        if (unseenTypes.length > 0) {
          for (const quest of advanced) if (quest.completed) claimCompletion(quest.id);
          settings.markQuestTypesSeen(advanced.map((q) => q.questType));
          // `leave` already ran above — the interstitial's own dismiss has
          // nothing further of the caller's to close.
          present(advanced, () => {});
          router.push('/log/interstitial');
          return;
        }

        const entries: QuestToastEntry[] = [];

        for (const quest of advanced) {
          const count = settings.bumpQuestAdvance(quest.id, activeQuestIds);

          if (quest.completed && !claimCompletion(quest.id)) continue;

          if (shouldAnnounce(count, quest.completed)) {
            entries.push({ quest, completed: quest.completed });
          }
        }

        if (entries.length > 0) showToast(entries);
      })
      .catch((error: unknown) => {
        console.error('[usePostLogInterstitial] quest pull failed', error);
      });
  };
}

/** Every quest active right now — today's daily set plus this week's weekly set (UC-23). */
export function useActiveQuests() {
  const userId = useUserId();
  const locale = useSettingsStore((state) => state.locale);
  const today = todayKey();

  return useQuery({
    queryKey: [...queryKeys.gamification.quests(today), locale],
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      return gamificationRepository.getActiveQuests(userId, today);
    },
    enabled: userId !== null,
    retry: false,
  });
}

/**
 * Refreshes today's quests (with their copy in the current language) from the
 * server. Mounted in the tabs layout so it runs in the background from the
 * moment the app opens; `useRefreshQuests` re-triggers it. Separate from
 * `useActiveQuests` so screens render from disk at once and use this only for
 * the skeleton / error states.
 */
export function useQuestsPull() {
  const userId = useUserId();
  const locale = useSettingsStore((state) => state.locale);
  const signedIn = useAuthStore((state) => state.session !== null);
  const queryClient = useQueryClient();
  const today = todayKey();

  return useQuery({
    queryKey: queryKeys.gamification.questSync(today, locale),
    queryFn: async () => {
      if (!userId) throw new Error('No local profile yet.');

      const questsBefore = new Map(
        gamificationRepository.getActiveQuests(userId, today).map((q) => [q.id, q]),
      );

      const quests = await gamificationRepository.pullQuests(userId, today, locale);
      void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.quests(today) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.coins() });

      announceBackgroundCompletions(quests, questsBefore);

      return true;
    },
    enabled: userId !== null && signedIn && env.hasBackend,
    staleTime: 30_000,
    // NetInfo can report "offline" for a reachable dev backend; without this a
    // retry would sit paused forever instead of trying the request.
    networkMode: 'always',
    retry: false,
  });
}

/** Re-runs the quest pull now (no-op while it is already in flight or disabled). */
export function useRefreshQuests() {
  const queryClient = useQueryClient();
  const locale = useSettingsStore((state) => state.locale);

  return () =>
    queryClient.invalidateQueries(
      { queryKey: queryKeys.gamification.questSync(todayKey(), locale) },
      { cancelRefetch: false },
    );
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

type CoinBundles = Awaited<ReturnType<typeof gamificationApi.bundles>>;

/** The coin shop's bundles. Refetched on every open; the query client's persister shows the last answer while it loads. */
export function useCoinBundles() {
  return useQuery<CoinBundles>({
    queryKey: queryKeys.gamification.bundles(),
    queryFn: ({ signal }) => gamificationApi.bundles(signal),
    refetchOnMount: 'always',
    enabled: env.hasBackend,
    retry: false,
  });
}

/** Spend coins on a shop bundle; refreshes the balance and the premium tier on success. */
export function useRedeemCoins() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (days: number) => {
      if (!userId) throw new Error('No local profile yet.');

      await gamificationRepository.redeemCoinsForPremium(userId, days);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.coins() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.premium.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiQuota });
    },
  });
}

/** `weeks` of daily entry counts, gridded for the streak screen's heatmap. */
export function useLoggingHeatmap(weeks = 53) {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.gamification.heatmap(weeks),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      const today = todayKey();
      const from = shiftDateKey(today, -(weeks * 7 - 1));
      const counts = getEntryCountsByDay(userId, from, today);

      return loggingHeatmap(counts, weeks, today);
    },
    enabled: userId !== null,
    retry: false,
  });
}
