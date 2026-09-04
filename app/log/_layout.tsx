import { Stack } from 'expo-router';

/**
 * The logging flow, presented as a modal stack from the root layout.
 *
 * Outside `(tabs)` so it can be opened from any tab and dismissed back to
 * wherever it started.
 */
export default function LogLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="meal" options={{ title: 'Log a meal' }} />
      <Stack.Screen name="ingredient" options={{ title: 'Add ingredient' }} />
    </Stack>
  );
}
