// src/features/notifications/__tests__/reconcile.test.ts
import * as entryRepository from '@/data/entryRepository';
import * as gamification from '@/data/gamificationRepository';
import * as userRepository from '@/data/userRepository';
import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';
import { useSettingsStore } from '@/features/settings/store';
import { shiftDateKey, toDateKey } from '@/lib/date';
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

// Fixed reference clock so every reconcile decision (already-passed nudge
// time, "already logged today", "logged yesterday") is deterministic
// regardless of when this test suite actually runs. 10am sits safely before
// the default breakfast/lunch/dinner times and the default streak nudge
// (19:00), so "not yet passed" branches are exercised by default; specific
// tests override with their own `now` where the opposite branch matters.
const NOW = new Date('2026-03-10T10:00:00');
const TODAY = toDateKey(NOW);
const YESTERDAY = shiftDateKey(TODAY, -1);
const TWO_DAYS_AGO = shiftDateKey(TODAY, -2);

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
  it('schedules tomorrow\'s reminder when that meal is already logged today', async () => {
    const user = createUser();

    entryRepository.createEntry({
      userId: user.id,
      name: 'Lunch',
      mealType: 'lunch',
      inputMethod: 'manual',
      loggedOn: TODAY,
      ingredients: [],
    });

    await reconcileNotifications(user.id, NOW);

    // No history yet, so the fallback default (12:30) is used — but for
    // TOMORROW, not left uncancelled/unscheduled, so the reminder survives
    // even if the app is never reopened again before then.
    expect(mockedScheduler.scheduleAt).toHaveBeenCalledWith(
      'meal-lunch',
      scheduler.tomorrowAt(mockedScheduler.DEFAULT_MEAL_TIMES.lunch, NOW),
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );
  });

  it('does not schedule a meal reminder for a soft-deleted "logged today" entry', async () => {
    const user = createUser();

    const entry = entryRepository.createEntry({
      userId: user.id,
      name: 'Lunch',
      mealType: 'lunch',
      inputMethod: 'manual',
      loggedOn: TODAY,
      ingredients: [],
    });

    entryRepository.deleteEntry(entry.id);

    await reconcileNotifications(user.id, NOW);

    // The deleted entry must not count as "already logged" — today's
    // occurrence (not tomorrow's) should still be scheduled.
    expect(mockedScheduler.scheduleAt).toHaveBeenCalledWith(
      'meal-lunch',
      scheduler.nextOccurrence(mockedScheduler.DEFAULT_MEAL_TIMES.lunch, NOW),
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );
  });

  it('schedules a meal reminder at the fixed default time when there is no history yet', async () => {
    const user = createUser();

    await reconcileNotifications(user.id, NOW);

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

    await reconcileNotifications(user.id, NOW);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-breakfast');
    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-lunch');
    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-dinner');
  });
});

describe('reconcileNotifications — streak-at-risk', () => {
  it('pre-schedules tomorrow\'s nudge when today is already the last active day', async () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, TODAY);

    await reconcileNotifications(user.id, NOW);

    // Safe today — but nothing should be pending for tomorrow's boot-effect
    // window to fall back on, so tomorrow's nudge is queued in advance.
    expect(mockedScheduler.scheduleAt).toHaveBeenCalledWith(
      'streak-risk',
      scheduler.tomorrowAt(
        scheduler.streakNudgeTime(mockedScheduler.DEFAULT_LAST_LOG_TIME),
        NOW,
      ),
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );
  });

  it('schedules streak-risk when the streak is active but today is unlogged and the nudge time has not passed', async () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, YESTERDAY);

    await reconcileNotifications(user.id, NOW);

    expect(mockedScheduler.scheduleAt).toHaveBeenCalledWith(
      'streak-risk',
      expect.any(Date),
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );
  });

  it('cancels streak-risk once the nudge time has already passed today', async () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, YESTERDAY);

    // Default nudge is 19:00 (21:00 default last-log minus 2h) — 22:00 is past it.
    const lateNow = new Date('2026-03-10T22:00:00');

    await reconcileNotifications(user.id, lateNow);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('streak-risk');
    expect(mockedScheduler.scheduleAt).not.toHaveBeenCalledWith(
      'streak-risk',
      expect.anything(),
      expect.anything(),
    );
  });

  it('cancels streak-risk for a lapsed streak (a gap of 2+ days) instead of nudging with a stale count', async () => {
    const user = createUser();

    // recordActiveDay doesn't reset currentStreak until the next log, so a
    // stale streak row can still report a non-zero currentStreak days after
    // the streak actually broke — reconcile must not trust it.
    gamification.recordActiveDay(user.id, TWO_DAYS_AGO);

    await reconcileNotifications(user.id, NOW);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('streak-risk');
    expect(mockedScheduler.scheduleAt).not.toHaveBeenCalledWith(
      'streak-risk',
      expect.anything(),
      expect.anything(),
    );
  });

  it('does not schedule streak-risk for a user with no streak row yet', async () => {
    const user = createUser();

    await reconcileNotifications(user.id, NOW);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('streak-risk');
    expect(mockedScheduler.scheduleAt).not.toHaveBeenCalledWith(
      'streak-risk',
      expect.anything(),
      expect.anything(),
    );
  });

  it('cancels streak-risk when streakRemindersEnabled is off', async () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, YESTERDAY);
    useSettingsStore.setState({ streakRemindersEnabled: false });

    await reconcileNotifications(user.id, NOW);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('streak-risk');
    expect(mockedScheduler.scheduleAt).not.toHaveBeenCalledWith(
      'streak-risk',
      expect.anything(),
      expect.anything(),
    );
  });
});
