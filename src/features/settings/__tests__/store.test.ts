import { useSettingsStore } from '../store';

describe('bumpQuestAdvance', () => {
  beforeEach(() => {
    useSettingsStore.setState({ questAdvanceCounts: {} });
  });

  it('starts a quest at count 1 and increments on repeat calls', () => {
    const bump = useSettingsStore.getState().bumpQuestAdvance;

    expect(bump('quest-1', ['quest-1'])).toBe(1);
    expect(bump('quest-1', ['quest-1'])).toBe(2);
    expect(bump('quest-1', ['quest-1'])).toBe(3);
  });

  it('tracks separate quests independently', () => {
    const bump = useSettingsStore.getState().bumpQuestAdvance;

    bump('quest-1', ['quest-1', 'quest-2']);
    bump('quest-1', ['quest-1', 'quest-2']);
    bump('quest-2', ['quest-1', 'quest-2']);

    expect(useSettingsStore.getState().questAdvanceCounts).toEqual({
      'quest-1': 2,
      'quest-2': 1,
    });
  });

  it('drops counters for quests no longer in the active set', () => {
    const bump = useSettingsStore.getState().bumpQuestAdvance;

    bump('yesterdays-quest', ['yesterdays-quest']);
    // Today's quest set has replaced it — the stale counter should be pruned
    // the next time anything is bumped.
    bump('todays-quest', ['todays-quest']);

    expect(useSettingsStore.getState().questAdvanceCounts).toEqual({
      'todays-quest': 1,
    });
  });
});

describe('healthSyncEnabled', () => {
  it('defaults to off', () => {
    expect(useSettingsStore.getState().healthSyncEnabled).toBe(false);
  });

  it('setHealthSyncEnabled flips it and persists', () => {
    useSettingsStore.getState().setHealthSyncEnabled(true);

    expect(useSettingsStore.getState().healthSyncEnabled).toBe(true);
  });
});

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
