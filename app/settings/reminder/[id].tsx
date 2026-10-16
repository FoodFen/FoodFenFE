import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { TimePicker } from '@/components/ui/TimePicker';
import { requestNotificationPermission } from '@/features/notifications/permission';
import { MEAL_COPY_KEYS, reconcileNotifications } from '@/features/notifications/reconcile';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import { useTranslation } from '@/hooks/useTranslation';
import { haptics } from '@/lib/haptics';
import { DEFAULT_MEAL_TIMES } from '@/lib/notificationScheduler';
import type { TimeOfDay } from '@/lib/notificationScheduler';

const NEW_REMINDER_TIME: TimeOfDay = { hour: 9, minute: 0 };

/** Creates (`id === 'new'`) or edits one reminder. Only custom reminders can be deleted. */
export default function ReminderEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();

  const userId = useProfileStore((state) => state.profile?.id);
  const existing = useSettingsStore((state) => state.reminders.find((r) => r.id === id));
  const addReminder = useSettingsStore((state) => state.addReminder);
  const updateReminder = useSettingsStore((state) => state.updateReminder);
  const removeReminder = useSettingsStore((state) => state.removeReminder);

  const isNew = id === 'new';
  const meal = existing?.kind === 'meal' ? existing : null;

  const [time, setTime] = useState<TimeOfDay | null>(
    existing ? existing.time : NEW_REMINDER_TIME,
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [titleError, setTitleError] = useState(false);

  if (!isNew && !existing) return null;

  const pickerTime = time ?? (meal ? DEFAULT_MEAL_TIMES[meal.meal] : NEW_REMINDER_TIME);

  const reconcile = () => {
    if (userId) void reconcileNotifications(userId);
  };

  const save = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (meal) {
      updateReminder(meal.id, {
        time,
        title: trimmedTitle || null,
        body: trimmedBody || null,
      });
    } else if (!trimmedTitle || !time) {
      setTitleError(true);
      return;
    } else if (existing) {
      updateReminder(existing.id, { time, title: trimmedTitle, body: trimmedBody });
    } else {
      const granted = await requestNotificationPermission();

      addReminder({ enabled: granted, time, title: trimmedTitle, body: trimmedBody });

      if (!granted) {
        Alert.alert(t('notifications', 'addReminder'), t('notifications', 'permissionDenied'));
      }
    }

    reconcile();
    haptics.success();
    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;

    Alert.alert(
      t('notifications', 'deleteReminder'),
      t('notifications', 'deleteReminderMessage'),
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('common', 'delete'),
          style: 'destructive',
          onPress: () => {
            removeReminder(existing.id);
            reconcile();
            router.back();
          },
        },
      ],
    );
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <Stack.Screen
        options={{ title: t('notifications', isNew ? 'addReminder' : 'editReminder') }}
      />

      <View className="gap-2">
        <Text variant="label" tone="muted">
          {t('notifications', 'timeLabel')}
        </Text>
        {meal && !time ? (
          <Text variant="caption" tone="subtle">
            {t('notifications', 'automaticTimeHint')}
          </Text>
        ) : null}
        <TimePicker
          value={{ hours: pickerTime.hour, minutes: pickerTime.minute }}
          onChange={({ hours, minutes }) => setTime({ hour: hours, minute: minutes })}
        />
        {meal && time ? (
          <Button
            label={t('notifications', 'resetToAutomatic')}
            variant="ghost"
            onPress={() => setTime(null)}
          />
        ) : null}
      </View>

      <Input
        label={t('notifications', 'titleLabel')}
        value={title}
        onChangeText={(value) => {
          setTitle(value);
          setTitleError(false);
        }}
        placeholder={meal ? t('notifications', MEAL_COPY_KEYS[meal.meal].titleKey) : undefined}
        error={titleError ? t('notifications', 'titleRequired') : undefined}
      />

      <Input
        label={t('notifications', 'bodyLabel')}
        value={body}
        onChangeText={setBody}
        placeholder={meal ? t('notifications', MEAL_COPY_KEYS[meal.meal].bodyKey) : undefined}
      />

      <Button label={t('common', 'save')} onPress={() => void save()} fullWidth size="lg" />

      {existing?.kind === 'custom' ? (
        <Button
          label={t('notifications', 'deleteReminder')}
          variant="danger"
          onPress={confirmDelete}
          fullWidth
        />
      ) : null}
    </KeyboardAwareScrollView>
  );
}
