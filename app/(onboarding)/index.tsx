import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';

/**
 * First run.
 *
 * The only thing standing between installing the app and using it. There is no
 * sign-in step and no server call: everything collected here stays on the
 * device, and an account is offered later from Profile for anyone who wants
 * their diary on a second device.
 */
export default function OnboardingScreen() {
  const createProfile = useProfileStore((state) => state.createProfile);
  const setMealRemindersEnabled = useSettingsStore((state) => state.setMealRemindersEnabled);
  const setStreakRemindersEnabled = useSettingsStore(
    (state) => state.setStreakRemindersEnabled,
  );

  return (
    <OnboardingWizard
      onComplete={(draft) => {
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
        setMealRemindersEnabled(draft.notificationsEnabled);
        setStreakRemindersEnabled(draft.notificationsEnabled);
        // Not logging `draft`: it's body metrics, and those never go to the
        // console per CLAUDE.md.
      }}
    />
  );
}
