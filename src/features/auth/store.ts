import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { configureAuth } from '@/api/client';
import { authApi } from '@/api/endpoints/auth';
import type { SignInPayload, SignUpPayload } from '@/api/endpoints/auth';
import { syncApi } from '@/api/endpoints/sync';
import { authSessionSchema } from '@/api/schemas';
import type { RemoteAuthSession, RemoteDailyGoal, RemoteUser } from '@/api/schemas';
import { clearAccountState } from '@/data/gamificationRepository';
import { applyDailyGoals } from '@/data/pull';
import { configureSyncAuth } from '@/data/sync';
import * as userRepository from '@/data/userRepository';
import { getAppleCredential, getGoogleIdToken } from '@/features/auth/social';
import { useProfileStore } from '@/features/profile/store';
import { env } from '@/lib/env';
import { preferences, StorageKeys } from '@/lib/storage';

/**
 * The optional account session.
 *
 * Optional is the important word: the app tracks perfectly well with this
 * store empty forever. A session does exactly one thing — it lets reads try
 * the server before falling back to the device database (see
 * `canUseRemote` in `src/data/sync.ts`) — and it is never what decides whether
 * the app is usable. The local profile in `useProfileStore` does that.
 *
 * The session's `user` is the *server's* record, not the local profile; the
 * two are reconciled by sync, which is not built yet.
 *
 * Tokens live in the OS keychain (`expo-secure-store`), never in MMKV: MMKV is
 * a plain file, readable on a rooted device or from an unencrypted backup.
 */

const SESSION_KEY = 'foodfen.session';

/**
 * Refresh this long before the token actually expires, so a request never
 * departs with a token that dies in flight.
 */
const REFRESH_LEEWAY_MS = 60_000;

export type AuthSession = RemoteAuthSession;

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;

  /** Read the stored session on app start. Safe to call more than once. */
  hydrate: () => Promise<void>;
  signIn: (payload: SignInPayload) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

async function persistSession(session: AuthSession | null): Promise<void> {
  if (session) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } else {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

async function readSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;

    const parsed = authSessionSchema.safeParse(JSON.parse(raw));

    // A session written by an older app version may no longer parse. Treat it
    // as signed out rather than crashing on launch.
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (env.isDev)
      console.warn(
        '[auth] Failed to read stored session; treating as signed out.',
        error,
      );
    return null;
  }
}

/**
 * Local data belongs to whichever account first signed in on this device (a
 * guest's data is claimed by their first sign-in). A different account must not
 * inherit it — it would also be pushed to that account's server record.
 */
function ownedByAnotherAccount(accountId: number): boolean {
  const owner = preferences.get<number>(StorageKeys.accountOwnerId);

  return owner !== undefined && owner !== accountId;
}

/**
 * Erase (for a different account) and restore the profile in one synchronous
 * step. The local profile is never null in between, so the root route guards
 * don't flip and rebuild the navigation stack under the sign-in screen — which
 * left its "Done" button with nowhere to go.
 */
function swapLocalData(
  remote: RemoteUser,
  goals: RemoteDailyGoal[] | null,
  erase: boolean,
): void {
  if (erase) useProfileStore.getState().eraseAll();
  preferences.set(StorageKeys.accountOwnerId, remote.id);

  if (!goals) return;

  const restored = userRepository.restoreLocalUser(remote);
  console.warn(
    '[auth] restore profile',
    restored ? restored.id : 'not restorable',
    'goals',
    goals.length,
  );
  if (!restored) return;

  applyDailyGoals(restored.id, goals);
  if (!userRepository.getGoalForDate(restored.id))
    userRepository.writeCalculatedGoal(restored);

  useProfileStore.getState().refresh();
}

async function adoptSession(session: AuthSession): Promise<void> {
  const erase = ownedByAnotherAccount(session.user.id);
  const needsRestore =
    (erase || !useProfileStore.getState().profile) &&
    userRepository.canRestoreLocalUser(session.user);

  console.warn('[auth] adopt session', {
    account: session.user.id,
    erase,
    hasProfile: Boolean(useProfileStore.getState().profile),
    needsRestore,
  });

  let goals: RemoteDailyGoal[] | null = null;

  if (needsRestore) {
    try {
      goals = await syncApi.goals(undefined, session.accessToken);
    } catch (error) {
      if (env.isDev) console.warn('[auth] Goal fetch at sign-in failed.', error);
      goals = [];
    }
  }

  swapLocalData(session.user, goals, erase);
  await persistSession(session);
  useAuthStore.setState({ session, status: 'authenticated' });
  console.warn('[auth] session adopted', {
    profile: useProfileStore.getState().profile?.id ?? null,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,

  hydrate: async () => {
    const session = await readSession();

    set({ session, status: session ? 'authenticated' : 'unauthenticated' });
  },

  signIn: async (payload) => {
    await adoptSession(await authApi.signIn(payload));
  },

  signUp: async (payload) => {
    await adoptSession(await authApi.signUp(payload));
  },

  signInWithGoogle: async () => {
    const idToken = await getGoogleIdToken();
    if (!idToken) return; // User cancelled — not an error.

    await adoptSession(await authApi.socialSignIn({ provider: 'google', idToken }));
  },

  signInWithApple: async () => {
    const credential = await getAppleCredential();
    if (!credential) return; // User cancelled — not an error.

    await adoptSession(
      await authApi.socialSignIn({
        provider: 'apple',
        idToken: credential.identityToken,
        fullName: credential.fullName,
        email: credential.email,
      }),
    );
  },

  signOut: async () => {
    const { session } = get();
    const profileId = useProfileStore.getState().profile?.id;

    if (profileId) clearAccountState(profileId);

    // Clear locally first: if the server call fails the user is still signed
    // out on this device, which is what they asked for.
    set({ session: null, status: 'unauthenticated' });
    await persistSession(null);

    if (session) {
      await authApi.signOut(session.refreshToken).catch((error: unknown) => {
        // Best effort — the refresh token expires on its own.
        if (env.isDev)
          console.warn('[auth] Sign-out request failed (best effort).', error);
      });
    }
  },
}));

/**
 * Hand the API client its auth hooks. Called once from the root layout — the
 * indirection is what keeps `client.ts` free of any import from this feature.
 */
export function connectAuthToApiClient(): void {
  configureAuth({
    getAccessToken: () => {
      const session = useAuthStore.getState().session;
      if (!session) return null;

      // Let a nearly-expired token through: the 401 path will refresh it. This
      // only skips the token when it is definitively dead.
      return session.expiresAt <= Date.now() ? null : session.accessToken;
    },

    refreshSession: async () => {
      const current = useAuthStore.getState().session;
      if (!current) return null;

      try {
        const next = await authApi.refresh(current.refreshToken);

        await persistSession(next);
        useAuthStore.setState({ session: next, status: 'authenticated' });

        return next.accessToken;
      } catch (error) {
        if (env.isDev) console.warn('[auth] Session refresh failed; signing out.', error);
        return null;
      }
    },

    onSessionExpired: () => {
      useAuthStore.setState({ session: null, status: 'unauthenticated' });
      void persistSession(null);
    },
  });
}

/**
 * Hand `src/data/sync.ts` a way to check for a session without it importing
 * this feature — the same indirection `connectAuthToApiClient` uses.
 */
export function connectAuthToSync(): void {
  configureSyncAuth(() => useAuthStore.getState().session !== null);
}

/** True when the access token is expired or about to be. */
export function isSessionStale(session: AuthSession | null): boolean {
  if (!session) return true;

  return session.expiresAt - REFRESH_LEEWAY_MS <= Date.now();
}
