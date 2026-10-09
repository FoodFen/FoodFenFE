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

/** `45000` → `45.000₫`. Hand-rolled: Hermes' `Intl` locale data is not guaranteed. */
export function formatVnd(amount: number): string {
  return `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}₫`;
}
