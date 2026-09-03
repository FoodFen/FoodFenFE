import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { configureAuth } from '@/api/client';
import { authApi } from '@/api/endpoints/auth';
import type { SignInPayload, SignUpPayload } from '@/api/endpoints/auth';
import { authSessionSchema } from '@/api/schemas';
import type { AuthSession, UserProfile } from '@/types/models';

/**
 * Session state.
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

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;

  /** Read the stored session on app start. Safe to call more than once. */
  hydrate: () => Promise<void>;
  signIn: (payload: SignInPayload) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signOut: () => Promise<void>;
  /** Replace the cached profile after a settings change. */
  setUser: (user: UserProfile) => void;
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
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,

  hydrate: async () => {
    const session = await readSession();

    set({ session, status: session ? 'authenticated' : 'unauthenticated' });
  },

  signIn: async (payload) => {
    const session = await authApi.signIn(payload);

    await persistSession(session);
    set({ session, status: 'authenticated' });
  },

  signUp: async (payload) => {
    const session = await authApi.signUp(payload);

    await persistSession(session);
    set({ session, status: 'authenticated' });
  },

  signOut: async () => {
    const { session } = get();

    // Clear locally first: if the server call fails the user is still signed
    // out on this device, which is what they asked for.
    set({ session: null, status: 'unauthenticated' });
    await persistSession(null);

    if (session) {
      await authApi.signOut(session.refreshToken).catch(() => {
        // Best effort — the refresh token expires on its own.
      });
    }
  },

  setUser: (user) => {
    const { session } = get();
    if (!session) return;

    const next = { ...session, user };

    set({ session: next });
    void persistSession(next);
  },
}));

/** Non-React accessors, for use inside the API layer. */
export const authSelectors = {
  session: () => useAuthStore.getState().session,
  user: () => useAuthStore.getState().session?.user ?? null,
  isAuthenticated: () => useAuthStore.getState().status === 'authenticated',
};

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
      } catch {
        return null;
      }
    },

    onSessionExpired: () => {
      useAuthStore.setState({ session: null, status: 'unauthenticated' });
      void persistSession(null);
    },
  });
}

/** True when the access token is expired or about to be. */
export function isSessionStale(session: AuthSession | null): boolean {
  if (!session) return true;

  return session.expiresAt - REFRESH_LEEWAY_MS <= Date.now();
}
