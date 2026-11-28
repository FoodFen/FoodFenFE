// src/features/notifications/reconcile.ts
import { addDays } from 'date-fns';

import * as entryRepository from '@/data/entryRepository';
import * as gamification from '@/data/gamificationRepository';
import * as notificationRepository from '@/data/notificationRepository';
import { useSettingsStore } from '@/features/settings/store';
import type { CustomReminder, MealReminder } from '@/features/settings/store';
import type { DateKey } from '@/lib/date';
import { shiftDateKey, toDateKey } from '@/lib/date';
import { env } from '@/lib/env';
import { translate, type Locale, type Translations } from '@/lib/i18n';
import {
  atTime,
  cancel,
  cancelOrphanedCustom,
  DEFAULT_LAST_LOG_TIME,
  DEFAULT_MEAL_TIMES,
  scheduleAt,
  scheduleDaily,
  streakNudgeTime,
  tomorrowAt,
  type TimeOfDay,
} from '@/lib/notificationScheduler';
import type { FoodEntry } from '@/types/models';

type Meal = 'breakfast' | 'lunch' | 'dinner';

const MEAL_REMINDER_DAYS = 7;

export const MEAL_COPY_KEYS: Record<
  Meal,
  { titleKey: keyof Translations['notifications']; bodyKey: keyof Translations['notifications'] }
> = {
  breakfast: { titleKey: 'mealBreakfastTitle', bodyKey: 'mealBreakfastBody' },
  lunch: { titleKey: 'mealLunchTitle', bodyKey: 'mealLunchBody' },
  dinner: { titleKey: 'mealDinnerTitle', bodyKey: 'mealDinnerBody' },
};

// Minutes of day, [start, end). The learned median is when entries were recorded, not eaten, so
// catch-up logging can skew it far outside the meal's real slot.
const PLAUSIBLE_MEAL_WINDOWS: Record<Meal, [number, number]> = {
  breakfast: [4 * 60, 11 * 60],
  lunch: [11 * 60, 16 * 60],
  dinner: [16 * 60, 24 * 60],
};

export function resolveMealTime(
  userId: string,
  meal: Meal,
  reminderTime: TimeOfDay | null,
): TimeOfDay {
  if (reminderTime) return reminderTime;

  const learned = notificationRepository.medianMealTime(userId, meal);
  if (learned) {
    const minutes = learned.hour * 60 + learned.minute;
    const [start, end] = PLAUSIBLE_MEAL_WINDOWS[meal];
    if (minutes >= start && minutes < end) return learned;
  }

  return DEFAULT_MEAL_TIMES[meal];
}

/**
 * Serializes every call below: two calls fired close together (e.g. two
 * logging mutations completing near-simultaneously) would otherwise
 * interleave their reads and native writes and could leave a stale
 * schedule behind. Each call now fully settles before the next one starts.
 */
let reconcileQueue: Promise<void> = Promise.resolve();

/**
 * Re-evaluates both notification categories against today's actual state
 * and schedules/cancels accordingly. Cheap — a handful of SQLite reads plus
 * a few dozen schedule/cancel calls — so it's safe to call on every trigger
 * point: app boot, returning to the foreground, after a logging mutation,
 * after a settings toggle flips.
 *
 * `now` defaults to the real clock; callers never need to pass it — it
 * exists so tests can pin every date/time decision below instead of
 * depending on the wall clock at run time.
 */
export function reconcileNotifications(userId: string, now: Date = new Date()): Promise<void> {
  const run = reconcileQueue.then(() => reconcileOnce(userId, now));

  reconcileQueue = run;

  return run;
}

async function reconcileOnce(userId: string, now: Date): Promise<void> {
  try {
    const { reminders, streakRemindersEnabled, locale } = useSettingsStore.getState();
    const today = toDateKey(now);
    const todaysEntries = entryRepository.getEntriesForDay(userId, today);

    await Promise.all([
      ...reminders.map((reminder) =>
        reminder.kind === 'meal'
          ? reconcileMeal(userId, todaysEntries, reminder, locale, now)
          : reconcileCustom(reminder),
      ),
      cancelOrphanedCustom(
        new Set(reminders.filter((r) => r.kind === 'custom' && r.enabled).map((r) => r.id)),
      ),
      reconcileStreak(userId, today, streakRemindersEnabled, locale, now),
    ]);
  } catch (error) {
    // Every call site is fire-and-forget (`void reconcileNotifications(...)`)
    // — an uncaught rejection here would otherwise become an unhandled
    // promise rejection with nothing to observe it.
    if (env.isDev) console.warn('[notifications] reconcile failed', error);
  }
}

async function reconcileMeal(
  userId: string,
  todaysEntries: FoodEntry[],
  reminder: MealReminder,
  locale: Locale,
  now: Date,
): Promise<void> {
  const { id, meal } = reminder;
  const slots = Array.from({ length: MEAL_REMINDER_DAYS }, (_, day) => ({
    slotId: `${id}-d${day}` as const,
    day,
  }));

  // The bare `id` is the pre-7-day single trigger; clearing it stops an upgraded install double-firing.
  await cancel(id);

  if (!reminder.enabled) {
    await Promise.all(slots.map(({ slotId }) => cancel(slotId)));
    return;
  }

  const alreadyLogged = todaysEntries.some((entry) => entry.mealType === meal);

  const time = resolveMealTime(userId, meal, reminder.time);
  const { titleKey, bodyKey } = MEAL_COPY_KEYS[meal];
  const content = {
    title: reminder.title ?? translate(locale, 'notifications', titleKey),
    body: reminder.body ?? translate(locale, 'notifications', bodyKey),
  };

  // Nothing reruns reconcile purely because midnight passed, so the whole
  // week is queued up front; today's slot is dropped once logged or passed.
  await Promise.all(
    slots.map(({ slotId, day }) => {
      const at = atTime(addDays(now, day), time);
      const skipToday = day === 0 && (alreadyLogged || at.getTime() <= now.getTime());

      return skipToday ? cancel(slotId) : scheduleAt(slotId, at, content);
    }),
  );
}

async function reconcileCustom(reminder: CustomReminder): Promise<void> {
  if (!reminder.enabled) {
    await cancel(reminder.id);
    return;
  }

  await scheduleDaily(reminder.id, reminder.time, { title: reminder.title, body: reminder.body });
}

async function reconcileStreak(
  userId: string,
  today: DateKey,
  enabled: boolean,
  locale: Locale,
  now: Date,
): Promise<void> {
  if (!enabled) {
    await cancel('streak-risk');
    return;
  }

  const streak = gamification.getStreak(userId);

  if (!streak || streak.currentStreak === 0) {
    await cancel('streak-risk');
    return;
  }

  const lastLogTime = notificationRepository.medianLastLogTime(userId) ?? DEFAULT_LAST_LOG_TIME;
  const nudgeTime = streakNudgeTime(lastLogTime);
  const title = translate(locale, 'notifications', 'streakRiskTitle');
  const body = translate(locale, 'notifications', 'streakRiskBody').replace(
    '{days}',
    String(streak.currentStreak),
  );

  if (streak.lastActiveDate === today) {
    // Safe today — pre-schedule tomorrow's nudge for the same reason meal
    // reminders do: nothing else reruns reconcile purely on day rollover.
    await scheduleAt('streak-risk', tomorrowAt(nudgeTime, now), { title, body });
    return;
  }

  if (streak.lastActiveDate !== shiftDateKey(today, -1)) {
    // The streak already lapsed (a gap of 2+ days, or no active day at
    // all). `recordActiveDay` doesn't reset `currentStreak` until the next
    // log, so a stale row can still report a non-zero streak days after it
    // actually broke — nudging here would show a false streak length.
    await cancel('streak-risk');
    return;
  }

  const nudgeAt = atTime(now, nudgeTime);

  if (nudgeAt.getTime() <= now.getTime()) {
    // The lead-time window already passed today — nothing useful left to
    // warn about before the streak breaks at midnight.
    await cancel('streak-risk');
    return;
  }

  await scheduleAt('streak-risk', nudgeAt, { title, body });
}
