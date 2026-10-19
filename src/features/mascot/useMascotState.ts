import { useMemo } from 'react';

import { useDiaryDay } from '@/features/diary/queries';
import { freshReaction, useMascotReactionStore } from '@/features/mascot/reactionStore';
import { resolveMealTime } from '@/features/notifications/reconcile';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import { todayKey } from '@/lib/date';
import {
  REACTION_ACTION,
  hungryMeal,
  isThirsty,
  type MascotAction,
  type MascotMeal,
  type MascotReaction,
} from '@/lib/mascot';

export type MascotBubble =
  | { type: 'reaction'; kind: MascotReaction }
  | { type: 'hungry'; meal: MascotMeal }
  | { type: 'thirsty' }
  | null;

/** Today's mascot state, regardless of which day the dashboard has selected. */
export function useMascotState(): { action: MascotAction; bubble: MascotBubble } {
  const userId = useProfileStore((state) => state.profile?.id ?? null);
  const { data: day } = useDiaryDay(todayKey());
  const pending = useMascotReactionStore((state) => state.pending);
  const reminders = useSettingsStore((state) => state.reminders);
  const enabled = useSettingsStore((state) => state.mascotRemindersEnabled);
  const wake = useSettingsStore((state) => state.mascotWakeTime);
  const sleep = useSettingsStore((state) => state.mascotSleepTime);
  const lagPct = useSettingsStore((state) => state.mascotWaterLagPct);

  const mealTimes = useMemo(() => {
    if (!userId) return null;

    const timeFor = (meal: MascotMeal) =>
      resolveMealTime(
        userId,
        meal,
        reminders.find((r) => r.kind === 'meal' && r.meal === meal)?.time ?? null,
      );

    return { breakfast: timeFor('breakfast'), lunch: timeFor('lunch'), dinner: timeFor('dinner') };
    // `day` is not read inside; it changes after a log so the stored medians refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reminders, day]);

  const reaction = freshReaction(pending);

  if (reaction) {
    return {
      action: REACTION_ACTION[reaction.kind],
      bubble: { type: 'reaction', kind: reaction.kind },
    };
  }

  if (!enabled || !day || !mealTimes) return { action: 'idle', bubble: null };

  const now = new Date();

  const meal = hungryMeal({
    now,
    times: mealTimes,
    loggedMeals: day.entries.map((entry) => entry.mealType),
  });

  if (meal) return { action: 'hungry', bubble: { type: 'hungry', meal } };

  if (
    isThirsty({
      now,
      wake,
      sleep,
      waterMl: day.waterMl,
      targetWaterMl: day.goal.targetWaterMl,
      lagPct,
    })
  ) {
    return { action: 'thirsty', bubble: { type: 'thirsty' } };
  }

  return { action: 'idle', bubble: null };
}
