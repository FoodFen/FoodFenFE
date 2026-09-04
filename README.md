# FoodFen

Cross-platform (iOS + Android) calorie and macro tracker built with Expo, expo-router and NativeWind.

**Local-first.** The app is fully usable with no account and no connection: the diary lives in an on-device SQLite database, which is the source of truth. A server, when there is one, is an accelerator and a backup — never a requirement.

There is **no web target**. `app.config.ts` declares `platforms: ['ios', 'android']` and no `web` block.

## Stack

| Concern      | Choice                                                    |
| ------------ | --------------------------------------------------------- |
| Runtime      | Expo SDK 57 · React Native 0.86 · React 19.2              |
| Routing      | expo-router 57 (file-based, typed routes)                 |
| Styling      | NativeWind 4.2 + Tailwind CSS 3.4                         |
| Database     | expo-sqlite + Drizzle ORM (typed schema, real migrations) |
| Server state | TanStack Query 5                                          |
| Client state | Zustand 5                                                 |
| Forms        | React Hook Form 7 + Zod 4                                 |
| Preferences  | react-native-mmkv 4 · expo-secure-store (tokens)          |
| Lists        | @shopify/flash-list 2                                     |
| Animation    | Reanimated 4 + react-native-worklets                      |
| Tests        | Jest + jest-expo · better-sqlite3 for real database tests |

Versions are pinned to what `expo install` resolves for SDK 57, so `npx expo-doctor` passes 21/21.

## Getting started

```bash
npm install
```

No configuration is required — the app runs offline out of the box. Copy `.env.example` to `.env.local` only when you have a backend to point at.

This app uses a **development build**, not Expo Go — SQLite, MMKV, Reanimated 4 and the camera modules all require custom native code.

```bash
npm run ios        # builds and launches the iOS dev client (macOS only)
npm run android    # builds and launches the Android dev client
npm start          # dev server for an already-installed dev client
```

`android/` and `ios/` are generated, not committed (Continuous Native Generation). `npm run prebuild` regenerates them; edit `app.config.ts` rather than the native projects.

## How offline and online fit together

```
read   →  refresh from the server when possible, then read locally — always
write  →  local, immediately, marked unsynced for a later push
```

`src/data/sync.ts` is the whole policy. `readWithRefresh` tries a pull only when all three of `env.hasBackend`, a signed-in session, and connectivity hold; any failure is swallowed and the local read answers anyway. **The read is never "remote value or local on failure"** — the answer is always assembled from local rows, which means online and offline take the same code path (so the offline case cannot rot), server data joins naturally against local goals and water, and a slow server never produces an error state for data already on disk.

Writes never wait for anything. Every insert and update stamps `updated_at` and clears `synced_at` (`touch()`), so "rows the server has not seen" is a query, not a guess — `pendingChangeCount()` is what Profile shows as _N changes saved on this device only_. Deletes are soft, because a row that vanished cannot be deleted server-side later.

The **push** half is not built. Everything it needs exists: the dirty flag, the soft deletes, `remote_id` for identity mapping, and `markSynced()`. `src/data/pull.ts` already refuses to overwrite a locally modified row, which is the rule any push must respect.

## Data model

`src/db/schema.ts` is the CalSnap ERD v1.0.0 as SQLite. Eleven tables: `user`, `daily_goal`, `food_entry`, `ingredient`, `activity_log`, `weight_log`, `water_log`, `streak`, `quest`, `coin_transaction`, `subscription`.

Four deliberate departures from the server-side ERD, each documented at its definition:

1. **Text ids, not autoincrement ints.** A local row needs an id before a server exists to assign one, so every table has a locally minted `id` plus a nullable `remote_id`.
2. **Sync columns everywhere** — `updated_at`, `synced_at`, `deleted_at`. See above.
3. **No `password_hash`.** It is in the ERD because the server needs it; a device never should.
4. **Three added columns**, marked "extension" in the schema: `food_entry.meal_type` (the diary groups by meal, and guessing it from the clock would be wrong for anyone eating off-schedule), `*.logged_on` (the local calendar day as `yyyy-MM-dd`, stored at write time — deriving it from a timestamp later would apply the _current_ UTC offset rather than the one in force when the meal was eaten), and `user.weekly_rate_kg` (the calorie target cannot be derived without a pace, and the ERD has nowhere to put one).

Change the schema, then `npm run db:generate` to emit a migration. Migrations run from the root layout before any screen mounts.

## Scripts

| Script                | What it does                               |
| --------------------- | ------------------------------------------ |
| `npm start`           | Dev server for the dev client              |
| `npm run android/ios` | Build + run the native app                 |
| `npm run prebuild`    | Regenerate `android/` and `ios/`           |
| `npm run db:generate` | Emit a migration from `src/db/schema.ts`   |
| `npm run db:studio`   | Browse the schema in Drizzle Studio        |
| `npm run typecheck`   | `tsc --noEmit`                             |
| `npm run lint`        | ESLint, zero warnings tolerated            |
| `npm run format`      | Prettier, with Tailwind class sorting      |
| `npm test`            | Jest                                       |
| `npm run verify`      | typecheck + lint + test                    |
| `npm run doctor`      | `expo-doctor` dependency and config checks |

## Layout

```
app/                        Routes. The file tree IS the navigation graph.
  _layout.tsx               Providers, fonts, migrations, onboarding guard
  (onboarding)/             First run — the only gate in front of the diary
  (auth)/                   sign-in, sign-up — optional, reached from Profile
  (tabs)/                   Diary · Log · Insights · Profile
  log/                      meal → ingredient  — modal composer
  entry/[id].tsx            A logged meal and its ingredients
  settings/goals.tsx        Body stats and targets
drizzle/                    Generated migrations. Do not hand-edit.
src/
  db/                       Drizzle schema, client, test harness
  data/                     Repositories over the database + sync policy
  api/                      HTTP client, wire schemas, endpoint modules
  components/ui/            Design-system primitives (Text, Button, Card, ...)
  components/diary/         Diary composites
  components/profile/       Shared body-stat form and goal preview
  features/                 auth · diary · insights · profile · settings
  hooks/                    Cross-cutting hooks
  lib/                      nutrition math, dates, storage, env, query client
  theme/                    Palette mirror for non-className consumers
  types/models.ts           Domain model (aliases the Drizzle row types)
```

### Where the interesting decisions live

- **`src/lib/nutrition.ts`** — the domain core. BMR (Mifflin–St Jeor), TDEE, target derivation, portion scaling, macro arithmetic. Pure functions, heavily tested. Everything nutritional flows through here.
- **`src/data/sync.ts`** — the local/remote policy described above, in about forty lines.
- **`src/data/entryRepository.ts`** — `recalculateTotals` is the only writer of an entry's stored totals, which is what keeps the denormalized header honest against its ingredients.
- **`src/data/userRepository.ts`** — goals are append-only history. The goal in force on a day is the newest row effective on or before it, so changing your target today never rewrites what last week was measured against.
- **`src/db/testDatabase.ts`** — tests run against real SQL, applying the _same_ generated migrations the app ships. A hand-written CREATE TABLE in a harness would drift from the migration and the tests would pass against a schema no device has.

## Conventions

- Energy is always **kcal**, macros **grams**, mass **kg**, length **cm**, volume **ml**. `unitSystem` is a display preference and never changes what is stored.
- Diary days are local calendar days (`yyyy-MM-dd`), never timestamps. A meal logged at 11pm belongs to that day. Use `src/lib/date.ts`; never `toISOString()`, which shifts the date across the UTC boundary.
- `fiberG: null` means unknown or Premium-gated; `0` means measured as none. They are not the same and must not be collapsed.
- Import with the `@/` alias for `src/`.
- Never import `@/db/testDatabase` from app code — ESLint blocks it. better-sqlite3 cannot run on a device.

## Premium

`user.subscription_tier` gates two things today, per the data model: the fiber breakdown, and adding an ingredient by hand (the bundled reference list stays free). `useIsPremium()` is the check; `resolveTier()` derives the real tier from the subscription row so an expired plan downgrades itself without a job.

## Not yet built

- **Push sync.** Reads already refresh from the server; writes queue locally and nothing drains them. See "How offline and online fit together".
- **AI meal capture.** `input_method` covers `voice`/`image`/`type`/`manual` and `ai_feedback` records thumbs up/down, but only the typed and manual paths exist. When the model lands, it should produce ingredient rows and let the existing composer save them; the call belongs on the server, never with a key in the bundle.
- **AI insights.** The Insights tab shows locally computed trends. The AI layer should consume `summarizeTrends()` — small and pre-aggregated — rather than raw entries.
- **Gamification UI.** Streaks, quests, coins and subscriptions have schema, repositories and tested rules, but no screens. Streaks already advance when a meal is logged.
- **Barcode scanning and photo logging.** `expo-camera` and `expo-image-picker` are installed and permissioned; `food_entry.image_url` is plumbed through. No screens yet.
