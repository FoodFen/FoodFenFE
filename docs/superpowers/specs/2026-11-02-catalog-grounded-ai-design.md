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
  `catalogFoodId` and `verified`. Editing grams already re-scales the row's own values proportionally in
  `app/log/meal.tsx`. For a catalog-derived row that equals scaling from `per100g`, so the app doesn't use
  `per100g` (the BE still sends it).
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

## Phase 3 — Admin catalog management

Detailed with the owner on 2026-11-03.

**Why.** Real users notice foods whose numbers are slightly off. They report it outside the app (the in-app
report is deferred). An admin then fixes the food from the Web admin, and the next AI analysis uses the new
numbers. Admins also add missing foods. A list of the names the AI could not match tells them which foods
to add.

**Who.** Any user with the admin role. There is one kind of admin and no approval step. An admin who saves
a change is fully accountable for it. There is no "reason" or "source note" field.

**Goals**
- Admins can find any food by name (accent- and case-insensitive), fix its numbers, add new foods, archive
  and unarchive foods.
- Every create, edit, archive and unarchive is recorded: which admin, when, before and after.
- An edit takes effect on the next AI analysis, with no deploy.
- Admins see the food names the AI could not match, most frequent first, and can turn one into a new food
  or dismiss it.
- The catalog gets an English name per food.

**Non-goals**
- Bulk edit, CSV import or export.
- Re-computing meals logged in the past. They keep the numbers they were saved with.
- Mobile seeing the new numbers in manual search. That is Phase 4. In Phase 3 only AI results change.
- Showing the English name anywhere in the Mobile app. Phase 4 carries it to the app; how it is displayed
  is decided there.
- Recipe breakdowns or ingredient lists for a food. The admin enters per-100 g figures directly.
- Hard delete, ever.
- Recording the name of a whole dish the AI broke into components (owner, 2026-11-03). Only unmatched
  rows are recorded; the prompt is not changed for this.

**Anti-goals**
- An AI analysis that fails or slows down because recording an unmatched name failed.
- An edit that stores the user's identity or photo anywhere in the unmatched-names log.
- A catalog change that leaves the AI on stale numbers for longer than a TTL fallback.

### BE

**`foods` table changes**
- Add `name_en` (nullable string, same length limit as `name`).
- **Backfill** (data migration): for each food, `name_en` = the first alias that is pure ASCII and is not
  just the folded Vietnamese name or a part of it (for example `bun cha` is skipped, `grilled pork with
  noodles` is taken). Roughly 650 of 670 foods get one; the exact count depends on edge cases like
  `cafe latte` for `latte`, and spot-checking a sample is enough. The rest stay null for admins to fill in.
  - My call: the alias stays in `aliases` too. Removing it would change the prompt's catalog block and
    could hurt matching.
- The prompt's catalog block is unchanged (`slug | name | aliases | default g`). `name_en` is not added to
  it, because the English alias is already there.
- `updated_by_admin_id` (already present) is set on every admin write.

**Source rules on save**
- **Create:** `source_kind=team`, `source_ref="team"`, so the food is verified.
- **Edit of any food, legacy included** (owner, 2026-11-03):
  - If any of `kcal`, `carbs_g`, `protein_g`, `fat_g`, `fiber_g` changes, the food becomes `team` /
    `"team"`.
  - Changes to the name, English name, aliases, category or servings keep the source.
  - The original source stays readable in the change log's "before" snapshot.
- A legacy food gets a tick only when an admin changes one of its numbers. Renaming it alone keeps it
  legacy and unticked.
- `fiber_g` null means "not tracked" and stays distinct from 0 in the form, the API and storage.

**Validation** (my call; the builder may tighten it)
- `name`: required, 1–120 characters after trimming. No other non-archived or archived food may have the
  same folded name; on a clash the API returns 409.
- `name_en`: optional, up to 120 characters.
- `aliases`: up to 20, each 1–80 characters, trimmed, with duplicates dropped.
- `category`: one of the existing `FoodCategory` values.
- Per 100 g:
  - `kcal` must be an integer from 0 to 900;
  - `carbs_g`, `protein_g`, `fat_g` each from 0 to 100, with a sum of at most 100;
  - `fiber_g` is null, or from 0 to 100.
- `servings`: 1–10 rows, each with a label of 1–40 characters and `grams` > 0 and ≤ 5000, and exactly one
  marked as the default.

**Slug.** Generated on create from the folded name: lowercase ASCII, with `đ` → `d` and non-alphanumeric
runs replaced by `-`. The existing `fold()` in `src/application/dish_fit.py` already handles `đ`. On a
clash, append `-2`, `-3`, and so on. The slug never changes afterwards, even when the name does.

**Audit log `food_changes`** (append-only, admin-only)
- `id`, `food_id` (FK), `admin_id` (FK users, `SET NULL`), `action`
  (`create` | `update` | `archive` | `unarchive`), `before` (JSON, null for create), `after` (JSON),
  `created_at`.
- `before`/`after` are full snapshots of the editable fields plus `source_kind`/`source_ref`/`archived`.
  The Web computes the diff.
- Each change row is written in the same transaction as the food write.

**Unmatched names log `food_misses`**
- Written from the Phase 2 grounding step: for each row the server treats as unmatched (null or unknown
  slug), upsert by `fold(name)`:
  - store the display `name` from the first time it was seen and the request `language`;
  - increment `count`;
  - set `last_seen_at`.
- Columns: `id`, `key` (unique folded name), `name`, `language`, `count`, `first_seen_at`, `last_seen_at`,
  `status` (`open` | `ignored` | `resolved`), `resolved_food_id` (nullable FK foods).
- No user id, no image, nothing else from the request.
- Not written when `FOOD_ANALYSIS_GROUNDING` is off.
- **Key normalisation** (my call): strip the count suffix (`"Egg (x3)"` → `"Egg"`), trim whitespace and
  trailing punctuation, then `fold()`. The stored display `name` is the stripped first-seen form.
- A failure to record is logged and swallowed: the analysis response is never affected. The upsert is one
  statement per analysis (all of that analysis's unmatched names together). It must run in its own
  session or a SAVEPOINT: a failed statement inside the request's session would poison it, and the later
  trial consume and commit would fail with it.
- **Auto-resolve** (my call): creating a food, or saving a new name/aliases, marks `resolved` every
  `open` miss whose key equals the folded name, English name or an alias of that food.
- A `missId` on create that is unknown or not `open` is ignored: the food is still created.
- An `ignored` or `resolved` key keeps its status: later sightings still raise `count` and
  `last_seen_at` but never re-open it (owner, 2026-11-03).

**Admin endpoints** (under the existing `/admin` router and its admin dependency; camelCase on the wire;
the same opaque `cursor` / `limit` (1–50, default 20) / `nextCursor` paging as `/admin/restaurants`)
- `GET /admin/foods`
  - Query: `q` (accent-insensitive substring over `name`, `nameEn`, `aliases`, `slug`), `category`,
    `verified` (true/false), `archived` (default false; `true` lists only archived foods).
  - Sorted by folded name.
  - Each item has `slug`, `name`, `nameEn`, `category`, `sourceKind`, `sourceRef`, `verified`, per-100 g
    numbers, `archived`, `updatedAt`.
  - Searching in memory over all rows with `fold()` (as `/admin/users` does) or in SQL with `unaccent`
    (as restaurants do) is the builder's call. Either way, `đ` must match `d`.
- `GET /admin/foods/{slug}`: the full food, including `aliases`, `servings`, and the email of the last
  admin to update it.
- `POST /admin/foods`: create. The body is the editable fields. An optional `missId` marks that miss
  `resolved` with `resolved_food_id` in the same transaction.
- `PATCH /admin/foods/{slug}`: a partial update of the editable fields, with the source rules above.
- `POST /admin/foods/{slug}/archive` and `POST /admin/foods/{slug}/unarchive`: idempotent; each writes a
  change row only when the state actually flips. Unarchive returns 409 if a non-archived food now has the
  same folded name (my call).
- **Concurrent edits:** last write wins (my call). Both saves are in the change log.
- **Search:** in memory with `fold()`, sorted by folded name and paged by slicing (my call). `aliases` is
  a JSON column, so SQL `unaccent` over it would need a cast or a new column.
- `GET /admin/foods/{slug}/changes`: newest first, each with the admin's email, `action`, `createdAt`,
  `before`, `after`. No paging is needed at this size (my call).
- `GET /admin/food-misses`: `status` (default `open`), paged, sorted by `count` descending and then
  `lastSeenAt` descending.
  - Each item carries `existingFood` (`{slug, name}` or null): a non-archived food whose folded name,
    English name or an alias equals the miss key (owner, 2026-11-03). It is computed at read time against
    the current catalog, never stored, so it is always up to date.
  - It covers the case where the AI returned no catalog id even though a food with that exact name
    exists. The admin sees it and ignores the miss. Grounding itself is not changed: the server does not
    match by name.
- `POST /admin/food-misses/{id}/ignore` and `POST /admin/food-misses/{id}/reopen`.

**Cache**
- Every food write (create, update, archive, unarchive) calls `FoodCatalogCache.invalidate()` after
  commit.
- The explicit Gemini context cache is keyed by the hash of the prompt prefix, so it rebuilds by itself
  when the catalog block changes. The old cache simply expires. Nothing else needs invalidating.
- Prod runs one instance (Render free plan). If it ever scales out, other instances pick up the change
  within the cache's 600 s TTL. That is acceptable, and noted here so nobody is surprised.
- An archived food disappears from the prompt and from matching on the next analysis. It still exists for
  meals already logged with it.

**Mobile.** No Mobile change in Phase 3. The AI contract is unchanged: `catalogName` stays the Vietnamese
name.

### Web — admin page "Thức ăn"

- **Placement.** A new admin nav entry "Thức ăn" (en: "Foods") beside the mascot and restaurant pages, at
  route `/admin/foods`, following the existing admin page, table, toolbar and dialog patterns
  (`src/features/admin/`).
- **Two tabs.**
  1. **"Danh mục"** (catalog):
     - A table with columns name (with the English name under it, muted), category, kcal/100 g, source
       (tick when verified, else a "chưa có nguồn" badge), and updated.
     - A toolbar with search, a category filter, a "verified / not verified" filter and a "show archived"
       toggle.
     - A "Thêm món" button.
     - Clicking a row opens the edit dialog.
  2. **"AI chưa nhận ra"** (misses):
     - A table with name (plus an "EN" badge when `language` isn't `vi`), count, and last seen.
     - Each row has **Thêm món** (opens the create dialog and sends `missId`) and **Bỏ qua** (ignore).
       The miss name is prefilled into `name`, or into `nameEn` when the miss's language isn't `vi`
       (my call).
     - When `existingFood` is set, the row shows a badge "Đã có trong danh mục: <name>" that links to that
       food. **Thêm món** is hidden on that row, and **Bỏ qua** stays.
     - A status filter `open` / `ignored` / `resolved`, where an ignored or resolved row can be re-opened.
- **Create/edit dialog.**
  - Fields: name, English name, aliases (tag input), category (select), per-100 g kcal/carbs/protein/fat,
    and fiber (empty = not tracked).
  - A servings editor: rows of label + grams, one default radio, add/remove.
  - Client-side Zod validation mirrors the BE rules. The slug is shown read-only on edit.
  - When editing a sourced (non-team) food, a one-line notice warns that changing any number switches its
    source to "FoodFen team".
- **Food detail actions** in the dialog: "Lưu trữ" / "Bỏ lưu trữ" (with a confirm) and a "Lịch sử" panel
  listing the change rows: admin email, time, action, and the fields that differ between before and after.
- **Copy** in `vi` and `en` locale files, like the other admin pages.

### Done when
- **BE:**
  - the migration applies on prod data: `name_en` is backfilled for roughly 650 foods, and `food_changes` and
    `food_misses` exist;
  - create, update, archive and unarchive behave as above, each writing exactly one change row;
  - the source switches to `team` exactly per the rules;
  - an edited food's new numbers come back from the next analysis without a restart;
  - an unmatched analysis row creates or increments a miss;
  - a failing miss upsert doesn't fail the analysis;
  - tests, `lint-imports` and the BE verify command all pass.
- **Web:** an admin can find "bun cha" by typing it without accents, fix its kcal, see the change in
  "Lịch sử", add a food from a miss, archive it and unarchive it; and Web verify passes.

### Left to the builders
- Table and column names within BE conventions, and the exact JSON shape of the snapshots.
- In-memory vs SQL search (see above).
- Web layout details, within the existing admin patterns.

## Phase 4 — Mobile syncs the catalog

Detailed with the owner on 2026-11-05.

**Why.** Since Phase 3, admins fix and add foods in the BE, but the app's manual search still reads the
bundled `foods.json`. A food an admin fixed shows its old numbers when a user types its name, and a food
an admin added can't be found at all. Only AI results see the change today.

**Where the user sees it** (owner): the manual food search (`app/log/search.tsx`). As the user types a
name:
- foods an admin added appear;
- foods an admin edited show the new numbers, with a tick when they have a source;
- archived foods disappear.

Everything else that reads the catalog through `getCatalogFood` picks up the same data with no extra
work: the ingredient screen, quick log, barcode and recents.

**Goals**
- Admin changes reach the app on the next app start or foreground, in the background.
- The app stays fully usable offline and for guests, using the bundle plus whatever it last synced.
- **English names** (owner): when the app language is English, the search results, the ingredient screen
  and every other place that shows a catalog food's name use `nameEn` when it exists, and the Vietnamese
  name otherwise. Search matches the Vietnamese name, the English name and the aliases, whatever the app
  language.

**Non-goals**
- Re-computing meals already logged. A logged ingredient keeps the name and numbers it was saved with.
  Changing the app language later doesn't rename it (my call).
- A tick in diary history.
- Real-time push of catalog changes.
- Any change to the AI analysis or the admin side.

**Anti-goals**
- A catalog sync that blocks a render, the splash screen or a search keystroke (CLAUDE.md no-blocking
  rule).
- A sync failure that loses already-synced foods, or leaves search worse than the bundle alone.
- An archived food breaking an existing diary entry, the ingredient screen or recents.
- An English user seeing a Vietnamese name when the food has an English one.

### BE

- **`GET /foods?updatedSince=<iso>`**, public with no auth (the catalog is public data). The response
  is `{ foods: Food[], serverTime }`.
  - `Food` = `{slug, name, nameEn, aliases, category, sourceKind, sourceRef, verified, per100g: {kcal,
    carbsG, proteinG, fatG, fiberG}, servings: [{label, grams, default}], archived, updatedAt}`.
  - It returns foods with `updated_at >= updatedSince`, archived ones included. Without `updatedSince`
    it returns every food; the bundle refresh script uses that.
  - `serverTime` is the server's clock taken **before** the query runs. The app stores it as its next
    cursor, so device clock skew never matters, and a food written during the query is fetched again
    next time rather than missed. The overlay is keyed by slug, so a duplicate is harmless.
- No paging (my call). A full dump is ~670 rows; a delta is usually a handful. Normal response
  compression is enough.
- An index on `foods.updated_at` if the builder thinks the table size warrants it.
- Every admin write (Phase 3) already bumps `updated_at`. Archive and unarchive must bump it too; check
  that they do.
- The endpoint goes in the BE contract doc for the app: a new section in FoodFenFE
  `docs/backend-contracts/`. That doc is written from this repo, not by the BE session.

### Mobile

- **Overlay storage** (my call): a local SQLite table (Drizzle schema plus a generated migration) with
  one row per synced food: the slug as key, the food payload, and `updatedAt`. Store the sync cursor
  (`serverTime`) next to it, in the same table's metadata or the app's storage helper.
- **Merge.**
  - `src/data/foodCatalog.ts` builds its in-memory food list from the bundle, then applies overlay rows
    by slug: an overlay row replaces the bundle record, or adds a new food.
  - The merged list is rebuilt once after each sync that wrote rows, not on every search.
  - New overlay foods get folded name, English name and aliases for search, using the same `foldVi`
    rules.
  - Serving ids follow the bundle's `<slug>-s<index>` convention.
- **A newer bundle wins over older overlay rows** (my call): on start, drop the overlay rows whose
  `updatedAt` is older than the bundle's `snapshotAt`, and reset the cursor to `snapshotAt` if it is
  older. An app update that ships a fresh bundle then isn't shadowed by stale synced rows.
- **Source mapping:** the bundle type and its trusted-source list must cover `team` (verified, label
  "FoodFen team") and `legacy` (unverified).
- **Erase:** the overlay is public data, so it survives `eraseDatabase()` (an account switch) by design.
- **Archived foods** are left out of search results and recents, but `getCatalogFood` still resolves
  them, so old entries and the ingredient screen keep working.
- **The first cursor** is the bundle's snapshot time (`snapshotAt`, see the bundle refresh below). After
  the first successful sync it is the last `serverTime`.
- **Sync trigger.**
  - On app start and on foreground, fire-and-forget, with `.catch()` and nothing awaited in a render
    path.
  - At most once every 10 minutes after a **successful** sync (my call). A failed sync, e.g. a Render
    cold start, doesn't start the 10 minutes.
  - It runs for guests too and needs no session; it is skipped when `env.hasBackend` is false.
  - A failure leaves the overlay and the cursor untouched. The next trigger retries.
- **After a sync that wrote rows**, invalidate whatever query or memo the search screen reads, so an
  open search refreshes.
- **Display name.** One helper picks `nameEn` when the locale is English and it exists, else `name`.
  Every screen showing a catalog food's name goes through it. When the user logs a food, the stored name
  is the one displayed at that moment (my call).

### Bundle refresh

- After Phase 4, **the BE is the only place foods are edited.**
  - `scripts/build-catalog.mjs` and the hand-authored `data/catalog` sources stop being the editing path
    (my call).
  - Keep them in the repo as the record of where the original numbers came from.
  - Say so in `docs/food-data-sources.md`, so nobody edits them expecting an effect.
- A new script (e.g. `npm run catalog:pull`) calls `GET /foods` on prod with no `updatedSince` and
  writes `src/data/catalog/foods.json`:
  - in the existing built shape, with `nameEn` and the folded fields added, and serving ids generated;
  - archived foods are kept, so old ids still resolve;
  - it records `snapshotAt` = the response's `serverTime`.
- Run it once as part of Phase 4, so the bundle carries `nameEn` and `snapshotAt`. After that, run it
  before each app release (a manual step, my call). It needs no auth.

### Done when
- **BE:**
  - `GET /foods` returns everything without auth, and only changed rows (archived included) with
    `updatedSince`;
  - `serverTime` is taken before the query;
  - archive and unarchive bump `updated_at`;
  - tests and the BE verify pass.
- **Mobile:**
  - Edit a food's kcal in the Web admin, reopen the app, and the search shows the new number without a
    reinstall.
  - Add a food in the admin, and it appears in search.
  - Archive it, and it disappears from search, while an entry already logged with it still opens.
  - Switch the app to English, and search shows "Grilled pork with noodles" for `bun-cha`.
  - Turn the network off, and search still works from the bundle and the last overlay.
  - The bundle is refreshed from prod with `snapshotAt` and `nameEn`.
  - `npm run verify` passes.

### Left to the builders
- Exact table and column names, and the shape of the cursor storage.
- Whether the BE adds the `updated_at` index.
- How the search screen is told to refresh (query invalidation or a store version counter).

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
| Phase 4 BE | new FoodFenBE session | the public `GET /foods` endpoint |
| Phase 4 Mobile | this FoodFenFE session (via a subagent) | overlay, sync, English names, bundle refresh; after the BE endpoint is on prod (the bundle refresh needs it) |
