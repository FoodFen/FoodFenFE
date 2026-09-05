import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

/**
 * First run.
 *
 * The only thing standing between installing the app and using it. There is no
 * sign-in step and no server call: everything collected here stays on the
 * device, and an account is offered later from Profile for anyone who wants
 * their diary on a second device.
 */
export default function OnboardingScreen() {
  return (
    <OnboardingWizard
      onComplete={() => {
        // Saving the draft (createProfile) is a separate piece of work — this
        // is deliberately a stub. Not logging `draft` itself: it's body
        // metrics, and those never go to the console.
      }}
    />
  );
}
