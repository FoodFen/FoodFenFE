import { Stack } from 'expo-router';

/**
 * The Premium purchase flow, presented as a modal stack from the root layout.
 *
 * Both screens draw their own header (see `ScreenHeader` / the close button
 * over the hero image) rather than the native one, matching `app/log/_layout.tsx`.
 */
export default function PremiumLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="payment" />
    </Stack>
  );
}
