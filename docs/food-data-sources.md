# Food data sources

Every nutrition figure in the bundled food catalog must trace back to a cited
source and an identifier inside that source. Vietnamese data takes priority:
a food that exists in the NIN table is cited from NIN, and USDA is used only
for what NIN does not cover.

## Sources

### NIN — Bảng thành phần thực phẩm Việt Nam (2007)

- **Publisher:** Viện Dinh dưỡng Quốc gia (National Institute of Nutrition), Bộ Y tế.
- **Copy used:** the PDF hosted by FAO INFOODS,
  <https://www.fao.org/fileadmin/templates/food_composition/documents/pdf/VTN_FCT_2007.pdf>
  (567 pages, 526 foods).
- **Identifier:** the table's own food code (`Mã số`), e.g. `1001` = Gạo nếp cái.
  Cited in the catalog as `nin:<code>`.
- **Extracted file:** `data/catalog/sources/nin-2007.json`. Each entry carries
  `code`, `stt`, `page` (PDF page), `nameVi`, `nameEn`, `wastePct` and
  `per100g` (water, kcal, kJ, protein, fat, carbs, fiber, ash).
- **Basis:** per 100 g **edible portion**. `wastePct` (`Thải bỏ`) is the
  inedible share of the food as purchased.
- **Regenerate:** `node scripts/extract-nin.mjs <path-to-pdf>`. Needs
  `pdftotext` (ships with Git for Windows) for the numbers, and Python with
  `pymupdf` for the Vietnamese names (the PDF uses the legacy TCVN3/ABC font
  encoding, which the script decodes). The PDF itself is not committed.
- **Checked:** every number on pages 14, 353, 420 and 509 against the rendered
  PDF, names on a further 6 pages. Automatic checks: no duplicate codes, kcal
  agrees with 4P + 9F + 4C on every entry that has all four, kJ agrees with
  kcal × 4.184 except two rounding cases at ≤ 6 kcal.
- **Caveats:**
  - `-` in the book means "not measured" and is stored as `null`, never `0`.
    75 foods (mostly vegetables and fruit) have no fat figure.
  - Carbs exclude fiber in this table.
  - Names are stored in sentence case because the PDF prints them in
    capitals; proper nouns come out lowercased (e.g. "nhật bản").
  - A newer 2017 edition (628 foods) exists in print; codes may differ from
    2007. Not used yet because no machine-readable copy was found.
- **Rights:** the table is a copyrighted NIN publication. The catalog uses its
  nutrient values as facts and cites the code for every one. Ask NIN for
  permission before commercial use.

### USDA — FoodData Central, SR Legacy (April 2018)

- **Publisher:** U.S. Department of Agriculture, Agricultural Research Service.
- **Copy used:** the official CSV release,
  <https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip>.
- **Identifier:** the FoodData Central ID (`fdcId`), e.g. `168878` = Rice,
  white, long-grain, regular, enriched, cooked. Cited as `usda:<fdcId>`. The
  legacy NDB number is kept alongside as `ndbNumber`.
- **Extracted file:** `data/catalog/sources/usda-sr-legacy.json` (7,793 foods),
  with `description`, `category` and `per100g` (kcal, protein, fat, carbs by
  difference, total dietary fiber, water).
- **Nutrient ids used:** 1008 energy (kcal), 1003 protein, 1004 total fat,
  1005 carbohydrate by difference, 1079 total dietary fiber, 1051 water.
- **Regenerate:** `node scripts/extract-usda.mjs <dir-with-unzipped-csvs>`.
  The zip and CSVs are not committed.
- **Caveats:** a missing nutrient is `null` (fiber is missing for 562 foods).
  187 foods do not satisfy 4P + 9F + 4C within 15 %, mostly because of alcohol,
  fiber or sweeteners. They are kept as published.
- **Rights:** public domain (CC0). Citation is still given for traceability.

## How the catalog cites sources

Each record in `data/catalog/*.json` names its source, and
`scripts/build-catalog.mjs` resolves the numbers from it (types in
`src/data/catalog/record.ts`).

- **Single food:** `"source": "nin:<code>"` or `"source": "usda:<fdcId>"`, with
  no `per100g`. The build copies the numbers from the source file, so nothing
  is typed by hand. NIN prints `-` for fat on some low-fat foods, and their
  kcal already matches 4P + 4C, so a missing protein, fat or carbs value
  becomes 0. A missing fiber value stays absent.
- **Dish** (phở, bún bò, cơm tấm…): no published per-dish figures were found.
  A dish is `"source": "recipe"` with
  `"recipe": [{ "ref": "nin:<code>" | "usda:<fdcId>" | "water", "grams": n }]`
  and an optional cooked weight `yieldGrams`. The build sums the ingredients
  and scales the total to 100 g of the dish. Every ingredient code can be
  traced, but the recipe proportions are FoodFen's own estimate.
- **Packaged product:** `"source": "label"` with
  `"label": { "brand", "url" }` and the `per100g` copied from that label.
  These are the only hand-typed figures allowed.
- **Rounding:** kcal to a whole number, macros and fiber to one decimal.
- **Output:** the built `foods.json` carries `source`, a `sourceRef`
  (`nin:…`, `usda:…`, `label:<brand>`) and `verified: true`. The app shows a
  green tick next to a verified food's name.
- **Enforcement:** `npm run catalog:build` fails on any record without a
  cited source. While old records are being migrated,
  `node scripts/build-catalog.mjs --allow-legacy` passes them through unchanged
  and without the tick.

### Migration status

**656 of the 670 catalog foods are cited:** 144 NIN, 162 USDA, 350 recipes.

- **Single foods** cite NIN when NIN has the same food in the same state.
  Otherwise they cite USDA, e.g. where NIN has white asparagus only, or its
  "ớt" is chili rather than bell pepper.
- **Dishes** are recipes sized to their default serving.
  - Each recipe record keeps a `note` with its assumptions, e.g. cooking loss
    on grilled meat, oil absorbed when frying, or bone share. The note stays
    in the data file and is not bundled into the app.
  - Where a recipe ingredient has no exact entry, the nearest entry stands in
    and the note says so, e.g. tilapia for cá basa in a kho dish, or goby for
    cá kèo.
- **14 records stay legacy.** They have no tick and keep their old figures:
  - **No matching entry:** xoài xanh, măng cụt, cá basa, sò huyết, rong biển
    khô, roi, bột ngọt, giấm gạo, khoai lang chiên.
  - **Doubtful match:** da heo luộc. NIN's pork skin is lean and raw.
  - **Branded, need their package label:** Yakult, bột chiên giòn, sa tế,
    hạt nêm.
