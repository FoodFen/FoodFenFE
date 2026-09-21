import type { DateKey } from '@/lib/date';
import { lastNDays } from '@/lib/date';
import { EMPTY_NUTRITION, sumNutrition } from '@/lib/nutrition';
import type { DiaryDay, FoodEntry, Nutrition } from '@/types/models';

import { getEntriesInRange } from './entryRepository';
import type { ExerciseTotals } from './logRepository';
import { getExerciseByDay, getWaterByDay } from './logRepository';
import { getGoalForDate } from './userRepository';

/**
 * A day of the diary, assembled from the tables that make it up.
 *
 * Nothing is stored at this level — a `DiaryDay` is a view over food entries,
 * water, activity and whichever goal was in force. Assembling it here keeps
 * that composition in one place instead of in every screen that needs a day.
 */

/**
 * No `daily_goal` row is in force for a date. Named so a screen can detect it
 * (`error instanceof MissingGoalError`) and self-heal rather than string-match.
 */
export class MissingGoalError extends Error {
  constructor(readonly date: DateKey) {
    super(`No daily goal is in force on ${date}.`);
    this.name = 'MissingGoalError';
  }
}

function entryNutrition(entry: FoodEntry): Nutrition {
  return {
    kcal: entry.totalKcal,
    carbsG: entry.carbsG,
    proteinG: entry.proteinG,
    fatG: entry.fatG,
    fiberG: entry.fiberG,
  };
}

/**
 * Build days from already-fetched rows.
 *
 * Range reads fetch entries, water and activity once for the whole window and
 * then slice them per day, so a seven-day trend costs three queries rather
 * than twenty-one.
 */
function assembleDays(
  userId: string,
  dates: readonly DateKey[],
  entries: FoodEntry[],
  waterByDay: Map<DateKey, number>,
  exerciseByDay: Map<DateKey, ExerciseTotals>,
): DiaryDay[] {
  const entriesByDay = new Map<DateKey, FoodEntry[]>();

  for (const entry of entries) {
    const bucket = entriesByDay.get(entry.loggedOn);

    if (bucket) bucket.push(entry);
    else entriesByDay.set(entry.loggedOn, [entry]);
  }

  return dates.map((date) => {
    const dayEntries = entriesByDay.get(date) ?? [];
    const goal = getGoalForDate(userId, date);

    if (!goal) throw new MissingGoalError(date);

    return {
      date,
      entries: dayEntries,
      totals:
        dayEntries.length === 0
          ? { ...EMPTY_NUTRITION }
          : sumNutrition(dayEntries.map(entryNutrition)),
      goal,
      exerciseKcal: exerciseByDay.get(date)?.total ?? 0,
      addBackEligibleExerciseKcal: exerciseByDay.get(date)?.addBackEligible ?? 0,
      waterMl: waterByDay.get(date) ?? 0,
    };
  });
}

export function getDiaryDay(userId: string, date: DateKey): DiaryDay {
  const [day] = assembleDays(
    userId,
    [date],
    getEntriesInRange(userId, date, date),
    getWaterByDay(userId, date, date),
    getExerciseByDay(userId, date, date),
  );

  if (!day) throw new Error(`Failed to assemble the diary for ${date}.`);

  return day;
}

export function getDiaryRange(userId: string, from: DateKey, to: DateKey): DiaryDay[] {
  const dates = datesBetween(from, to);

  return assembleDays(
    userId,
    dates,
    getEntriesInRange(userId, from, to),
    getWaterByDay(userId, from, to),
    getExerciseByDay(userId, from, to),
  );
}

/** The last `days` days ending today, oldest first. */
export function getRecentDiaryDays(userId: string, days: number): DiaryDay[] {
  const dates = lastNDays(days);
  const from = dates[0];
  const to = dates[dates.length - 1];

  if (!from || !to) return [];

  return assembleDays(
    userId,
    dates,
    getEntriesInRange(userId, from, to),
    getWaterByDay(userId, from, to),
    getExerciseByDay(userId, from, to),
  );
}

function datesBetween(from: DateKey, to: DateKey): DateKey[] {
  const dates: DateKey[] = [];
  const end = new Date(`${to}T00:00:00`);

  for (
    let cursor = new Date(`${from}T00:00:00`);
    cursor <= end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');

    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}
