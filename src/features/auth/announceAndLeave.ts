import { router } from 'expo-router';
import { Alert } from 'react-native';

import { useProfileStore } from '@/features/profile/store';
import { haptics } from '@/lib/haptics';

/**
 * Confirms a successful auth, then leaves the auth screen: back to where it was
 * opened from, or on into setup when no local profile could be restored.
 */
export function announceAndLeave(
  title: string,
  message: string,
  doneLabel: string,
  needsSetupMessage: string,
): void {
  haptics.success();
  const needsSetup = useProfileStore.getState().profile === null;

  Alert.alert(title, needsSetup ? needsSetupMessage : message, [
    {
      text: doneLabel,
      onPress: () => {
        if (useProfileStore.getState().profile === null) router.dismissTo('/setup');
        else if (router.canGoBack()) router.back();
        else router.replace('/(tabs)');
      },
    },
  ]);
}
