/**
 * Core domain model.
 *
 * Energy is always kilocalories and macros are always grams — no unit field,
 * because mixed units in a nutrition app are a bug factory. Convert at the
 * edges (API deserialization, user input) and keep the inside consistent.
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: readonly MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
] as const;

export type Sex = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type GoalKind = 'lose' | 'maintain' | 'gain';

/** Macronutrient totals in grams. */
export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

/** Everything nutritional we track for one amount of food. */
export interface Nutrition extends Macros {
  /** Kilocalories. */
  calories: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  saturatedFat?: number;
}

/** A serving size a food can be logged in, e.g. "1 medium (118 g)". */
export interface ServingUnit {
  id: string;
  label: string;
  /** How many grams one of this unit weighs. Drives all scaling. */
  grams: number;
}

/**
 * A food as it exists in the catalog, independent of any diary entry.
 * Nutrition is normalized per 100 g so entries of any size scale from it.
 */
export interface Food {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  /** Nutrition for 100 g of this food. */
  per100g: Nutrition;
  servingUnits: ServingUnit[];
  /** Set when the user created this food themselves. */
  isCustom?: boolean;
  verified?: boolean;
}

/** One logged food in the diary. */
export interface FoodEntry {
  id: string;
  /** ISO date, `yyyy-MM-dd`, in the user's local timezone. */
  date: string;
  mealType: MealType;
  food: Food;
  /** How many of `servingUnitId` were eaten. */
  quantity: number;
  servingUnitId: string;
  /** Denormalized totals for this entry, so lists render without recomputing. */
  nutrition: Nutrition;
  notes?: string;
  photoUri?: string;
  loggedAt: string;
}

/** Daily targets the user is measured against. */
export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  sex: Sex;
  /** Years. */
  age: number;
  /** Centimetres. */
  heightCm: number;
  /** Kilograms. */
  weightKg: number;
  activityLevel: ActivityLevel;
  goalKind: GoalKind;
  /** Kilograms per week; positive magnitude, direction comes from `goalKind`. */
  weeklyRateKg: number;
  /** Set when the user has overridden the computed targets. */
  customGoals?: NutritionGoals;
}

/** One day of the diary, as rendered on the Today screen. */
export interface DiaryDay {
  date: string;
  entries: FoodEntry[];
  totals: Nutrition;
  goals: NutritionGoals;
  /** Kilocalories burned through logged exercise, if any. */
  exerciseCalories: number;
  waterMl: number;
}

export interface WeightLog {
  id: string;
  date: string;
  weightKg: number;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  user: UserProfile;
}
