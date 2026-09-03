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

/**
 * Group a day's entries into the four meals.
 *
 * Every meal is returned even when empty, so the diary always shows all four
 * sections with an "Add food" affordance rather than hiding the ones the user
 * has not filled in yet.
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
          : sumNutrition(mealEntries.map((entry) => entry.nutrition)),
    };
  });
}

/** An empty day, so screens can render before the first fetch resolves. */
export function emptyDiaryDay(date: string, goals: DiaryDay['goals']): DiaryDay {
  return {
    date,
    entries: [],
    totals: { ...EMPTY_NUTRITION },
    goals,
    exerciseCalories: 0,
    waterMl: 0,
  };
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
