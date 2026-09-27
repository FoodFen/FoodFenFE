// src/lib/notificationScheduler.ts
import { setHours, setMilliseconds, setMinutes, setSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';

/**
 * Local, adaptive scheduling for meal and streak reminders. Every trigger is
 * a one-shot date, never a repeating one — the target time itself shifts
 * day to day as the user's logging history changes, so a repeating trigger
 * would go stale.
 */

export interface TimeOfDay {
  hour: number;
  minute: number;
}

export type NotificationId = 'meal-breakfast' | 'meal-lunch' | 'meal-dinner' | 'streak-risk';

/** Fixed fallback used until 3+ days of real history exist for that meal. */
export const DEFAULT_MEAL_TIMES: Record<'breakfast' | 'lunch' | 'dinner', TimeOfDay> = {
  breakfast: { hour: 8, minute: 0 },
  lunch: { hour: 12, minute: 30 },
  dinner: { hour: 19, minute: 0 },
};

/**
 * Fallback "usual last log of the day" until 3+ days of history exist. This
 * is an input to `streakNudgeTime`, not the nudge time itself — it produces
 * a 19:00 nudge (21:00 minus 2h), same as a real user whose history says
 * they usually finish logging around 9pm.
 */
export const DEFAULT_LAST_LOG_TIME: TimeOfDay = { hour: 21, minute: 0 };

const STREAK_NUDGE_LEAD_HOURS = 2;
const STREAK_NUDGE_MIN_HOUR = 17;
const STREAK_NUDGE_MAX_HOUR = 23;

/** `time` set on the given date, seconds/ms zeroed. */
export function atTime(date: Date, time: TimeOfDay): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(date, time.hour), time.minute), 0), 0);
}

/** `time` on the day after `now`. */
export function tomorrowAt(time: TimeOfDay, now: Date = new Date()): Date {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return atTime(tomorrow, time);
}

/** `time` today if that moment hasn't passed yet, else tomorrow. */
export function nextOccurrence(time: TimeOfDay, now: Date = new Date()): Date {
  const today = atTime(now, time);

  return today.getTime() > now.getTime() ? today : tomorrowAt(time, now);
}

/**
 * 2 hours before `lastLogTime`, clamped to [17:00, 23:00] so a user whose
 * usual last log is very early or very late still gets a nudge at a
 * reasonable evening hour rather than mid-morning or past 11pm.
 */
export function streakNudgeTime(lastLogTime: TimeOfDay): TimeOfDay {
  const minutes = lastLogTime.hour * 60 + lastLogTime.minute - STREAK_NUDGE_LEAD_HOURS * 60;
  const clamped = Math.min(
    Math.max(minutes, STREAK_NUDGE_MIN_HOUR * 60),
    STREAK_NUDGE_MAX_HOUR * 60,
  );

  return { hour: Math.floor(clamped / 60), minute: clamped % 60 };
}

/**
 * Cancels any existing notification under `id` (expo-notifications does not
 * dedupe by content) then schedules the new one as a one-shot date trigger.
 */
export async function scheduleAt(
  id: NotificationId,
  at: Date,
  content: { title: string; body: string },
): Promise<void> {
  await cancel(id);

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

export async function cancel(id: NotificationId): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

/** Cancels every pending local notification, regardless of category. */
export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
