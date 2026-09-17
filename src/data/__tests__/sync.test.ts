import { onlineManager } from '@tanstack/react-query';

import { user } from '@/db/schema';
import type { TestDatabase } from '@/db/testDatabase';
import { createTestDatabase } from '@/db/testDatabase';
import { env as importedEnv } from '@/lib/env';

import {
  canUseRemote,
  configureSyncAuth,
  markSynced,
  pendingChangeCount,
  readWithRefresh,
  touch,
  touchDeleted,
} from '../sync';
import * as userRepository from '../userRepository';

jest.mock('@/lib/env', () => ({
  env: {
    apiUrl: 'https://example.test',
    hasBackend: true,
    apiTimeoutMs: 15_000,
    variant: 'development',
    isDev: false,
  },
}));

// The real `env` is `as const`, so its properties are typed readonly; the
// mock above is a plain mutable object, and this cast lets tests flip it.
const env = importedEnv as { hasBackend: boolean };

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

const profileInput = {
  gender: 'male' as const,
  birthYear: 1990,
  height: 180,
  weightCurrent: 85,
  weightGoal: 78,
  activityLevel: 'moderate' as const,
  dietType: 'balanced' as const,
  weeklyRateKg: 0.5,
};

beforeEach(() => {
  mockDb = createTestDatabase();
  configureSyncAuth(() => false);
  env.hasBackend = true;
  onlineManager.setOnline(true);
});

describe('canUseRemote', () => {
  it('requires a configured backend', () => {
    env.hasBackend = false;
    configureSyncAuth(() => true);

    expect(canUseRemote()).toBe(false);
  });

  it('requires a signed-in session', () => {
    configureSyncAuth(() => false);

    expect(canUseRemote()).toBe(false);
  });

  it('requires the device to be online', () => {
    configureSyncAuth(() => true);
    onlineManager.setOnline(false);

    expect(canUseRemote()).toBe(false);
  });

  it('is true only when a backend, a session and connectivity all hold', () => {
    configureSyncAuth(() => true);

    expect(canUseRemote()).toBe(true);
  });
});

describe('readWithRefresh', () => {
  it('always answers from the local read, skipping pull when remote is unusable', async () => {
    const pull = jest.fn();

    const result = await readWithRefresh({ pull, read: () => 'local-value' });

    expect(result).toBe('local-value');
    expect(pull).not.toHaveBeenCalled();
  });

  it('pulls first when remote is usable, then still answers from the local read', async () => {
    configureSyncAuth(() => true);
    const pull = jest.fn().mockResolvedValue(undefined);

    const result = await readWithRefresh({ pull, read: () => 'local-value' });

    expect(result).toBe('local-value');
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it('swallows a pull failure and still returns the local read', async () => {
    configureSyncAuth(() => true);
    const pull = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(readWithRefresh({ pull, read: () => 'local-value' })).resolves.toBe(
      'local-value',
    );
  });
});

describe('touch / touchDeleted', () => {
  it('marks a row updated now and not yet synced', () => {
    const now = new Date('2026-03-02T10:00:00Z');

    expect(touch(now)).toEqual({ updatedAt: now, syncedAt: null });
  });

  it('additionally stamps a deletion time', () => {
    const now = new Date('2026-03-02T10:00:00Z');

    expect(touchDeleted(now)).toEqual({ updatedAt: now, syncedAt: null, deletedAt: now });
  });
});

describe('pendingChangeCount / markSynced', () => {
  it('counts newly created rows as pending, and stops counting them once marked synced', () => {
    const created = userRepository.createLocalUser(profileInput);

    // The new user row and its opening daily goal are both unsynced.
    expect(pendingChangeCount()).toBe(2);

    markSynced(user, created.user.id, 501);

    expect(pendingChangeCount()).toBe(1);
  });
});
