import type { CatalogFood } from '@/types/models';

/**
 * Types for the bundled food catalog.
 *
 * `CatalogSourceRecord` is the shape hand-authored in `data/catalog/*.json`;
 * every food cites a source. `nin:<code>` / `usda:<fdcId>` records carry no
 * `per100g` (the build copies it from `data/catalog/sources/`), a `recipe` is
 * summed from cited ingredients, and a `label` carries hand-entered package
 * figures cited by URL. Legacy records (`recipe-estimate`, `generic`, `chain`,
 * or `label` without a `label` object) keep their own `per100g` until migrated.
 * `BuiltCatalogFood` is what `scripts/build-catalog.mjs` emits into
 * `src/data/catalog/foods.json` (committed): the resolved record plus a stable
 * slug `id`, serving ids, and folded (diacritic- and `đ`-insensitive)
 * name/alias fields the in-memory search scans.
 */

export type LegacyCatalogSource = 'label' | 'nin' | 'recipe-estimate' | 'chain' | 'generic';

/** The `source` of a built food: the source kind, or a legacy string. */
export type CatalogSource = 'nin' | 'usda' | 'recipe' | 'label' | LegacyCatalogSource;

export interface CatalogSourceServing {
  label: string;
  grams: number;
  default?: boolean;
}

export interface CatalogPer100g {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG?: number;
}

/** `nin:<code>`, `usda:<fdcId>` or the built-in zero-nutrient `water`. */
export type RecipeRef = `nin:${string}` | `usda:${string}` | 'water';

export interface RecipeIngredient {
  ref: RecipeRef;
  grams: number;
}

interface CatalogRecordBase {
  name: string;
  aliases: string[];
  category: string;
  servings: CatalogSourceServing[];
}

export interface NinRecord extends CatalogRecordBase {
  source: `nin:${string}`;
}

export interface UsdaRecord extends CatalogRecordBase {
  source: `usda:${string}`;
}

export interface RecipeRecord extends CatalogRecordBase {
  source: 'recipe';
  recipe: RecipeIngredient[];
  /** Cooked weight in grams; defaults to the sum of ingredient grams. */
  yieldGrams?: number;
}

export interface LabelRecord extends CatalogRecordBase {
  source: 'label';
  label: { brand: string; url: string };
  per100g: CatalogPer100g;
}

export interface LegacyRecord extends CatalogRecordBase {
  source: LegacyCatalogSource;
  per100g: CatalogPer100g;
  label?: undefined;
}

export type CatalogSourceRecord =
  | NinRecord
  | UsdaRecord
  | RecipeRecord
  | LabelRecord
  | LegacyRecord;

export interface BuiltCatalogFood extends CatalogFood {
  source: CatalogSource;
  /** `nin:<code>`, `usda:<fdcId>` or `label:<brand>`; absent for recipes and legacy records. */
  sourceRef?: string;
  /** `foldVi(name)` — precomputed so search never folds the whole list. */
  nameFold: string;
  /** `aliases.map(foldVi)`. */
  aliasesFold: string[];
}
