import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';

import { db } from '@/db/client';
import { foodEntry, ingredient } from '@/db/schema';
import type { DateKey } from '@/lib/date';
import { generateLocalId } from '@/lib/id';
import { sumNutrition } from '@/lib/nutrition';
import type {
  AiFeedback,
  FoodEntry,
  Ingredient,
  InputMethod,
  MealType,
  Nutrition,
} from '@/types/models';

import { notDeleted, touch, touchDeleted } from './sync';

/**
 * Logged meals and the ingredients they break down into.
 *
 * An entry's stored totals are always the sum of its live ingredients —
 * `recalculateTotals` is the only thing that writes them, and every mutation
 * routes through it. Nothing else may set `totalKcal` directly, or the header
 * and the ingredient list will disagree.
 */

export interface IngredientInput {
  name: string;
  quantityG: number;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG?: number | null;
  /** Set when this row was prefilled from the bundled catalog. */
  catalogFoodId?: string | null;
}

export interface CreateEntryInput {
  userId: string;
  name: string;
  /** User-chosen override for `foodEmojiFor`'s keyword guess. */
  emoji?: string | null;
  mealType: MealType;
  inputMethod: InputMethod;
  /** `yyyy-MM-dd`, the local day this meal belongs to. */
  loggedOn: DateKey;
  loggedAt?: Date;
  imageUrl?: string | null;
  ingredients: IngredientInput[];
}

export interface CreateManualEntryInput {
  userId: string;
  name: string;
  /** User-chosen override for `foodEmojiFor`'s keyword guess. */
  emoji?: string | null;
  mealType: MealType;
  /** `yyyy-MM-dd`, the local day this meal belongs to. */
  loggedOn: DateKey;
  /** Free-label "amount eaten" — a number and its unit, stored as picked. */
  amount?: number | null;
  amountUnit?: 'g' | 'serving' | null;
  totalKcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

function toNutrition(
  row: Pick<Ingredient, 'kcal' | 'carbsG' | 'proteinG' | 'fatG' | 'fiberG'>,
): Nutrition {
  return {
    kcal: row.kcal,
    carbsG: row.carbsG,
    proteinG: row.proteinG,
    fatG: row.fatG,
    fiberG: row.fiberG,
  };
}

function readIngredients(entryId: string): Ingredient[] {
  return db
    .select()
    .from(ingredient)
    .where(and(eq(ingredient.foodEntryId, entryId), notDeleted(ingredient)))
    .all();
}

/**
 * Re-sum an entry from its ingredients and store the result.
 *
 * Called after every ingredient change. Totals are denormalized so the diary
 * list can render without a join per row; this is what keeps that safe.
 */
export function recalculateTotals(entryId: string): void {
  const rows = readIngredients(entryId);
  const totals = sumNutrition(rows.map(toNutrition));

  db.update(foodEntry)
    .set({
      totalKcal: totals.kcal,
      carbsG: totals.carbsG,
      proteinG: totals.proteinG,
      fatG: totals.fatG,
      fiberG: totals.fiberG ?? null,
      ...touch(),
    })
    .where(eq(foodEntry.id, entryId))
    .run();
}

export function createEntry(input: CreateEntryInput): FoodEntry {
  const now = new Date();
  const entryId = generateLocalId('entry');

  db.insert(foodEntry)
    .values({
      id: entryId,
      userId: input.userId,
      name: input.name,
      emoji: input.emoji ?? null,
      inputMethod: input.inputMethod,
      imageUrl: input.imageUrl ?? null,
      mealType: input.mealType,
      loggedAt: input.loggedAt ?? now,
      loggedOn: input.loggedOn,
      aiFeedback: null,
      remoteId: null,
      deletedAt: null,
      ...touch(now),
    })
    .run();

  if (input.ingredients.length > 0) {
    db.insert(ingredient)
      .values(
        input.ingredients.map((row) => ({
          id: generateLocalId('ing'),
          foodEntryId: entryId,
          name: row.name,
          quantityG: row.quantityG,
          kcal: row.kcal,
          carbsG: row.carbsG,
          proteinG: row.proteinG,
          fatG: row.fatG,
          fiberG: row.fiberG ?? null,
          catalogFoodId: row.catalogFoodId ?? null,
          remoteId: null,
          deletedAt: null,
          ...touch(now),
        })),
      )
      .run();
  }

  recalculateTotals(entryId);

  const created = getEntry(entryId);

  if (!created) throw new Error('Entry vanished immediately after being created.');

  return created;
}

/**
 * Insert one aggregate `food_entry` with no ingredients (UC-12, manual entry).
 *
 * Unlike `createEntry`, the stored header totals are the source of truth: the
 * user typed the final numbers, so there is nothing to sum and
 * `recalculateTotals` — which would zero a header with no ingredient rows — is
 * deliberately not called. `fiberG` stays null: unknown, not measured-none.
 */
export function createManualEntry(input: CreateManualEntryInput): FoodEntry {
  const now = new Date();
  const entryId = generateLocalId('entry');

  db.insert(foodEntry)
    .values({
      id: entryId,
      userId: input.userId,
      name: input.name,
      emoji: input.emoji ?? null,
      inputMethod: 'manual',
      imageUrl: null,
      totalKcal: input.totalKcal,
      carbsG: input.carbsG,
      proteinG: input.proteinG,
      fatG: input.fatG,
      fiberG: null,
      amount: input.amount ?? null,
      amountUnit: input.amountUnit ?? null,
      aiFeedback: null,
      mealType: input.mealType,
      loggedAt: now,
      loggedOn: input.loggedOn,
      remoteId: null,
      deletedAt: null,
      ...touch(now),
    })
    .run();

  const created = getEntry(entryId);

  if (!created) throw new Error('Entry vanished immediately after being created.');

  return created;
}

export function getEntry(entryId: string): FoodEntry | undefined {
  const entry = db
    .select()
    .from(foodEntry)
    .where(and(eq(foodEntry.id, entryId), notDeleted(foodEntry)))
    .limit(1)
    .all()[0];

  if (!entry) return undefined;

  return { ...entry, ingredients: readIngredients(entryId) };
}

/**
 * Every entry on a day, oldest first.
 *
 * Ingredients for the whole day are fetched in one query and grouped in
 * memory, rather than one query per entry — the diary is the hottest read in
 * the app and N+1 there is felt.
 */
export function getEntriesForDay(userId: string, date: DateKey): FoodEntry[] {
  return getEntriesInRange(userId, date, date);
}

export function getEntriesInRange(
  userId: string,
  from: DateKey,
  to: DateKey,
): FoodEntry[] {
  const entries = db
    .select()
    .from(foodEntry)
    .where(
      and(
        eq(foodEntry.userId, userId),
        gte(foodEntry.loggedOn, from),
        lte(foodEntry.loggedOn, to),
        notDeleted(foodEntry),
      ),
    )
    .orderBy(asc(foodEntry.loggedAt))
    .all();

  if (entries.length === 0) return [];

  const rows = db
    .select()
    .from(ingredient)
    .where(
      and(
        inArray(
          ingredient.foodEntryId,
          entries.map((entry) => entry.id),
        ),
        notDeleted(ingredient),
      ),
    )
    .all();

  const byEntry = new Map<string, Ingredient[]>();

  for (const row of rows) {
    const bucket = byEntry.get(row.foodEntryId);

    if (bucket) bucket.push(row);
    else byEntry.set(row.foodEntryId, [row]);
  }

  return entries.map((entry) => ({
    ...entry,
    ingredients: byEntry.get(entry.id) ?? [],
  }));
}

export interface UpdateEntryInput {
  name?: string;
  emoji?: string | null;
  mealType?: MealType;
  /** Move the meal to another day. */
  loggedOn?: DateKey;
  aiFeedback?: AiFeedback | null;
  /** When present, replaces the entry's ingredients wholesale. */
  ingredients?: IngredientInput[];
}

export function updateEntry(entryId: string, patch: UpdateEntryInput): FoodEntry {
  const now = new Date();
  const { ingredients: nextIngredients, ...entryPatch } = patch;

  if (Object.keys(entryPatch).length > 0) {
    db.update(foodEntry)
      .set({ ...entryPatch, ...touch(now) })
      .where(eq(foodEntry.id, entryId))
      .run();
  }

  if (nextIngredients) {
    // Replace rather than diff: an edited ingredient list is small, and
    // matching rows by name to preserve ids would guess wrong the moment
    // someone renames one. Soft-deleted so the removals can still be pushed.
    db.update(ingredient)
      .set(touchDeleted(now))
      .where(and(eq(ingredient.foodEntryId, entryId), notDeleted(ingredient)))
      .run();

    if (nextIngredients.length > 0) {
      db.insert(ingredient)
        .values(
          nextIngredients.map((row) => ({
            id: generateLocalId('ing'),
            foodEntryId: entryId,
            name: row.name,
            quantityG: row.quantityG,
            kcal: row.kcal,
            carbsG: row.carbsG,
            proteinG: row.proteinG,
            fatG: row.fatG,
            fiberG: row.fiberG ?? null,
            catalogFoodId: row.catalogFoodId ?? null,
            remoteId: null,
            deletedAt: null,
            ...touch(now),
          })),
        )
        .run();
    }

    recalculateTotals(entryId);
  }

  const updated = getEntry(entryId);

  if (!updated) throw new Error(`Entry ${entryId} was not found.`);

  return updated;
}

export interface UpdateManualEntryInput {
  name?: string;
  emoji?: string | null;
  mealType?: MealType;
  amount?: number | null;
  amountUnit?: 'g' | 'serving' | null;
  totalKcal?: number;
  carbsG?: number;
  proteinG?: number;
  fatG?: number;
}

/**
 * Patch an aggregate entry's typed numbers in place (the edit screen).
 *
 * The mirror of `createManualEntry`: the header totals are the source of truth,
 * so the macro columns are written directly and `recalculateTotals` is not
 * called. Only meaningful for an entry with no ingredient rows.
 */
export function updateManualEntry(
  entryId: string,
  patch: UpdateManualEntryInput,
): FoodEntry {
  const now = new Date();

  if (Object.keys(patch).length > 0) {
    db.update(foodEntry)
      .set({ ...patch, ...touch(now) })
      .where(eq(foodEntry.id, entryId))
      .run();
  }

  const updated = getEntry(entryId);

  if (!updated) throw new Error(`Entry ${entryId} was not found.`);

  return updated;
}

/** Soft delete, so the deletion itself can be synced later. */
export function deleteEntry(entryId: string): void {
  const now = new Date();

  db.update(foodEntry).set(touchDeleted(now)).where(eq(foodEntry.id, entryId)).run();

  db.update(ingredient)
    .set(touchDeleted(now))
    .where(and(eq(ingredient.foodEntryId, entryId), notDeleted(ingredient)))
    .run();
}

export interface RecentCatalogFood {
  catalogFoodId: string;
  name: string;
  /** The weight logged the last time this food was used. */
  quantityG: number;
}

/**
 * The catalog foods this user logged most recently, one row per food.
 *
 * Joins `ingredient` to `food_entry` for the user filter and recency order,
 * then keeps the first (newest) occurrence of each `catalogFoodId`. Powers the
 * "Gần đây" shortcut in the search-and-portion flow.
 */
export function getRecentCatalogFoods(
  userId: string,
  limit = 8,
): RecentCatalogFood[] {
  const rows = db
    .select({
      catalogFoodId: ingredient.catalogFoodId,
      name: ingredient.name,
      quantityG: ingredient.quantityG,
      loggedAt: foodEntry.loggedAt,
    })
    .from(ingredient)
    .innerJoin(foodEntry, eq(ingredient.foodEntryId, foodEntry.id))
    .where(
      and(
        eq(foodEntry.userId, userId),
        isNotNull(ingredient.catalogFoodId),
        notDeleted(ingredient),
        notDeleted(foodEntry),
      ),
    )
    .orderBy(desc(foodEntry.loggedAt))
    .all();

  const seen = new Set<string>();
  const recents: RecentCatalogFood[] = [];

  for (const row of rows) {
    if (row.catalogFoodId === null || seen.has(row.catalogFoodId)) continue;

    seen.add(row.catalogFoodId);
    recents.push({
      catalogFoodId: row.catalogFoodId,
      name: row.name,
      quantityG: row.quantityG,
    });

    if (recents.length >= limit) break;
  }

  return recents;
}

/** Distinct days with at least one entry, for streaks and trends. */
export function getLoggedDays(userId: string, from: DateKey, to: DateKey): DateKey[] {
  const rows = db
    .selectDistinct({ loggedOn: foodEntry.loggedOn })
    .from(foodEntry)
    .where(
      and(
        eq(foodEntry.userId, userId),
        gte(foodEntry.loggedOn, from),
        lte(foodEntry.loggedOn, to),
        notDeleted(foodEntry),
      ),
    )
    .orderBy(asc(foodEntry.loggedOn))
    .all();

  return rows.map((row) => row.loggedOn);
}
