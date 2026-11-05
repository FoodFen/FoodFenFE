# Food catalog sync

Public read of the server-side food catalog. The app merges it over the bundled `foods.json`, and the
`catalog:pull` script uses it to refresh that bundle. Live on prod since FoodFenBE `c348776`.

## `GET /foods?updatedSince=<iso>`

- **No auth.** The catalog is public data, so guests sync too.
- `updatedSince` is optional, ISO 8601 with a timezone. A malformed value → `422`.
  - **Without it**, the response holds every food, archived ones included (~670 rows).
  - **With it**, the response holds the foods whose `updatedAt >= updatedSince` (inclusive), archived
    ones included.
- No paging.

```json
{
  "foods": [
    {
      "slug": "ba-chi-nuong",
      "name": "Ba chỉ nướng",
      "nameEn": "grilled pork belly",
      "aliases": ["ba chi nuong", "grilled pork belly"],
      "category": "chien-nuong",
      "sourceKind": "recipe",
      "sourceRef": "recipe",
      "verified": true,
      "per100g": { "kcal": 324, "carbsG": 4.8, "proteinG": 19.6, "fatG": 25.1, "fiberG": 0.1 },
      "servings": [
        { "label": "1 phần (~120 g)", "grams": 120, "default": true },
        { "label": "100 g", "grams": 100, "default": false }
      ],
      "archived": false,
      "updatedAt": "2026-11-02T17:10:20.141148Z"
    }
  ],
  "serverTime": "2026-11-05T16:03:17.758507Z"
}
```

- `slug` is the permanent id. It is the same as the bundle's `id` and `ingredient.catalog_food_id`.
- `nameEn` may be null. Values backfilled from aliases are lowercase.
- `sourceKind` is one of `nin`, `usda`, `recipe`, `label`, `team` or `legacy`. `verified` is
  `sourceKind != legacy`. `sourceRef` is null only for `legacy`.
- `per100g.fiberG` null means "not tracked", which is not the same as 0.
- `servings` has exactly one `default: true` and carries no ids. The app derives them as
  `<slug>-s<index>`, the same way the bundle does.
- An archived food stays resolvable by slug. The app only hides it from search and recents.
- `serverTime` is read **before** the query runs. Use it as the next `updatedSince`, never the device
  clock. A row written while the query runs is then fetched again next time instead of being missed.
  Rows are keyed by slug, so applying one twice is harmless.
- Every admin create, edit, archive and unarchive bumps `updatedAt`.
