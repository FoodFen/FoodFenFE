// src/data/notificationRepository.ts
import { and, eq, gte } from 'drizzle-orm';

import { db } from '@/db/client';
import { activityLog, foodEntry, waterLog } from '@/db/schema';
import { shiftDateKey, todayKey } from '@/lib/date';
import type { TimeOfDay } from '@/lib/notificationScheduler';

import { notDeleted } from './sync';

/**
 * Read-only queries over logging history, feeding the adaptive notification
 * schedule. SQLite has no MEDIAN() aggregate, so both functions pull the raw
 * timestamps for the window and compute the median in JS — the same
 * "pull rows, compute in JS" shape `recalculateTotals` already uses.
 */

const MIN_SAMPLES = 3;

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  // Non-null: both callers only invoke `median` after checking their row
  // count is at least MIN_SAMPLES, so `sorted` is never empty here.
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function toTimeOfDay(minutes: number): TimeOfDay {
  const rounded = Math.round(minutes);

  return { hour: Math.floor(rounded / 60), minute: rounded % 60 };
}

/**
 * Median time-of-day this user has logged `mealType`, over the last `days`
 * days. Null if fewer than 3 live entries exist in that window — not enough
 * signal to trust over the fixed default.
 */
export function medianMealTime(
  userId: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  days = 14,
): TimeOfDay | null {
  // `days` calendar days inclusive of today: today, today-1, ..., today-(days-1).
  const since = shiftDateKey(todayKey(), -(days - 1));

  const rows = db
    .select({ loggedAt: foodEntry.loggedAt })
    .from(foodEntry)
    .where(
      and(
        eq(foodEntry.userId, userId),
        eq(foodEntry.mealType, mealType),
        gte(foodEntry.loggedOn, since),
        notDeleted(foodEntry),
      ),
    )
    .all();

  if (rows.length < MIN_SAMPLES) return null;

  return toTimeOfDay(median(rows.map((row) => minutesOfDay(row.loggedAt))));
}

/**
 * Median time-of-day of each day's *last* log — food, activity, or water,
 * whichever was latest — over the last `days` days. Null if fewer than 3
 * distinct days have any data.
 */
export function medianLastLogTime(userId: string, days = 14): TimeOfDay | null {
  // `days` calendar days inclusive of today: today, today-1, ..., today-(days-1).
  const since = shiftDateKey(todayKey(), -(days - 1));

  const rows = [
    ...db
      .select({ loggedOn: foodEntry.loggedOn, loggedAt: foodEntry.loggedAt })
      .from(foodEntry)
      .where(
        and(eq(foodEntry.userId, userId), gte(foodEntry.loggedOn, since), notDeleted(foodEntry)),
      )
      .all(),
    ...db
      .select({ loggedOn: activityLog.loggedOn, loggedAt: activityLog.loggedAt })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.userId, userId),
          gte(activityLog.loggedOn, since),
          notDeleted(activityLog),
        ),
      )
      .all(),
    ...db
      .select({ loggedOn: waterLog.loggedOn, loggedAt: waterLog.loggedAt })
      .from(waterLog)
      .where(and(eq(waterLog.userId, userId), gte(waterLog.loggedOn, since), notDeleted(waterLog)))
      .all(),
  ];

  const lastPerDay = new Map<string, Date>();

  for (const row of rows) {
    const existing = lastPerDay.get(row.loggedOn);

    if (!existing || row.loggedAt.getTime() > existing.getTime()) {
      lastPerDay.set(row.loggedOn, row.loggedAt);
    }
  }

  if (lastPerDay.size < MIN_SAMPLES) return null;

  return toTimeOfDay(median(Array.from(lastPerDay.values()).map(minutesOfDay)));
}
