# Local Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two local, adaptive notification categories — meal-time reminders and streak-at-risk — scheduled entirely on-device via the already-installed `expo-notifications`, with settings and onboarding wiring to control them.

**Architecture:** A pure scheduling-math layer (`src/lib/notificationScheduler.ts`) sits below a read-only SQLite query layer (`src/data/notificationRepository.ts`) that computes each user's usual meal/last-log times, both driven by a thin orchestrator (`src/features/notifications/reconcile.ts`) that reads settings + today's actual state and calls schedule/cancel. The orchestrator runs at app boot, after every logging mutation, and after either settings toggle flips.

**Tech Stack:** `expo-notifications` (already installed, no version change), `date-fns` (already installed), Drizzle/SQLite via the existing `db` client, Zustand (`src/features/settings/store.ts`), TanStack Query (existing mutations in `src/features/diary/queries.ts`).

**Spec:** `docs/superpowers/specs/2026-09-27-notifications-design.md`

## Global Constraints

- No new dependency. No Drizzle migration — the two new settings fields are MMKV-backed device prefs, not `user` table columns.
- Local scheduling only (`scheduleNotificationAsync`/`cancelScheduledNotificationAsync`); no push token, no backend call.
- Only breakfast/lunch/dinner get meal reminders — snack is explicitly out of scope.
- History window is 14 days; fewer than 3 samples in that window means "not enough signal," fall back to the fixed default.
- Streak nudge time is 2 hours before the user's usual last-log time, clamped to `[17:00, 23:00]`.
- Notification copy must be encouraging, never guilt/moralizing (the spec's explicit tone requirement, contrasting the research's Noom example).
- Every new namespace/key goes in both `src/lib/i18n/vi.ts` (source of truth) and `src/lib/i18n/en.ts`.

## Review Focus

- A brand-new user with zero logging history gets meal reminders at the fixed default times, not a crash or a null time passed to the scheduler — pinned in Task 4.
- An even number of historical samples must average the two middle values, not silently pick one — pinned in Task 2.
- A soft-deleted (`deletedAt` set) log entry must not count toward the median or toward "already logged today" — pinned in Task 2.
- A user with no `streak` row at all (never logged anything, ever) must not throw and must not schedule `streak-risk` — pinned in Task 4.
- Turning both settings off must cancel all four pending notifications, not just skip scheduling new ones (a previously-scheduled one must not keep firing after opt-out) — pinned in Task 4.

---

## Task 1: Notification scheduling math (`src/lib/notificationScheduler.ts`)

**Files:**
- Create: `src/lib/notificationScheduler.ts`
- Test: `src/lib/__tests__/notificationScheduler.test.ts`

**Interfaces:**
- Produces: `TimeOfDay { hour: number; minute: number }`, `NotificationId = 'meal-breakfast' | 'meal-lunch' | 'meal-dinner' | 'streak-risk'`, `DEFAULT_MEAL_TIMES: Record<'breakfast' | 'lunch' | 'dinner', TimeOfDay>`, `DEFAULT_LAST_LOG_TIME: TimeOfDay`, `nextOccurrence(time: TimeOfDay, now?: Date): Date`, `streakNudgeTime(lastLogTime: TimeOfDay): TimeOfDay`, `scheduleAt(id: NotificationId, at: Date, content: { title: string; body: string }): Promise<void>`, `cancel(id: NotificationId): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/notificationScheduler.test.ts
import * as Notifications from 'expo-notifications';

import {
  cancel,
  DEFAULT_LAST_LOG_TIME,
  DEFAULT_MEAL_TIMES,
  nextOccurrence,
  scheduleAt,
  streakNudgeTime,
} from '../notificationScheduler';

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  scheduleNotificationAsync: jest.fn(async () => 'scheduled-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
}));

describe('nextOccurrence', () => {
  it('returns today when the time has not passed yet', () => {
    const now = new Date('2026-03-10T10:00:00');
    const result = nextOccurrence({ hour: 12, minute: 30 }, now);

    expect(result.getTime()).toBe(new Date('2026-03-10T12:30:00').getTime());
  });

  it('rolls to tomorrow when the time has already passed today', () => {
    const now = new Date('2026-03-10T20:00:00');
    const result = nextOccurrence({ hour: 8, minute: 0 }, now);

    expect(result.getTime()).toBe(new Date('2026-03-11T08:00:00').getTime());
  });
});

describe('streakNudgeTime', () => {
  it('is 2 hours before the given time within the normal range', () => {
    expect(streakNudgeTime({ hour: 21, minute: 0 })).toEqual({ hour: 19, minute: 0 });
  });

  it('clamps to 17:00 for an early usual last-log time', () => {
    expect(streakNudgeTime({ hour: 9, minute: 0 })).toEqual({ hour: 17, minute: 0 });
  });

  it('stays under the 23:00 ceiling for a very late usual last-log time', () => {
    // 23:59 minus 2h is 21:59 — the upper clamp can never actually bind since
    // a TimeOfDay's hour is capped at 23, but this pins that near-boundary
    // subtraction is still correct rather than accidentally clamping early.
    expect(streakNudgeTime({ hour: 23, minute: 59 })).toEqual({ hour: 21, minute: 59 });
  });

  it('DEFAULT_LAST_LOG_TIME (21:00) resolves to 19:00, matching the normal-range case', () => {
    expect(streakNudgeTime(DEFAULT_LAST_LOG_TIME)).toEqual({ hour: 19, minute: 0 });
  });
});

describe('scheduleAt', () => {
  it('cancels any existing notification under the id, then schedules the new one', async () => {
    const at = new Date('2026-03-10T12:30:00');

    await scheduleAt('meal-lunch', at, { title: 'Lunch?', body: "Haven't logged lunch yet?" });

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('meal-lunch');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'meal-lunch',
      content: { title: 'Lunch?', body: "Haven't logged lunch yet?" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  });
});

describe('cancel', () => {
  it('delegates to cancelScheduledNotificationAsync', async () => {
    await cancel('streak-risk');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('streak-risk');
  });
});

describe('DEFAULT_MEAL_TIMES', () => {
  it('has all three meal types', () => {
    expect(Object.keys(DEFAULT_MEAL_TIMES).sort()).toEqual(['breakfast', 'dinner', 'lunch']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/__tests__/notificationScheduler.test.ts`
Expected: FAIL — `Cannot find module '../notificationScheduler'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/notificationScheduler.ts
import { setHours, setMilliseconds, setMinutes, setSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';

/**
 * Local, adaptive scheduling for meal and streak reminders. Every trigger is
 * a one-shot date, never a repeating one — the target time itself shifts
 * day to day as the user's logging history changes, so a repeating trigger
 * would go stale.
 */

export interface TimeOfDay {
  hour: number;
  minute: number;
}

export type NotificationId = 'meal-breakfast' | 'meal-lunch' | 'meal-dinner' | 'streak-risk';

/** Fixed fallback used until 3+ days of real history exist for that meal. */
export const DEFAULT_MEAL_TIMES: Record<'breakfast' | 'lunch' | 'dinner', TimeOfDay> = {
  breakfast: { hour: 8, minute: 0 },
  lunch: { hour: 12, minute: 30 },
  dinner: { hour: 19, minute: 0 },
};

/**
 * Fallback "usual last log of the day" until 3+ days of history exist. This
 * is an input to `streakNudgeTime`, not the nudge time itself — it produces
 * a 19:00 nudge (21:00 minus 2h), same as a real user whose history says
 * they usually finish logging around 9pm.
 */
export const DEFAULT_LAST_LOG_TIME: TimeOfDay = { hour: 21, minute: 0 };

const STREAK_NUDGE_LEAD_HOURS = 2;
const STREAK_NUDGE_MIN_HOUR = 17;
const STREAK_NUDGE_MAX_HOUR = 23;

function atTime(date: Date, time: TimeOfDay): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(date, time.hour), time.minute), 0), 0);
}

/** `time` today if that moment hasn't passed yet, else tomorrow. */
export function nextOccurrence(time: TimeOfDay, now: Date = new Date()): Date {
  const today = atTime(now, time);

  if (today.getTime() > now.getTime()) return today;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return atTime(tomorrow, time);
}

/**
 * 2 hours before `lastLogTime`, clamped to [17:00, 23:00] so a user whose
 * usual last log is very early or very late still gets a nudge at a
 * reasonable evening hour rather than mid-morning or past 11pm.
 */
export function streakNudgeTime(lastLogTime: TimeOfDay): TimeOfDay {
  const minutes = lastLogTime.hour * 60 + lastLogTime.minute - STREAK_NUDGE_LEAD_HOURS * 60;
  const clamped = Math.min(
    Math.max(minutes, STREAK_NUDGE_MIN_HOUR * 60),
    STREAK_NUDGE_MAX_HOUR * 60,
  );

  return { hour: Math.floor(clamped / 60), minute: clamped % 60 };
}

/**
 * Cancels any existing notification under `id` (expo-notifications does not
 * dedupe by content) then schedules the new one as a one-shot date trigger.
 */
export async function scheduleAt(
  id: NotificationId,
  at: Date,
  content: { title: string; body: string },
): Promise<void> {
  await cancel(id);

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

export async function cancel(id: NotificationId): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/__tests__/notificationScheduler.test.ts`
Expected: PASS, all 9 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notificationScheduler.ts src/lib/__tests__/notificationScheduler.test.ts
git commit -m "$(cat <<'EOF'
Add local notification scheduling math

Pure time math (next-occurrence rolling, streak-nudge clamping) plus a
thin expo-notifications wrapper, ahead of the repository/orchestrator
layers that will call it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Notification history queries (`src/data/notificationRepository.ts`)

**Files:**
- Create: `src/data/notificationRepository.ts`
- Test: `src/data/__tests__/notificationRepository.test.ts`

**Interfaces:**
- Consumes: `TimeOfDay` from Task 1 (`@/lib/notificationScheduler`).
- Produces: `medianMealTime(userId: string, mealType: 'breakfast' | 'lunch' | 'dinner', days?: number): TimeOfDay | null`, `medianLastLogTime(userId: string, days?: number): TimeOfDay | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/data/__tests__/notificationRepository.test.ts
import { waterLog } from '@/db/schema';
import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';
import { shiftDateKey, todayKey } from '@/lib/date';
import { generateLocalId } from '@/lib/id';

import * as entryRepository from '../entryRepository';
import * as logRepository from '../logRepository';
import * as notificationRepository from '../notificationRepository';
import { touch } from '../sync';
import * as userRepository from '../userRepository';

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

function createUser() {
  return userRepository.createLocalUser({
    gender: 'male',
    birthYear: 1990,
    height: 180,
    weightCurrent: 80,
    weightGoal: 75,
    activityLevel: 'moderate',
    dietType: 'balanced',
    weeklyRateKg: 0.5,
  }).user;
}

/**
 * N days before today, as a DateKey. Fixtures are built relative to
 * `todayKey()` (never a hardcoded calendar date) so they stay inside the
 * default 14-day window no matter when this test actually runs.
 */
function daysAgo(n: number): string {
  return shiftDateKey(todayKey(), -n);
}

function logMealAt(
  userId: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  dateKey: string,
  hour: number,
  minute: number,
) {
  return entryRepository.createEntry({
    userId,
    name: mealType,
    mealType,
    inputMethod: 'manual',
    loggedOn: dateKey,
    loggedAt: new Date(
      `${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
    ),
    ingredients: [],
  });
}

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('medianMealTime', () => {
  it('returns null with fewer than 3 samples', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(3), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 30);

    expect(notificationRepository.medianMealTime(user.id, 'lunch')).toBeNull();
  });

  it('returns the middle value for an odd sample count', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(3), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 30);
    logMealAt(user.id, 'lunch', daysAgo(1), 13, 0);

    expect(notificationRepository.medianMealTime(user.id, 'lunch')).toEqual({
      hour: 12,
      minute: 30,
    });
  });

  it('averages the two middle values for an even sample count', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(4), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(3), 12, 20);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 40);
    logMealAt(user.id, 'lunch', daysAgo(1), 13, 0);

    // sorted minutes: 720, 740, 760, 780 → middle two average to 750 → 12:30
    expect(notificationRepository.medianMealTime(user.id, 'lunch')).toEqual({
      hour: 12,
      minute: 30,
    });
  });

  it('ignores entries for a different meal type', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(3), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 30);
    logMealAt(user.id, 'lunch', daysAgo(1), 13, 0);
    logMealAt(user.id, 'breakfast', daysAgo(1), 7, 0);

    expect(notificationRepository.medianMealTime(user.id, 'breakfast')).toBeNull();
  });

  it('ignores entries outside the day window', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(3), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 30);
    logMealAt(user.id, 'lunch', daysAgo(1), 13, 0);
    logMealAt(user.id, 'lunch', daysAgo(400), 23, 59);

    expect(notificationRepository.medianMealTime(user.id, 'lunch', 14)).toEqual({
      hour: 12,
      minute: 30,
    });
  });

  it('excludes a soft-deleted entry', () => {
    const user = createUser();

    const toDelete = logMealAt(user.id, 'lunch', daysAgo(3), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 30);
    logMealAt(user.id, 'lunch', daysAgo(1), 13, 0);

    entryRepository.deleteEntry(toDelete.id);

    // Only 2 live entries remain — below the 3-sample threshold.
    expect(notificationRepository.medianMealTime(user.id, 'lunch')).toBeNull();
  });
});

describe('medianLastLogTime', () => {
  it('returns null with fewer than 3 distinct days', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(2), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(1), 12, 0);

    expect(notificationRepository.medianLastLogTime(user.id)).toBeNull();
  });

  it('takes the latest log of each day across food, activity, and water', () => {
    const user = createUser();
    const day3 = daysAgo(3);
    const day2 = daysAgo(2);
    const day1 = daysAgo(1);

    // 3 days ago: only a lunch at 12:00 → last log 12:00
    logMealAt(user.id, 'lunch', day3, 12, 0);

    // 2 days ago: lunch at 12:00, then an evening activity at 20:00 → last log 20:00
    logMealAt(user.id, 'lunch', day2, 12, 0);
    logRepository.addActivity({
      userId: user.id,
      activityType: 'walk',
      caloriesBurned: 100,
      date: day2,
      loggedAt: new Date(`${day2}T20:00:00`),
    });

    // 1 day ago: lunch at 12:00, then water at 22:00 → last log 22:00
    logMealAt(user.id, 'lunch', day1, 12, 0);
    mockDb
      .insert(waterLog)
      .values({
        id: generateLocalId('water'),
        userId: user.id,
        amountMl: 250,
        loggedAt: new Date(`${day1}T22:00:00`),
        loggedOn: day1,
        remoteId: null,
        deletedAt: null,
        ...touch(),
      })
      .run();

    // Medians of [12:00, 20:00, 22:00] → 20:00
    expect(notificationRepository.medianLastLogTime(user.id)).toEqual({ hour: 20, minute: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/data/__tests__/notificationRepository.test.ts`
Expected: FAIL — `Cannot find module '../notificationRepository'`

- [ ] **Step 3: Write the implementation**

```ts
// src/data/notificationRepository.ts
import { and, eq, gte } from 'drizzle-orm';

import { db } from '@/db/client';
import { activityLog, foodEntry, waterLog } from '@/db/schema';
import { shiftDateKey, todayKey } from '@/lib/date';
import type { TimeOfDay } from '@/lib/notificationScheduler';

import { notDeleted } from './sync';

/**
 * Read-only queries over logging history, feeding the adaptive notification
 * schedule. SQLite has no MEDIAN() aggregate, so both functions pull the raw
 * timestamps for the window and compute the median in JS — the same
 * "pull rows, compute in JS" shape `recalculateTotals` already uses.
 */

const MIN_SAMPLES = 3;

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function toTimeOfDay(minutes: number): TimeOfDay {
  const rounded = Math.round(minutes);

  return { hour: Math.floor(rounded / 60), minute: rounded % 60 };
}

/**
 * Median time-of-day this user has logged `mealType`, over the last `days`
 * days. Null if fewer than 3 live entries exist in that window — not enough
 * signal to trust over the fixed default.
 */
export function medianMealTime(
  userId: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  days = 14,
): TimeOfDay | null {
  const since = shiftDateKey(todayKey(), -days);

  const rows = db
    .select({ loggedAt: foodEntry.loggedAt })
    .from(foodEntry)
    .where(
      and(
        eq(foodEntry.userId, userId),
        eq(foodEntry.mealType, mealType),
        gte(foodEntry.loggedOn, since),
        notDeleted(foodEntry),
      ),
    )
    .all();

  if (rows.length < MIN_SAMPLES) return null;

  return toTimeOfDay(median(rows.map((row) => minutesOfDay(row.loggedAt))));
}

/**
 * Median time-of-day of each day's *last* log — food, activity, or water,
 * whichever was latest — over the last `days` days. Null if fewer than 3
 * distinct days have any data.
 */
export function medianLastLogTime(userId: string, days = 14): TimeOfDay | null {
  const since = shiftDateKey(todayKey(), -days);

  const rows = [
    ...db
      .select({ loggedOn: foodEntry.loggedOn, loggedAt: foodEntry.loggedAt })
      .from(foodEntry)
      .where(
        and(eq(foodEntry.userId, userId), gte(foodEntry.loggedOn, since), notDeleted(foodEntry)),
      )
      .all(),
    ...db
      .select({ loggedOn: activityLog.loggedOn, loggedAt: activityLog.loggedAt })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.userId, userId),
          gte(activityLog.loggedOn, since),
          notDeleted(activityLog),
        ),
      )
      .all(),
    ...db
      .select({ loggedOn: waterLog.loggedOn, loggedAt: waterLog.loggedAt })
      .from(waterLog)
      .where(and(eq(waterLog.userId, userId), gte(waterLog.loggedOn, since), notDeleted(waterLog)))
      .all(),
  ];

  const lastPerDay = new Map<string, Date>();

  for (const row of rows) {
    const existing = lastPerDay.get(row.loggedOn);

    if (!existing || row.loggedAt.getTime() > existing.getTime()) {
      lastPerDay.set(row.loggedOn, row.loggedAt);
    }
  }

  if (lastPerDay.size < MIN_SAMPLES) return null;

  return toTimeOfDay(median(Array.from(lastPerDay.values()).map(minutesOfDay)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/data/__tests__/notificationRepository.test.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/data/notificationRepository.ts src/data/__tests__/notificationRepository.test.ts
git commit -m "$(cat <<'EOF'
Add median meal/last-log time queries for adaptive reminders

Reads food_entry/activity_log/water_log history to compute each
user's usual meal times and usual last-log-of-the-day time, with a
3-sample floor before trusting the result over the fixed default.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Settings store fields (`mealRemindersEnabled`, `streakRemindersEnabled`)

**Files:**
- Modify: `src/lib/storage.ts` (add two `StorageKeys` entries)
- Modify: `src/features/settings/store.ts`
- Modify: `src/features/settings/__tests__/store.test.ts`

**Interfaces:**
- Produces: `useSettingsStore` gains `mealRemindersEnabled: boolean`, `streakRemindersEnabled: boolean`, `setMealRemindersEnabled(value: boolean): void`, `setStreakRemindersEnabled(value: boolean): void`.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/settings/__tests__/store.test.ts`:

```ts
describe('mealRemindersEnabled', () => {
  it('defaults to off', () => {
    expect(useSettingsStore.getState().mealRemindersEnabled).toBe(false);
  });

  it('setMealRemindersEnabled flips it and persists', () => {
    useSettingsStore.getState().setMealRemindersEnabled(true);

    expect(useSettingsStore.getState().mealRemindersEnabled).toBe(true);
  });
});

describe('streakRemindersEnabled', () => {
  it('defaults to off', () => {
    expect(useSettingsStore.getState().streakRemindersEnabled).toBe(false);
  });

  it('setStreakRemindersEnabled flips it and persists', () => {
    useSettingsStore.getState().setStreakRemindersEnabled(true);

    expect(useSettingsStore.getState().streakRemindersEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/settings/__tests__/store.test.ts`
Expected: FAIL — `mealRemindersEnabled` / `setMealRemindersEnabled` are not functions on the store.

- [ ] **Step 3: Add the storage keys**

In `src/lib/storage.ts`, extend the `StorageKeys` object (around line 102):

```ts
export const StorageKeys = {
  colorScheme: 'color-scheme',
  locale: 'locale',
  onboardingComplete: 'onboarding-complete',
  queryCache: 'react-query-cache',
  devSeed: 'dev-seed-enabled',
  hideChallengeProgress: 'hide-challenge-progress',
  seenQuestTypes: 'seen-quest-types',
  streakCommittedDate: 'streak-committed-date',
  questAdvanceCounts: 'quest-advance-counts',
  healthSyncEnabled: 'health-sync-enabled',
  mealRemindersEnabled: 'meal-reminders-enabled',
  streakRemindersEnabled: 'streak-reminders-enabled',
} as const;
```

- [ ] **Step 4: Add the fields to the store**

In `src/features/settings/store.ts`, add to the `SettingsState` interface (after `healthSyncEnabled: boolean;`):

```ts
  /** Local, adaptive reminder to log a meal around the user's usual time. */
  mealRemindersEnabled: boolean;
  /** Local reminder before an active streak breaks for the day. */
  streakRemindersEnabled: boolean;
```

and after `setHealthSyncEnabled: (value: boolean) => void;`:

```ts
  setMealRemindersEnabled: (value: boolean) => void;
  setStreakRemindersEnabled: (value: boolean) => void;
```

In the store body, after `healthSyncEnabled: preferences.get<boolean>(StorageKeys.healthSyncEnabled) ?? false,`:

```ts
  mealRemindersEnabled:
    preferences.get<boolean>(StorageKeys.mealRemindersEnabled) ?? false,
  streakRemindersEnabled:
    preferences.get<boolean>(StorageKeys.streakRemindersEnabled) ?? false,
```

and after the `setHealthSyncEnabled` method:

```ts
  setMealRemindersEnabled: (mealRemindersEnabled) => {
    preferences.set(StorageKeys.mealRemindersEnabled, mealRemindersEnabled);
    set({ mealRemindersEnabled });
  },

  setStreakRemindersEnabled: (streakRemindersEnabled) => {
    preferences.set(StorageKeys.streakRemindersEnabled, streakRemindersEnabled);
    set({ streakRemindersEnabled });
  },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/features/settings/__tests__/store.test.ts`
Expected: PASS, all tests including the 4 new ones.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage.ts src/features/settings/store.ts src/features/settings/__tests__/store.test.ts
git commit -m "$(cat <<'EOF'
Add mealRemindersEnabled/streakRemindersEnabled settings

Device-local, MMKV-backed booleans (default off), same pattern as
healthSyncEnabled — no migration needed, these aren't user-table
columns.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Reconciliation orchestrator (`src/features/notifications/reconcile.ts`)

**Files:**
- Create: `src/features/notifications/reconcile.ts`
- Test: `src/features/notifications/__tests__/reconcile.test.ts`
- Modify: `src/lib/i18n/vi.ts` (add `notifications` namespace)
- Modify: `src/lib/i18n/en.ts` (add `notifications` namespace)

**Interfaces:**
- Consumes: `medianMealTime`/`medianLastLogTime` (Task 2), `TimeOfDay`/`DEFAULT_MEAL_TIMES`/`DEFAULT_LAST_LOG_TIME`/`nextOccurrence`/`streakNudgeTime`/`scheduleAt`/`cancel` (Task 1), `mealRemindersEnabled`/`streakRemindersEnabled` (Task 3), `entryRepository.getEntriesForDay(userId, date): FoodEntry[]`, `gamification.getStreak(userId): Streak | undefined` (existing), `translate(locale, namespace, key)` (existing, `@/lib/i18n`).
- Produces: `reconcileNotifications(userId: string): Promise<void>`.

- [ ] **Step 1: Add the `notifications` i18n namespace**

In `src/lib/i18n/vi.ts`, add after the `healthSync` block:

```ts
  notifications: {
    mealRemindersHeading: 'Nhắc giờ ăn',
    mealRemindersCaption:
      'Nhắc bạn ghi lại bữa ăn vào khoảng giờ bạn thường ăn, nếu bữa đó chưa được ghi hôm nay.',
    streakRemindersHeading: 'Nhắc giữ chuỗi ngày',
    streakRemindersCaption: 'Nhắc bạn trước khi mất chuỗi ngày, nếu hôm nay bạn chưa ghi gì.',
    permissionDenied:
      'Không thể lấy quyền thông báo. Bạn có thể bật lại trong Cài đặt hệ thống.',
    mealBreakfastTitle: 'Bữa sáng của bạn đâu rồi? 🍳',
    mealBreakfastBody: 'Bạn chưa ghi bữa sáng hôm nay.',
    mealLunchTitle: 'Đã ăn trưa chưa? 🍜',
    mealLunchBody: 'Bạn chưa ghi bữa trưa hôm nay.',
    mealDinnerTitle: 'Bữa tối thì sao? 🍽️',
    mealDinnerBody: 'Bạn chưa ghi bữa tối hôm nay.',
    streakRiskTitle: '🔥 Đừng để mất chuỗi ngày của bạn',
    streakRiskBody: 'Bạn đang giữ chuỗi {days} ngày — ghi lại một thứ gì đó trước khi hôm nay kết thúc.',
  },
```

In `src/lib/i18n/en.ts`, add after the `healthSync` block:

```ts
  notifications: {
    mealRemindersHeading: 'Meal reminders',
    mealRemindersCaption:
      "Reminds you to log a meal around your usual time, if it hasn't been logged yet today.",
    streakRemindersHeading: 'Streak reminders',
    streakRemindersCaption:
      "Reminds you before your streak breaks, if you haven't logged anything today.",
    permissionDenied:
      'Could not get notification permission. You can turn it on again in system Settings.',
    mealBreakfastTitle: "Where's breakfast? 🍳",
    mealBreakfastBody: "You haven't logged breakfast yet today.",
    mealLunchTitle: 'Had lunch yet? 🍜',
    mealLunchBody: "You haven't logged lunch yet today.",
    mealDinnerTitle: 'What about dinner? 🍽️',
    mealDinnerBody: "You haven't logged dinner yet today.",
    streakRiskTitle: "🔥 Don't lose your streak",
    streakRiskBody: "You're on a {days}-day streak — log something before today ends.",
  },
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/features/notifications/__tests__/reconcile.test.ts
import * as entryRepository from '@/data/entryRepository';
import * as gamification from '@/data/gamificationRepository';
import * as userRepository from '@/data/userRepository';
import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';
import { useSettingsStore } from '@/features/settings/store';
import { shiftDateKey, todayKey } from '@/lib/date';
import * as scheduler from '@/lib/notificationScheduler';

import { reconcileNotifications } from '../reconcile';

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

jest.mock('@/lib/notificationScheduler', () => {
  const actual = jest.requireActual('@/lib/notificationScheduler');

  return {
    ...actual,
    scheduleAt: jest.fn(async () => undefined),
    cancel: jest.fn(async () => undefined),
  };
});

const mockedScheduler = jest.mocked(scheduler);

function createUser() {
  return userRepository.createLocalUser({
    gender: 'male',
    birthYear: 1990,
    height: 180,
    weightCurrent: 80,
    weightGoal: 75,
    activityLevel: 'moderate',
    dietType: 'balanced',
    weeklyRateKg: 0.5,
  }).user;
}

beforeEach(() => {
  mockDb = createTestDatabase();
  jest.clearAllMocks();
  useSettingsStore.setState({ mealRemindersEnabled: true, streakRemindersEnabled: true });
});

describe('reconcileNotifications — meal reminders', () => {
  it('cancels a meal reminder when that meal is already logged today', async () => {
    const user = createUser();

    entryRepository.createEntry({
      userId: user.id,
      name: 'Lunch',
      mealType: 'lunch',
      inputMethod: 'manual',
      loggedOn: todayKey(),
      ingredients: [],
    });

    await reconcileNotifications(user.id);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-lunch');
    expect(mockedScheduler.scheduleAt).not.toHaveBeenCalledWith(
      'meal-lunch',
      expect.anything(),
      expect.anything(),
    );
  });

  it('schedules a meal reminder at the fixed default time when there is no history yet', async () => {
    const user = createUser();

    await reconcileNotifications(user.id);

    expect(mockedScheduler.scheduleAt).toHaveBeenCalledWith(
      'meal-breakfast',
      expect.any(Date),
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );

    const [, scheduledAt] = mockedScheduler.scheduleAt.mock.calls.find(
      (call) => call[0] === 'meal-breakfast',
    ) as Parameters<typeof mockedScheduler.scheduleAt>;

    expect(scheduledAt.getHours()).toBe(mockedScheduler.DEFAULT_MEAL_TIMES.breakfast.hour);
    expect(scheduledAt.getMinutes()).toBe(mockedScheduler.DEFAULT_MEAL_TIMES.breakfast.minute);
  });

  it('cancels all three meal reminders when mealRemindersEnabled is off', async () => {
    const user = createUser();

    useSettingsStore.setState({ mealRemindersEnabled: false });

    await reconcileNotifications(user.id);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-breakfast');
    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-lunch');
    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-dinner');
  });
});

describe('reconcileNotifications — streak-at-risk', () => {
  it('cancels streak-risk when today is already the last active day', async () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, todayKey());

    await reconcileNotifications(user.id);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('streak-risk');
  });

  it('schedules streak-risk when the streak is active but today is unlogged', async () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, shiftDateKey(todayKey(), -1));

    await reconcileNotifications(user.id);

    expect(mockedScheduler.scheduleAt).toHaveBeenCalledWith(
      'streak-risk',
      expect.any(Date),
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );
  });

  it('does not schedule streak-risk for a user with no streak row yet', async () => {
    const user = createUser();

    await reconcileNotifications(user.id);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('streak-risk');
    expect(mockedScheduler.scheduleAt).not.toHaveBeenCalledWith(
      'streak-risk',
      expect.anything(),
      expect.anything(),
    );
  });

  it('cancels streak-risk when streakRemindersEnabled is off', async () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, shiftDateKey(todayKey(), -1));
    useSettingsStore.setState({ streakRemindersEnabled: false });

    await reconcileNotifications(user.id);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('streak-risk');
    expect(mockedScheduler.scheduleAt).not.toHaveBeenCalledWith(
      'streak-risk',
      expect.anything(),
      expect.anything(),
    );
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/features/notifications/__tests__/reconcile.test.ts`
Expected: FAIL — `Cannot find module '../reconcile'`

- [ ] **Step 4: Write the implementation**

```ts
// src/features/notifications/reconcile.ts
import * as entryRepository from '@/data/entryRepository';
import * as gamification from '@/data/gamificationRepository';
import * as notificationRepository from '@/data/notificationRepository';
import { useSettingsStore } from '@/features/settings/store';
import type { DateKey } from '@/lib/date';
import { todayKey } from '@/lib/date';
import { translate, type Locale, type Translations } from '@/lib/i18n';
import {
  cancel,
  DEFAULT_LAST_LOG_TIME,
  DEFAULT_MEAL_TIMES,
  nextOccurrence,
  scheduleAt,
  streakNudgeTime,
} from '@/lib/notificationScheduler';

type Meal = 'breakfast' | 'lunch' | 'dinner';

const MEAL_IDS: Record<Meal, 'meal-breakfast' | 'meal-lunch' | 'meal-dinner'> = {
  breakfast: 'meal-breakfast',
  lunch: 'meal-lunch',
  dinner: 'meal-dinner',
};

const MEAL_COPY_KEYS: Record<
  Meal,
  { titleKey: keyof Translations['notifications']; bodyKey: keyof Translations['notifications'] }
> = {
  breakfast: { titleKey: 'mealBreakfastTitle', bodyKey: 'mealBreakfastBody' },
  lunch: { titleKey: 'mealLunchTitle', bodyKey: 'mealLunchBody' },
  dinner: { titleKey: 'mealDinnerTitle', bodyKey: 'mealDinnerBody' },
};

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner'];

/**
 * Re-evaluates both notification categories against today's actual state
 * and schedules/cancels accordingly. Cheap — a handful of SQLite reads plus
 * at most 4 schedule/cancel calls — so it's safe to call on every trigger
 * point: app boot, after a logging mutation, after a settings toggle flips.
 */
export async function reconcileNotifications(userId: string): Promise<void> {
  const { mealRemindersEnabled, streakRemindersEnabled, locale } = useSettingsStore.getState();
  const today = todayKey();

  await Promise.all([
    ...MEALS.map((meal) => reconcileMeal(userId, today, meal, mealRemindersEnabled, locale)),
    reconcileStreak(userId, today, streakRemindersEnabled, locale),
  ]);
}

async function reconcileMeal(
  userId: string,
  today: DateKey,
  meal: Meal,
  enabled: boolean,
  locale: Locale,
): Promise<void> {
  const id = MEAL_IDS[meal];

  if (!enabled) {
    await cancel(id);
    return;
  }

  const alreadyLogged = entryRepository
    .getEntriesForDay(userId, today)
    .some((entry) => entry.mealType === meal);

  if (alreadyLogged) {
    await cancel(id);
    return;
  }

  const time = notificationRepository.medianMealTime(userId, meal) ?? DEFAULT_MEAL_TIMES[meal];
  const { titleKey, bodyKey } = MEAL_COPY_KEYS[meal];

  await scheduleAt(id, nextOccurrence(time), {
    title: translate(locale, 'notifications', titleKey),
    body: translate(locale, 'notifications', bodyKey),
  });
}

async function reconcileStreak(
  userId: string,
  today: DateKey,
  enabled: boolean,
  locale: Locale,
): Promise<void> {
  if (!enabled) {
    await cancel('streak-risk');
    return;
  }

  const streak = gamification.getStreak(userId);

  if (!streak || streak.currentStreak === 0 || streak.lastActiveDate === today) {
    await cancel('streak-risk');
    return;
  }

  const lastLogTime = notificationRepository.medianLastLogTime(userId) ?? DEFAULT_LAST_LOG_TIME;

  await scheduleAt('streak-risk', nextOccurrence(streakNudgeTime(lastLogTime)), {
    title: translate(locale, 'notifications', 'streakRiskTitle'),
    body: translate(locale, 'notifications', 'streakRiskBody').replace(
      '{days}',
      String(streak.currentStreak),
    ),
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/features/notifications/__tests__/reconcile.test.ts`
Expected: PASS, all 7 tests.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/notifications/reconcile.ts src/features/notifications/__tests__/reconcile.test.ts src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "$(cat <<'EOF'
Add reconcileNotifications orchestrator

Reads the two settings toggles plus today's actual logging/streak
state and schedules or cancels each of the four notification ids
accordingly. Not yet called from anywhere in the app.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire reconciliation into app boot and logging mutations

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `src/features/diary/queries.ts`

**Interfaces:**
- Consumes: `reconcileNotifications(userId: string): Promise<void>` (Task 4).

No new automated test — this task is thin wiring of an already-tested function into existing call sites; this codebase does not unit-test its `queries.ts`/`_layout.tsx` wiring layer (confirmed: no test file exists for either today). Verified by typecheck/lint plus the full existing suite staying green.

- [ ] **Step 1: Wire into app boot**

In `app/_layout.tsx`'s `@/...` import group, insert this between the `useAuthStore` line and the `useProfileStore` line (`import/order` is lint-enforced at zero warnings, so alphabetical position matters: `@/features/auth/store` < `@/features/notifications/reconcile` < `@/features/profile/store`):

```ts
import { reconcileNotifications } from '@/features/notifications/reconcile';
```

In `AppShell` (after the existing dev-seed `useEffect`, which ends around line 164), add:

```ts
  // Re-evaluate meal/streak notifications once the profile is available —
  // covers first boot, and a profile appearing right after onboarding.
  useEffect(() => {
    if (!migrated || !profileId) return;

    void reconcileNotifications(profileId);
  }, [migrated, profileId]);
```

- [ ] **Step 2: Wire into every mutation that calls `recordActiveDay`**

In `src/features/diary/queries.ts`'s `@/...` import group, insert this between the `suggestedMealType` line (`@/features/diary/selectors`) and the `useProfileStore` line (`@/features/profile/store`) — alphabetical position matters here too (`diary` < `notifications` < `profile`):

```ts
import { reconcileNotifications } from '@/features/notifications/reconcile';
```

Then, immediately after each of the following existing lines, add `void reconcileNotifications(userId);`:

```ts
      gamification.recordActiveDay(userId, input.loggedOn);
```
(in `useLogMeal`, ~line 197, and again in `useLogManualEntry`, ~line 223 — both become:)
```ts
      gamification.recordActiveDay(userId, input.loggedOn);
      void reconcileNotifications(userId);
```

```ts
      gamification.recordActiveDay(userId, today);
```
(in `useQuickLogFood`, ~line 302, becomes:)
```ts
      gamification.recordActiveDay(userId, today);
      void reconcileNotifications(userId);
```

```ts
      gamification.recordActiveDay(userId, date);
```
(in `useAddWater`, ~line 358, and `useSetWaterTotal`, ~line 379 — both become:)
```ts
      gamification.recordActiveDay(userId, date);
      void reconcileNotifications(userId);
```

```ts
      gamification.recordActiveDay(userId, input.date);
```
(in `useLogActivity`, ~line 430, becomes:)
```ts
      gamification.recordActiveDay(userId, input.date);
      void reconcileNotifications(userId);
```

- [ ] **Step 3: Run the full existing test suite**

Run: `npm test`
Expected: PASS — every previously-passing test still passes (this task adds no new logic, only calls into already-tested code).

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx src/features/diary/queries.ts
git commit -m "$(cat <<'EOF'
Wire reconcileNotifications into app boot and logging mutations

Runs once the profile is available at boot, and again after every
mutation that already calls recordActiveDay, so logging a meal
immediately cancels that meal's pending reminder and re-evaluates
the streak nudge.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Settings UI toggles

**Files:**
- Modify: `app/settings/index.tsx`

**Interfaces:**
- Consumes: `mealRemindersEnabled`/`streakRemindersEnabled`/`setMealRemindersEnabled`/`setStreakRemindersEnabled` (Task 3), `reconcileNotifications` (Task 4), `t('notifications', ...)` keys (Task 4).

No new automated test — this screen has no existing test file (confirmed: not in the test list), consistent with this codebase's convention of verifying screens by running the app rather than RNTL. Verified by typecheck/lint, then a manual check in the dev client (see Step 5).

- [ ] **Step 1: Add imports**

`import/order` is lint-enforced at zero warnings, so both new imports must land in alphabetical position within their existing group, not just anywhere in the file.

In `app/settings/index.tsx`'s top (external-package) import group, insert between the `@expo/vector-icons/Ionicons` line and the `expo-router` line:

```ts
import * as Notifications from 'expo-notifications';
```

In the `@/...` import group, insert between the `useLogSheetStore` line and the `useIsPremium, useProfileStore` line:

```ts
import { reconcileNotifications } from '@/features/notifications/reconcile';
```

- [ ] **Step 2: Read the two settings fields and add toggle handlers**

After the existing `healthSyncEnabled`/`setHealthSyncEnabled` reads (~line 54):

```ts
  const mealRemindersEnabled = useSettingsStore((state) => state.mealRemindersEnabled);
  const setMealRemindersEnabled = useSettingsStore((state) => state.setMealRemindersEnabled);
  const streakRemindersEnabled = useSettingsStore((state) => state.streakRemindersEnabled);
  const setStreakRemindersEnabled = useSettingsStore(
    (state) => state.setStreakRemindersEnabled,
  );
```

After the existing `toggleHealthSync` function (~line 102):

```ts
  const requestNotificationPermission = async (): Promise<boolean> => {
    const { granted } = await Notifications.getPermissionsAsync();

    if (granted) return true;

    return (await Notifications.requestPermissionsAsync()).granted;
  };

  const toggleMealReminders = async (value: boolean) => {
    if (!value) {
      setMealRemindersEnabled(false);
      void reconcileNotifications(user.id);
      return;
    }

    if (await requestNotificationPermission()) {
      setMealRemindersEnabled(true);
      void reconcileNotifications(user.id);
    } else {
      Alert.alert(t('notifications', 'mealRemindersHeading'), t('notifications', 'permissionDenied'));
    }
  };

  const toggleStreakReminders = async (value: boolean) => {
    if (!value) {
      setStreakRemindersEnabled(false);
      void reconcileNotifications(user.id);
      return;
    }

    if (await requestNotificationPermission()) {
      setStreakRemindersEnabled(true);
      void reconcileNotifications(user.id);
    } else {
      Alert.alert(
        t('notifications', 'streakRemindersHeading'),
        t('notifications', 'permissionDenied'),
      );
    }
  };
```

Note: these handlers use `user.id`, which is safe here because they're defined after the existing `if (!user) return null;` early return (~line 67) — same as `toggleHealthSync` already does.

- [ ] **Step 3: Render the two toggle rows**

In the JSX, immediately after the existing `healthSync` `Card` block (~line 358) and before the `{__DEV__ ? (` block:

```tsx
      <Card className="gap-3">
        <Text variant="heading">{t('notifications', 'mealRemindersHeading')}</Text>
        <SegmentedControl
          options={[
            { value: 'on' as const, label: t('developer', 'on') },
            { value: 'off' as const, label: t('developer', 'off') },
          ]}
          value={mealRemindersEnabled ? 'on' : 'off'}
          onChange={(value) => void toggleMealReminders(value === 'on')}
        />
        <Text variant="caption" tone="subtle">
          {t('notifications', 'mealRemindersCaption')}
        </Text>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('notifications', 'streakRemindersHeading')}</Text>
        <SegmentedControl
          options={[
            { value: 'on' as const, label: t('developer', 'on') },
            { value: 'off' as const, label: t('developer', 'off') },
          ]}
          value={streakRemindersEnabled ? 'on' : 'off'}
          onChange={(value) => void toggleStreakReminders(value === 'on')}
        />
        <Text variant="caption" tone="subtle">
          {t('notifications', 'streakRemindersCaption')}
        </Text>
      </Card>
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 5: Manual check**

Run: `npm run android` (or `npm run ios`), open Settings, confirm both new rows render, toggle each on (grant the OS permission prompt) and off, and confirm no crash. This is a manual step, not an automated one — flag it as such rather than claiming automated coverage.

- [ ] **Step 6: Commit**

```bash
git add app/settings/index.tsx
git commit -m "$(cat <<'EOF'
Add meal/streak reminder toggles to Settings

Two rows mirroring the existing healthSync toggle pattern: turning
one on requests OS notification permission first and reverts to off
on denial; either change immediately re-runs reconcileNotifications.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Onboarding wiring

**Files:**
- Modify: `app/(onboarding)/index.tsx`

**Interfaces:**
- Consumes: `setMealRemindersEnabled`/`setStreakRemindersEnabled` (Task 3).

No new automated test — no existing test file covers this screen's `onComplete` wiring. Verified by typecheck/lint plus the manual onboarding run in Step 3.

- [ ] **Step 1: Wire the granted permission into both settings fields**

Replace the full contents of `app/(onboarding)/index.tsx` with:

```tsx
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';

/**
 * First run.
 *
 * The only thing standing between installing the app and using it. There is no
 * sign-in step and no server call: everything collected here stays on the
 * device, and an account is offered later from Profile for anyone who wants
 * their diary on a second device.
 */
export default function OnboardingScreen() {
  const createProfile = useProfileStore((state) => state.createProfile);
  const setMealRemindersEnabled = useSettingsStore((state) => state.setMealRemindersEnabled);
  const setStreakRemindersEnabled = useSettingsStore(
    (state) => state.setStreakRemindersEnabled,
  );

  return (
    <OnboardingWizard
      onComplete={(draft) => {
        // dietType isn't collected by this wizard; the schema's own default
        // ('balanced') is what a fresh profile gets until a diet-type step
        // exists.
        createProfile({
          gender: draft.gender,
          birthYear: draft.birthYear,
          unitSystem: draft.unitSystem,
          height: draft.height,
          weightCurrent: draft.weightCurrent,
          weightGoal: draft.weightGoal,
          activityLevel: draft.activityLevel,
          dietType: 'balanced',
          weeklyRateKg: draft.weeklyRateKg,
        });

        // NotificationsStep's "Enable" already ran the OS permission
        // request; both reminder categories opt in together on "Enable"
        // and stay off on "Skip". reconcileNotifications runs on its own
        // once the new profile appears (app/_layout.tsx), so no need to
        // call it here.
        setMealRemindersEnabled(draft.notificationsEnabled);
        setStreakRemindersEnabled(draft.notificationsEnabled);
        // Not logging `draft`: it's body metrics, and those never go to the
        // console per CLAUDE.md.
      }}
    />
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 3: Manual check**

Run: `npm run android` (or `npm run ios`), erase local data (Settings → Erase local data, or reinstall), go through onboarding, tap "Enable" on the notifications step, finish onboarding, then check Settings → both new toggles are on. Repeat choosing "Skip" — both should be off.

- [ ] **Step 4: Commit**

```bash
git add "app/(onboarding)/index.tsx"
git commit -m "$(cat <<'EOF'
Wire onboarding's notification permission into the two reminder settings

"Enable" on NotificationsStep now opts into both meal and streak
reminders; "Skip" leaves both off. Previously this value was
discarded entirely.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full verify suite**

Run: `npm run verify`
Expected: typecheck, lint (`--max-warnings=0`), and the full Jest suite all pass, including every test added in Tasks 1–4.

- [ ] **Step 2: Run `expo-doctor`**

Run: `npm run doctor`
Expected: 21/21 (no new dependency was added, so this should be unaffected — confirms nothing about the existing `expo-notifications` config regressed).

- [ ] **Step 3: Manual smoke test**

On a dev client build (`npm run android` or `npm run ios`):
1. Fresh install → onboarding → "Enable" on notifications → finish onboarding.
2. Settings → confirm both reminder toggles are on.
3. Log breakfast and lunch, leave dinner unlogged → wait past your device clock's dinner default time (or temporarily change the device clock forward) → confirm a "dinner" notification fires and a "lunch"/"breakfast" one does not.
4. Toggle both Settings rows off → confirm no further notifications fire.

This step is manual and cannot be automated in this codebase (no on-device notification firing in Jest, and no CI device available) — record the result in the PR/handoff notes rather than skipping it silently.
