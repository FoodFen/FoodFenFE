# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope discipline — the top rule

Do exactly what was asked. Nothing upstream, nothing downstream, nothing adjacent, even when the next step is obvious. Violating this is a worse failure than a bug.

**One layer per turn.** Each of these is a separate deliverable needing its own explicit request; never bundle two unprompted:

1. Schema / types / interfaces
2. Migrations
3. Repositories (`src/data/`)
4. Hooks and stores (`src/features/`)
5. Components and screens
6. Navigation wiring
7. Tests

Example — "implement the Drizzle models for offline storage" means table definitions in `src/db/schema.ts` and nothing else. Not the migration, not repository functions, not query hooks, not screens.

- **Ambiguous scope → narrowest reasonable reading.** State the assumption in one line and proceed; never silently take the broadest reading to be helpful.
- **No unsolicited extras**: no extra screens or components, no "while I'm here" refactors, no error/empty states beyond what is needed to compile, no new dependencies, no tests unless tests were the ask, no adjacent product features (don't touch gamification when asked for meal logging).
- Something worth doing that you noticed? Put it in the next-steps list; don't do it.
- **Trivial necessities are fine to just do**: a missing import, a type export the file you just wrote needs, a one-line fix to a bug you introduced. New functions, files, screens or behaviour are never "trivial".
- Even for an explicitly large task ("build the whole onboarding flow"), work section by section and pause between chunks unless the user says "do it all in one pass".

**Closing move for every implementation response** (this is the default, not optional):

- one line per file touched
- what you deliberately did not do, when adjacent work is obvious
- a numbered list of 2–4 logical next pieces, and a direct question asking which — then stop until told

Open with 2–4 bullets naming the files and scope first when the task is non-trivial or ambiguous, so it can be redirected before any code is written.

## Product

FoodFend: AI-powered nutrition and calorie tracking. Surfaces are AI food recognition (photograph a meal → identified items with estimated kcal/macros), a long multi-step personalized onboarding, a daily dashboard, gamification (streaks, quests, coins, a shop), and a freemium Premium paywall. This context informs naming and data modelling — it never licenses building more than the current turn asked for.

## Commands

```bash
npm run verify                  # typecheck + lint + test — run before calling anything done
npm run typecheck               # tsc --noEmit
npm run lint                    # eslint, --max-warnings=0
npm test                        # jest
npx jest src/lib/__tests__/nutrition.test.ts        # one file
npx jest -t "recalculateTotals"                     # one test by name
npm run db:generate             # emit a migration after editing src/db/schema.ts
npm run db:studio               # browse the schema in Drizzle Studio
npm run doctor                  # expo-doctor; must stay 21/21
npm run android | npm run ios   # build + run the dev client
npm start                       # dev server for an already-installed dev client
npm run prebuild                # regenerate android/ and ios/
```

No env setup is needed — the app runs fully offline with no `.env` at all. Copy `.env.example` to `.env.local` only when pointing at a real backend.

## Non-negotiable constraints

- **Development build only, no Expo Go.** SQLite, MMKV, Reanimated 4 and the camera modules all need custom native code.
- **No web target.** `app.config.ts` declares `platforms: ['ios', 'android']` and no `web` block. Don't add web fallbacks.
- **Never import `@react-navigation/*`.** Since SDK 56 expo-router vendors its own navigation core; importing React Navigation directly is a hard Metro bundling error. `Stack`, `ThemeProvider`, `DarkTheme`, `DefaultTheme` come from `expo-router`; `Tabs` from `expo-router/js-tabs` (the plain `expo-router` re-export is deprecated in SDK 57).
- **Don't add the Reanimated/Worklets babel plugin.** `babel-preset-expo` registers `react-native-worklets/plugin` automatically when `react-native-reanimated` is installed; adding it manually double-registers and the build fails.
- **`android/` and `ios/` are generated and gitignored** (CNG). Change `app.config.ts`, never the native projects.
- **Never import `@/db/testDatabase` from app code.** ESLint (`eslint.config.js`) blocks it via `no-restricted-imports` — better-sqlite3 cannot run on a device.
- **Auth tokens go in `expo-secure-store`, never MMKV.** MMKV is a plain file, readable on a rooted device or from an unencrypted backup.
- **Nothing secret in `EXPO_PUBLIC_*`.** It is inlined into the bundle. Any future AI/model call belongs on a server.
- Versions are pinned to what `expo install` resolves for SDK 57. Add dependencies with `npx expo install`, not `npm install`.

## Architecture

### Local-first is the design, not a fallback

The on-device SQLite database is the source of truth. The app is fully usable with **no account and no connection**; a server is an accelerator and a backup.

- `src/data/sync.ts` is the entire policy, ~170 lines. `readWithRefresh({ pull, read })` optionally refreshes from the server, then **always** answers from local rows — never "remote value, or local on failure". So online and offline take the same code path, and a slow server never produces an error state for data already on disk.
- `canUseRemote()` requires all three of `env.hasBackend`, a session, and connectivity.
- Writes are local and immediate. Every insert/update spreads `touch()` (`updatedAt` now, `syncedAt` null); deletes are soft via `touchDeleted()`. "Rows the server hasn't seen" is therefore a query — `pendingChangeCount()`.
- **Push sync exists** (`src/data/push.ts`, run by `usePushSync()` on mount and app foreground) and drains `pendingChangeCount()`: user profile, daily goals, streak, food entries + ingredients, activity/water/weight logs, quests, and coin transactions. One row at a time per `docs/backend-contracts/sync.md`, no separate retry queue — a failed row just stays dirty and retries on the next run. `subscription` is deliberately excluded from this path; it's server-authoritative via `premium-entitlements.md`'s `GET /subscriptions/me` + PayOS flow, never client-pushed. `src/data/pull.ts` refuses to overwrite a locally modified row, which push respects by construction — still genuinely open: cross-device conflict resolution when both edited the same row offline, and applying a deletion made on another device (pull has no way to see one).
- `env.apiUrl` is `string | undefined` on purpose. `src/api/client.ts` throws `ApiError('not_configured')` rather than building a bad URL, so a build with no backend reports "accounts unavailable" and everything else works unchanged.

### Layering

```
app/            routes (the file tree IS the nav graph)
  ↓
src/features/   TanStack Query hooks + Zustand stores  ← screens only talk to this
  ↓
src/data/       repositories (all SQL lives here) + sync policy
  ↓
src/db/         Drizzle schema + client
```

`src/api/` sits beside this, not under it: it is only auth and future sync (`client.ts`, `errors.ts`, `schemas.ts`, `endpoints/`). Diary and food reads/writes never touch it.

Two orthogonal pieces of identity:

- `useProfileStore` — the **local profile** (a `user` row). This is what the root layout gates on: onboarding, not sign-in, is the only thing between a fresh install and the diary (`Stack.Protected guard={!hasProfile}` in `app/_layout.tsx`).
- `useAuthStore` — an **optional session**. It gates nothing; it only decides whether reads try the server first. `(auth)` routes are reachable at any time and gate nothing.

`app/_layout.tsx` holds the boot sequence: fonts, Drizzle `useMigrations`, stored-session hydration, then `enableForeignKeys()` + first profile read. Nothing may query the database before migrations report success — on a fresh install the tables don't exist yet. It also hosts the app-wide `LogSheet` (the tab bar's "+" and every dashboard card's "+" open the same instance via `useLogSheetStore`) and `QuestToast`.

Logging is not a tab. `(tabs)` is Home / Achievements / Stats, drawn by the custom `FloatingTabBar`; the green "+" button pushes the `log` modal stack (`app/log/`: meal → ingredient, plus `activity`, `manual`, `search`, `interstitial`) and returns you to wherever you were.

### Data model

`src/db/schema.ts` is the FoodFen ERD v1.0.0 as SQLite, with four documented departures: text ids + nullable `remote_id`, sync columns everywhere, no `password_hash`, and three added columns (`food_entry.meal_type`, `*.logged_on`, `user.weekly_rate_kg`). `src/types/models.ts` aliases the Drizzle row types rather than duplicating them; only composite shapes (`FoodEntry`, `DiaryDay`) are hand-written there.

Where the load-bearing logic lives:

- `src/lib/nutrition.ts` — the domain core. BMR (Mifflin–St Jeor), TDEE, target derivation, portion scaling. Pure and heavily tested; everything nutritional flows through it.
- `src/data/entryRepository.ts` — `recalculateTotals` is the _only_ writer of an entry's stored totals, which keeps the denormalized header honest against its ingredients.
- `src/data/userRepository.ts` — daily goals are append-only history: the goal in force on a day is the newest row effective on or before it, so changing today's target never rewrites what last week was measured against.
- `src/data/foodCatalog.ts` (backed by `src/data/catalog/foods.json`) — a bundled read-only reference list, not a table. Chosen values are _copied_ onto the ingredient row, so editing the catalog can never rewrite history.
- `src/data/gamificationRepository.ts` + `src/features/gamification/` (`queries.ts`, `selectors.ts`, `toastStore.ts`, `interstitialStore.ts`) — streaks, weekly quests and coin balances; rules are tested independently of the UI that now surfaces them (`app/(tabs)/achievements.tsx`, `app/log/interstitial.tsx`, `src/components/gamification/QuestToast.tsx`).

### Conventions

- Energy **kcal**, macros **g**, mass **kg**, length **cm**, volume **ml**. `unitSystem` is display-only and never changes what is stored.
- Diary days are local calendar days (`yyyy-MM-dd`) via `src/lib/date.ts`. Never `toISOString()` — it shifts the date across the UTC boundary.
- `fiberG: null` = unknown or Premium-gated; `0` = measured as none. Do not collapse them.
- Import `src/` through the `@/` alias and `app/` through `@app/`. Never a relative `../../../` chain across those boundaries.
- Strict mode; no `any` without a comment justifying it. Nothing may introduce an ESLint warning — the config runs at `--max-warnings=0`.
- Server/async state → TanStack Query. Local/UI/ephemeral state → Zustand. Don't put server data in a store or UI state in a query.
- Zod schemas sit next to the form or API boundary they validate, and TS types are `z.infer<>`d from them rather than declared twice.
- Migrations come from `drizzle-kit generate`. Never hand-write migration SQL unless asked.
- Match the naming and folder patterns already in the repo instead of introducing new ones.
- Body metrics and health data are sensitive: never log them, never send them to analytics unless asked.
- Where kcal/macro arithmetic rounds or converts units, say so in a comment.
- Gamification and paywall logic changes often for growth experiments, so it should be togglable in isolation — but build that structure only when building that logic, never preemptively.
- Styling is NativeWind `className` against semantic tokens (`bg-surface`, `text-fg-muted`, `text-protein`) defined once per theme in `global.css`. No `dark:` variants for ordinary work. `src/theme/colors.ts` mirrors the same palette in JS for SVG fill/stroke, the navigator theme and the status bar — change both together. Reach for inline `style={{}}` only when the value is computed at runtime.

### Tests

`src/db/testDatabase.ts` runs better-sqlite3 in memory against the **same generated migrations** the app ships, so schema drift between the harness and the device is impossible. Repository tests use it directly. `jest.setup.ts` stubs `expo-secure-store` with a Map and makes `react-native-mmkv` throw — deliberately, so tests exercise the in-memory fallback in `src/lib/storage.ts`.

## Not yet built

- **AI meal capture — largely built.** `input_method` covers `voice`/`image`/`type`/`manual` and `ai_feedback` records thumbs up/down. Typed, manual, voice (on-device speech-to-text via `expo-speech-recognition` feeding the same text-analysis call), and image (camera/library photo through `app/log/manual.tsx`'s `ImageCapturePanel`) all produce real ingredient rows via `useAnalyzeFood()` and are stored under their correct `input_method`. Barcode scanning is the one capture path with no UI yet — `expo-camera` is installed and permissioned, but there's no scan screen or barcode→catalog lookup.
- **AI insights.** The Stats tab shows locally computed trends. The AI layer should consume `summarizeTrends()` — small and pre-aggregated — rather than raw entries.
- **Coin shop.** `app/shop.tsx` is a placeholder `EmptyState`; coin balances already accrue through gamification.

## Other instructions

- Reduce commenting in code, only put comments at the top explaining what this file does in a brief, high-level summary. Do not comment every line or function.
