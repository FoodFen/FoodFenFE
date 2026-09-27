// src/features/notifications/reconcile.ts
import * as entryRepository from '@/data/entryRepository';
import * as gamification from '@/data/gamificationRepository';
import * as notificationRepository from '@/data/notificationRepository';
import { useSettingsStore } from '@/features/settings/store';
import type { DateKey } from '@/lib/date';
import { todayKey } from '@/lib/date';
import { translate, type Locale, type Translations } from '@/lib/i18n';
import {
  cancel,
  DEFAULT_LAST_LOG_TIME,
  DEFAULT_MEAL_TIMES,
  nextOccurrence,
  scheduleAt,
  streakNudgeTime,
} from '@/lib/notificationScheduler';

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
 * Re-evaluates both notification categories against today's actual state
 * and schedules/cancels accordingly. Cheap — a handful of SQLite reads plus
 * at most 4 schedule/cancel calls — so it's safe to call on every trigger
 * point: app boot, after a logging mutation, after a settings toggle flips.
 */
export async function reconcileNotifications(userId: string): Promise<void> {
  const { mealRemindersEnabled, streakRemindersEnabled, locale } = useSettingsStore.getState();
  const today = todayKey();

  await Promise.all([
    ...MEALS.map((meal) => reconcileMeal(userId, today, meal, mealRemindersEnabled, locale)),
    reconcileStreak(userId, today, streakRemindersEnabled, locale),
  ]);
}

async function reconcileMeal(
  userId: string,
  today: DateKey,
  meal: Meal,
  enabled: boolean,
  locale: Locale,
): Promise<void> {
  const id = MEAL_IDS[meal];

  if (!enabled) {
    await cancel(id);
    return;
  }

  const alreadyLogged = entryRepository
    .getEntriesForDay(userId, today)
    .some((entry) => entry.mealType === meal);

  if (alreadyLogged) {
    await cancel(id);
    return;
  }

  const time = notificationRepository.medianMealTime(userId, meal) ?? DEFAULT_MEAL_TIMES[meal];
  const { titleKey, bodyKey } = MEAL_COPY_KEYS[meal];

  await scheduleAt(id, nextOccurrence(time), {
    title: translate(locale, 'notifications', titleKey),
    body: translate(locale, 'notifications', bodyKey),
  });
}

async function reconcileStreak(
  userId: string,
  today: DateKey,
  enabled: boolean,
  locale: Locale,
): Promise<void> {
  if (!enabled) {
    await cancel('streak-risk');
    return;
  }

  const streak = gamification.getStreak(userId);

  if (!streak || streak.currentStreak === 0 || streak.lastActiveDate === today) {
    await cancel('streak-risk');
    return;
  }

  const lastLogTime = notificationRepository.medianLastLogTime(userId) ?? DEFAULT_LAST_LOG_TIME;

  await scheduleAt('streak-risk', nextOccurrence(streakNudgeTime(lastLogTime)), {
    title: translate(locale, 'notifications', 'streakRiskTitle'),
    body: translate(locale, 'notifications', 'streakRiskBody').replace(
      '{days}',
      String(streak.currentStreak),
    ),
  });
}
