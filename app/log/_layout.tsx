import { Stack } from 'expo-router';

/**
 * The logging flow, presented as a modal stack from the root layout.
 *
 * Keeping it outside `(tabs)` means the flow can be opened from any tab and
 * dismissed back to wherever it started.
 */
export default function LogLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="search" options={{ title: 'Add food' }} />
      <Stack.Screen name="portion" options={{ title: 'Portion' }} />
    </Stack>
  );
}
