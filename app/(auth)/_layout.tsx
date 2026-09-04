import { Stack } from 'expo-router';

/**
 * Sign in and sign up.
 *
 * Pushed from Profile rather than gating the app, so these screens show a
 * header with a back button — a user who opened them by mistake has to be able
 * to leave without an account.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
    </Stack>
  );
}
