import { entryNutrition } from '@/features/diary/selectors';
import { macroEnergyShare } from '@/lib/nutrition';
import type { DiaryDay, Macros, MealType } from '@/types/models';

/**
 * Locally computed trends.
 *
 * Deterministic statistics over the user's own diary — no model involved. When
 * the AI insight layer arrives it should consume this summary rather than raw
 * entries: it is small, already aggregated, and the same numbers the user sees
 * on screen.
 */

export interface TrendSummary {
  /** Days in the window with at least one entry. */
  daysLogged: number;
  totalDays: number;
  /** Mean over logged days only — blank days would drag it toward zero. */
  averageKcal: number;
  averageMacros: Macros;
  /** Mean share of energy from each macro, as 0–1 fractions. */
  averageMacroShare: Macros;
  /** Mean over logged days that have a fiber figure; `null` when none do — unknown is not zero. */
  averageFiberG: number | null;
  /** Logged days that contributed to `averageFiberG`. */
  fiberDaysKnown: number;
  /** Mean daily calories minus mean daily target. Negative is a deficit. */
  averageDelta: number;
  /** Consecutive logged days ending at the most recent day in the window. */
  streak: number;
  /** Per-day figures, oldest first — the shape a chart consumes. */
  series: { date: string; kcal: number; target: number }[];
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
    proteinG: round1(mean(logged.map((day) => day.totals.proteinG))),
    carbsG: round1(mean(logged.map((day) => day.totals.carbsG))),
    fatG: round1(mean(logged.map((day) => day.totals.fatG))),
  };

  const fiberValues = logged.flatMap((day) =>
    day.totals.fiberG === undefined || day.totals.fiberG === null ? [] : [day.totals.fiberG],
  );

  return {
    daysLogged: logged.length,
    totalDays: ordered.length,
    averageFiberG: fiberValues.length === 0 ? null : round1(mean(fiberValues)),
    fiberDaysKnown: fiberValues.length,
    averageKcal: Math.round(mean(logged.map((day) => day.totals.kcal))),
    averageMacros,
    averageMacroShare: macroEnergyShare(averageMacros),
    averageDelta: Math.round(
      mean(logged.map((day) => day.totals.kcal - day.goal.targetKcal)),
    ),
    streak: currentStreak(ordered),
    series: ordered.map((day) => ({
      date: day.date,
      kcal: day.totals.kcal,
      target: day.goal.targetKcal,
    })),
  };
}

/** Consecutive logged days counting back from the most recent day. */
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
      perMeal[entry.mealType] =
        (perMeal[entry.mealType] ?? 0) + entryNutrition(entry).kcal;
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
