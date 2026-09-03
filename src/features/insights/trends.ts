import { macroEnergyShare } from '@/lib/nutrition';
import type { DiaryDay, Macros, MealType } from '@/types/models';

/**
 * Locally computed trends.
 *
 * These are deterministic statistics over the user's own diary — no model
 * involved. When the AI insight service is added it should consume this
 * summary rather than raw entries: it is smaller, already anonymised of food
 * names, and the same numbers the user sees on screen.
 */

export interface TrendSummary {
  /** Days in the window that have at least one entry. */
  daysLogged: number;
  totalDays: number;
  /** Mean calories across logged days only — blank days would drag it to zero. */
  averageCalories: number;
  averageMacros: Macros;
  /** Mean share of energy from each macro, as 0–1 fractions. */
  averageMacroShare: Macros;
  /** Mean daily calories minus mean daily goal. Negative is a deficit. */
  averageDelta: number;
  /** Consecutive days ending today with at least one entry. */
  streak: number;
  /** Calories per day, oldest first — the shape a chart consumes. */
  series: { date: string; calories: number; goal: number }[];
}

function isLogged(day: DiaryDay): boolean {
  return day.entries.length > 0;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeTrends(days: readonly DiaryDay[]): TrendSummary {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const logged = ordered.filter(isLogged);

  const averageMacros: Macros = {
    protein: round1(mean(logged.map((day) => day.totals.protein))),
    carbs: round1(mean(logged.map((day) => day.totals.carbs))),
    fat: round1(mean(logged.map((day) => day.totals.fat))),
  };

  return {
    daysLogged: logged.length,
    totalDays: ordered.length,
    averageCalories: Math.round(mean(logged.map((day) => day.totals.calories))),
    averageMacros,
    averageMacroShare: macroEnergyShare(averageMacros),
    averageDelta: Math.round(
      mean(logged.map((day) => day.totals.calories - day.goals.calories)),
    ),
    streak: currentStreak(ordered),
    series: ordered.map((day) => ({
      date: day.date,
      calories: day.totals.calories,
      goal: day.goals.calories,
    })),
  };
}

/** Consecutive logged days counting back from the most recent day in the window. */
export function currentStreak(orderedDays: readonly DiaryDay[]): number {
  let streak = 0;

  for (let index = orderedDays.length - 1; index >= 0; index -= 1) {
    const day = orderedDays[index];
    if (!day || !isLogged(day)) break;

    streak += 1;
  }

  return streak;
}

/** Mean calories logged per meal, to show which meal drives the day. */
export function averageByMeal(days: readonly DiaryDay[]): Record<MealType, number> {
  const totals: Record<string, number[]> = {};

  for (const day of days) {
    if (!isLogged(day)) continue;

    const perMeal: Record<string, number> = {};
    for (const entry of day.entries) {
      perMeal[entry.mealType] = (perMeal[entry.mealType] ?? 0) + entry.nutrition.calories;
    }

    for (const meal of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
      (totals[meal] ??= []).push(perMeal[meal] ?? 0);
    }
  }

  return {
    breakfast: Math.round(mean(totals.breakfast ?? [])),
    lunch: Math.round(mean(totals.lunch ?? [])),
    dinner: Math.round(mean(totals.dinner ?? [])),
    snack: Math.round(mean(totals.snack ?? [])),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
