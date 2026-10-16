// src/features/notifications/permission.ts
import * as Notifications from 'expo-notifications';

/** True if notifications are already allowed, else asks the OS and reports the answer. */
export async function requestNotificationPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();

  if (granted) return true;

  return (await Notifications.requestPermissionsAsync()).granted;
}
