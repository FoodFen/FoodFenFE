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

/** A day's live water rows, most recently written first. */
export function getWaterEntries(userId: string, date: DateKey): WaterLog[] {
  return db
    .select()
    .from(waterLog)
    .where(
      and(eq(waterLog.userId, userId), eq(waterLog.loggedOn, date), notDeleted(waterLog)),
    )
    .orderBy(desc(waterLog.loggedAt), sql`rowid desc`)
    .all();
}

/**
 * Set the day's water total to exactly `targetMl` (the "tap a cup" interaction).
 *
 * Increasing inserts one new row for the difference, same as a normal log.
 * Decreasing trims the most-recently-written rows first — soft-deleting whole
 * ones and shrinking the last one only as much as needed — so the log stays
 * append-only (nothing is ever un-deleted or rewritten to a bigger amount) while
 * the sum lands exactly on the target.
 */
export function setWaterTotal(userId: string, date: DateKey, targetMl: number): void {
  const current = getWaterMl(userId, date);
  const diff = targetMl - current;

  if (diff > 0) {
    addWater(userId, diff, date);
    return;
  }

  if (diff === 0) return;

  let remaining = -diff;

  for (const entry of getWaterEntries(userId, date)) {
    if (remaining <= 0) break;

    if (entry.amountMl <= remaining) {
      db.update(waterLog).set(touchDeleted()).where(eq(waterLog.id, entry.id)).run();
      remaining -= entry.amountMl;
    } else {
      db.update(waterLog)
        .set({ amountMl: entry.amountMl - remaining, ...touch() })
        .where(eq(waterLog.id, entry.id))
        .run();
      remaining = 0;
    }
  }
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
  /** When the activity happened, if backdated from "now" (UC-16's time picker). */
  loggedAt?: Date;
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
      loggedAt: input.loggedAt ?? now,
      loggedOn: input.date,
      remoteId: null,
      deletedAt: null,
      ...touch(now),
    })
    .run();
}

/**
 * One steps-derived activity per user/day/source, upserted in place.
 *
 * Scoped only to a health-sourced row re-syncing itself across repeated
 * dashboard opens on the same day (the dashboard may call this many times as
 * the day's step count rises) — it only ever matches on
 * (userId, loggedOn, activityType: 'steps', source), so it never reads or
 * writes a `source: 'manual'` row, and Apple Health / Google Fit each keep
 * their own row if a device somehow reports both for one day.
 */
export function upsertHealthSteps(
  userId: string,
  date: DateKey,
  caloriesBurned: number,
  source: Extract<ActivitySource, 'apple_health' | 'google_fit'>,
): void {
  const existing = db
    .select()
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, userId),
        eq(activityLog.loggedOn, date),
        eq(activityLog.activityType, 'steps'),
        eq(activityLog.source, source),
        notDeleted(activityLog),
      ),
    )
    .limit(1)
    .all()[0];

  if (existing) {
    db.update(activityLog)
      .set({ caloriesBurned, ...touch() })
      .where(eq(activityLog.id, existing.id))
      .run();
    return;
  }

  const now = new Date();

  db.insert(activityLog)
    .values({
      id: generateLocalId('act'),
      userId,
      activityType: 'steps',
      caloriesBurned,
      source,
      loggedAt: now,
      loggedOn: date,
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

/**
 * The one activity type that represents passive/ambient movement — steps
 * taken over the course of a normal day — rather than a deliberate workout.
 * The TDEE activity-level multiplier chosen at onboarding already assumes
 * typical daily movement like this, so it must not also add back to the
 * eating budget under All-calories mode (`kcalRemaining`) — doing so would
 * count the same movement twice. Everything else (a chosen preset, a
 * manually-typed activity, or — if a future pass imports real workouts from
 * a health app — a synced run/ride/swim) represents exertion beyond that
 * baseline and is eligible.
 *
 * This is the one place that distinction lives. A future recalibration
 * (e.g. deriving the baseline itself from a trend of measured activity
 * instead of a static onboarding answer) still needs this same "ambient vs.
 * deliberate" split — it would only replace this one check, not anything
 * downstream of it.
 */
const AMBIENT_ACTIVITY_TYPE = 'steps';

export interface ExerciseTotals {
  /** Every logged activity for the day, regardless of type — what "Calories burned" displays. */
  total: number;
  /** The subset eligible to add back to the eating budget (see `AMBIENT_ACTIVITY_TYPE`). */
  addBackEligible: number;
}

export function getExerciseByDay(
  userId: string,
  from: DateKey,
  to: DateKey,
): Map<DateKey, ExerciseTotals> {
  const rows = db
    .select({
      day: activityLog.loggedOn,
      total: sql<number>`coalesce(sum(${activityLog.caloriesBurned}), 0)`,
      addBackEligible: sql<number>`coalesce(sum(case when ${activityLog.activityType} != ${AMBIENT_ACTIVITY_TYPE} then ${activityLog.caloriesBurned} else 0 end), 0)`,
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

  return new Map(rows.map((row) => [row.day, { total: row.total, addBackEligible: row.addBackEligible }]));
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

/** The weigh-in in force on `date`: the newest row recorded on or before it. */
export function getWeightAsOf(userId: string, date: DateKey): WeightLog | undefined {
  return db
    .select()
    .from(weightLog)
    .where(
      and(
        eq(weightLog.userId, userId),
        lte(weightLog.recordedAt, date),
        notDeleted(weightLog),
      ),
    )
    .orderBy(desc(weightLog.recordedAt))
    .limit(1)
    .all()[0];
}
