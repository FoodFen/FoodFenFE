# Local notifications — design

Status: approved by user, ready for implementation planning.

## Context

`expo-notifications` is already installed and configured as a plugin
(`app.config.ts`). Onboarding already asks for OS permission
(`src/components/onboarding/steps/NotificationsStep.tsx`), but the
resulting `granted` boolean is discarded — `notificationsEnabled` flows
into the onboarding draft and then is explicitly dropped in
`app/(onboarding)/index.tsx` ("isn't a user-table column"). Nothing has
ever scheduled a notification.

This app is local-first with no push/server infra by design
(`docs/backend-contracts/README.md`, `CLAUDE.md`), so this is
**local, on-device scheduled notifications only** — no new backend
endpoint, no new dependency beyond what's installed, no schema
migration. Everything needed already lives on the device:
`food_entry.loggedAt` (a real timestamp, not just the `loggedOn` diary
day) and the `streak` table (`currentStreak`, `lastActiveDate`).

## Scope

**In scope — two notification categories, each independently
toggleable:**

1. **Meal-time reminders.** For breakfast/lunch/dinner, if that meal
   hasn't been logged yet today, fire a local notification around the
   user's own usual time for that meal.
2. **Streak-at-risk.** If the user has an active streak
   (`currentStreak > 0`) and hasn't logged anything at all today
   (`lastActiveDate !== todayKey()`), fire one notification 2 hours
   before their usual time-of-day for their last log of the day.

**Explicitly not in scope for this pass** (from the brainstorm; not
built, no stub left behind):

- Water reminders, weigh-in reminders, quest/milestone notifications,
  re-engagement/win-back pushes, tips/education, paywall nudges — all
  surfaced in the research but not requested for v1.
- Any server-triggered push. `expo-notifications`'s push-token path is
  unused; only `scheduleNotificationAsync`/`cancelScheduledNotificationAsync`
  are used.
- Background/periodic recomputation via `expo-task-manager`. Recompute
  happens at app boot and after logging actions (see Data flow below);
  a schedule computed on the last app open is what fires even if the
  app stays closed for days — acceptable staleness, not a bug to solve
  here.
- Snacks. `MealType` includes `'snack'`, but "usual snack time" is a
  much noisier signal (snacks are logged at all hours) — only
  breakfast/lunch/dinner get a reminder.

## Architecture

```
src/data/notificationRepository.ts   — read-only queries over food_entry/streak
src/lib/notificationScheduler.ts     — pure scheduling math + expo-notifications wrapper
src/features/notifications/reconcile.ts — orchestrator: settings + today's state → schedule calls
```

`src/data/notificationRepository.ts` is a `src/data/` module (it reads
SQLite) alongside `entryRepository.ts`/`gamificationRepository.ts`.
`src/lib/notificationScheduler.ts` is a `src/lib/` module (like
`nutrition.ts`) because its clamping/rounding math is pure and testable
independent of any database — the same split `health-step-sync`'s
design already used for `src/lib/health/` vs. the repository layer.

### `src/data/notificationRepository.ts`

```ts
/** Time-of-day, independent of any date. */
export interface TimeOfDay { hour: number; minute: number; }

/**
 * Median time-of-day this user has logged `mealType`, over the last
 * `days` days. Null if fewer than 3 entries exist in that window — not
 * enough signal to trust over the fixed default.
 */
export function medianMealTime(
  userId: string,
  mealType: Extract<MealType, 'breakfast' | 'lunch' | 'dinner'>,
  days = 14,
): TimeOfDay | null;

/**
 * Median time-of-day of each day's *last* log (food, activity, or
 * water — whatever last touched `recordActiveDay`'s definition of "did
 * something today"), over the last `days` days. Null if fewer than 3
 * distinct days have any data.
 */
export function medianLastLogTime(userId: string, days = 14): TimeOfDay | null;
```

Implementation note: SQLite has no `MEDIAN()` aggregate. Both functions
pull the raw `loggedAt` timestamps for the window (`food_entry` for the
first; `food_entry` UNION `activity_log` UNION `water_log`, grouped by
`loggedOn`, taking `MAX(loggedAt)` per day, for the second), convert
each to minutes-since-midnight in JS, sort, and take the middle value
(average of the two middle values on an even count). This is the same
"pull rows, compute in JS" shape `recalculateTotals` and
`summarizeTrends` already use elsewhere in this codebase — no raw SQL
math expressions.

### `src/lib/notificationScheduler.ts`

```ts
export type NotificationId = 'meal-breakfast' | 'meal-lunch' | 'meal-dinner' | 'streak-risk';

/** Fixed fallback used until 3+ days of real history exist. */
export const DEFAULT_MEAL_TIMES: Record<'breakfast' | 'lunch' | 'dinner', TimeOfDay> = {
  breakfast: { hour: 8, minute: 0 },
  lunch: { hour: 12, minute: 30 },
  dinner: { hour: 19, minute: 0 },
};

/**
 * Fallback "usual last log of the day" until 3+ days of history exist.
 * This is an input to `streakNudgeTime` below, not the nudge time itself
 * — it produces a 19:00 nudge (21:00 minus 2h), same as a real user whose
 * history says they usually finish logging around 9pm.
 */
export const DEFAULT_LAST_LOG_TIME: TimeOfDay = { hour: 21, minute: 0 };

/**
 * `time` on today's date if that moment hasn't passed yet, else on
 * tomorrow's date. `scheduleAt(id, target, title, body)` cancels any
 * existing notification under `id` first (expo-notifications does not
 * dedupe by content), then schedules the new one as a one-shot date
 * trigger — never a repeating trigger, since the target time itself
 * changes day to day as history shifts.
 */
export function nextOccurrence(time: TimeOfDay, now = new Date()): Date;

export async function scheduleAt(
  id: NotificationId,
  at: Date,
  content: { title: string; body: string },
): Promise<void>;

export async function cancel(id: NotificationId): Promise<void>;

/**
 * `lastLogTime` minus 2 hours, clamped to [17:00, 23:00] — a user whose
 * usual last log is 9am must not get pinged mid-morning, and a
 * midnight-logger's nudge is pulled back to a reasonable evening hour
 * rather than firing at 10pm two hours before midnight sharp... clamped
 * the other direction too (never past 23:00, so it isn't pointless).
 */
export function streakNudgeTime(lastLogTime: TimeOfDay): TimeOfDay;
```

### `src/features/notifications/reconcile.ts`

```ts
/**
 * Re-evaluates both categories against today's actual state and
 * schedules/cancels accordingly. Cheap enough to call on every trigger
 * point below — it's a handful of SQLite reads plus at most 4
 * schedule/cancel calls, not a heavy job.
 */
export async function reconcileNotifications(userId: string): Promise<void>;
```

For each of breakfast/lunch/dinner: if `mealRemindersEnabled` is off,
`cancel(id)`; else if today's `getEntriesForDay(userId, todayKey())`
already has an entry with that `mealType`, `cancel(id)`; else compute
the time (`medianMealTime` or the default) and `scheduleAt`.

For streak: if `streakRemindersEnabled` is off, `cancel('streak-risk')`;
else read `getStreak(userId)` — if `currentStreak === 0` or
`lastActiveDate === todayKey()`, `cancel('streak-risk')`; else compute
`streakNudgeTime(medianLastLogTime(userId) ?? DEFAULT_LAST_LOG_TIME)` and
`scheduleAt`.

## Data flow / trigger points

`reconcileNotifications(userId)` runs:

1. **App boot** — `app/_layout.tsx`'s `AppShell`, in the same `useEffect`
   that already calls `refreshProfile()` after migrations succeed (once
   `profileId` is available).
2. **After every logging mutation that calls `recordActiveDay`** —
   `src/features/diary/queries.ts` (`useLogMeal`, `useLogManualEntry`,
   and the other call sites at lines ~197/223/302/358/379/430). Logging
   lunch immediately cancels `meal-lunch` and re-evaluates
   `streak-risk` (now satisfied for today) without waiting for the next
   app open.
3. **Right after either settings toggle flips**, in the Settings screen
   handler, so turning a category on/off takes effect immediately
   rather than on next boot.

`reconcileNotifications` is fire-and-forget (`void`) from all three
call sites — it's a local scheduling side effect, not something a
screen needs to await or show loading state for.

## Settings & onboarding

- `src/features/settings/store.ts` gains two booleans, same pattern as
  `hideChallengeProgress`/`healthSyncEnabled`: `mealRemindersEnabled`,
  `streakRemindersEnabled` (both default `false`, MMKV-backed, no
  migration needed — these are device prefs, not `user` table columns).
- `app/settings/index.tsx` gains a "Notifications" section with two
  toggle rows. Turning a toggle **on** first calls
  `Notifications.getPermissionsAsync()`; if not granted, calls
  `requestPermissionsAsync()` — if the user denies, the toggle reverts
  to off (no schedule is created without OS permission). This mirrors
  the existing opt-in dance `healthSyncEnabled` already does for
  Health Connect/HealthKit permissions.
- `NotificationsStep`'s "Enable" button (`onChange(granted)`) — instead
  of the value being discarded in `app/(onboarding)/index.tsx` — now
  sets both `mealRemindersEnabled` and `streakRemindersEnabled` to
  `granted`. "Skip" leaves both `false`. This is the only change to the
  onboarding wizard itself; the step's own UI/copy is unchanged.
- New i18n strings (`src/lib/i18n/en.ts` and `vi.ts`): the two Settings
  row labels, and the four notification bodies (breakfast/lunch/dinner/
  streak), written in the encouraging, non-guilt tone the research
  flagged as the difference between MyFitnessPal's pattern and Noom's
  more-criticized one — e.g. "Haven't logged lunch yet?" /
  "🔥 Don't lose your {n}-day streak — log something before your day
  wraps up," not "You failed to log lunch."

## Error handling / edge cases

- No permission at all (never granted, or later revoked): `scheduleAt`
  still calls through to `expo-notifications`, which silently no-ops
  without permission on both platforms — no special-cased check needed
  in the scheduler itself, but `reconcileNotifications` skips scheduling
  work entirely when both settings are off, which is the common case
  for a user who denied at onboarding and never turned it on in Settings.
- Fewer than 3 days of history: falls back to `DEFAULT_MEAL_TIMES` /
  21:00 default for the streak nudge, per `medianMealTime`/
  `medianLastLogTime` returning `null`.
- Timezone/travel: `nextOccurrence` and all time math use the device's
  current local clock at reconcile time (same convention as
  `src/lib/date.ts`), so a travel day naturally recomputes against the
  new local time next time `reconcileNotifications` runs — no special
  handling needed.
- A user who logs a meal *after* its notification already fired that
  day: nothing to do — the fired notification already showed; the next
  `reconcileNotifications` call (triggered by that very log) cancels
  only the *pending* (not-yet-fired) copy for tomorrow's slot if one
  existed, and correctly leaves `streak-risk` cancelled for today.

## Testing

- `src/data/__tests__/notificationRepository.test.ts` —
  `medianMealTime`/`medianLastLogTime` against the `testDatabase`:
  odd/even sample counts, the <3-samples null case, and that a
  `deletedAt` (soft-deleted) entry is excluded.
- `src/lib/__tests__/notificationScheduler.test.ts` — `nextOccurrence`
  (today vs. rolls to tomorrow), `streakNudgeTime`'s clamping at both
  ends, with `expo-notifications` mocked (no real OS scheduling in
  Jest, same as `jest.setup.ts`'s existing `expo-secure-store` stub
  pattern).
- `reconcileNotifications` itself is thin orchestration over already-
  tested pieces; it is exercised at the integration level (does the
  right `scheduleAt`/`cancel` get called for a given settings+state
  combination) rather than given its own deep unit suite.
