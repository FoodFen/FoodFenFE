import { useSettingsStore } from '../store';

describe('healthSyncEnabled', () => {
  it('defaults to off', () => {
    expect(useSettingsStore.getState().healthSyncEnabled).toBe(false);
  });

  it('setHealthSyncEnabled flips it and persists', () => {
    useSettingsStore.getState().setHealthSyncEnabled(true);

    expect(useSettingsStore.getState().healthSyncEnabled).toBe(true);
  });
});

describe('meal reminders', () => {
  it('defaults to off', () => {
    expect(useSettingsStore.getState().reminders.some((r) => r.enabled)).toBe(false);
  });

  it('setReminderEnabled flips one and persists', () => {
    useSettingsStore.getState().setReminderEnabled('meal-breakfast', true);

    expect(useSettingsStore.getState().reminders[0]?.enabled).toBe(true);
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
