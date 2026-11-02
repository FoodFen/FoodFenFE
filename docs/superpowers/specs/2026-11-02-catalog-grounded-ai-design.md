# Catalog-grounded AI food analysis + server-side food catalog — design

Date: 2026-11-02 · Status: draft for approval · Repos: FoodFenBE, FoodFenFE (Mobile), FoodFenWeb

## Why

AI meal capture (`POST /ai/food/analyze-image`, `POST /ai/food/analyze-text`) asks Gemini to estimate the
foods, the grams, **and** the kcal/macros of each row (`DEFAULT_GEMINI_FOOD_ANALYSIS_PROMPT` in
FoodFenBE `src/infrastructure/config.py`, `gemini_food_vision_provider.py`). Nothing checks those numbers
against our food data. The Mobile app ships a cited catalog of 670 foods
(`src/data/catalog/foods.json`, built from NIN 2007, USDA, recipes summed from cited ingredients and
package labels; see `docs/food-data-sources.md`). The AI never sees it. Every AI-logged meal is therefore
nutrition the model made up.

The owner's rule: **portion size and count may be the AI's estimate; nutrition must come from a sourced
record whenever one exists.**

## Rules (decided by the owner)

1. **Division of labour.** The AI recognises the foods and estimates grams and count. Nutrition for a
   matched food = the catalog's per-100 g figures × the AI's grams.
2. **Whole dish first.** If the catalog has the whole dish (phở bò, cơm tấm sườn…), return one row for it.
   Only when no whole dish matches, break the dish into components, and match each component to the
   catalog on its own.
3. **Unmatched rows stay AI estimates.** A component the catalog doesn't have keeps the model's own
   kcal/macro estimate, with no tick.
4. **Green tick = has a source.** It is independent of who matched the food. Sourced kinds: NIN, USDA, a
   recipe of cited ingredients, a package label, and **FoodFen team** (an admin entered it and is fully
   accountable for it). No tick when:
   - the row is an AI estimate, or
   - the row matched a catalog food that has no source (today's 14 "legacy" records: `generic`,
     `recipe-estimate`, and one `label` without a label object). Such a match still uses the catalog's
     numbers.
5. **Admins maintain the catalog** from the Web admin. They add missing foods and fix wrong ones, acting
   on feedback that arrives outside the app. Every add and edit records which admin did it and when.
6. **Out of scope now:** an in-app "report wrong food" feature. Re-computing meals logged in the past.
   Matching against restaurant dishes (`dish` table), because a photo can't tell which restaurant a dish
   came from.

## Anti-goals

- A matched row whose nutrition still comes from the model.
- A tick on anything without a source.
- A slower or more expensive analysis than the user tolerates today. Target: ≤ ~1.5× today's median
  latency. Cost must be measured and reported before rollout.
- Breaking older app versions. Contract changes are additive only.

## Phases and order

The work ships in four phases, each usable on its own. Phases 1 and 2 solve the reported problem;
3 and 4 make the catalog maintainable.

| Phase | What | Repos | Depends on |
|---|---|---|---|
| 1 | Catalog lives in the BE | BE | — |
| 2 | AI grounded in the catalog | BE, then Mobile | 1 (Mobile only needs the contract) |
| 3 | Admin catalog management | BE, then Web | 1 |
| 4 | Mobile syncs the catalog from the BE | BE, then Mobile | 1, 3 |

---

## Phase 1 — Catalog in the BE

**Goal.** The BE owns a `food` table seeded with today's 670 foods, ids and numbers identical to the
Mobile bundle, and the application layer can read it.

**Decisions**
- **Public id = the catalog slug** (`banh-bao-chay`), stable forever. The Mobile bundle and its local
  `ingredient.catalog_food_id` already reference foods by it. That column is local-only: sync and the BE
  food-entry schema don't carry it, and Phase 2 doesn't change that.
- **Fiber.** A food with no fiber value keeps `fiber_g` null. Never seed it as 0. The BE rule "UUID PK for a new table" still
  holds: there is a UUID PK, and `slug` is a unique, immutable column.
- **Columns:**
  - `slug`, `name`, `aliases` (list of strings), `category`
  - `source_kind` (`StrEnum`: `nin`, `usda`, `recipe`, `label`, `team`, `legacy`)
  - `source_ref` (`nin:1001`, `usda:…`, `label:<brand>`, the literal `recipe` for recipe foods (their
    `foods.json` record has no `sourceRef`), `team`, or null for legacy)
  - per-100 g `kcal` (int), `carbs_g`, `protein_g`, `fat_g`, `fiber_g` (nullable)
  - `servings` (list of `{label, grams, default}`)
  - `archived` (bool, default false)
  - `created_at`, `updated_at`, `updated_by_admin_id` (nullable for seeded rows)
- **`verified` is derived, never stored:** `source_kind != legacy`. Map today's legacy sources
  (`generic`, `recipe-estimate`, `label` without `sourceRef`) to `legacy`.
- **Seed** from a committed copy of Mobile's built `src/data/catalog/foods.json`, loaded by an Alembic data
  migration. Precedent: the mascot seed migrations. Recipe breakdowns and source notes are not imported;
  only the resolved per-100 g figures are.
- **Source of truth.** After Phase 1, the BE table is the source of truth for **new** foods and edits.
  Mobile's `data/catalog` pipeline and bundle stay as the offline snapshot until Phase 4 decides how they
  are refreshed. Nobody hand-edits both sides.
- No public endpoint yet. The Phase 2 use case reads the table through a repository port.

**Done when**
- the migration applies on an empty DB and on prod data;
- the table has 670 rows, and each row's slug and numbers equal `foods.json`;
- a `FoodCatalogRepository` port and its implementation can list all non-archived foods and get one by slug;
- tests, `lint-imports` and the BE verify command all pass.

---

## Phase 2 — AI grounded in the catalog

**Approach: put the catalog in the prompt, and have the model return a slug.** Not SQL LIKE matching
(AI names are in a different language or wording from the catalog: "grilled chicken breast" vs
"Ức gà nướng"). Not RAG either: 670 foods fit in the prompt. Revisit RAG only if the catalog grows to
tens of thousands of foods.

### BE

- **Catalog in the prompt.** Each request's prompt carries one line per non-archived food:
  `slug | name | aliases | default serving grams`.
  - The block is built from the repository and cached in process.
  - The cache is rebuilt when the catalog changes (Phase 3 must invalidate it) and has a TTL fallback.
  - The block must be byte-identical between requests so Gemini's prompt caching hits (see the rollout
    bar).
- **Prompt rules** (replace the current "estimate kcal/macros" instructions):
  1. List each distinct food. Prefer a whole-dish catalog entry. If none fits, list the components.
  2. For each row, return `catalog_id` = the slug of the closest catalog food that truly is the same
     food, or null. Never pick a merely similar food: a wrong match is worse than none.
  3. Estimate `quantity_g` for the portion shown, using the catalog food's default serving as a size
     anchor. Keep the existing count convention (`"Egg (x3)"`).
  4. Always return a `kcal`/macros/`fiber_g` estimate for every row, so a row whose slug turns out to be
     unknown still has numbers. The server discards the estimate on a matched row (my call; see below).
  5. `confidence` keeps today's meaning.
- **Prompt assembly** (my call):
  - The catalog block and the grounding rules are code, not configuration. Retire the
    `GEMINI_FOOD_ANALYSIS_PROMPT` env override, because a stale override in prod would silently turn
    grounding off. Check the Render env and remove the variable there if it is set.
  - Put the catalog block first in the system instruction so Gemini's implicit prefix caching can apply.
- **Kill switch** (my call): an env flag `FOOD_ANALYSIS_GROUNDING` (default on). When off, the old prompt
  and behaviour run unchanged, and the new response fields come back null/false. No deploy is needed to
  turn it off.
- **Rollout bar** (my call):
  - Before switching it on in prod, measure on ~20 sample photos and texts: median latency, input tokens
    per call, and match rate.
  - Ship if latency is ≤ 1.5× today. Otherwise report to the owner with the numbers.
  - Cost has been accepted by the owner. The prod key is paid and covered by Google credit.
  - Estimate:
    - the full catalog block (`slug | name | aliases | default g`, ~47k chars) is ~15k input tokens;
    - on `gemini-3.5-flash-lite` ($0.30/M input, $0.03/M cached, $2.50/M output) that adds ~$4.5 per
      1,000 analyses uncached, or ~$0.45 per 1,000 with cache hits.
  - **Caching is required, not optional.** Put the catalog block first in the system instruction, keep it
    byte-identical between requests, and rely on Gemini's implicit caching. Confirm hits in the usage log
    (`cached_content_token_count`; add it to `log_usage`).
  - Explicit context caching (storage ~$11/month for 15k tokens) pays off only above ~4 analyses/hour.
    Add it only if the logs show implicit caching missing.
  - If tokens must drop, trim aliases first: ~8k tokens without them.
- **Gemini errors** (my call): a rate-limit or model error fails the request as today (5xx → the app's
  retry message). There is no silent fallback to an ungrounded answer.
- **Server-side grounding** (use case, not controller):
  - for each row whose `catalog_id` is a known, non-archived slug, compute
    `kcal = round(per100g.kcal × g / 100)` and each macro rounded to one decimal, the same rounding the
    catalog build uses;
  - `fiber_g` is null when the catalog has no fiber value;
  - an unknown slug or a null id is treated as unmatched, and the model's estimate is used;
  - a matched row's numbers come only from the catalog; the model's own estimate for that row is
    discarded, but logged next to the catalog figure as a quality signal;
  - `name` stays the model's name, in the requested language, and is what the UI shows. `catalogName` is
    always the catalog's (Vietnamese) name.
- **Logging.** Per analysis, log the matched/unmatched counts and the input tokens. This feeds the cost and
  quality check.

### Wire contract — additive fields on each `ingredients[]` row

```json
{
  "name": "Phở bò",
  "quantityG": 550,
  "kcal": 446, "carbsG": 56.1, "proteinG": 24.8, "fatG": 13.2, "fiberG": 1.1,
  "confidence": 0.8,
  "catalogFoodId": "pho-bo",
  "catalogName": "Phở bò",
  "verified": true,
  "sourceRef": "recipe",
  "per100g": { "kcal": 81, "carbsG": 10.2, "proteinG": 4.5, "fatG": 2.4, "fiberG": 0.2 }
}
```

- An unmatched row has `catalogFoodId`, `catalogName`, `sourceRef` and `per100g` all null, and
  `verified: false`.
- `per100g` is included so the app can re-scale when the user edits grams, even for a food the app's
  bundle doesn't have yet (one added by an admin).
- Update `docs/backend-contracts/ai-food-capture.md` (FoodFenFE) in the same change as the BE
  implementation.

### Mobile

- **Schema.** Extend `aiFoodAnalysisResponseSchema` with the new fields, all optional or nullable, so a
  BE without the change still parses.
- **Draft rows.** In the meal draft (`app/log/manual.tsx` → `useDraftStore`), an AI row keeps
  `catalogFoodId`, `verified` and `per100g`:
  - editing grams re-scales from `per100g`;
  - a row without `per100g` keeps today's behaviour.
- **Tick.** Draft rows show `VerifiedTick` when `verified`.
- **Persistence.** Saving writes `catalogFoodId` onto `ingredient.catalog_food_id` (the column exists).
  No new column.
- **Not in Phase 2:** a tick in diary history.

**Done when**
- a photo of a bowl of phở returns one `pho-bo` row with catalog-derived numbers and a tick;
- a dish not in the catalog returns component rows, each matched where possible;
- an unknown item returns a no-tick estimate;
- old app builds still work against the new BE;
- median latency and input-token cost are measured and reported against today's baseline;
- BE and Mobile verify both pass.

---

## Phase 3 — Admin catalog management (decision level; detail in its own session)

- **BE admin endpoints** (admin role, same auth as the existing admin endpoints): list with
  accent-insensitive search and paging (reuse the restaurant-search approach), get, create, update,
  archive/unarchive. No hard delete: slugs are referenced by users' logged meals.
- **Admin-entered foods.**
  - A food created by an admin gets `source_kind=team`, `source_ref="team"`, and is verified.
  - Editing the numbers of a NIN/USDA/recipe/label food switches it to `team`: the admin now owns the
    numbers, and the original reference is kept in the change log.
  - A legacy food becomes verified once an admin saves it as `team`.
- **Audit.** An append-only `food_change` log stores admin id, timestamp, action, and before/after
  values. It is visible to admins only.
- **Slug.** Generated from the name on create, unique, immutable after create.
- Any change invalidates the Phase 2 prompt cache.
- **Web.** An admin page "Thức ăn" beside the existing mascot and restaurant admin pages: a list with
  search, a create/edit form (name, aliases, category, per-100 g numbers, servings), archive, and a view of
  the change log for one food.

## Phase 4 — Mobile syncs the catalog (decision level; detail in its own session)

- **BE.** A public read endpoint, `GET /foods?updatedSince=<iso>`, returns the changed foods, including
  archived ones so the app can hide them. It needs no auth: the catalog is public data.
- **Mobile.**
  - Keep the bundled `foods.json` as the offline baseline.
  - Persist a delta overlay of BE foods newer than the bundle.
  - Search and `getCatalogFood` read the bundle merged with the overlay; archived foods are hidden from
    search but still resolve by id.
  - The sync is fire-and-forget, on app start and on foreground, per CLAUDE.md's no-blocking rule.
- How the bundle snapshot gets regenerated from the BE (a script that dumps the BE table into `foods.json`)
  is decided in that phase.

---

## Left to the builders

- Whether explicit context caching is worth adding, judged from logged cache hits (see the rollout bar).
- The exact prompt wording, within the rules above.
- Table and column names, and the shape of the data migration, within BE conventions.
- Mobile UI details of the tick on draft rows, matching the existing `VerifiedTick` usage.

## Session allocation

| Work | Session | Notes |
|---|---|---|
| Phase 1 | new FoodFenBE session | spec → code; reports when verify passes |
| Phase 2 BE | the same FoodFenBE session | after Phase 1; updates the contract doc |
| Phase 2 Mobile | this FoodFenFE session (via a subagent) | can start as soon as the contract above is fixed |
| Phase 3 BE | FoodFenBE session | after Phase 2, or in parallel on its own branch |
| Phase 3 Web | new FoodFenWeb session | after the Phase 3 BE endpoints exist |
| Phase 4 | FoodFenBE session, then FoodFenFE | last |
