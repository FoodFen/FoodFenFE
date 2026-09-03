import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="goals" options={{ title: 'Goals' }} />
    </Stack>
  );
}
