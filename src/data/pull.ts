import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { syncApi } from '@/api/endpoints/sync';
import type {
  RemoteActivityLog,
  RemoteDailyGoal,
  RemoteFoodEntry,
  RemoteWaterLog,
  RemoteWeightLog,
} from '@/api/schemas';
import { db } from '@/db/client';
import {
  activityLog,
  dailyGoal,
  foodEntry,
  ingredient,
  waterLog,
  weightLog,
} from '@/db/schema';
import type { DateKey } from '@/lib/date';
import { generateLocalId } from '@/lib/id';

/**
 * Bringing server rows into the device database.
 *
 * Each pull is an upsert keyed on `remote_id`, the server's integer id, which
 * is the only identifier both sides agree on — local ids are minted on-device
 * and the server has never heard of them.
 *
 * The rule that matters: **a locally modified row is never overwritten.** If
 * `synced_at` is null or older than `updated_at`, the device holds an edit the
 * server has not seen, and taking the server's version would silently discard
 * something the user typed. Those rows are skipped here and left to the push
 * pass (`push.ts`), which sends them up and marks them synced.
 */

/** True when the local row holds an edit the server has not received. */
function isDirty(row: { updatedAt: Date; syncedAt: Date | null }): boolean {
  return row.syncedAt === null || row.updatedAt.getTime() > row.syncedAt.getTime();
}

function syncedNow(): { updatedAt: Date; syncedAt: Date } {
  const now = new Date();

  return { updatedAt: now, syncedAt: now };
}

export async function pullDailyGoals(userId: string): Promise<void> {
  applyDailyGoals(userId, await syncApi.goals());
}

export function applyDailyGoals(userId: string, remote: RemoteDailyGoal[]): void {
  if (remote.length > 0) {
    // Sign-in fallback goals: never pushed (no remoteId) and never edited. Hard delete, since a soft-deleted row is dirty and would be pushed.
    db.delete(dailyGoal)
      .where(
        and(
          eq(dailyGoal.userId, userId),
          isNull(dailyGoal.remoteId),
          isNotNull(dailyGoal.syncedAt),
          sql`${dailyGoal.updatedAt} <= ${dailyGoal.syncedAt}`,
        ),
      )
      .run();
  }

  for (const row of remote) {
    upsertDailyGoal(userId, row);
  }
}

function upsertDailyGoal(userId: string, remote: RemoteDailyGoal): void {
  const existing = db
    .select()
    .from(dailyGoal)
    .where(and(eq(dailyGoal.userId, userId), eq(dailyGoal.remoteId, remote.id)))
    .limit(1)
    .all()[0];

  const values = {
    targetKcal: remote.targetKcal,
    targetCarbsG: remote.targetCarbsG,
    targetProteinG: remote.targetProteinG,
    targetFatG: remote.targetFatG,
    targetWaterMl: remote.targetWaterMl,
    effectiveDate: remote.effectiveDate,
    remoteId: remote.id,
    deletedAt: null,
    ...syncedNow(),
  };

  if (existing) {
    if (isDirty(existing)) return;

    db.update(dailyGoal).set(values).where(eq(dailyGoal.id, existing.id)).run();

    return;
  }

  db.insert(dailyGoal)
    .values({ id: generateLocalId('goal'), userId, ...values })
    .run();
}

export async function pullFoodEntries(
  userId: string,
  from: DateKey,
  to: DateKey,
): Promise<void> {
  const remote = await syncApi.foodEntries(from, to);

  for (const entry of remote) {
    upsertFoodEntry(userId, entry);
  }
}

function upsertFoodEntry(userId: string, remote: RemoteFoodEntry): void {
  const existing = db
    .select()
    .from(foodEntry)
    .where(and(eq(foodEntry.userId, userId), eq(foodEntry.remoteId, remote.id)))
    .limit(1)
    .all()[0];

  if (existing && isDirty(existing)) return;

  const values = {
    name: remote.name,
    inputMethod: remote.inputMethod,
    imageUrl: remote.imageUrl ?? null,
    totalKcal: remote.totalKcal,
    carbsG: remote.carbsG,
    proteinG: remote.proteinG,
    fatG: remote.fatG,
    fiberG: remote.fiberG ?? null,
    aiFeedback: remote.aiFeedback ?? null,
    mealType: remote.mealType,
    loggedAt: new Date(remote.loggedAt),
    loggedOn: remote.loggedOn,
    remoteId: remote.id,
    deletedAt: null,
    ...syncedNow(),
  };

  const entryId = existing?.id ?? generateLocalId('entry');

  if (existing) {
    db.update(foodEntry).set(values).where(eq(foodEntry.id, entryId)).run();
  } else {
    db.insert(foodEntry)
      .values({ id: entryId, userId, ...values })
      .run();
  }

  // Ingredients arrive as a complete list, so the local set is replaced rather
  // than merged — the server's version of a meal's composition is the whole
  // truth about it, and a leftover local row would show up as a phantom
  // ingredient that nothing accounts for in the totals.
  db.delete(ingredient).where(eq(ingredient.foodEntryId, entryId)).run();

  if (remote.ingredients.length > 0) {
    db.insert(ingredient)
      .values(
        remote.ingredients.map((row) => ({
          id: generateLocalId('ing'),
          foodEntryId: entryId,
          name: row.name,
          quantityG: row.quantityG,
          kcal: row.kcal,
          carbsG: row.carbsG,
          proteinG: row.proteinG,
          fatG: row.fatG,
          fiberG: row.fiberG ?? null,
          catalogFoodId: null,
          remoteId: row.id,
          deletedAt: null,
          ...syncedNow(),
        })),
      )
      .run();
  }
}

export async function pullDayLogs(
  userId: string,
  from: DateKey,
  to: DateKey,
): Promise<void> {
  const [water, activity, weight] = await Promise.all([
    syncApi.waterLogs(from, to),
    syncApi.activityLogs(from, to),
    syncApi.weightLogs(from, to),
  ]);

  for (const row of water) upsertWaterLog(userId, row);
  for (const row of activity) upsertActivityLog(userId, row);
  for (const row of weight) upsertWeightLog(userId, row);
}

function upsertWaterLog(userId: string, remote: RemoteWaterLog): void {
  const existing = db
    .select()
    .from(waterLog)
    .where(and(eq(waterLog.userId, userId), eq(waterLog.remoteId, remote.id)))
    .limit(1)
    .all()[0];

  if (existing && isDirty(existing)) return;

  const values = {
    amountMl: remote.amountMl,
    loggedAt: new Date(remote.loggedAt),
    loggedOn: remote.loggedOn,
    remoteId: remote.id,
    deletedAt: null,
    ...syncedNow(),
  };

  if (existing) {
    db.update(waterLog).set(values).where(eq(waterLog.id, existing.id)).run();

    return;
  }

  db.insert(waterLog)
    .values({ id: generateLocalId('water'), userId, ...values })
    .run();
}

function upsertActivityLog(userId: string, remote: RemoteActivityLog): void {
  const existing = db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.userId, userId), eq(activityLog.remoteId, remote.id)))
    .limit(1)
    .all()[0];

  if (existing && isDirty(existing)) return;

  const values = {
    activityType: remote.activityType,
    caloriesBurned: remote.caloriesBurned,
    source: remote.source,
    loggedAt: new Date(remote.loggedAt),
    loggedOn: remote.loggedOn,
    remoteId: remote.id,
    deletedAt: null,
    ...syncedNow(),
  };

  if (existing) {
    db.update(activityLog).set(values).where(eq(activityLog.id, existing.id)).run();

    return;
  }

  db.insert(activityLog)
    .values({ id: generateLocalId('act'), userId, ...values })
    .run();
}

function upsertWeightLog(userId: string, remote: RemoteWeightLog): void {
  const existing = db
    .select()
    .from(weightLog)
    .where(and(eq(weightLog.userId, userId), eq(weightLog.remoteId, remote.id)))
    .limit(1)
    .all()[0];

  if (existing && isDirty(existing)) return;

  const values = {
    weight: remote.weight,
    recordedAt: remote.recordedAt,
    remoteId: remote.id,
    deletedAt: null,
    ...syncedNow(),
  };

  if (existing) {
    db.update(weightLog).set(values).where(eq(weightLog.id, existing.id)).run();

    return;
  }

  db.insert(weightLog)
    .values({ id: generateLocalId('weight'), userId, ...values })
    .run();
}

/**
 * How many rows the server has already seen, for diagnostics and tests.
 * Counts only rows carrying a `remote_id`.
 */
export function pulledRowCount(): number {
  const [row] = db
    .select({ count: sql<number>`count(*)` })
    .from(foodEntry)
    .where(isNotNull(foodEntry.remoteId))
    .all();

  return row?.count ?? 0;
}
