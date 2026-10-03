import { router } from 'expo-router';
import { Alert } from 'react-native';

import { haptics } from '@/lib/haptics';

/** Confirms a successful auth, then returns to wherever the auth screen was opened from. */
export function announceAndLeave(title: string, message: string, doneLabel: string): void {
  haptics.success();
  Alert.alert(title, message, [
    {
      text: doneLabel,
      onPress: () => {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      },
    },
  ]);
}
