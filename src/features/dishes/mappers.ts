import type { RemoteDish } from '@/api/schemas';
import type { LogManualEntryInput } from '@/features/diary/queries';
import type { DateKey } from '@/lib/date';
import type { MealType } from '@/types/models';

const oneDecimal = (value: number): number => Math.round(value * 10) / 10;

/**
 * A dish becomes a `manual` diary entry: the sync contract has no catalog
 * input method, and a dish is a fixed set of totals with no ingredient rows,
 * which is exactly what a manual entry is. Rounding matches the manual-entry
 * form: whole kcal, macros to one decimal.
 */
export type DishNutrition = Pick<
  RemoteDish,
  'name' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'servingG'
>;

export function dishToManualEntry(
  dish: DishNutrition,
  mealType: MealType,
  loggedOn: DateKey,
): LogManualEntryInput {
  return {
    name: dish.name,
    emoji: null,
    mealType,
    loggedOn,
    amount: dish.servingG,
    amountUnit: 'g',
    totalKcal: Math.round(dish.kcal),
    carbsG: oneDecimal(dish.carbsG),
    proteinG: oneDecimal(dish.proteinG),
    fatG: oneDecimal(dish.fatG),
  };
}

/** Whole kcal the dish exceeds what is left today by; undefined when it is within budget or the user has no goal. Independent of the server's `fits` (suggested) flag. */
export function overKcal(
  dish: Pick<RemoteDish, 'kcal'>,
  remainingKcal: number | null,
): number | undefined {
  if (remainingKcal === null) return undefined;

  // Display rounding only: whole kcal, with an overspent day counted from zero.
  const over = Math.round(dish.kcal - Math.max(remainingKcal, 0));
  return over > 0 ? over : undefined;
}

/** `45000` → `45.000₫`. Hand-rolled: Hermes' `Intl` locale data is not guaranteed. */
export function formatVnd(amount: number): string {
  return `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}₫`;
}

const EXCEED_CODES = {
  exceeds_kcal: 'kcal',
  exceeds_carbs: 'carbs',
  exceeds_fat: 'fat',
} as const;

export type ExceededNutrient = (typeof EXCEED_CODES)[keyof typeof EXCEED_CODES];

/** Unknown reason codes are ignored on purpose: the server may add more. */
export function describeReasons(reasons: string[]): {
  fillsProtein: boolean;
  exceeds: ExceededNutrient[];
} {
  const exceeds: ExceededNutrient[] = [];
  for (const code of reasons) {
    if (Object.hasOwn(EXCEED_CODES, code)) exceeds.push(EXCEED_CODES[code as keyof typeof EXCEED_CODES]);
  }
  return { fillsProtein: reasons.includes('fills_protein'), exceeds };
}
