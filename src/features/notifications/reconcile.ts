// src/features/notifications/reconcile.ts
import * as entryRepository from '@/data/entryRepository';
import * as gamification from '@/data/gamificationRepository';
import * as notificationRepository from '@/data/notificationRepository';
import { useSettingsStore } from '@/features/settings/store';
import type { DateKey } from '@/lib/date';
import { shiftDateKey, toDateKey } from '@/lib/date';
import { env } from '@/lib/env';
import { translate, type Locale, type Translations } from '@/lib/i18n';
import {
  atTime,
  cancel,
  DEFAULT_LAST_LOG_TIME,
  DEFAULT_MEAL_TIMES,
  nextOccurrence,
  scheduleAt,
  streakNudgeTime,
  tomorrowAt,
} from '@/lib/notificationScheduler';
import type { FoodEntry } from '@/types/models';

type Meal = 'breakfast' | 'lunch' | 'dinner';

const MEAL_IDS: Record<Meal, 'meal-breakfast' | 'meal-lunch' | 'meal-dinner'> = {
  breakfast: 'meal-breakfast',
  lunch: 'meal-lunch',
  dinner: 'meal-dinner',
};

const MEAL_COPY_KEYS: Record<
  Meal,
  { titleKey: keyof Translations['notifications']; bodyKey: keyof Translations['notifications'] }
> = {
  breakfast: { titleKey: 'mealBreakfastTitle', bodyKey: 'mealBreakfastBody' },
  lunch: { titleKey: 'mealLunchTitle', bodyKey: 'mealLunchBody' },
  dinner: { titleKey: 'mealDinnerTitle', bodyKey: 'mealDinnerBody' },
};

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner'];

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
 * at most 4 schedule/cancel calls — so it's safe to call on every trigger
 * point: app boot, after a logging mutation, after a settings toggle flips.
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
    const { mealRemindersEnabled, streakRemindersEnabled, locale } = useSettingsStore.getState();
    const today = toDateKey(now);
    const todaysEntries = entryRepository.getEntriesForDay(userId, today);

    await Promise.all([
      ...MEALS.map((meal) =>
        reconcileMeal(userId, todaysEntries, meal, mealRemindersEnabled, locale, now),
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
  meal: Meal,
  enabled: boolean,
  locale: Locale,
  now: Date,
): Promise<void> {
  const id = MEAL_IDS[meal];

  if (!enabled) {
    await cancel(id);
    return;
  }

  const alreadyLogged = todaysEntries.some((entry) => entry.mealType === meal);

  const time = notificationRepository.medianMealTime(userId, meal) ?? DEFAULT_MEAL_TIMES[meal];
  const { titleKey, bodyKey } = MEAL_COPY_KEYS[meal];

  // Today's occurrence is already satisfied — pre-schedule tomorrow's
  // instead of cancelling outright, so the reminder survives even if the
  // app is never reopened again before then (reconcile only runs at boot,
  // after a log, or after a settings change — nothing reruns it purely
  // because midnight passed).
  const at = alreadyLogged ? tomorrowAt(time, now) : nextOccurrence(time, now);

  await scheduleAt(id, at, {
    title: translate(locale, 'notifications', titleKey),
    body: translate(locale, 'notifications', bodyKey),
  });
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
