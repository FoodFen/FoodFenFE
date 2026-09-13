/**
 * Dev-only diary seed for the four days before today.
 *
 * Food logging is not wired yet, so a fresh install paints the dashboard at
 * zero — empty rings, flat macro bars, no weight. This fills days -1..-4 with
 * roughly realistic meals plus a few water logs and two weigh-ins so every
 * dashboard surface has something to render.
 *
 * Daily calorie totals are computed relative to that day's real `daily_goal`
 * target, not hardcoded, so the week strip shows four distinct ring colours
 * whatever the onboarding target turned out to be.
 *
 * Hard-guarded to `__DEV__` (first line of every export) and gated behind the
 * Settings → Developer toggle. `seedRecentDays` wipes its own four-day window
 * and reseeds on every call; `clearSeededDays` just wipes it, so turning the
 * toggle off removes the seeded days (dev-only — there is no real diary data in
 * that window yet).
 *
 * Not a repository: it exists only to make the dev dashboard non-empty.
 */

import { and, eq, inArray } from 'drizzle-orm';

import { createEntry } from '@/data/entryRepository';
import { addWater, logWeight } from '@/data/logRepository';
import { getGoalForDate } from '@/data/userRepository';
import { db } from '@/db/client';
import { foodEntry, waterLog, weightLog } from '@/db/schema';
import type { DateKey } from '@/lib/date';
import { shiftDateKey, todayKey } from '@/lib/date';
import type { MealType } from '@/types/models';

interface SeedMeal {
  mealType: MealType;
  name: string;
  quantityG: number;
}

interface SeedDay {
  offset: -1 | -2 | -3 | -4;
  /** That day's total kcal, derived from its real goal target. */
  desiredTotal: (target: number) => number;
  meals: SeedMeal[];
  waterMl: number[];
  /** One weigh-in for that day, or `null` for no reading. */
  weightKg: number | null;
}

/** Fraction of the day's calories per meal, in `meals` order. */
const MEAL_SPLIT = [0.3, 0.35, 0.35] as const;

/** kcal fallback when no goal row is in force yet (shouldn't happen post-onboarding). */
const FALLBACK_TARGET_KCAL = 2000;

/**
 * `RING_UNDER` is 500 kcal below target, `RING_YELLOW_OVER` is 100 over and
 * `RING_RED_OVER` is 200, so:
 *   day -4 → target − 700 kcal  → over 500 under     → under (black)
 *   day -3 → target − 150 kcal  → within threshold   → green
 *   day -2 → target + 150 kcal  → 100–200 over       → yellow
 *   day -1 → target + 420 kcal  → over 200           → red
 * Weigh-ins trend downward, assuming the common weight-loss direction.
 */
const SEED_DAYS: SeedDay[] = [
  {
    offset: -4,
    desiredTotal: (target) => Math.max(Math.round(target - 700), 400),
    weightKg: null,
    waterMl: [250, 250, 250],
    meals: [
      { mealType: 'breakfast', name: 'Black coffee and a boiled egg', quantityG: 60 },
      { mealType: 'lunch', name: 'Small garden salad', quantityG: 200 },
      { mealType: 'dinner', name: 'Miso soup with tofu', quantityG: 300 },
    ],
  },
  {
    offset: -3,
    desiredTotal: (target) => target - 150,
    weightKg: null,
    waterMl: [250, 500, 300],
    meals: [
      { mealType: 'breakfast', name: 'Oatmeal with banana', quantityG: 300 },
      { mealType: 'lunch', name: 'Grilled chicken salad', quantityG: 350 },
      { mealType: 'dinner', name: 'Tofu vegetable stir-fry', quantityG: 450 },
    ],
  },
  {
    offset: -2,
    desiredTotal: (target) => target + 150,
    weightKg: 80.6,
    waterMl: [250, 250, 500],
    meals: [
      { mealType: 'breakfast', name: 'Eggs, toast and avocado', quantityG: 260 },
      { mealType: 'lunch', name: 'Beef pho', quantityG: 600 },
      { mealType: 'dinner', name: 'Salmon with rice and greens', quantityG: 480 },
    ],
  },
  {
    offset: -1,
    desiredTotal: (target) => target + 420,
    weightKg: 80.3,
    waterMl: [500, 350, 250],
    meals: [
      { mealType: 'breakfast', name: 'Pancakes with syrup', quantityG: 300 },
      { mealType: 'lunch', name: 'Cheeseburger and fries', quantityG: 420 },
      { mealType: 'dinner', name: 'Pasta carbonara', quantityG: 400 },
    ],
  },
];

function seedWindowKeys(): DateKey[] {
  return SEED_DAYS.map((day) => shiftDateKey(todayKey(), day.offset));
}

/**
 * Remove every row this seed writes across its three-day window. Hard delete,
 * not soft: this is throwaway dev data. Ingredients cascade because foreign
 * keys are on by the time the app boots.
 */
export function clearSeededDays(userId: string): void {
  if (!__DEV__) return;

  const seedWindow = seedWindowKeys();

  db.delete(foodEntry)
    .where(and(eq(foodEntry.userId, userId), inArray(foodEntry.loggedOn, seedWindow)))
    .run();
  db.delete(waterLog)
    .where(and(eq(waterLog.userId, userId), inArray(waterLog.loggedOn, seedWindow)))
    .run();
  db.delete(weightLog)
    .where(and(eq(weightLog.userId, userId), inArray(weightLog.recordedAt, seedWindow)))
    .run();
}

export function seedRecentDays(userId: string): void {
  if (!__DEV__) return;

  clearSeededDays(userId);

  for (const day of SEED_DAYS) {
    const loggedOn = shiftDateKey(todayKey(), day.offset);
    const target = getGoalForDate(userId, loggedOn)?.targetKcal ?? FALLBACK_TARGET_KCAL;
    const desired = day.desiredTotal(target);

    day.meals.forEach((meal, index) => {
      const kcal = Math.round(desired * (MEAL_SPLIT[index] ?? 0));

      // Macros from an energy split of this meal's kcal: carbs 45% and protein
      // 25% at 4 kcal/g, fat 30% at 9 kcal/g; fibre a rough 1 g per 110 kcal.
      createEntry({
        userId,
        name: meal.name,
        mealType: meal.mealType,
        inputMethod: 'type',
        loggedOn,
        ingredients: [
          {
            name: meal.name,
            quantityG: meal.quantityG,
            kcal,
            carbsG: Math.round((kcal * 0.45) / 4),
            proteinG: Math.round((kcal * 0.25) / 4),
            fatG: Math.round((kcal * 0.3) / 9),
            fiberG: Math.round(kcal / 110),
          },
        ],
      });
    });

    for (const amountMl of day.waterMl) {
      addWater(userId, amountMl, loggedOn);
    }

    if (day.weightKg !== null) {
      logWeight(userId, day.weightKg, loggedOn);
    }
  }
}
