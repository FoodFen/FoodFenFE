import { authApi } from '@/api/endpoints/auth';
import type { RemoteAuthSession } from '@/api/schemas';
import { clearAccountState } from '@/data/gamificationRepository';
import { useProfileStore } from '@/features/profile/store';
import { preferences, StorageKeys } from '@/lib/storage';

import { useAuthStore } from '../store';

jest.mock('@/api/endpoints/auth', () => ({
  authApi: { signIn: jest.fn(), signOut: jest.fn(async () => undefined) },
}));

jest.mock('@/db/client', () => ({ db: {} }));

jest.mock('@/data/gamificationRepository', () => ({
  clearAccountState: jest.fn(),
}));

jest.mock('@/features/auth/social', () => ({
  getAppleCredential: jest.fn(),
  getGoogleIdToken: jest.fn(),
}));

jest.mock('@/features/profile/store', () => ({
  useProfileStore: { getState: jest.fn() },
}));

const eraseAll = jest.fn();

function sessionFor(accountId: number): RemoteAuthSession {
  return {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: Date.now() + 3_600_000,
    user: { id: accountId } as RemoteAuthSession['user'],
  };
}

const credentials = { email: 'a@b.co', password: 'secret123' };

beforeEach(() => {
  jest.clearAllMocks();
  preferences.remove(StorageKeys.accountOwnerId);
  useAuthStore.setState({ session: null, status: 'unauthenticated' });
  jest.mocked(useProfileStore.getState).mockReturnValue({
    profile: { id: 'user-1' },
    eraseAll,
  } as unknown as ReturnType<typeof useProfileStore.getState>);
});

describe('signIn account ownership', () => {
  it('lets the first account claim a guest’s local data without erasing it', async () => {
    jest.mocked(authApi.signIn).mockResolvedValue(sessionFor(7));

    await useAuthStore.getState().signIn(credentials);

    expect(eraseAll).not.toHaveBeenCalled();
    expect(preferences.get(StorageKeys.accountOwnerId)).toBe(7);
  });

  it('keeps local data when the same account signs back in', async () => {
    preferences.set(StorageKeys.accountOwnerId, 7);
    jest.mocked(authApi.signIn).mockResolvedValue(sessionFor(7));

    await useAuthStore.getState().signIn(credentials);

    expect(eraseAll).not.toHaveBeenCalled();
  });

  it('erases local data and takes ownership when a different account signs in', async () => {
    preferences.set(StorageKeys.accountOwnerId, 7);
    jest.mocked(authApi.signIn).mockResolvedValue(sessionFor(8));

    await useAuthStore.getState().signIn(credentials);

    expect(eraseAll).toHaveBeenCalledTimes(1);
    expect(preferences.get(StorageKeys.accountOwnerId)).toBe(8);
    expect(useAuthStore.getState().session?.user.id).toBe(8);
  });
});

describe('signOut', () => {
  it('clears the account-bound state of the local profile', async () => {
    useAuthStore.setState({ session: sessionFor(7), status: 'authenticated' });

    await useAuthStore.getState().signOut();

    expect(clearAccountState).toHaveBeenCalledWith('user-1');
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('does not touch the owner, so the same account can sign back in to its data', async () => {
    preferences.set(StorageKeys.accountOwnerId, 7);
    useAuthStore.setState({ session: sessionFor(7), status: 'authenticated' });

    await useAuthStore.getState().signOut();

    expect(preferences.get(StorageKeys.accountOwnerId)).toBe(7);
  });
});
