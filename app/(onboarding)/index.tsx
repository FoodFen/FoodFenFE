import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useProfileStore } from '@/features/profile/store';

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

  return (
    <OnboardingWizard
      onComplete={(draft) => {
        // dietType isn't collected by this wizard; the schema's own default
        // ('balanced') is what a fresh profile gets until a diet-type step
        // exists. `notificationsEnabled` isn't a user-table column — the
        // permission request already happened in NotificationsStep.
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
        // Not logging `draft`: it's body metrics, and those never go to the
        // console per CLAUDE.md.
      }}
    />
  );
}
