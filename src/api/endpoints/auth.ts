import { api } from '@/api/client';
import { authSessionSchema, userProfileSchema } from '@/api/schemas';
import type { AuthSession, UserProfile } from '@/types/models';

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
 * `skipAuth` on every call here: these endpoints establish the session, so
 * sending a stale (or missing) token would trigger a pointless refresh cycle.
 */
export const authApi = {
  signIn: (payload: SignInPayload): Promise<AuthSession> =>
    api.post('auth/sign-in', payload, { schema: authSessionSchema, skipAuth: true }),

  signUp: (payload: SignUpPayload): Promise<AuthSession> =>
    api.post('auth/sign-up', payload, { schema: authSessionSchema, skipAuth: true }),

  refresh: (refreshToken: string): Promise<AuthSession> =>
    api.post(
      'auth/refresh',
      { refreshToken },
      { schema: authSessionSchema, skipAuth: true },
    ),

  signOut: (refreshToken: string): Promise<void> =>
    api.post('auth/sign-out', { refreshToken }),

  requestPasswordReset: (email: string): Promise<void> =>
    api.post('auth/password-reset', { email }, { skipAuth: true }),

  me: (): Promise<UserProfile> => api.get('auth/me', { schema: userProfileSchema }),

  updateProfile: (patch: Partial<UserProfile>): Promise<UserProfile> =>
    api.patch('auth/me', patch, { schema: userProfileSchema }),
};
