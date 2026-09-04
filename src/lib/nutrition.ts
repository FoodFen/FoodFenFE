import type {
  ActivityLevel,
  CatalogFood,
  CatalogServing,
  DietType,
  Macros,
  Nutrition,
  UserProfile,
} from '@/types/models';

/** Kilocalories per gram. Converts macro targets to grams and back. */
export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

/** Kilocalories in one kilogram of body mass — the standard planning figure. */
const KCAL_PER_KG_BODY_MASS = 7700;

/**
 * Daily deficit or surplus is capped so the app never suggests an unsafe
 * target. 1 kg/week is already an aggressive rate.
 */
const MAX_DAILY_KCAL_DELTA = 1000;

/** Floors from common clinical guidance; we never target below these. */
const MIN_KCAL_BY_GENDER = { male: 1500, female: 1200, other: 1200 } as const;

/** Millilitres of water per kilogram of body mass, the usual rule of thumb. */
const WATER_ML_PER_KG = 35;

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

export const DIET_LABELS: Record<DietType, string> = {
  balanced: 'Balanced',
  low_carb: 'Low carb',
  high_protein: 'High protein',
  keto: 'Keto',
  vegetarian: 'Vegetarian',
};

export const EMPTY_NUTRITION: Nutrition = {
  kcal: 0,
  carbsG: 0,
  proteinG: 0,
  fatG: 0,
};

/** Whole years, from the birth year the profile stores. */
export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  return Math.max(now.getFullYear() - birthYear, 0);
}

/**
 * Basal metabolic rate via Mifflin–St Jeor, the equation with the best
 * validated accuracy for the general population.
 *
 * The equation is only defined for male and female. `other` takes the mean of
 * the two constants rather than defaulting to one of them, which would bias
 * the target by ±83 kcal for everyone who selects it.
 */
export function basalMetabolicRate(
  profile: Pick<UserProfile, 'gender' | 'birthYear' | 'height' | 'weightCurrent'>,
  now: Date = new Date(),
): number {
  const age = ageFromBirthYear(profile.birthYear, now);
  const base = 10 * profile.weightCurrent + 6.25 * profile.height - 5 * age;

  switch (profile.gender) {
    case 'male':
      return base + 5;
    case 'female':
      return base - 161;
    case 'other':
      return base - 78;
  }
}

/** Total daily energy expenditure: BMR scaled by activity level. */
export function totalDailyEnergyExpenditure(
  profile: Pick<
    UserProfile,
    'gender' | 'birthYear' | 'height' | 'weightCurrent' | 'activityLevel'
  >,
  now: Date = new Date(),
): number {
  return basalMetabolicRate(profile, now) * ACTIVITY_MULTIPLIERS[profile.activityLevel];
}

export type GoalDirection = 'lose' | 'maintain' | 'gain';

/**
 * Which way the user is trying to move.
 *
 * Derived from goal weight rather than stored, because storing both is storing
 * the same fact twice — and they can disagree.
 */
export function goalDirection(
  profile: Pick<UserProfile, 'weightCurrent' | 'weightGoal'>,
): GoalDirection {
  // A goal within half a kilo of current weight is maintenance, not a plan;
  // a stricter comparison would make everyone who rounds their weight a cutter.
  const difference = profile.weightGoal - profile.weightCurrent;

  if (Math.abs(difference) < 0.5) return 'maintain';

  return difference < 0 ? 'lose' : 'gain';
}

/**
 * Daily calorie change implied by the target rate, clamped to
 * `MAX_DAILY_KCAL_DELTA`. Negative is a deficit, positive a surplus.
 */
export function dailyKcalDelta(direction: GoalDirection, weeklyRateKg: number): number {
  if (direction === 'maintain') return 0;

  const magnitude = Math.min(
    (Math.abs(weeklyRateKg) * KCAL_PER_KG_BODY_MASS) / 7,
    MAX_DAILY_KCAL_DELTA,
  );

  return direction === 'lose' ? -magnitude : magnitude;
}

/**
 * Macro split as a fraction of total calories.
 *
 * Diet type leads where the user has chosen one; otherwise the split follows
 * the goal, raising protein on a cut so muscle is better preserved.
 */
function macroSplitFor(direction: GoalDirection, dietType: DietType): Macros {
  switch (dietType) {
    case 'low_carb':
      return { proteinG: 0.3, carbsG: 0.2, fatG: 0.5 };
    case 'high_protein':
      return { proteinG: 0.4, carbsG: 0.35, fatG: 0.25 };
    case 'keto':
      return { proteinG: 0.25, carbsG: 0.05, fatG: 0.7 };
    case 'balanced':
    case 'vegetarian':
      break;
  }

  switch (direction) {
    case 'lose':
      return { proteinG: 0.35, carbsG: 0.35, fatG: 0.3 };
    case 'gain':
      return { proteinG: 0.25, carbsG: 0.45, fatG: 0.3 };
    case 'maintain':
      return { proteinG: 0.3, carbsG: 0.4, fatG: 0.3 };
  }
}

/** The daily targets a `daily_goal` row is created from. */
export interface CalculatedTargets {
  targetKcal: number;
  targetCarbsG: number;
  targetProteinG: number;
  targetFatG: number;
  targetWaterMl: number;
}

/**
 * Derive daily targets from the profile.
 *
 * Only used when `calorieCalcMode` is `auto`; a `manual` user's targets come
 * from whatever they typed into their latest `daily_goal` row, and this is
 * never applied over the top of them.
 */
export function calculateTargets(
  profile: Pick<
    UserProfile,
    | 'gender'
    | 'birthYear'
    | 'height'
    | 'weightCurrent'
    | 'weightGoal'
    | 'activityLevel'
    | 'dietType'
    | 'weeklyRateKg'
  >,
  now: Date = new Date(),
): CalculatedTargets {
  const direction = goalDirection(profile);
  const maintenance = totalDailyEnergyExpenditure(profile, now);
  const targetKcal = Math.round(
    Math.max(
      maintenance + dailyKcalDelta(direction, profile.weeklyRateKg),
      MIN_KCAL_BY_GENDER[profile.gender],
    ),
  );

  const split = macroSplitFor(direction, profile.dietType);

  return {
    targetKcal,
    targetProteinG: Math.round((targetKcal * split.proteinG) / KCAL_PER_GRAM.protein),
    targetCarbsG: Math.round((targetKcal * split.carbsG) / KCAL_PER_GRAM.carbs),
    targetFatG: Math.round((targetKcal * split.fatG) / KCAL_PER_GRAM.fat),
    targetWaterMl: Math.round((profile.weightCurrent * WATER_ML_PER_KG) / 50) * 50,
  };
}

/** What one quantity of a catalog serving weighs. */
export function gramsForServing(quantity: number, serving: CatalogServing): number {
  return quantity * serving.grams;
}

export function findServing(
  food: CatalogFood,
  servingId: string,
): CatalogServing | undefined {
  return food.servings.find((serving) => serving.id === servingId);
}

/**
 * Scale a catalog food's per-100 g figures to an actual weight, for prefilling
 * an ingredient row.
 *
 * `fiberG` stays absent when the source has no value: reporting `0` would
 * claim the food contains no fiber rather than that nobody measured it.
 */
export function scaleNutrition(per100g: Nutrition, grams: number): Nutrition {
  const factor = grams / 100;

  return {
    kcal: Math.round(per100g.kcal * factor),
    carbsG: round1(per100g.carbsG * factor),
    proteinG: round1(per100g.proteinG * factor),
    fatG: round1(per100g.fatG * factor),
    fiberG:
      per100g.fiberG === undefined || per100g.fiberG === null
        ? undefined
        : round1(per100g.fiberG * factor),
  };
}

/** Nutrition for a portion expressed in catalog servings. */
export function nutritionForServing(
  food: CatalogFood,
  quantity: number,
  servingId: string,
): Nutrition {
  const serving = findServing(food, servingId) ?? food.servings[0];

  // A food with no servings defined can still be logged by weight in grams.
  return scaleNutrition(
    food.per100g,
    serving ? gramsForServing(quantity, serving) : quantity,
  );
}

/**
 * Sum nutrition across ingredients or entries.
 *
 * `fiberG` survives only if at least one item reported it, so a total of
 * `undefined` still means "not measured" rather than "none".
 */
export function sumNutrition(items: readonly Nutrition[]): Nutrition {
  let kcal = 0;
  let carbsG = 0;
  let proteinG = 0;
  let fatG = 0;
  let fiberG: number | undefined;

  for (const item of items) {
    kcal += item.kcal;
    carbsG += item.carbsG;
    proteinG += item.proteinG;
    fatG += item.fatG;

    if (item.fiberG !== undefined && item.fiberG !== null) {
      fiberG = (fiberG ?? 0) + item.fiberG;
    }
  }

  return {
    kcal: Math.round(kcal),
    carbsG: round1(carbsG),
    proteinG: round1(proteinG),
    fatG: round1(fatG),
    fiberG: fiberG === undefined ? undefined : round1(fiberG),
  };
}

/**
 * Calories still available today. Exercise is added back, matching how
 * mainstream trackers present the number.
 */
export function kcalRemaining(
  targetKcal: number,
  consumedKcal: number,
  exerciseKcal = 0,
): number {
  return Math.round(targetKcal - consumedKcal + exerciseKcal);
}

/**
 * Progress toward a target as a 0–1 fraction. Values above the target clamp to
 * 1 so bars do not overflow; use `kcalRemaining` to detect overshoot.
 */
export function progressFraction(consumed: number, target: number): number {
  if (target <= 0) return 0;

  return Math.min(Math.max(consumed / target, 0), 1);
}

/** Share of total calories contributed by each macro, as 0–1 fractions. */
export function macroEnergyShare(macros: Macros): Macros {
  const proteinKcal = macros.proteinG * KCAL_PER_GRAM.protein;
  const carbsKcal = macros.carbsG * KCAL_PER_GRAM.carbs;
  const fatKcal = macros.fatG * KCAL_PER_GRAM.fat;
  const total = proteinKcal + carbsKcal + fatKcal;

  if (total <= 0) return { proteinG: 0, carbsG: 0, fatG: 0 };

  return {
    proteinG: proteinKcal / total,
    carbsG: carbsKcal / total,
    fatG: fatKcal / total,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
