# Health Connect / HealthKit Step Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show today's (or a viewed past day's) real step count on the dashboard, derive an estimated calorie contribution from it using the user's own weight, and persist that contribution into `activity_log` so it sums into `exerciseKcal` alongside anything logged by hand — on both Android (Health Connect) and iOS (HealthKit), behind an explicit, off-by-default Settings toggle.

**Architecture:** A platform-agnostic `HealthProvider` interface in `src/lib/health/` with one implementation per OS, selected at runtime by `Platform.OS`. A TanStack Query hook in `src/features/dashboard/queries.ts` reads through it, computes calories via a new pure function in `src/lib/activity.ts`, and writes through a new upsert-per-day repository function in `src/data/logRepository.ts` — the same `read → estimate → upsert-by-day → invalidate` shape the codebase already uses for weight (`logWeight`) and water (`setWaterTotal`).

**Tech Stack:** `react-native-health-connect` + `expo-health-connect` (Android), `@kingstinct/react-native-healthkit` (iOS, Nitro Modules, New Architecture), existing TanStack Query 5 / Zustand / Drizzle stack.

**Spec:** `docs/superpowers/specs/2026-09-18-health-step-sync-design.md`

## Global Constraints

- Development build only, no Expo Go (CLAUDE.md) — both native packages require a dev client rebuild.
- `android/` and `ios/` are generated and gitignored; every native config change goes through `app.config.ts`, never a hand-edited native project file (CLAUDE.md).
- Add dependencies with `npx expo install`, never plain `npm install` (CLAUDE.md).
- `minSdkVersion` moves from 24 to 26 in `app.config.ts`'s `expo-build-properties` entry — Health Connect requires API 26+ (spec).
- iOS `infoPlist` gains `NSHealthShareUsageDescription` — required for App Store review of any HealthKit read (spec).
- The Settings toggle that gates all of this defaults to **off**; nothing in this feature ever requests a permission without the user first opting in (spec — "health data is sensitive... this must never be a silent background permission grab").
- No background/periodic sync of any kind — every read happens only when the dashboard is mounted or pull-to-refreshed (spec).
- `src/lib/health/` never imports from `src/data/` or touches SQLite — it is a thin native-access layer, parallel to `src/lib/nutrition.ts` / `src/lib/activity.ts`, not a repository (spec, CLAUDE.md layering).
- Server/async state goes through TanStack Query; local/UI state through Zustand — never mixed (CLAUDE.md).
- Body metrics and health data are never logged and never sent to analytics (CLAUDE.md).
- Strict TypeScript, no `any` without a justifying comment; `npm run lint` must stay at zero warnings (`--max-warnings=0`); `npm run verify` (typecheck + lint + test) must pass before any task is considered done.
- A manually-logged `activity_log` row (`source: 'manual'`) is never read, updated, or deleted by anything in this feature — only a health-derived row (`source: 'apple_health' | 'google_fit'`) for the same day is ever touched, and only by that same source re-syncing itself (spec).

---

### Task 1: `estimateStepsCalories` — the pure calorie formula

**Files:**
- Modify: `src/lib/activity.ts`
- Test: `src/lib/__tests__/activity.test.ts`

**Interfaces:**
- Produces: `estimateStepsCalories(steps: number, weightKg: number): number`, exported from `src/lib/activity.ts`. Every later task that needs a steps→kcal figure calls this and nothing else.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/activity.test.ts`:

```ts
import { estimateStepsCalories } from '../activity';

describe('estimateStepsCalories', () => {
  it('is zero for zero steps', () => {
    expect(estimateStepsCalories(0, 70)).toBe(0);
  });

  it('matches the formula: (steps / 100) * 3.5 MET * 3.5 * weightKg / 200', () => {
    // 1,000 steps at 70 kg: (1000/100) * 3.5 * 3.5 * 70 / 200 = 42.875 -> 43
    expect(estimateStepsCalories(1000, 70)).toBe(43);
  });

  it('scales linearly with steps at a fixed weight', () => {
    expect(estimateStepsCalories(20000, 70)).toBe(estimateStepsCalories(10000, 70) * 2);
  });

  it('scales linearly with weight at a fixed step count', () => {
    expect(estimateStepsCalories(10000, 140)).toBe(estimateStepsCalories(10000, 70) * 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/activity.test.ts`
Expected: FAIL — `estimateStepsCalories is not a function` (or a TS error if run through `tsc` first).

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/activity.ts`, after `caloriesBurnedForPreset`:

```ts
/** Steps/minute at moderate-intensity walking pace (Tudor-Locke & Rowe, 2012). */
const MODERATE_PACE_STEPS_PER_MINUTE = 100;
/** Compendium of Physical Activities code 17190, "walking, 2.8-3.2 mph, level,
 * moderate pace, firm surface" — the same primary source cited above for
 * ACTIVITY_PRESETS. */
const WALKING_MET = 3.5;

/**
 * Estimate calories burned from a day's step count, scaled by the user's own
 * weight rather than a flat reference figure (unlike ACTIVITY_PRESETS, this is
 * a fresh calculation with no inherited reference-weight assumption to carry).
 * Rounded to the nearest kcal, same as caloriesBurnedForPreset.
 */
export function estimateStepsCalories(steps: number, weightKg: number): number {
  const minutesWalked = steps / MODERATE_PACE_STEPS_PER_MINUTE;

  return Math.round((minutesWalked * WALKING_MET * 3.5 * weightKg) / 200);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/activity.test.ts`
Expected: PASS, all 4 new tests plus the existing 5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/activity.ts src/lib/__tests__/activity.test.ts
git commit -m "Add estimateStepsCalories, scaled by the user's own weight"
```

---

### Task 2: `upsertHealthSteps` — one health-derived row per day

**Files:**
- Modify: `src/data/logRepository.ts`
- Test: Create `src/data/__tests__/logRepository.test.ts`

**Interfaces:**
- Consumes: `generateLocalId('act')`, `touch()`, `notDeleted(activityLog)` (all already in this file); `ActivitySource` from `@/types/models`.
- Produces: `upsertHealthSteps(userId: string, date: DateKey, caloriesBurned: number, source: Extract<ActivitySource, 'apple_health' | 'google_fit'>): void`, exported from `src/data/logRepository.ts`. Task 8's query hook calls this and nothing else to persist.

- [ ] **Step 1: Write the failing test**

Create `src/data/__tests__/logRepository.test.ts`:

```ts
import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';

import * as logRepository from '../logRepository';
import * as userRepository from '../userRepository';

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

function createUser() {
  return userRepository.createLocalUser({
    gender: 'female',
    birthYear: 1995,
    height: 165,
    weightCurrent: 65,
    weightGoal: 65,
    activityLevel: 'moderate',
    dietType: 'balanced',
    weeklyRateKg: 0,
  }).user;
}

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('upsertHealthSteps', () => {
  it('inserts a new steps row with the right source and activityType', () => {
    const user = createUser();

    logRepository.upsertHealthSteps(user.id, '2026-03-01', 120, 'google_fit');

    const activities = logRepository.getActivities(user.id, '2026-03-01');

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activityType: 'steps',
      source: 'google_fit',
      caloriesBurned: 120,
    });
  });

  it('updates the same row in place on a second sync for the same day', () => {
    const user = createUser();

    logRepository.upsertHealthSteps(user.id, '2026-03-01', 120, 'google_fit');
    logRepository.upsertHealthSteps(user.id, '2026-03-01', 260, 'google_fit');

    const activities = logRepository.getActivities(user.id, '2026-03-01');

    expect(activities).toHaveLength(1);
    expect(activities[0]?.caloriesBurned).toBe(260);
  });

  it('never touches a manually-logged row for the same day', () => {
    const user = createUser();

    logRepository.addActivity({
      userId: user.id,
      activityType: 'walking',
      caloriesBurned: 141,
      date: '2026-03-01',
    });

    logRepository.upsertHealthSteps(user.id, '2026-03-01', 120, 'google_fit');

    const activities = logRepository.getActivities(user.id, '2026-03-01');

    expect(activities).toHaveLength(2);
    expect(activities.find((a) => a.source === 'manual')?.caloriesBurned).toBe(141);
    expect(activities.find((a) => a.source === 'google_fit')?.caloriesBurned).toBe(120);
  });

  it('keeps apple_health and google_fit as separate rows if both ever write the same day', () => {
    const user = createUser();

    logRepository.upsertHealthSteps(user.id, '2026-03-01', 120, 'google_fit');
    logRepository.upsertHealthSteps(user.id, '2026-03-01', 130, 'apple_health');

    const activities = logRepository.getActivities(user.id, '2026-03-01');

    expect(activities).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/__tests__/logRepository.test.ts`
Expected: FAIL — `logRepository.upsertHealthSteps is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/data/logRepository.ts`, after `addActivity`:

```ts
/**
 * One steps-derived activity per user/day/source, upserted in place.
 *
 * Scoped only to a health-sourced row re-syncing itself across repeated
 * dashboard opens on the same day (the dashboard may call this many times as
 * the day's step count rises) — it only ever matches on
 * (userId, loggedOn, activityType: 'steps', source), so it never reads or
 * writes a `source: 'manual'` row, and Apple Health / Google Fit each keep
 * their own row if a device somehow reports both for one day.
 */
export function upsertHealthSteps(
  userId: string,
  date: DateKey,
  caloriesBurned: number,
  source: Extract<ActivitySource, 'apple_health' | 'google_fit'>,
): void {
  const existing = db
    .select()
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, userId),
        eq(activityLog.loggedOn, date),
        eq(activityLog.activityType, 'steps'),
        eq(activityLog.source, source),
        notDeleted(activityLog),
      ),
    )
    .limit(1)
    .all()[0];

  if (existing) {
    db.update(activityLog)
      .set({ caloriesBurned, ...touch() })
      .where(eq(activityLog.id, existing.id))
      .run();
    return;
  }

  const now = new Date();

  db.insert(activityLog)
    .values({
      id: generateLocalId('act'),
      userId,
      activityType: 'steps',
      caloriesBurned,
      source,
      loggedAt: now,
      loggedOn: date,
      remoteId: null,
      deletedAt: null,
      ...touch(now),
    })
    .run();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/data/__tests__/logRepository.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/logRepository.ts src/data/__tests__/logRepository.test.ts
git commit -m "Add upsertHealthSteps: one health-derived activity row per day"
```

---

### Task 3: Settings toggle — `healthSyncEnabled`

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `src/features/settings/store.ts`
- Test: Modify `src/features/settings/__tests__/store.test.ts`

**Interfaces:**
- Produces: `useSettingsStore.getState().healthSyncEnabled: boolean` (default `false`) and `.setHealthSyncEnabled(value: boolean): void`. Task 8's query hook reads the former to gate whether it ever calls a `HealthProvider`; Task 10's Settings row calls the latter.

- [ ] **Step 1: Write the failing test**

Append to `src/features/settings/__tests__/store.test.ts`:

```ts
describe('healthSyncEnabled', () => {
  it('defaults to off', () => {
    expect(useSettingsStore.getState().healthSyncEnabled).toBe(false);
  });

  it('setHealthSyncEnabled flips it and persists', () => {
    useSettingsStore.getState().setHealthSyncEnabled(true);

    expect(useSettingsStore.getState().healthSyncEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/settings/__tests__/store.test.ts`
Expected: FAIL — `healthSyncEnabled` is `undefined`, `setHealthSyncEnabled` is not a function.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/storage.ts`, add one entry to the `StorageKeys` object (after `questAdvanceCounts`):

```ts
  healthSyncEnabled: 'health-sync-enabled',
```

In `src/features/settings/store.ts`, add to the `SettingsState` interface (after `questAdvanceCounts`):

```ts
  /**
   * Opt-in to reading today's step count from Health Connect (Android) /
   * HealthKit (iOS). Off by default — health data is sensitive, so this is
   * never requested without the user turning it on first.
   */
  healthSyncEnabled: boolean;
```

and to the setters group (after `bumpQuestAdvance`):

```ts
  setHealthSyncEnabled: (value: boolean) => void;
```

In the store body, add the initial value (after `questAdvanceCounts:` initializer):

```ts
  healthSyncEnabled: preferences.get<boolean>(StorageKeys.healthSyncEnabled) ?? false,
```

and the setter (after `bumpQuestAdvance`'s implementation, before `completeOnboarding`):

```ts
  setHealthSyncEnabled: (healthSyncEnabled) => {
    preferences.set(StorageKeys.healthSyncEnabled, healthSyncEnabled);
    set({ healthSyncEnabled });
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/settings/__tests__/store.test.ts`
Expected: PASS, all tests including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/features/settings/store.ts src/features/settings/__tests__/store.test.ts
git commit -m "Add the off-by-default healthSyncEnabled setting"
```

---

### Task 4: `HealthProvider` interface

**Files:**
- Create: `src/lib/health/types.ts`

**Interfaces:**
- Produces: `export interface HealthProvider { isAvailable(): Promise<boolean>; requestPermissions(): Promise<boolean>; getStepCount(date: DateKey): Promise<number | null>; }`. Tasks 5, 6 and 7 all implement or consume this exact shape.

This file is pure TypeScript with no runtime code, so there is nothing to
unit-test — it is verified by the type checker once Tasks 5–7 implement
against it.

- [ ] **Step 1: Write the interface**

Create `src/lib/health/types.ts`:

```ts
import type { DateKey } from '@/lib/date';

/**
 * A source of on-device health data, abstracted over the two platform SDKs
 * (Health Connect on Android, HealthKit on iOS) so the rest of the app never
 * branches on Platform.OS itself — see `./index.ts`.
 *
 * Deliberately minimal: today this only reads a daily step total. The next
 * natural extension point, if full workout import (UC-17's fuller scope) is
 * ever built, is a `getWorkouts(range): Promise<HealthWorkout[]>` method here
 * — not added now, since nothing calls it yet.
 */
export interface HealthProvider {
  /** Whether this platform's health SDK exists and is usable on this device
   * (e.g. false if Health Connect isn't installed on an Android < 14 device). */
  isAvailable(): Promise<boolean>;
  /** Prompts the OS permission dialog. Resolves true only if steps read
   * access was granted. */
  requestPermissions(): Promise<boolean>;
  /**
   * Total steps for the given local calendar day. Both platforms can answer
   * for past days as well as today; returns null if there is no permission,
   * no provider on this device, or no recorded data for that day (including
   * "before health tracking started on this phone").
   */
  getStepCount(date: DateKey): Promise<number | null>;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors (this file has no consumers yet, so it should be silent).

- [ ] **Step 3: Commit**

```bash
git add src/lib/health/types.ts
git commit -m "Add the HealthProvider interface"
```

---

### Task 5: Android — Health Connect implementation

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `app.config.ts`
- Create: `src/lib/health/healthConnect.ts`

**Interfaces:**
- Consumes: `HealthProvider` from `./types` (Task 4).
- Produces: `export const healthConnectProvider: HealthProvider`. Task 7's platform picker imports this.

There is nothing pure to unit-test here — every function is a thin
pass-through to a native module that cannot run under Jest (same
reasoning the design spec gives). Verification is `npx tsc --noEmit` plus
an actual run on a device, since a real Android device is available.

- [ ] **Step 1: Install the packages**

Run:

```bash
npx expo install react-native-health-connect expo-health-connect
```

- [ ] **Step 2: Wire the config plugin and raise `minSdkVersion`**

In `app.config.ts`, change the `expo-build-properties` entry inside
`OWN_PLUGINS` (currently `android: { minSdkVersion: 24 }`) to:

```ts
  [
    'expo-build-properties',
    {
      ios: { useFrameworks: 'static' },
      android: { minSdkVersion: 26 },
    },
  ],
```

and add `'expo-health-connect'` to the `OWN_PLUGINS` array, after the
`expo-notifications` entry:

```ts
  ['expo-notifications', { color: '#16A34A' }],
  'expo-health-connect',
```

- [ ] **Step 3: Implement the provider**

Create `src/lib/health/healthConnect.ts`:

```ts
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { Linking } from 'react-native';

import type { DateKey } from '@/lib/date';

import type { HealthProvider } from './types';

/** The Play Store listing for the Health Connect app, opened when it isn't
 * installed at all (common on Android < 14, where it ships as a separate
 * app rather than being built into the OS). */
const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

/** Local-day boundaries as the ISO instants Health Connect's time filter wants. */
function dayBounds(date: DateKey): { startTime: string; endTime: string } {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

async function isAvailable(): Promise<boolean> {
  const status = await getSdkStatus();

  // Verify these two constant names against the installed version's
  // exported enum (node_modules/react-native-health-connect) if this check
  // misbehaves — third-party enum names occasionally shift between majors.
  return status === SdkAvailabilityStatus.SDK_AVAILABLE;
}

async function requestPermissions(): Promise<boolean> {
  const status = await getSdkStatus();

  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
    // Not installed at all — send the user to install it instead of
    // silently failing every future attempt (spec requirement).
    await Linking.openURL(`market://details?id=${HEALTH_CONNECT_PACKAGE}`);
    return false;
  }

  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false; // e.g. needs a provider update

  await initialize();

  const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);

  return granted.some((p) => p.recordType === 'Steps');
}

async function getStepCount(date: DateKey): Promise<number | null> {
  if (!(await isAvailable())) return null;

  await initialize();

  const { records } = await readRecords('Steps', {
    timeRangeFilter: { operator: 'between', ...dayBounds(date) },
  });

  if (records.length === 0) return null;

  return records.reduce((sum, record) => sum + record.count, 0);
}

export const healthConnectProvider: HealthProvider = {
  isAvailable,
  requestPermissions,
  getStepCount,
};
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors. If `SdkAvailabilityStatus`, `getSdkStatus`, or the
`Steps` record's field name (`count`) don't match, open
`node_modules/react-native-health-connect/lib/typescript/index.d.ts` and
adjust the import/field names only — the surrounding logic doesn't change.

- [ ] **Step 5: Rebuild the dev client and confirm on a device**

Run: `npx expo prebuild --clean && npm run android`

On the device: the app should build and launch without a Health-Connect-related
crash. Full permission-grant and step-read verification happens once Task 11
wires this into the dashboard — this step only confirms the native build
itself is sound.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.config.ts src/lib/health/healthConnect.ts
git commit -m "Add the Android Health Connect provider"
```

---

### Task 6: iOS — HealthKit implementation

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `app.config.ts`
- Create: `src/lib/health/healthKit.ts`

**Interfaces:**
- Consumes: `HealthProvider` from `./types` (Task 4).
- Produces: `export const healthKitProvider: HealthProvider`. Task 7's platform picker imports this.

Same testing note as Task 5: nothing pure to unit-test, and — as agreed —
**no iOS device exists yet to verify this on**. This task is written and
type-checked now; the device-verification step is explicitly deferred
rather than skipped.

- [ ] **Step 1: Install the package**

Run:

```bash
npx expo install @kingstinct/react-native-healthkit
```

- [ ] **Step 2: Add the config plugin and the usage-description string**

In `app.config.ts`, add `'@kingstinct/react-native-healthkit'` to the
`OWN_PLUGINS` array, after `'expo-health-connect'`:

```ts
  'expo-health-connect',
  '@kingstinct/react-native-healthkit',
```

and add `NSHealthShareUsageDescription` to `ios.infoPlist` (alongside the
existing `NSCameraUsageDescription` etc.):

```ts
      NSHealthShareUsageDescription:
        'FoodFen reads your step count so it can estimate the calories you burned walking today.',
```

- [ ] **Step 3: Implement the provider**

Create `src/lib/health/healthKit.ts`:

```ts
import {
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import type { DateKey } from '@/lib/date';

import type { HealthProvider } from './types';

const STEP_COUNT_TYPE = 'HKQuantityTypeIdentifierStepCount';

/** Local-day boundaries as the Date objects the statistics query wants. */
function dayBounds(date: DateKey): { startDate: Date; endDate: Date } {
  return {
    startDate: new Date(`${date}T00:00:00`),
    endDate: new Date(`${date}T23:59:59.999`),
  };
}

async function isAvailable(): Promise<boolean> {
  return isHealthDataAvailable();
}

async function requestPermissions(): Promise<boolean> {
  if (!(await isAvailable())) return false;

  try {
    await requestAuthorization({ toRead: [STEP_COUNT_TYPE], toShare: [] });
    return true;
  } catch {
    return false;
  }
}

async function getStepCount(date: DateKey): Promise<number | null> {
  if (!(await isAvailable())) return null;

  const stats = await queryStatisticsForQuantity(STEP_COUNT_TYPE, dayBounds(date));

  // Verify `sumQuantity`'s exact shape against the installed version's
  // TypeScript types (node_modules/@kingstinct/react-native-healthkit) once
  // a device is available to test against — this is the one call in this
  // file built from secondary documentation rather than a hands-on check.
  const total = stats?.sumQuantity?.quantity;

  return typeof total === 'number' ? Math.round(total) : null;
}

export const healthKitProvider: HealthProvider = {
  isAvailable,
  requestPermissions,
  getStepCount,
};
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors. If `queryStatisticsForQuantity`'s return shape doesn't
match (`sumQuantity.quantity`), open
`node_modules/@kingstinct/react-native-healthkit`'s `.d.ts` files and adjust
that one field access — the surrounding logic doesn't change.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.config.ts src/lib/health/healthKit.ts
git commit -m "Add the iOS HealthKit provider (untested — no device yet)"
```

---

### Task 7: Platform picker

**Files:**
- Create: `src/lib/health/index.ts`

**Interfaces:**
- Consumes: `healthConnectProvider` (Task 5), `healthKitProvider` (Task 6).
- Produces: `export function getHealthProvider(): HealthProvider`. Task 8's query hook calls this and nothing else.

- [ ] **Step 1: Write the picker**

Create `src/lib/health/index.ts`:

```ts
import { Platform } from 'react-native';

import { healthConnectProvider } from './healthConnect';
import { healthKitProvider } from './healthKit';
import type { HealthProvider } from './types';

export type { HealthProvider } from './types';

export function getHealthProvider(): HealthProvider {
  return Platform.OS === 'ios' ? healthKitProvider : healthConnectProvider;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/health/index.ts
git commit -m "Add the Platform.OS health provider picker"
```

---

### Task 8: `useHealthSteps` query hook

**Files:**
- Modify: `src/features/dashboard/queries.ts`
- Modify: `src/lib/queryClient.ts` (new query key)

**Interfaces:**
- Consumes: `getHealthProvider()` (Task 7), `estimateStepsCalories` (Task 1), `logRepository.upsertHealthSteps` (Task 2), `useSettingsStore().healthSyncEnabled` (Task 3), `useProfileStore().profile.weightCurrent` (existing).
- Produces: `useHealthSteps(date: DateKey)`, a TanStack Query result whose `data` is `{ steps: number; kcal: number } | null | undefined` (`undefined` while pending or when the setting is off, `null` when the setting is on but the platform returned no data — no permission, unsupported device, or nothing recorded for that day). Task 11's dashboard section consumes this and `useSettingsStore().healthSyncEnabled` directly.

No new unit test: this hook's only real logic (the estimate and the
upsert) is already covered by Tasks 1 and 2's tests; the hook itself is
thin orchestration over `useQuery`, in the same style as every other hook
in `src/features/dashboard/queries.ts`, none of which carry their own
tests today.

- [ ] **Step 1: Add the query key**

In `src/lib/queryClient.ts`, add a `health` entry to the `queryKeys` object
(alongside `gamification`, following the same shape):

```ts
  health: {
    all: ['health'] as const,
    steps: (date: string) => [...queryKeys.health.all, 'steps', date] as const,
  },
```

- [ ] **Step 2: Write the hook**

Add to `src/features/dashboard/queries.ts`:

```ts
import { useQuery, useQueryClient } from '@tanstack/react-query';

import * as diaryRepository from '@/data/diaryRepository';
import { getCoinBalance } from '@/data/gamificationRepository';
import * as logRepository from '@/data/logRepository';
import { getWeightAsOf } from '@/data/logRepository';
import { readWithRefresh } from '@/data/sync';
import { pullDiaryWindow } from '@/features/diary/queries';
import { getHealthProvider } from '@/lib/health';
import { estimateStepsCalories } from '@/lib/activity';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import type { DateKey } from '@/lib/date';
import { calendarWeek } from '@/lib/date';
import { queryKeys } from '@/lib/queryClient';
```

(merge the new imports — `useQueryClient`, `logRepository`, `getHealthProvider`,
`estimateStepsCalories`, `useSettingsStore` — into the existing import block
rather than duplicating the `useQuery`/`diaryRepository`/etc. lines already
there.)

Then add the hook itself, after `useCoinBalance`:

```ts
/**
 * Today's (or a viewed past day's) step count and its estimated calorie
 * contribution, read from whichever HealthProvider this platform has.
 *
 * The read-through write: a successful read is immediately persisted via
 * `upsertHealthSteps` (idempotent per day, per source — see its own doc
 * comment) and the diary invalidated, so `exerciseKcal` picks it up the same
 * way any other logged activity does. Disabled entirely while the user
 * hasn't opted in via Settings.
 */
export function useHealthSteps(date: DateKey) {
  const userId = useUserId();
  const profile = useProfileStore((state) => state.profile);
  const healthSyncEnabled = useSettingsStore((state) => state.healthSyncEnabled);
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.health.steps(date),
    queryFn: async () => {
      if (!userId || !profile) throw new Error('No local profile yet.');

      const steps = await getHealthProvider().getStepCount(date);

      if (steps === null) return null;

      const kcal = estimateStepsCalories(steps, profile.weightCurrent);
      const source = Platform.OS === 'ios' ? 'apple_health' : 'google_fit';

      logRepository.upsertHealthSteps(userId, date, kcal, source);
      void queryClient.invalidateQueries({ queryKey: queryKeys.diary.all });

      return { steps, kcal };
    },
    enabled: userId !== null && profile !== null && healthSyncEnabled,
    retry: false,
  });
}
```

Add `import { Platform } from 'react-native';` to this file's import block
if it isn't already imported there.

- [ ] **Step 3: Verify it type-checks and existing tests still pass**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, all existing tests still pass (this task adds no new
test file, so the count should be unchanged from before this task).

- [ ] **Step 4: Commit**

```bash
git add src/features/dashboard/queries.ts src/lib/queryClient.ts
git commit -m "Add useHealthSteps: read-through-and-persist daily step sync"
```

---

### Task 9: Step-goal constant

**Files:**
- Modify: `src/features/dashboard/constants.ts`

**Interfaces:**
- Produces: `export const DASHBOARD_STEP_GOAL: number`. Task 11's dashboard section imports this for the `ProgressRing`'s fraction.

- [ ] **Step 1: Add the constant**

Add to `src/features/dashboard/constants.ts`, after `DASHBOARD_BURN_GOAL_KCAL`:

```ts
/**
 * Daily step target for the steps row's progress ring. Deliberately not the
 * popular "10,000 steps" figure — that traces to a 1965 Japanese pedometer
 * marketing name (manpo-kei, "10,000-step meter"), not a study. Later
 * epidemiological work (Lee et al., JAMA Intern Med 2019; Paluch et al.,
 * Lancet Public Health 2022) found mortality-risk benefit already levelling
 * off around 7,000-9,000 steps/day for many adult cohorts. There is no
 * per-user step goal in the data model, so this is a fixed figure until one
 * exists — same placeholder status as DASHBOARD_BURN_GOAL_KCAL above.
 */
export const DASHBOARD_STEP_GOAL = 8000;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/dashboard/constants.ts
git commit -m "Add DASHBOARD_STEP_GOAL, sourced rather than the marketing 10,000 figure"
```

---

### Task 10: Settings — the opt-in toggle

**Files:**
- Modify: `app/settings/index.tsx`
- Modify: `src/lib/i18n/vi.ts`
- Modify: `src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `useSettingsStore().healthSyncEnabled` / `.setHealthSyncEnabled` (Task 3), `getHealthProvider().requestPermissions()` (Task 7), the local `SegmentedControl` component already defined at the bottom of this file.

- [ ] **Step 1: Add the i18n keys**

In `src/lib/i18n/vi.ts`, add a new `healthSync` namespace after the
`smartMode` namespace:

```ts
  healthSync: {
    heading: 'Đồng bộ bước chân',
    caption:
      'Đọc số bước hôm nay từ Health Connect / Apple Health để ước tính thêm calo đã đốt.',
    permissionDenied: 'Không thể lấy quyền truy cập. Bạn có thể bật lại trong Cài đặt hệ thống.',
  },
```

In `src/lib/i18n/en.ts`, add the matching entry after `smartMode`:

```ts
  healthSync: {
    heading: 'Step sync',
    caption:
      "Reads today's step count from Health Connect / Apple Health to estimate extra calories burned.",
    permissionDenied: 'Could not get permission. You can re-enable it from system Settings.',
  },
```

- [ ] **Step 2: Add the toggle row**

In `app/settings/index.tsx`, add these two lines to the destructuring block
near the top (alongside `devSeedEnabled`/`hideChallengeProgress`):

```ts
  const healthSyncEnabled = useSettingsStore((state) => state.healthSyncEnabled);
  const setHealthSyncEnabled = useSettingsStore((state) => state.setHealthSyncEnabled);
```

Add this import:

```ts
import { getHealthProvider } from '@/lib/health';
```

Add a handler function near the other handlers in the component body:

```ts
  const toggleHealthSync = async (value: boolean) => {
    if (!value) {
      setHealthSyncEnabled(false);
      return;
    }

    const granted = await getHealthProvider().requestPermissions();

    if (granted) {
      setHealthSyncEnabled(true);
    } else {
      Alert.alert(t('healthSync', 'heading'), t('healthSync', 'permissionDenied'));
    }
  };
```

Add the row's JSX, after the `challengeProgress` `<Card>` block and before
the `{__DEV__ ? ... }` block:

```tsx
      <Card className="gap-3">
        <Text variant="heading">{t('healthSync', 'heading')}</Text>
        <SegmentedControl
          options={[
            { value: 'on' as const, label: t('developer', 'on') },
            { value: 'off' as const, label: t('developer', 'off') },
          ]}
          value={healthSyncEnabled ? 'on' : 'off'}
          onChange={(value) => void toggleHealthSync(value === 'on')}
        />
        <Text variant="caption" tone="subtle">
          {t('healthSync', 'caption')}
        </Text>
      </Card>
```

`Alert` is already imported in this file (used elsewhere for confirmations)
— confirm that import exists rather than adding a duplicate.

- [ ] **Step 3: Verify it type-checks and lints clean**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 4: Commit**

```bash
git add app/settings/index.tsx src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "Add the off-by-default Health sync toggle to Settings"
```

---

### Task 11: Dashboard — real steps, and the per-day activity list

**Files:**
- Create: `src/components/dashboard/ActivityRow.tsx`
- Modify: `src/components/dashboard/CaloriesBurnedSection.tsx`
- Modify: `src/lib/i18n/vi.ts`
- Modify: `src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `useHealthSteps(date)` (Task 8), `DASHBOARD_STEP_GOAL` (Task 9), `useSettingsStore().healthSyncEnabled` (Task 3), `logRepository.getActivities(userId, date)` (existing, previously uncalled from the UI).
- Produces: `ActivityRow` component, exported for potential reuse, but this task's only consumer is `CaloriesBurnedSection`.

- [ ] **Step 1: Add the i18n keys**

In `src/lib/i18n/vi.ts`, add to the `dashboard` namespace (near
`noWorkouts`):

```ts
    automaticActivity: 'tự động',
    reconnectHealth: 'Kết nối lại',
```

In `src/lib/i18n/en.ts`, add the matching entries:

```ts
    automaticActivity: 'automatic',
    reconnectHealth: 'Reconnect',
```

- [ ] **Step 2: Write `ActivityRow`**

Create `src/components/dashboard/ActivityRow.tsx`, mirroring
`src/components/diary/FoodEntryRow.tsx`'s layout:

```tsx
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';
import type { ActivityLogRow } from '@/db/schema';

/**
 * One logged activity for the day — a manual entry or a health-derived one.
 * Only the automatic case gets a small caption; the manual case is the
 * expected default and needs no callout (mirrors FoodEntryRow's layout).
 */
export function ActivityRow({ activity }: { activity: ActivityLogRow }) {
  const { t } = useTranslation();
  const isAutomatic = activity.source !== 'manual';

  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <View className="flex-1 gap-0.5">
        <Text variant="body" numberOfLines={1}>
          {activity.activityType}
        </Text>
        {isAutomatic ? (
          <Text variant="caption" tone="muted">
            {t('dashboard', 'automaticActivity')}
          </Text>
        ) : null}
      </View>

      <Text variant="mono" tone="muted">
        {activity.caloriesBurned}
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: Wire the steps row and the activity list into `CaloriesBurnedSection`**

Replace the full contents of `src/components/dashboard/CaloriesBurnedSection.tsx`:

```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ActivityRow } from '@/components/dashboard/ActivityRow';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import * as logRepository from '@/data/logRepository';
import { DASHBOARD_BURN_GOAL_KCAL, DASHBOARD_STEP_GOAL } from '@/features/dashboard/constants';
import { useHealthSteps } from '@/features/dashboard/queries';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { getHealthProvider } from '@/lib/health';
import { progressFraction } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

import { MetricSection } from './MetricSection';

/**
 * Active energy for the day: the health-synced steps row (opt-in, Settings),
 * plus every logged activity — manual and health-derived side by side.
 */
export function CaloriesBurnedSection({ day }: { day: DiaryDay }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const userId = useProfileStore((state) => state.profile?.id ?? null);
  const healthSyncEnabled = useSettingsStore((state) => state.healthSyncEnabled);
  const steps = useHealthSteps(day.date);

  const activities = userId ? logRepository.getActivities(userId, day.date) : [];
  const needsReconnect = healthSyncEnabled && steps.data === null;

  return (
    <MetricSection
      title={t('dashboard', 'caloriesBurned')}
      value={day.exerciseKcal}
      onAdd={() => router.push('/log/activity')}
    >
      <View className="gap-3 pt-1">
        <View className="flex-row items-center justify-between">
          <View>
            <Text variant="caption" tone="muted">
              {t('dashboard', 'steps')}
            </Text>
            {needsReconnect ? (
              <Pressable onPress={() => void getHealthProvider().requestPermissions()}>
                <Text variant="heading" tone="brand">
                  {t('dashboard', 'reconnectHealth')}
                </Text>
              </Pressable>
            ) : (
              <Text variant="heading" tone={steps.data ? 'default' : 'subtle'}>
                {steps.data ? steps.data.steps.toLocaleString() : '—'}
              </Text>
            )}
          </View>
          <ProgressRing
            progress={steps.data ? progressFraction(steps.data.steps, DASHBOARD_STEP_GOAL) : 0}
            size={44}
            strokeWidth={4}
          >
            <Ionicons name="footsteps-outline" size={18} color={colors.fgMuted} />
          </ProgressRing>
        </View>

        {activities.length === 0 ? (
          <Text variant="heading" tone="subtle">
            {t('dashboard', 'noWorkouts')}
          </Text>
        ) : (
          <View className="-mx-4 border-t border-border">
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </View>
        )}

        <Text variant="caption" tone="subtle">
          {t('dashboard', 'burnGoal').replace('{kcal}', String(DASHBOARD_BURN_GOAL_KCAL))}
        </Text>
      </View>
    </MetricSection>
  );
}
```

Note: `logRepository.getActivities` is called directly from a component
here rather than through a query hook — this matches how `day` itself
(computed by `useDiaryDay`) is already threaded through as a prop rather
than re-fetched, and `activities` for a given day changes only when
`useHealthSteps` or a manual log write invalidates `queryKeys.diary.all`,
which already triggers a re-render of this component's parent (and so
this component) via `day` changing identity. If this component is ever
used somewhere `day` isn't already a fresh prop, wrap this read in its own
`useQuery` instead.

- [ ] **Step 4: Verify it type-checks and lints clean**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 5: Run the full verify suite**

Run: `npm run verify`
Expected: all typecheck/lint/test steps pass — this is the last task, so
this is the final gate before the feature is considered done on the
Android side (iOS remains written-but-unverified per Task 6).

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/ActivityRow.tsx src/components/dashboard/CaloriesBurnedSection.tsx src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "Show real steps and a per-day activity list on the dashboard"
```

---

## After this plan

- Android is buildable and testable end to end on the real device available
  for this project; iOS is code-complete but unverified until a physical
  device exists (flagged at Tasks 6 and throughout the spec).
- Full historical backfill, background sync, and full workout import
  (UC-17's fuller scope) remain explicitly out of scope, per the design
  spec — not gaps in this plan, deliberate boundaries of it.
