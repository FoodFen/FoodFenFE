import { EMPTY_NUTRITION, sumNutrition } from '@/lib/nutrition';
import type { DiaryDay, FoodEntry, MealType, Nutrition } from '@/types/models';
import { MEAL_TYPES } from '@/types/models';

/** Derived views over a diary day. Pure functions — trivial to unit test. */

export interface MealGroup {
  mealType: MealType;
  entries: FoodEntry[];
  totals: Nutrition;
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🍎',
};

export function entryNutrition(entry: FoodEntry): Nutrition {
  return {
    kcal: entry.totalKcal,
    carbsG: entry.carbsG,
    proteinG: entry.proteinG,
    fatG: entry.fatG,
    fiberG: entry.fiberG,
  };
}

/**
 * Group a day's entries into the four meals.
 *
 * Every meal is returned even when empty, so the diary always shows all four
 * sections with an "add" affordance rather than hiding the ones the user has
 * not filled in yet.
 */
export function groupByMeal(entries: readonly FoodEntry[]): MealGroup[] {
  return MEAL_TYPES.map((mealType) => {
    const mealEntries = entries.filter((entry) => entry.mealType === mealType);

    return {
      mealType,
      entries: mealEntries,
      totals:
        mealEntries.length === 0
          ? { ...EMPTY_NUTRITION }
          : sumNutrition(mealEntries.map(entryNutrition)),
    };
  });
}

export function entryCount(day: DiaryDay | undefined): number {
  return day?.entries.length ?? 0;
}

/** The meal the user most likely wants to log into, based on the clock. */
export function suggestedMealType(now: Date = new Date()): MealType {
  const hour = now.getHours();

  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';

  return 'snack';
}

/** One line summarising what a meal was made of, for the diary row. */
export function describeIngredients(entry: FoodEntry, limit = 3): string {
  if (entry.ingredients.length === 0) return 'No ingredients';

  const names = entry.ingredients.slice(0, limit).map((row) => row.name);
  const remaining = entry.ingredients.length - names.length;

  return remaining > 0 ? `${names.join(', ')} +${remaining}` : names.join(', ');
}
