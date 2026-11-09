import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useProfileStore } from '@/features/profile/store';
import { MEAL_REMINDER_IDS, useSettingsStore } from '@/features/settings/store';
import { useTourStore } from '@/features/tour/store';

/**
 * First-run setup, reached from the welcome screen.
 *
 * There is no sign-in step here and no server call: everything collected stays
 * on the device. Returning users sign in from the welcome screen instead, and
 * an account is offered later from Profile for anyone who wants their diary on
 * a second device.
 */
export default function OnboardingScreen() {
  const createProfile = useProfileStore((state) => state.createProfile);
  const setReminderEnabled = useSettingsStore((state) => state.setReminderEnabled);
  const setStreakRemindersEnabled = useSettingsStore(
    (state) => state.setStreakRemindersEnabled,
  );

  return (
    <OnboardingWizard
      onComplete={(draft) => {
        useTourStore.getState().queue();

        // dietType isn't collected by this wizard; the schema's own default
        // ('balanced') is what a fresh profile gets until a diet-type step
        // exists.
        createProfile({
          gender: draft.gender,
          birthYear: draft.birthYear,
          unitSystem: draft.unitSystem,
          height: draft.height,
          weightCurrent: draft.weightCurrent,
          weightGoal: draft.weightGoal,
          activityLevel: draft.activityLevel,
          dietType: 'balanced',
          weeklyRateKg: draft.weeklyRateKg,
        });

        // NotificationsStep's "Enable" already ran the OS permission
        // request; both reminder categories opt in together on "Enable"
        // and stay off on "Skip". reconcileNotifications runs on its own
        // once the new profile appears (app/_layout.tsx), so no need to
        // call it here.
        MEAL_REMINDER_IDS.forEach((id) => setReminderEnabled(id, draft.notificationsEnabled));
        setStreakRemindersEnabled(draft.notificationsEnabled);
        // Not logging `draft`: it's body metrics, and those never go to the
        // console per CLAUDE.md.
      }}
    />
  );
}
