import type { CatalogFood } from '@/types/models';

/**
 * Types for the bundled food catalog.
 *
 * `CatalogSourceRecord` is the shape hand-authored in `data/catalog/*.json`.
 * `BuiltCatalogFood` is what `scripts/build-catalog.mjs` emits into
 * `src/data/catalog/foods.json` (committed): the source record plus a stable
 * slug `id`, serving ids, and folded (diacritic- and `đ`-insensitive)
 * name/alias fields the in-memory search scans.
 */

export type CatalogSource = 'label' | 'nin' | 'recipe-estimate' | 'chain' | 'generic';

export interface CatalogSourceServing {
  label: string;
  grams: number;
  default?: boolean;
}

export interface CatalogSourceRecord {
  name: string;
  aliases: string[];
  category: string;
  per100g: {
    kcal: number;
    carbsG: number;
    proteinG: number;
    fatG: number;
    fiberG?: number;
  };
  servings: CatalogSourceServing[];
  source: CatalogSource;
}

export interface BuiltCatalogFood extends CatalogFood {
  source: CatalogSource;
  /** `foldVi(name)` — precomputed so search never folds the whole list. */
  nameFold: string;
  /** `aliases.map(foldVi)`. */
  aliasesFold: string[];
}
