import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, Switch, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScrollScreen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { requestNotificationPermission } from '@/features/notifications/permission';
import { MEAL_COPY_KEYS, reconcileNotifications } from '@/features/notifications/reconcile';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import type { Reminder } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { colorsFor } from '@/theme/colors';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Every reminder, with an on/off switch each. Tapping a row opens its editor;
 * the editor is also where a new reminder is created.
 */
export default function RemindersScreen() {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { t } = useTranslation();

  const userId = useProfileStore((state) => state.profile?.id);
  const reminders = useSettingsStore((state) => state.reminders);
  const setReminderEnabled = useSettingsStore((state) => state.setReminderEnabled);

  const toggle = async (reminder: Reminder, value: boolean) => {
    if (value && !(await requestNotificationPermission())) {
      Alert.alert(t('notifications', 'manageReminders'), t('notifications', 'permissionDenied'));
      return;
    }

    setReminderEnabled(reminder.id, value);
    if (userId) void reconcileNotifications(userId);
  };

  return (
    <ScrollScreen>
      <Card flush>
        {reminders.map((reminder, index) => (
          <View
            key={reminder.id}
            className={cn('flex-row items-center', index > 0 && 'border-t border-border')}
          >
            <Pressable
              onPress={() => router.push(`/settings/reminder/${reminder.id}`)}
              accessibilityRole="button"
              className="flex-1 gap-0.5 px-4 py-3 active:bg-surface-alt"
            >
              <Text variant="heading">
                {reminder.time
                  ? `${pad(reminder.time.hour)}:${pad(reminder.time.minute)}`
                  : t('notifications', 'automaticTime')}
              </Text>
              <Text variant="body" tone="muted" numberOfLines={1}>
                {reminder.title ??
                  (reminder.kind === 'meal'
                    ? t('notifications', MEAL_COPY_KEYS[reminder.meal].titleKey)
                    : '')}
              </Text>
            </Pressable>

            <View className="pr-4">
              <Switch
                value={reminder.enabled}
                onValueChange={(value) => void toggle(reminder, value)}
                trackColor={{ false: colors.border, true: colors.brand }}
                accessibilityLabel={reminder.title ?? undefined}
              />
            </View>
          </View>
        ))}
      </Card>

      <Button
        label={t('notifications', 'addReminder')}
        onPress={() => router.push('/settings/reminder/new')}
        leading={<Ionicons name="add" size={18} color={colors.onBrand} />}
        fullWidth
      />
    </ScrollScreen>
  );
}
