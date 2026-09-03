import type {
  ActivityLevel,
  Food,
  GoalKind,
  Macros,
  Nutrition,
  NutritionGoals,
  ServingUnit,
  UserProfile,
} from '@/types/models';

/** Kilocalories per gram. Used to convert macro targets to grams. */
export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

/** Kilocalories in one kilogram of body mass — the standard planning figure. */
const KCAL_PER_KG_BODY_MASS = 7700;

/**
 * Daily deficit/surplus is capped so the app never suggests a target that is
 * unsafe. 1 kg/week is already an aggressive rate.
 */
const MAX_DAILY_CALORIE_DELTA = 1000;

/** Floors recommended by common clinical guidance; we never target below these. */
const MIN_CALORIES_BY_SEX = { male: 1500, female: 1200 } as const;

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary — little or no exercise',
  light: 'Light — 1–3 days a week',
  moderate: 'Moderate — 3–5 days a week',
  active: 'Active — 6–7 days a week',
  very_active: 'Very active — hard training or physical job',
};

export const EMPTY_NUTRITION: Nutrition = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

/**
 * Basal metabolic rate via Mifflin–St Jeor, the equation with the best
 * validated accuracy for the general population.
 */
export function basalMetabolicRate(
  profile: Pick<UserProfile, 'sex' | 'age' | 'heightCm' | 'weightKg'>,
): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;

  return profile.sex === 'male' ? base + 5 : base - 161;
}

/** Total daily energy expenditure: BMR scaled by activity level. */
export function totalDailyEnergyExpenditure(
  profile: Pick<UserProfile, 'sex' | 'age' | 'heightCm' | 'weightKg' | 'activityLevel'>,
): number {
  return basalMetabolicRate(profile) * ACTIVITY_MULTIPLIERS[profile.activityLevel];
}

/**
 * Daily calorie change implied by a target rate of weight change, clamped to
 * `MAX_DAILY_CALORIE_DELTA`. Positive means a surplus, negative a deficit.
 */
export function dailyCalorieDelta(goalKind: GoalKind, weeklyRateKg: number): number {
  if (goalKind === 'maintain') return 0;

  const magnitude = Math.min(
    (Math.abs(weeklyRateKg) * KCAL_PER_KG_BODY_MASS) / 7,
    MAX_DAILY_CALORIE_DELTA,
  );

  return goalKind === 'lose' ? -magnitude : magnitude;
}

/**
 * Macro split as a fraction of total calories. Protein is raised when cutting
 * so muscle is better preserved in a deficit.
 */
function macroSplitFor(goalKind: GoalKind): Macros {
  switch (goalKind) {
    case 'lose':
      return { protein: 0.35, carbs: 0.35, fat: 0.3 };
    case 'gain':
      return { protein: 0.25, carbs: 0.45, fat: 0.3 };
    case 'maintain':
      return { protein: 0.3, carbs: 0.4, fat: 0.3 };
  }
}

/**
 * The user's daily targets. Returns `customGoals` untouched when the user has
 * overridden them, otherwise derives targets from their profile.
 */
export function calculateGoals(profile: UserProfile): NutritionGoals {
  if (profile.customGoals) return profile.customGoals;

  const maintenance = totalDailyEnergyExpenditure(profile);
  const target = maintenance + dailyCalorieDelta(profile.goalKind, profile.weeklyRateKg);
  const calories = Math.round(Math.max(target, MIN_CALORIES_BY_SEX[profile.sex]));

  const split = macroSplitFor(profile.goalKind);

  return {
    calories,
    protein: Math.round((calories * split.protein) / KCAL_PER_GRAM.protein),
    carbs: Math.round((calories * split.carbs) / KCAL_PER_GRAM.carbs),
    fat: Math.round((calories * split.fat) / KCAL_PER_GRAM.fat),
  };
}

/** Grams represented by `quantity` of a serving unit. */
export function gramsFor(quantity: number, unit: ServingUnit): number {
  return quantity * unit.grams;
}

export function findServingUnit(food: Food, unitId: string): ServingUnit | undefined {
  return food.servingUnits.find((unit) => unit.id === unitId);
}

/**
 * Scale a food's per-100 g nutrition to an actual portion.
 *
 * Optional fields stay optional: a food with no fiber data must not report
 * `fiber: 0`, which would read as "contains no fiber" rather than "unknown".
 */
export function scaleNutrition(per100g: Nutrition, grams: number): Nutrition {
  const factor = grams / 100;
  const scaleOptional = (value: number | undefined) =>
    value === undefined ? undefined : round1(value * factor);

  return {
    calories: Math.round(per100g.calories * factor),
    protein: round1(per100g.protein * factor),
    carbs: round1(per100g.carbs * factor),
    fat: round1(per100g.fat * factor),
    fiber: scaleOptional(per100g.fiber),
    sugar: scaleOptional(per100g.sugar),
    sodium: scaleOptional(per100g.sodium),
    saturatedFat: scaleOptional(per100g.saturatedFat),
  };
}

/** Nutrition for a portion expressed in serving units. */
export function nutritionForPortion(
  food: Food,
  quantity: number,
  servingUnitId: string,
): Nutrition {
  const unit = findServingUnit(food, servingUnitId) ?? food.servingUnits[0];

  // A food with no serving units can still be logged by weight in grams.
  const grams = unit ? gramsFor(quantity, unit) : quantity;

  return scaleNutrition(food.per100g, grams);
}

/** Sum nutrition across entries, dropping optional fields nobody reported. */
export function sumNutrition(items: readonly Nutrition[]): Nutrition {
  const total: Nutrition = { ...EMPTY_NUTRITION };
  let hasFiber = false;
  let hasSugar = false;
  let hasSodium = false;
  let hasSaturatedFat = false;

  for (const item of items) {
    total.calories += item.calories;
    total.protein += item.protein;
    total.carbs += item.carbs;
    total.fat += item.fat;

    if (item.fiber !== undefined) {
      total.fiber = (total.fiber ?? 0) + item.fiber;
      hasFiber = true;
    }
    if (item.sugar !== undefined) {
      total.sugar = (total.sugar ?? 0) + item.sugar;
      hasSugar = true;
    }
    if (item.sodium !== undefined) {
      total.sodium = (total.sodium ?? 0) + item.sodium;
      hasSodium = true;
    }
    if (item.saturatedFat !== undefined) {
      total.saturatedFat = (total.saturatedFat ?? 0) + item.saturatedFat;
      hasSaturatedFat = true;
    }
  }

  return {
    calories: Math.round(total.calories),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
    fiber: hasFiber ? round1(total.fiber ?? 0) : undefined,
    sugar: hasSugar ? round1(total.sugar ?? 0) : undefined,
    sodium: hasSodium ? round1(total.sodium ?? 0) : undefined,
    saturatedFat: hasSaturatedFat ? round1(total.saturatedFat ?? 0) : undefined,
  };
}

/**
 * Calories still available today. Exercise calories are added back, matching
 * how mainstream trackers present the number.
 */
export function caloriesRemaining(
  goalCalories: number,
  consumed: number,
  exerciseCalories = 0,
): number {
  return Math.round(goalCalories - consumed + exerciseCalories);
}

/**
 * Progress toward a target as a 0–1 fraction. Values above the target clamp to
 * 1 so progress bars do not overflow; use `caloriesRemaining` to detect
 * overshoot.
 */
export function progressFraction(consumed: number, target: number): number {
  if (target <= 0) return 0;

  return Math.min(Math.max(consumed / target, 0), 1);
}

/** Share of total calories contributed by each macro, as 0–1 fractions. */
export function macroEnergyShare(macros: Macros): Macros {
  const proteinKcal = macros.protein * KCAL_PER_GRAM.protein;
  const carbsKcal = macros.carbs * KCAL_PER_GRAM.carbs;
  const fatKcal = macros.fat * KCAL_PER_GRAM.fat;
  const total = proteinKcal + carbsKcal + fatKcal;

  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };

  return {
    protein: proteinKcal / total,
    carbs: carbsKcal / total,
    fat: fatKcal / total,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
