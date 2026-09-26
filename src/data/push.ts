import { and, eq, isNull, or, sql } from 'drizzle-orm';

import { syncApi } from '@/api/endpoints/sync';
import type { PushActivityLogInput, PushFoodEntryInput } from '@/api/endpoints/sync';
import { db } from '@/db/client';
import { activityLog, dailyGoal, foodEntry, ingredient, user, waterLog, weightLog } from '@/db/schema';
import type { UserProfile } from '@/types/models';

import { markSynced } from './sync';

/**
 * Draining `pendingChangeCount()` to the server — the push half of
 * `src/data/sync.ts`'s "write locally, push later." One row at a time, per
 * resource, matching `docs/backend-contracts/sync.md` exactly (no batch
 * envelope). A row that fails just stays dirty and gets retried whenever
 * push next runs (`usePushSync`) — there is no separate retry queue.
 *
 * The `console.warn` calls throughout are deliberate, not leftover
 * debugging — `no-console` here only allows `warn`/`error`, and this is the
 * first version of push, worth being able to watch happen on a real device.
 */

function isDirty(row: { updatedAt: Date; syncedAt: Date | null }): boolean {
  return row.syncedAt === null || row.updatedAt.getTime() > row.syncedAt.getTime();
}

export async function pushUserProfile(profile: UserProfile): Promise<void> {
  if (profile.deletedAt !== null || !isDirty(profile)) return;

  try {
    await syncApi.pushUser({
      displayName: profile.displayName,
      gender: profile.gender,
      birthYear: profile.birthYear,
      unitSystem: profile.unitSystem,
      height: profile.height,
      weightCurrent: profile.weightCurrent,
      weightGoal: profile.weightGoal,
      activityLevel: profile.activityLevel,
      dietType: profile.dietType,
      calorieCalcMode: profile.calorieCalcMode,
      calorieLeftMode: profile.calorieLeftMode,
      weeklyRateKg: profile.weeklyRateKg,
    });

    markSynced(user, profile.id);
    console.warn('[push] profile synced', profile.id);
  } catch (error) {
    console.warn('[push] profile failed, will retry next sync', error);
  }
}

export async function pushDailyGoals(userId: string): Promise<void> {
  const rows = db
    .select()
    .from(dailyGoal)
    .where(
      and(
        eq(dailyGoal.userId, userId),
        or(isNull(dailyGoal.syncedAt), sql`${dailyGoal.updatedAt} > ${dailyGoal.syncedAt}`),
      ),
    )
    .all();

  for (const row of rows) {
    try {
      const remote = await syncApi.pushGoal({
        clientId: row.id,
        targetKcal: row.targetKcal,
        targetCarbsG: row.targetCarbsG,
        targetProteinG: row.targetProteinG,
        targetFatG: row.targetFatG,
        targetWaterMl: row.targetWaterMl,
        effectiveDate: row.effectiveDate,
      });

      markSynced(dailyGoal, row.id, remote.id);
      console.warn('[push] daily goal synced', row.id, '->', remote.id);
    } catch (error) {
      console.warn('[push] daily goal failed, will retry next sync', row.id, error);
    }
  }
}

export async function pushFoodEntries(userId: string): Promise<void> {
  const rows = db
    .select()
    .from(foodEntry)
    .where(
      and(
        eq(foodEntry.userId, userId),
        or(isNull(foodEntry.syncedAt), sql`${foodEntry.updatedAt} > ${foodEntry.syncedAt}`),
      ),
    )
    .all();

  for (const row of rows) {
    try {
      if (row.deletedAt !== null) {
        if (row.remoteId !== null) await syncApi.deleteFoodEntry(row.remoteId);
        markSynced(foodEntry, row.id);

        // `deleteEntry` soft-deletes the ingredients too — deleting the
        // parent already conveys their deletion server-side, so they just
        // need their own dirty flag cleared, not a push of their own.
        const deletedIngredients = db
          .select()
          .from(ingredient)
          .where(eq(ingredient.foodEntryId, row.id))
          .all();

        for (const ing of deletedIngredients) markSynced(ingredient, ing.id);

        console.warn('[push] food entry deleted', row.id);
        continue;
      }

      // All ingredient rows, including stale ones `updateEntry` soft-deleted
      // on a previous edit — those still need their own dirty flag cleared
      // below, even though only the live ones belong in the request body.
      const allIngredients = db
        .select()
        .from(ingredient)
        .where(eq(ingredient.foodEntryId, row.id))
        .all();
      const liveIngredients = allIngredients.filter((ing) => ing.deletedAt === null);

      const body: PushFoodEntryInput = {
        clientId: row.id,
        name: row.name,
        inputMethod: row.inputMethod,
        imageUrl: row.imageUrl,
        totalKcal: row.totalKcal,
        carbsG: row.carbsG,
        proteinG: row.proteinG,
        fatG: row.fatG,
        fiberG: row.fiberG,
        aiFeedback: row.aiFeedback,
        mealType: row.mealType,
        loggedAt: row.loggedAt.toISOString(),
        loggedOn: row.loggedOn,
        ingredients: liveIngredients.map((ing) => ({
          clientId: ing.id,
          name: ing.name,
          quantityG: ing.quantityG,
          kcal: ing.kcal,
          carbsG: ing.carbsG,
          proteinG: ing.proteinG,
          fatG: ing.fatG,
          fiberG: ing.fiberG,
        })),
      };

      const remote =
        row.remoteId === null
          ? await syncApi.createFoodEntry(body)
          : await syncApi.updateFoodEntry(row.remoteId, body);

      markSynced(foodEntry, row.id, remote.id);
      // Ingredients are always nested, never independently addressable
      // (docs/backend-contracts/sync.md) — the push above already carries
      // the whole live set, so a successful push just clears every
      // ingredient's dirty flag (live or soft-deleted) rather than mapping
      // individual remote ids.
      for (const ing of allIngredients) markSynced(ingredient, ing.id);

      console.warn('[push] food entry synced', row.id, '->', remote.id);
    } catch (error) {
      console.warn('[push] food entry failed, will retry next sync', row.id, error);
    }
  }
}

async function pushActivityLogs(userId: string): Promise<void> {
  const rows = db
    .select()
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, userId),
        or(isNull(activityLog.syncedAt), sql`${activityLog.updatedAt} > ${activityLog.syncedAt}`),
      ),
    )
    .all();

  for (const row of rows) {
    try {
      const body: PushActivityLogInput = {
        clientId: row.id,
        activityType: row.activityType,
        caloriesBurned: row.caloriesBurned,
        source: row.source,
        loggedAt: row.loggedAt.toISOString(),
        loggedOn: row.loggedOn,
      };

      const remote =
        row.remoteId === null
          ? await syncApi.createActivityLog(body)
          : await syncApi.updateActivityLog(row.remoteId, body);

      markSynced(activityLog, row.id, remote.id);
      console.warn('[push] activity log synced', row.id, '->', remote.id);
    } catch (error) {
      console.warn('[push] activity log failed, will retry next sync', row.id, error);
    }
  }
}

async function pushWaterLogs(userId: string): Promise<void> {
  const rows = db
    .select()
    .from(waterLog)
    .where(
      and(
        eq(waterLog.userId, userId),
        or(isNull(waterLog.syncedAt), sql`${waterLog.updatedAt} > ${waterLog.syncedAt}`),
      ),
    )
    .all();

  for (const row of rows) {
    try {
      if (row.deletedAt !== null) {
        if (row.remoteId !== null) await syncApi.deleteWaterLog(row.remoteId);
        markSynced(waterLog, row.id);
        console.warn('[push] water log deleted', row.id);
        continue;
      }

      // `setWaterTotal` can shrink an already-synced row in place (the "tap
      // a cup down" case) — PATCH, not POST, once it already has a remoteId.
      const remote =
        row.remoteId === null
          ? await syncApi.createWaterLog({
              clientId: row.id,
              amountMl: row.amountMl,
              loggedAt: row.loggedAt.toISOString(),
              loggedOn: row.loggedOn,
            })
          : await syncApi.updateWaterLog(row.remoteId, {
              amountMl: row.amountMl,
              loggedAt: row.loggedAt.toISOString(),
              loggedOn: row.loggedOn,
            });

      markSynced(waterLog, row.id, remote.id);
      console.warn('[push] water log synced', row.id, '->', remote.id);
    } catch (error) {
      console.warn('[push] water log failed, will retry next sync', row.id, error);
    }
  }
}

async function pushWeightLogs(userId: string): Promise<void> {
  const rows = db
    .select()
    .from(weightLog)
    .where(
      and(
        eq(weightLog.userId, userId),
        or(isNull(weightLog.syncedAt), sql`${weightLog.updatedAt} > ${weightLog.syncedAt}`),
      ),
    )
    .all();

  for (const row of rows) {
    try {
      const remote = await syncApi.createWeightLog({
        clientId: row.id,
        weight: row.weight,
        recordedAt: row.recordedAt,
      });

      markSynced(weightLog, row.id, remote.id);
      console.warn('[push] weight log synced', row.id, '->', remote.id);
    } catch (error) {
      console.warn('[push] weight log failed, will retry next sync', row.id, error);
    }
  }
}

export async function pushDayLogs(userId: string): Promise<void> {
  await pushActivityLogs(userId);
  await pushWaterLogs(userId);
  await pushWeightLogs(userId);
}

/**
 * The one entry point `usePushSync` calls. Food entries run last so a slow
 * AI-derived entry never blocks the smaller, faster resources behind it —
 * nothing here has a cross-resource dependency, so the order is otherwise
 * arbitrary.
 */
export async function pushAll(profile: UserProfile): Promise<void> {
  console.warn('[push] starting for user', profile.id);

  await pushUserProfile(profile);
  await pushDailyGoals(profile.id);
  await pushDayLogs(profile.id);
  await pushFoodEntries(profile.id);

  console.warn('[push] done for user', profile.id);
}
