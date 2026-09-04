import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { activityLog, waterLog, weightLog } from '@/db/schema';
import type { DateKey } from '@/lib/date';
import { generateLocalId } from '@/lib/id';
import type { ActivitySource, WaterLog, WeightLog } from '@/types/models';

import { notDeleted, touch, touchDeleted } from './sync';

/**
 * The three simple logs: water, weight and activity.
 *
 * Water and activity are append-only events summed per day — "drank 250 ml"
 * rather than "today's total is 750 ml" — because a running total cannot be
 * corrected without knowing what went into it. Weight is one reading per day,
 * so a second reading replaces the first rather than appending.
 */

export function addWater(userId: string, amountMl: number, date: DateKey): WaterLog {
  const now = new Date();

  const row: WaterLog = {
    id: generateLocalId('water'),
    userId,
    amountMl,
    loggedAt: now,
    loggedOn: date,
    remoteId: null,
    deletedAt: null,
    ...touch(now),
  };

  db.insert(waterLog).values(row).run();

  return row;
}

export function getWaterMl(userId: string, date: DateKey): number {
  const [row] = db
    .select({ total: sql<number>`coalesce(sum(${waterLog.amountMl}), 0)` })
    .from(waterLog)
    .where(
      and(eq(waterLog.userId, userId), eq(waterLog.loggedOn, date), notDeleted(waterLog)),
    )
    .all();

  return row?.total ?? 0;
}

/** Per-day totals across a range, as a `yyyy-MM-dd` → millilitres map. */
export function getWaterByDay(
  userId: string,
  from: DateKey,
  to: DateKey,
): Map<DateKey, number> {
  const rows = db
    .select({
      day: waterLog.loggedOn,
      total: sql<number>`coalesce(sum(${waterLog.amountMl}), 0)`,
    })
    .from(waterLog)
    .where(
      and(
        eq(waterLog.userId, userId),
        gte(waterLog.loggedOn, from),
        lte(waterLog.loggedOn, to),
        notDeleted(waterLog),
      ),
    )
    .groupBy(waterLog.loggedOn)
    .all();

  return new Map(rows.map((row) => [row.day, row.total]));
}

/**
 * Undo the most recent water entry of the day — the "minus" button.
 *
 * Ordered by `rowid` as well as timestamp. Two taps land in the same
 * millisecond easily enough, and `logged_at` alone leaves those tied, so
 * SQLite would be free to hand back either — undoing a drink the user did not
 * just add. `rowid` is the insertion order and breaks the tie exactly.
 */
export function removeLastWater(userId: string, date: DateKey): void {
  const latest = db
    .select()
    .from(waterLog)
    .where(
      and(eq(waterLog.userId, userId), eq(waterLog.loggedOn, date), notDeleted(waterLog)),
    )
    .orderBy(desc(waterLog.loggedAt), sql`rowid desc`)
    .limit(1)
    .all()[0];

  if (!latest) return;

  db.update(waterLog).set(touchDeleted()).where(eq(waterLog.id, latest.id)).run();
}

export interface AddActivityInput {
  userId: string;
  activityType: string;
  caloriesBurned: number;
  date: DateKey;
  source?: ActivitySource;
}

export function addActivity(input: AddActivityInput): void {
  const now = new Date();

  db.insert(activityLog)
    .values({
      id: generateLocalId('act'),
      userId: input.userId,
      activityType: input.activityType,
      caloriesBurned: input.caloriesBurned,
      source: input.source ?? 'manual',
      loggedAt: now,
      loggedOn: input.date,
      remoteId: null,
      deletedAt: null,
      ...touch(now),
    })
    .run();
}

export function getExerciseKcal(userId: string, date: DateKey): number {
  const [row] = db
    .select({
      total: sql<number>`coalesce(sum(${activityLog.caloriesBurned}), 0)`,
    })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, userId),
        eq(activityLog.loggedOn, date),
        notDeleted(activityLog),
      ),
    )
    .all();

  return row?.total ?? 0;
}

export function getExerciseByDay(
  userId: string,
  from: DateKey,
  to: DateKey,
): Map<DateKey, number> {
  const rows = db
    .select({
      day: activityLog.loggedOn,
      total: sql<number>`coalesce(sum(${activityLog.caloriesBurned}), 0)`,
    })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, userId),
        gte(activityLog.loggedOn, from),
        lte(activityLog.loggedOn, to),
        notDeleted(activityLog),
      ),
    )
    .groupBy(activityLog.loggedOn)
    .all();

  return new Map(rows.map((row) => [row.day, row.total]));
}

export function getActivities(userId: string, date: DateKey) {
  return db
    .select()
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, userId),
        eq(activityLog.loggedOn, date),
        notDeleted(activityLog),
      ),
    )
    .orderBy(asc(activityLog.loggedAt))
    .all();
}

/**
 * Record a weight reading.
 *
 * One per day: logging again on the same date corrects that day rather than
 * adding a second point, which would make the trend line meaningless.
 */
export function logWeight(userId: string, weight: number, date: DateKey): WeightLog {
  const existing = db
    .select()
    .from(weightLog)
    .where(
      and(
        eq(weightLog.userId, userId),
        eq(weightLog.recordedAt, date),
        notDeleted(weightLog),
      ),
    )
    .limit(1)
    .all()[0];

  if (existing) {
    const updated = { ...existing, weight, ...touch() };

    db.update(weightLog).set(updated).where(eq(weightLog.id, existing.id)).run();

    return updated;
  }

  const row: WeightLog = {
    id: generateLocalId('weight'),
    userId,
    weight,
    recordedAt: date,
    remoteId: null,
    deletedAt: null,
    ...touch(),
  };

  db.insert(weightLog).values(row).run();

  return row;
}

export function getWeightHistory(
  userId: string,
  from: DateKey,
  to: DateKey,
): WeightLog[] {
  return db
    .select()
    .from(weightLog)
    .where(
      and(
        eq(weightLog.userId, userId),
        gte(weightLog.recordedAt, from),
        lte(weightLog.recordedAt, to),
        notDeleted(weightLog),
      ),
    )
    .orderBy(asc(weightLog.recordedAt))
    .all();
}

export function getLatestWeight(userId: string): WeightLog | undefined {
  return db
    .select()
    .from(weightLog)
    .where(and(eq(weightLog.userId, userId), notDeleted(weightLog)))
    .orderBy(desc(weightLog.recordedAt))
    .limit(1)
    .all()[0];
}
