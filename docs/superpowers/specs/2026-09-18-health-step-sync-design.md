# Health Connect / HealthKit step sync — design

Status: approved by user, ready for implementation planning.

## Context

`src/components/dashboard/CaloriesBurnedSection.tsx` has a step-count row
that has always shown a placeholder `—`, with a comment: "Steps have no
data source yet (they need Health Connect / HealthKit)." The schema
already anticipated this: `activityLog.source` is typed
`'manual' | 'apple_health' | 'google_fit'` and `logRepository.addActivity`
already accepts an optional `source`, but nothing writes a non-`'manual'`
row yet.

The project's spec (`CalSnap_UseCases_BusinessLogic_v3.docx.md`) marks the
broader "sync activity from health app" idea as **UC-17, out of scope**
("Not observed in the recording; requires platform-specific SDK work
disproportionate to MVP value"). This was raised with the user and
they chose to build it anyway, as a deliberate excursion beyond the
thesis's stated MVP scope — not an oversight.

## Scope

**In scope:**
- Daily step count, read live per day (today or a past day the user is
  viewing), from Health Connect (Android) and HealthKit (iOS).
- An estimated calorie contribution from steps, computed from the
  user's actual profile weight (not a flat reference figure), written
  into `activity_log` as its own row per day, additive alongside any
  manually-logged activities for that day (both already sum into
  `exerciseKcal` via the existing `getExerciseByDay`/`getExerciseKcal`
  queries — no repository change needed there).
- A minimal per-day activity list on the dashboard (does not exist yet;
  `getActivities()` in `logRepository.ts` is written but has no caller)
  so a health-derived entry and a manually-logged entry are both
  visible, with the health-derived one carrying a small "tự động"
  caption to distinguish it.
- An explicit, off-by-default Settings toggle to opt in (health data is
  sensitive; this must never be a silent background permission grab).
- A shared, platform-agnostic interface (`HealthProvider`) so the
  Android implementation (buildable and testable now) and the iOS one
  (written now, tested later — no iOS device/Mac available yet) share
  one call site and one data flow.

**Explicitly not in scope for this pass** (documented as an extension
point, not built):
- Importing full workout records (type, duration, GPS, platform-computed
  calories) as their own `activity_log` entries — this was the
  higher-effort option the user did not pick. The `HealthProvider`
  interface is shaped so adding a `getWorkouts(range)` method later
  does not require restructuring the existing pieces, but no such
  method exists yet.
- Background/periodic sync. Reads only happen when the dashboard is
  open (mount or pull-to-refresh) — no `expo-task-manager` background
  registration, no extra OS-level background permissions.
- Any reconciliation between a health-derived entry and a
  similar/overlapping manual entry on the same day (e.g., the user
  logs "Walking 30 min" by hand on a day their phone also tracked that
  walk as steps). Both entries stand and both count — the user
  explicitly accepted this double-counting risk as a known trade-off
  rather than asking for it to be solved.
- Persisting raw historical step *counts* in the schema. Only the
  derived calorie figure is persisted (in `activity_log`, as today's
  writes already do for manual entries). If a health provider can
  still answer a live query for a past day, that day's step number and
  calorie figure populate normally; if it can't (revoked permission,
  data predates when tracking started on the phone, or the platform
  simply doesn't retain it that far back), that day's step row shows
  exactly what it does today (`—`, or whatever manual entries already
  contributed) — no special-cased fallback logic, no new column.

## Architecture

```
src/lib/health/
  types.ts          — HealthProvider interface, no platform code
  healthConnect.ts  — Android implementation (react-native-health-connect)
  healthKit.ts       — iOS implementation (@kingstinct/react-native-healthkit)
  index.ts           — picks the implementation for Platform.OS
```

`src/lib/health/` is a plain `src/lib/` module (like `nutrition.ts`,
`activity.ts`) — it never touches SQLite, so it does not belong under
`src/data/`. `src/features/dashboard/queries.ts` gains a
`useTodayOrViewedDaySteps(date)`-shaped TanStack Query hook that calls
it and, on a fresh non-null read, writes through to the repository
(below) and invalidates the diary queries so `exerciseKcal` recomputes
— the same "server/async state → TanStack Query" convention every
other async read in this codebase already follows, even though the
"server" here is an on-device native API rather than HTTP.

### `HealthProvider` interface

```ts
export interface HealthProvider {
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  /** Total steps for the given local calendar day, or null if there is
   * no permission, no provider on this device, or no data for that day. */
  getStepCount(date: DateKey): Promise<number | null>;
}
```

A single comment at this declaration notes that a future
`getWorkouts(range): Promise<HealthWorkout[]>` is the natural extension
point for the fuller UC-17 behavior — not stubbed out now.

### Repository

`src/data/logRepository.ts` gains one function:

```ts
export function upsertHealthSteps(
  userId: string,
  date: DateKey,
  caloriesBurned: number,
  source: Extract<ActivitySource, 'apple_health' | 'google_fit'>,
): void;
```

It finds the existing not-deleted `activity_log` row for
`(userId, date, activityType: 'steps', source)` and updates
`caloriesBurned` in place, or inserts one if none exists yet. This is
scoped *only* to a health-sourced row re-syncing itself across repeated
dashboard opens on the same day — it never reads or writes a
`source: 'manual'` row. A manual entry and a health-derived entry for
the same day are always two separate rows, and both already sum into
`exerciseKcal` today with no change needed there.

### Calorie estimate

A new pure function, `estimateStepsCalories(steps, weightKg)`, lives in
`src/lib/activity.ts` next to `caloriesBurnedForPreset` — same file,
because it shares that file's MET/Compendium citation convention and
is domain math, not a native wrapper (`src/lib/health/` stays a thin
platform-access layer only). Computed from the user's real
`weightCurrent` (via `useProfileStore`), not a flat reference weight —
this is a fresh calculation, not a reuse of the flat `ACTIVITY_PRESETS`
table, so there is no inherited reference-weight mismatch to worry
about here:

```
minutesWalked = steps / 100        // Tudor-Locke & Rowe (2012) cadence
                                    // threshold for moderate-intensity walking
kcal = minutesWalked × 3.5 (MET) × 3.5 × weightKg / 200
```

MET 3.5 is Compendium of Physical Activities code 17190 ("walking,
2.8–3.2 mph, level, moderate pace, firm surface") — the same primary
source already cited in `src/lib/activity.ts`.

### Step goal constant

The `ProgressRing` in the steps row needs a daily target to show
progress against. The commonly-quoted "10,000 steps/day" figure is
**not** a rigorous public-health recommendation — it traces to a 1965
Japanese pedometer marketing name (*manpo-kei*, "10,000-step meter"),
not a study. Later epidemiological work (e.g. Lee et al., JAMA Intern
Med 2019, on older women, and Paluch et al., Lancet Public Health
2022) found mortality-risk benefit already levelling off around
7,000–9,000 steps/day for many adult cohorts, with 10,000 not
identified as a meaningfully different threshold. Given that, this
design uses **8,000 steps/day** as the constant (`DASHBOARD_STEP_GOAL`,
next to `DASHBOARD_BURN_GOAL_KCAL` in
`src/features/dashboard/constants.ts`), with a code comment citing the
above rather than presenting a round marketing number as if it were an
authoritative target. This is a placeholder in the same sense
`DASHBOARD_BURN_GOAL_KCAL` already is — no per-user step goal exists in
the data model, so it is a fixed figure until one does.

### Dashboard UI

- The existing steps row in `CaloriesBurnedSection` gets its real
  number (and its `ProgressRing` its real fraction toward a step goal
  constant) once the setting is on and a value comes back.
- A new, minimal per-day activity list renders under it — the first
  consumer of `logRepository.getActivities()`. Each row: icon, activity
  name, kcal right-aligned; a health-derived row additionally shows a
  small muted "tự động" caption under its name (mirroring
  `FoodEntryRow`'s secondary-text line), so the kcal column stays
  aligned. A manually-logged row shows nothing extra — the unmarked
  case is the expected default, so only the automatic one needs calling
  out.
- Settings gains one new off-by-default toggle (same pattern as
  Smart-mode / Developer rows) to opt in; turning it on calls
  `requestPermissions()`.
- When `getStepCount` returns `null` because permission was denied or
  later revoked, the steps row shows a "Kết nối lại" affordance instead
  of a number, rather than silently showing `0` or looping the request.

## Native configuration

**Android — Health Connect:**
- `react-native-health-connect` + its `expo-health-connect` config
  plugin.
- Requires `minSdkVersion` ≥ 26; `app.config.ts` currently sets 24 via
  `expo-build-properties` and needs to move to 26. This is a real,
  user-visible change (drops installability on Android 7.x/7.1 devices,
  API 24–25) — flagged and accepted, not a silent side effect.
- Health Connect itself may not be installed on the device (common on
  Android < 14, where it ships as a separate Play Store app rather
  than being built into the OS). `isAvailable()` must detect this and
  the UI must offer to open its Play Store listing rather than failing
  silently or crashing.
- Known pitfall from research: an older release of
  `react-native-health-connect` bundled its own native package that
  collided with the one the config plugin also registers, producing a
  "duplicate HealthConnectPackage class" build error. Not expected with
  a current install, but documented here in case it resurfaces.

**iOS — HealthKit:**
- `@kingstinct/react-native-healthkit` — a Nitro Modules library built
  for the New Architecture, matching this project's RN 0.86 / React 19
  stack, with its own config plugin.
- `NSHealthShareUsageDescription` must be added to `app.config.ts`'s
  `ios.infoPlist` (App Store review requires a real purpose string).
- Does not run in Expo Go (already a non-issue — this project is
  dev-client-only) and cannot return real step data from the
  Simulator. Written now; verified on a real device once one is
  available — not a blocker for writing the code.

**Both platforms** require a dev client rebuild after these packages
and config changes land — this is not a JS-only change.

## Testing

- `src/lib/health/healthConnect.ts` and `healthKit.ts` wrap third-party
  native modules directly; there is nothing pure to unit test inside
  them beyond thin pass-through calls; the New Architecture native
  bridging cannot be exercised in Jest.
- The calorie-estimate formula (steps → kcal at a given weight) is a
  pure function and gets a unit test, same as `caloriesBurnedForPreset`
  in `src/lib/activity.ts`.
- `upsertHealthSteps` is a repository function against the real
  Drizzle schema and gets a `testDatabase`-backed test, matching every
  other `logRepository`/`data` function's existing test pattern:
  inserting twice for the same day updates in place rather than
  creating a second row, and a manual `source: 'manual'` row for the
  same day is left untouched.
- Everything above the native module boundary (the query hook,
  dashboard rendering, the Settings toggle) is exercised the same way
  the rest of the app's TanStack Query hooks and screens already are.
- No device/manual QA plan is written here for the Android side beyond
  "run it" since a real device is available; the iOS path is flagged
  throughout as code-complete-but-unverified until a device exists.
