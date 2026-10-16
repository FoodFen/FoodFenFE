import { Stack } from 'expo-router';

import { useTranslation } from '@/hooks/useTranslation';

export default function SettingsLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: t('settings', 'title') }} />
      <Stack.Screen name="goals" options={{ title: t('goals', 'layoutTitle') }} />
      <Stack.Screen
        name="ring-colors"
        options={{ title: t('ringColors', 'title') }}
      />
      <Stack.Screen name="smart-mode" options={{ title: t('smartMode', 'title') }} />
      <Stack.Screen
        name="reminders"
        options={{ title: t('notifications', 'manageReminders') }}
      />
      <Stack.Screen
        name="reminder/[id]"
        options={{ title: t('notifications', 'editReminder') }}
      />
    </Stack>
  );
}
