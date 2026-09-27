import { eraseDatabase } from '@/db/client';
import { useSettingsStore } from '@/features/settings/store';
import { cancelAll } from '@/lib/notificationScheduler';

import { useProfileStore } from '../store';

// `eraseDatabase` talks to the real expo-sqlite connection, which cannot run
// under Jest — mocked here so `eraseAll`'s own logic (cancel notifications,
// reset settings, clear profile state) can be exercised in isolation.
jest.mock('@/db/client', () => ({
  eraseDatabase: jest.fn(),
}));

jest.mock('@/lib/notificationScheduler', () => ({
  cancelAll: jest.fn(async () => undefined),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ mealRemindersEnabled: true, streakRemindersEnabled: true });
});

describe('eraseAll', () => {
  it('cancels every pending notification', () => {
    useProfileStore.getState().eraseAll();

    expect(cancelAll).toHaveBeenCalled();
  });

  it('turns both reminder settings back off', () => {
    useProfileStore.getState().eraseAll();

    expect(useSettingsStore.getState().mealRemindersEnabled).toBe(false);
    expect(useSettingsStore.getState().streakRemindersEnabled).toBe(false);
  });

  it('still wipes the database and clears the profile', () => {
    useProfileStore.getState().eraseAll();

    expect(eraseDatabase).toHaveBeenCalled();
    expect(useProfileStore.getState().profile).toBeNull();
    expect(useProfileStore.getState().isLoaded).toBe(true);
  });
});
