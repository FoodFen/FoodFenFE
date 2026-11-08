# Feature notes

Per-feature notes moved out of `CLAUDE.md` so they are read only when a change touches that feature.
Update the matching section in the same change as any rule it states.

## Sync & local-first

The on-device SQLite database is the source of truth. The app is fully usable with **no account and no connection**; a server is an accelerator and a backup.

- `src/data/sync.ts` is the entire policy, ~170 lines. `readWithRefresh({ pull, read })` optionally refreshes from the server, then **always** answers from local rows — never "remote value, or local on failure". So online and offline take the same code path, and a slow server never produces an error state for data already on disk.
- `canUseRemote()` requires all three of `env.hasBackend`, a session, and connectivity.
- Writes are local and immediate. Every insert/update spreads `touch()` (`updatedAt` now, `syncedAt` null); deletes are soft via `touchDeleted()`. "Rows the server hasn't seen" is therefore a query — `pendingChangeCount()`.
- **Push sync exists** (`src/data/push.ts`, run by `usePushSync()` on mount and app foreground) and drains `pendingChangeCount()`: user profile, daily goals, streak, food entries + ingredients, activity/water/weight logs, quests, and coin transactions. One row at a time per `docs/backend-contracts/sync.md`, no separate retry queue — a failed row just stays dirty and retries on the next run. `subscription` is deliberately excluded from this path; it's server-authoritative via `premium-entitlements.md`'s `GET /subscriptions/me` + PayOS flow, never client-pushed. `src/data/pull.ts` refuses to overwrite a locally modified row, which push respects by construction — still genuinely open: cross-device conflict resolution when both edited the same row offline, and applying a deletion made on another device (pull has no way to see one).
- **Local data belongs to one account.** `claimLocalData` in `src/features/auth/store.ts` records the first account to sign in (`StorageKeys.accountOwnerId`; a guest's data is claimed, not erased). A *different* account signing in triggers `eraseAll()` so it never inherits — or pushes — the previous account's rows. `signOut` keeps diary data and streak but calls `clearAccountState` to drop the server-authoritative cache (subscription, quests, coins) so premium never outlives the session; `useRefreshSubscription` also clears the local subscription when the server returns `subscription: null`.
- **Catalog sync** (`src/data/catalogSync.ts`, run by `useCatalogSync` in `app/_layout.tsx`) pulls admin food changes from the public `GET /foods?updatedSince=` (`docs/backend-contracts/food-catalog.md`) into the `catalog_food` table, which `foodCatalog.ts` merges over the bundle by slug. It needs **no session** (guests sync too), is skipped when `env.hasBackend` is false, and is fire-and-forget on app start and every foreground, at most once per 10 minutes after a *successful* sync (a failure starts no timer and changes neither overlay nor cursor). The cursor is the server's `serverTime` in `localData` (`StorageKeys.catalogCursor`), never the device clock; the first one is the bundle's `snapshotAt`. After a sync that wrote rows the hook invalidates `queryKeys.catalog.all`, so an open search re-runs. On start (after migrations) overlay rows older than the bundle's `snapshotAt` are dropped and an older cursor is reset to it, so an app update's fresher bundle is never shadowed.
- `env.apiUrl` is `string | undefined` on purpose. `src/api/client.ts` throws `ApiError('not_configured')` rather than building a bad URL, so a build with no backend reports "accounts unavailable" and everything else works unchanged.

Root cause of a real bug: `readWithRefresh` in `src/data/sync.ts` used to `await pull()` before returning, so every diary/dashboard read blocked on a live network round-trip whenever a server was reachable but slow — the local-first design existed only in the doc comment. Fixed by firing `pull()` without awaiting it.

## App shell, identity & navigation

Two orthogonal pieces of identity:

- `useProfileStore` — the **local profile** (a `user` row). This is what the root layout gates on: onboarding, not sign-in, is the only thing between a fresh install and the diary (`Stack.Protected guard={!hasProfile}` in `app/_layout.tsx`).
- `useAuthStore` — an **optional session**. It gates nothing; it only decides whether reads try the server first. `(auth)` routes are reachable at any time and gate nothing.

`app/_layout.tsx` holds the boot sequence: fonts, Drizzle `useMigrations`, stored-session hydration, then `enableForeignKeys()` + first profile read. Nothing may query the database before migrations report success — on a fresh install the tables don't exist yet. It also hosts the app-wide `LogSheet` (the tab bar's "+" and every dashboard card's "+" open the same instance via `useLogSheetStore`) and `QuestToast`.

Logging is not a tab. `(tabs)` is Home / Achievements / Dishes / Stats, drawn by the custom `FloatingTabBar`; a green "+" raised in the middle of the bar, which notches around it (between Achievements and Dishes) opens the shared `LogSheet` and returns you to wherever you were. The sheet's menu is food-first: Snap / Describe / Search are the large tiles (into `manual?mode=image`, `manual?mode=describe` and `search`), and Water / Weight / Activity / Manual are small secondary buttons. Routes pushed from it live in the `log` modal stack (`app/log/`: meal → ingredient, plus `activity`, `manual`, `search`, `interstitial`).

## Data model & domain logic

`src/db/schema.ts` is the FoodFen ERD v1.0.0 as SQLite, with four documented departures: text ids + nullable `remote_id`, sync columns everywhere, no `password_hash`, and three added columns (`food_entry.meal_type`, `*.logged_on`, `user.weekly_rate_kg`). `src/types/models.ts` aliases the Drizzle row types rather than duplicating them; only composite shapes (`FoodEntry`, `DiaryDay`) are hand-written there.

Where the load-bearing logic lives:

- `src/lib/nutrition.ts` — the domain core. BMR (Mifflin–St Jeor), TDEE, target derivation, portion scaling. Pure and heavily tested; everything nutritional flows through it.
- `src/data/entryRepository.ts` — `recalculateTotals` is the _only_ writer of an entry's stored totals, which keeps the denormalized header honest against its ingredients.
- `src/data/userRepository.ts` — daily goals are append-only history: the goal in force on a day is the newest row effective on or before it, so changing today's target never rewrites what last week was measured against.
- `src/data/foodCatalog.ts` (backed by `src/data/catalog/foods.json`, written by `npm run catalog:pull` as `{ snapshotAt, foods }`) — the bundled reference list with synced foods (`catalog_food` table, public data, **left out of `eraseDatabase()` on purpose**) applied over it by slug; the merged list is rebuilt once per sync that wrote rows, not per search. The BE is the only place foods are edited; run `catalog:pull` before each release. Search matches name, English name and aliases, and skips `archived` foods, which `getCatalogFood` still resolves. `source` covers `team` (shown as "FoodFen team", verified, trusted) and `legacy` (unverified). Every screen shows a catalog food's name through `foodDisplayName(food, locale)` (English `nameEn`, first letter upper-cased, else `name`), and a logged ingredient stores the name displayed at that moment. Chosen values are _copied_ onto the ingredient row, so editing the catalog can never rewrite history.
- `src/data/gamificationRepository.ts` + `src/features/gamification/` (`queries.ts`, `selectors.ts`, `toastStore.ts`, `interstitialStore.ts`) — streaks, weekly quests and coin balances; rules are tested independently of the UI that now surfaces them (`app/(tabs)/achievements.tsx`, `app/log/interstitial.tsx`, `src/components/gamification/QuestToast.tsx`).

## Not yet built

- **AI meal capture — built.** `input_method` covers `voice`/`image`/`type`/`manual` and `ai_feedback` records thumbs up/down. Typed, manual, voice (on-device speech-to-text via `expo-speech-recognition` feeding the same text-analysis call), and image (camera/library photo through `app/log/manual.tsx`'s `ImageCapturePanel`) all produce real ingredient rows via `useAnalyzeFood()` and are stored under their correct `input_method`. Barcode scanning lives in `app/log/camera.tsx`, the in-app camera that also takes the meal photo. EAN/UPC codes resolve through Open Food Facts (`src/data/barcodeLookup.ts`). Found products are kept in `localData` and resolve through `getCatalogFood`, so they work offline afterwards. While an analysis runs, `AiAnalyzingView` shows an animated wait screen with cycling status lines and a rotating nutrition tip, from `GET /nutrition-tips` (cached by TanStack Query, prefetched in the tabs layout) with a bundled fallback list.
- **AI insights.** The Stats tab shows locally computed trends. The AI layer should consume `summarizeTrends()` — small and pre-aggregated — rather than raw entries.
