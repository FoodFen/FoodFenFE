import { z } from 'zod';

import type { useTranslation } from '@/hooks/useTranslation';

/**
 * Form validation.
 *
 * Separate from `src/api/schemas.ts`: those describe what the server sends,
 * these describe what the user may type. The messages here are shown directly
 * under the field, so they are built from a `t` function rather than baked in
 * as English — each is a factory the screen calls with its own `t`.
 */

type Translate = ReturnType<typeof useTranslation>['t'];

const MIN_PASSWORD_LENGTH = 8;

export function makeSignInSchema(t: Translate) {
  return z.object({
    email: z.email(t('auth', 'emailInvalidError')),
    password: z.string().min(1, t('auth', 'passwordRequiredError')),
  });
}

export function makeSignUpSchema(t: Translate) {
  return z
    .object({
      displayName: z.string().trim().min(1, t('auth', 'displayNameRequiredError')).max(60),
      email: z.email(t('auth', 'emailInvalidError')),
      password: z
        .string()
        .min(
          MIN_PASSWORD_LENGTH,
          t('auth', 'passwordMinLengthError').replace('{count}', String(MIN_PASSWORD_LENGTH)),
        )
        // A length floor alone lets through "password"; requiring a digit is the
        // cheapest meaningful strengthening without frustrating the user.
        .regex(/\d/, t('auth', 'passwordNeedsDigitError')),
      confirmPassword: z.string(),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t('auth', 'passwordsMismatchError'),
      path: ['confirmPassword'],
    });
}

export type SignInValues = z.infer<ReturnType<typeof makeSignInSchema>>;
export type SignUpValues = z.infer<ReturnType<typeof makeSignUpSchema>>;
