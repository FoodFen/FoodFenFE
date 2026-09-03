import { z } from 'zod';

/**
 * Form validation.
 *
 * Separate from `src/api/schemas.ts`: those describe what the server sends,
 * these describe what the user may type. The messages here are shown directly
 * under the field, so they are written for a person, not a log.
 */

const MIN_PASSWORD_LENGTH = 8;

export const signInSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Tell us what to call you.').max(60),
    email: z.email('Enter a valid email address.'),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      // A length floor alone lets through "password"; requiring a digit is the
      // cheapest meaningful strengthening without frustrating the user.
      .regex(/\d/, 'Include at least one number.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

/** Onboarding: the physical details that drive the calorie target. */
export const onboardingSchema = z.object({
  sex: z.enum(['male', 'female']),
  age: z.coerce.number<number>().int().min(13, 'Must be 13 or older.').max(120),
  heightCm: z.coerce.number<number>().min(100, 'Enter your height in cm.').max(250),
  weightKg: z.coerce.number<number>().min(30, 'Enter your weight in kg.').max(400),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goalKind: z.enum(['lose', 'maintain', 'gain']),
  weeklyRateKg: z.coerce.number<number>().min(0).max(1.5),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;
