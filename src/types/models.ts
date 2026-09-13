import type {
  CoinTransactionRow,
  DailyGoalRow,
  FoodEntryRow,
  IngredientRow,
  QuestRow,
  StreakRow,
  SubscriptionRow,
  UserRow,
  WaterLogRow,
  WeightLogRow,
} from '@/db/schema';

/**
 * The domain model.
 *
 * Single-table entities are aliases of the Drizzle row types rather than
 * hand-written copies — the schema is the definition, and a parallel interface
 * would only be something to keep in sync. Composite shapes the UI works in
 * (an entry with its ingredients, a day of the diary) are defined here,
 * because no single table describes them.
 *
 * Units are fixed throughout: energy in kilocalories, macros in grams, mass in
 * kilograms, length in centimetres, volume in millilitres. `unitSystem` on the
 * user is a display preference and never changes what is stored.
 */

export type {
  ActivityLevel,
  ActivitySource,
  AiFeedback,
  CalorieCalcMode,
  CoinReason,
  DietType,
  Gender,
  InputMethod,
  MealType,
  PlanType,
  QuestType,
  SubscriptionStatus,
  SubscriptionTier,
  UnitSystem,
} from '@/db/schema';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const INPUT_METHODS = ['voice', 'image', 'type', 'manual'] as const;

export type UserProfile = UserRow;
export type DailyGoal = DailyGoalRow;
export type Ingredient = IngredientRow;
export type WeightLog = WeightLogRow;
export type WaterLog = WaterLogRow;
export type Streak = StreakRow;
export type Quest = QuestRow;
export type CoinTransaction = CoinTransactionRow;
export type Subscription = SubscriptionRow;

/** Macronutrients, in grams. */
export interface Macros {
  carbsG: number;
  proteinG: number;
  fatG: number;
}

/**
 * Everything nutritional we track for one amount of food.
 *
 * `fiberG` is optional in two different senses that must not be confused:
 * `undefined` means unknown or not visible on this plan (it is Premium-gated),
 * while `0` means measured as containing none.
 */
export interface Nutrition extends Macros {
  kcal: number;
  fiberG?: number | null;
}

/** A logged meal, with the ingredients it was broken down into. */
export interface FoodEntry extends FoodEntryRow {
  ingredients: Ingredient[];
}

/** One day of the diary, as the Today screen renders it. */
export interface DiaryDay {
  /** `yyyy-MM-dd`, local calendar day. */
  date: string;
  entries: FoodEntry[];
  totals: Nutrition;
  goal: DailyGoal;
  /** Sum of the day's activity logs. */
  exerciseKcal: number;
  /** Sum of the day's water logs. */
  waterMl: number;
}

/**
 * A food in the bundled reference list.
 *
 * Not a database table, and deliberately not part of the ERD: it is a
 * read-only lookup shipped in the bundle so the "type it in" path can prefill
 * an ingredient's numbers instead of making the user find them. Once chosen,
 * the values are copied onto the `ingredient` row — the catalog is never
 * referenced at read time, so editing this list can never rewrite history.
 */
export interface CatalogServing {
  id: string;
  label: string;
  /** What one of this serving weighs. Drives all scaling. */
  grams: number;
  /** The serving shown selected first. "100 g" is always present but never it. */
  default?: boolean;
}

export interface CatalogFood {
  id: string;
  name: string;
  brand?: string;
  /** Folded search terms — no-diacritic Vietnamese plus English. */
  aliases: string[];
  /** Slug bucket the food sorts into (`mon-nuoc`, `do-uong`, `an-vat`, …). */
  category: string;
  /** Nutrition for 100 g of this food. */
  per100g: Nutrition;
  servings: CatalogServing[];
}
