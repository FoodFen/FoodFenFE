# FoodFen

Cross-platform (iOS + Android) calorie and macro tracker built with Expo, expo-router and NativeWind.

There is **no web target**. `app.config.ts` declares `platforms: ['ios', 'android']` and no `web` block, and nothing in the codebase branches on a web platform.

## Stack

| Concern       | Choice                                                  |
| ------------- | ------------------------------------------------------- |
| Runtime       | Expo SDK 57 · React Native 0.86 · React 19.2            |
| Routing       | expo-router 57 (file-based, typed routes)               |
| Styling       | NativeWind 4.2 + Tailwind CSS 3.4                       |
| Server state  | TanStack Query 5, persisted to MMKV                     |
| Client state  | Zustand 5                                               |
| Forms         | React Hook Form 7 + Zod 4                               |
| Local storage | react-native-mmkv 4 (data) · expo-secure-store (tokens) |
| Lists         | @shopify/flash-list 2                                   |
| Animation     | Reanimated 4 + react-native-worklets                    |
| Tests         | Jest + jest-expo + @testing-library/react-native        |

Versions are pinned to what `expo install` resolves for SDK 57, so `npx expo-doctor` passes 21/21 checks.

## Getting started

```bash
npm install
cp .env.example .env.local     # set EXPO_PUBLIC_API_URL
```

This app uses a **development build**, not Expo Go — MMKV, Reanimated 4 and the camera modules all require custom native code.

```bash
npm run ios        # builds and launches the iOS dev client (macOS only)
npm run android    # builds and launches the Android dev client
npm start          # dev server for an already-installed dev client
```

The `android/` and `ios/` folders are generated, not committed (Continuous Native Generation). `npm run prebuild` regenerates them; edit `app.config.ts` rather than the native projects.

### Backend

The app talks to a REST backend at `EXPO_PUBLIC_API_URL`. The contract it expects lives in `src/api/` — `schemas.ts` is the authoritative description of every response shape, and `endpoints/` lists every route the app calls. Until that backend exists, requests fail with a typed `ApiError` and the screens show their error states.

> On the Android emulator, `localhost` refers to the emulator itself. `src/lib/env.ts` rewrites it to `10.0.2.2` automatically.

## Scripts

| Script                | What it does                               |
| --------------------- | ------------------------------------------ |
| `npm start`           | Dev server for the dev client              |
| `npm run android/ios` | Build + run the native app                 |
| `npm run prebuild`    | Regenerate `android/` and `ios/`           |
| `npm run typecheck`   | `tsc --noEmit`                             |
| `npm run lint`        | ESLint, zero warnings tolerated            |
| `npm run format`      | Prettier, with Tailwind class sorting      |
| `npm test`            | Jest                                       |
| `npm run verify`      | typecheck + lint + test                    |
| `npm run doctor`      | `expo-doctor` dependency and config checks |

## Layout

```
app/                        Routes. The file tree IS the navigation graph.
  _layout.tsx               Providers, fonts, splash, auth guard
  (auth)/                   sign-in, sign-up            — unauthenticated only
  (tabs)/                   Diary · Log · Insights · Profile
  log/                      search → portion            — modal flow
  settings/goals.tsx        Body stats and calorie goal
  food/[id].tsx             Nutrition detail
src/
  api/                      HTTP client, Zod wire schemas, endpoint modules
  components/ui/            Design-system primitives (Text, Button, Card, ...)
  components/diary/         Diary-specific composites
  components/insights/      Charts
  features/                 auth · diary · insights · settings · profile
                            (queries, mutations, stores, pure selectors)
  hooks/                    Cross-cutting hooks
  lib/                      nutrition math, dates, storage, env, query client
  theme/                    Palette mirror for non-className consumers
  types/models.ts           Domain model
```

### Where the interesting decisions live

- **`src/lib/nutrition.ts`** — the domain core. BMR (Mifflin–St Jeor), TDEE, goal derivation, portion scaling, macro arithmetic. Pure functions, covered by tests. Everything nutritional flows through here.
- **`src/api/client.ts`** — one fetch wrapper that owns auth headers, single-flight token refresh, timeouts, and Zod response validation. Auth handlers are _injected_ (`configureAuth`) so the HTTP layer never imports the auth feature.
- **`src/features/diary/queries.ts`** — optimistic logging and deletion. Entries appear instantly and roll back on failure, because logging happens on bad connections.
- **`global.css` + `tailwind.config.js`** — semantic design tokens as CSS variables. Components use `bg-surface` / `text-fg-muted`; the light and dark values are defined once, so almost nothing needs a `dark:` variant.

## Theming

Colors are defined twice on purpose:

- `global.css` — the source of truth for anything styled with `className`.
- `src/theme/colors.ts` — a JS mirror for the places that cannot take a class name (SVG `fill`, the navigator theme, the status bar).

A value changed in one must be changed in the other.

## Conventions

- Energy is always **kcal**, mass always **grams**, weight always **kg**. Convert at the edges; keep the inside consistent. Display units are a preference (`src/features/settings/store.ts`), never a storage format.
- Diary dates are local calendar days (`yyyy-MM-dd`), never timestamps. A meal logged at 11pm belongs to that day. Use `src/lib/date.ts` — never `toISOString()`, which shifts the date across the UTC boundary.
- Optional nutrients stay `undefined` when unreported. `fiber: 0` means "contains no fiber"; `undefined` means "we don't know".
- Import with the `@/` alias for `src/`.

## Not yet built

- **AI insights.** The Insights tab currently shows locally computed trends. When the AI layer is added, it should consume `summarizeTrends()` from `src/features/insights/trends.ts` — a small, already-aggregated summary — rather than raw diary entries, and the model call belongs on the server. Never ship an API key in the bundle; everything in `EXPO_PUBLIC_*` is readable by anyone who downloads the app.
- **Barcode scanning.** `expo-camera` is installed and permissioned, and `foodsApi.byBarcode` exists; the scanner screen is not written.
- **Photo logging.** `expo-image-picker` is installed and `FoodEntry.photoUri` is plumbed through, but nothing captures an image yet.
- **Offline write queue.** Reads are cached and served offline. Writes made while offline fail rather than queueing.
