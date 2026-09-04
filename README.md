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

`CLAUDE.md` carries the architecture in depth — the local/remote read-write policy, the layering rules, the unit and date conventions, and the constraints that are easier to hit than to discover. Read it before making a change of any size. The reasoning behind individual decisions lives in the file header comments, particularly `src/data/sync.ts`, `src/db/schema.ts`, `src/lib/nutrition.ts` and `src/db/testDatabase.ts`.

Change the schema, then `npm run db:generate` to emit a migration. Migrations run from the root layout before any screen mounts.

## Not yet built

- **Push sync.** Reads already refresh from the server; writes queue locally and nothing drains them.
- **AI meal capture.** `input_method` covers `voice`/`image`/`type`/`manual` and `ai_feedback` records thumbs up/down, but only the typed and manual paths exist. When the model lands, it should produce ingredient rows and let the existing composer save them; the call belongs on the server, never with a key in the bundle.
- **AI insights.** The Insights tab shows locally computed trends. The AI layer should consume `summarizeTrends()` — small and pre-aggregated — rather than raw entries.
- **Gamification UI.** Streaks, quests, coins and subscriptions have schema, repositories and tested rules, but no screens. Streaks already advance when a meal is logged.
- **Barcode scanning and photo logging.** `expo-camera` and `expo-image-picker` are installed and permissioned; `food_entry.image_url` is plumbed through. No screens yet.
