import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback, hardened for the places it is called from.
 *
 * Every call is fire-and-forget: a failed haptic must never reject into a
 * button's onPress handler. Android without a vibrator, and the simulator,
 * both throw.
 */

const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

function safely(run: () => Promise<void>): void {
  if (!isSupported) return;

  void run().catch(() => {
    // No vibrator, or the user disabled system haptics.
  });
}

export const haptics = {
  /** A row tap, a segment change. */
  selection: () => safely(() => Haptics.selectionAsync()),

  /** Confirming an action — logging a food, saving a goal. */
  success: () =>
    safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  warning: () =>
    safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),

  error: () =>
    safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),

  /** A deliberate, weightier action such as deleting an entry. */
  impact: (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) =>
    safely(() => Haptics.impactAsync(style)),
};
