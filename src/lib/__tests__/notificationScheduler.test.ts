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
