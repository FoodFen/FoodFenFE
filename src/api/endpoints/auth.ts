import { api } from '@/api/client';
import { authSessionSchema, userSchema } from '@/api/schemas';
import type { RemoteAuthSession, RemoteUser } from '@/api/schemas';

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload {
  email: string;
  password: string;
  displayName?: string;
}

/**
 * Account endpoints.
 *
 * Optional by design: the app tracks perfectly well without ever calling any
 * of these. An account exists so a diary can follow the user to another
 * device, which is why every one of these is reached from Profile rather than
 * from a gate in front of the app.
 *
 * `skipAuth` on the credential exchanges: they establish the session, so
 * sending a stale token would trigger a pointless refresh cycle.
 */
export const authApi = {
  signIn: (payload: SignInPayload): Promise<RemoteAuthSession> =>
    api.post('auth/sign-in', payload, { schema: authSessionSchema, skipAuth: true }),

  signUp: (payload: SignUpPayload): Promise<RemoteAuthSession> =>
    api.post('auth/sign-up', payload, { schema: authSessionSchema, skipAuth: true }),

  refresh: (refreshToken: string): Promise<RemoteAuthSession> =>
    api.post(
      'auth/refresh',
      { refreshToken },
      { schema: authSessionSchema, skipAuth: true },
    ),

  signOut: (refreshToken: string): Promise<void> =>
    api.post('auth/sign-out', { refreshToken }),

  requestPasswordReset: (email: string): Promise<void> =>
    api.post('auth/password-reset', { email }, { skipAuth: true }),

  me: (): Promise<RemoteUser> => api.get('auth/me', { schema: userSchema }),
};
