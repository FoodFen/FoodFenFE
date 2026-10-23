import { z } from 'zod';

import type { CatalogFood, CatalogServing } from '@/types/models';

import { getScannedFood, saveScannedFood } from './foodCatalog';

/**
 * Barcode -> food, via Open Food Facts.
 *
 * A product already scanned once is answered from local storage with no
 * network; a fresh hit is saved there (and resolves through `getCatalogFood`
 * from then on). Misses are never stored, and network failures propagate so
 * the caller can tell "not found" from "could not look".
 */

const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_FIELDS = 'product_name,product_name_vi,brands,nutriments,serving_quantity';
const KJ_PER_KCAL = 4.184;

// Open Food Facts sends numbers as numbers or numeric strings, and omits them freely.
const num = z.unknown().transform((value) => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
});

const responseSchema = z.object({
  status: z.number().optional(),
  product: z
    .object({
      product_name: z.string().nullish(),
      product_name_vi: z.string().nullish(),
      brands: z.string().nullish(),
      serving_quantity: num,
      nutriments: z
        .object({
          'energy-kcal_100g': num,
          energy_100g: num,
          proteins_100g: num,
          carbohydrates_100g: num,
          fat_100g: num,
          fiber_100g: num,
        })
        .optional(),
    })
    .optional(),
});

function toCatalogFood(
  code: string,
  body: z.infer<typeof responseSchema>,
): CatalogFood | null {
  const product = body.status === 1 ? body.product : undefined;
  if (!product) return null;

  const name = product.product_name_vi?.trim() || product.product_name?.trim();
  const n = product.nutriments;
  if (!name || !n) return null;

  // Rounded to whole kcal; kJ converted at 4.184 kJ per kcal.
  const kcal =
    n['energy-kcal_100g'] ??
    (n.energy_100g === undefined ? undefined : Math.round(n.energy_100g / KJ_PER_KCAL));
  if (kcal === undefined) return null;

  const id = `off:${code}`;
  const servingGrams = product.serving_quantity ?? 0;
  const servings: CatalogServing[] = [];

  // A 100 g package serving would be mistaken for the plain "100 g" serving.
  if (servingGrams > 0 && servingGrams !== 100) {
    servings.push({
      id: `${id}-s0`,
      label: `1 phần (~${Math.round(servingGrams)} g)`,
      grams: servingGrams,
      default: true,
    });
  }
  servings.push({ id: `${id}-s${servings.length}`, label: '100 g', grams: 100 });

  return {
    id,
    name,
    brand: product.brands?.split(',')[0]?.trim() || undefined,
    aliases: [],
    category: 'barcode',
    per100g: {
      kcal,
      proteinG: n.proteins_100g ?? 0,
      carbsG: n.carbohydrates_100g ?? 0,
      fatG: n.fat_100g ?? 0,
      fiberG: n.fiber_100g ?? null,
    },
    servings,
  };
}

export async function lookupBarcode(code: string): Promise<CatalogFood | null> {
  const saved = getScannedFood(`off:${code}`);
  if (saved) return saved;

  const response = await fetch(
    `${OFF_URL}/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`,
    { headers: { 'User-Agent': 'FoodFen/1.0' } },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Open Food Facts responded ${response.status}.`);

  const food = toCatalogFood(code, responseSchema.parse(await response.json()));
  if (food) saveScannedFood(food);

  return food;
}
