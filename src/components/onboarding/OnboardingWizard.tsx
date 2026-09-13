import { useState } from 'react';

import { ActivityLevelStep } from '@/components/onboarding/steps/ActivityLevelStep';
import { BirthYearStep } from '@/components/onboarding/steps/BirthYearStep';
import { FinalizeStep } from '@/components/onboarding/steps/FinalizeStep';
import { GenderStep } from '@/components/onboarding/steps/GenderStep';
import { HeightStep } from '@/components/onboarding/steps/HeightStep';
import { NotificationsStep } from '@/components/onboarding/steps/NotificationsStep';
import { RateStep } from '@/components/onboarding/steps/RateStep';
import { TargetWeightStep } from '@/components/onboarding/steps/TargetWeightStep';
import { UnitSystemStep } from '@/components/onboarding/steps/UnitSystemStep';
import { WeightStep } from '@/components/onboarding/steps/WeightStep';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { DEFAULT_WEEKLY_RATE_KG, goalDirection } from '@/lib/nutrition';
import type { ActivityLevel, Gender, UnitSystem } from '@/types/models';

export interface OnboardingDraft {
  gender: Gender;
  birthYear: number;
  notificationsEnabled: boolean;
  unitSystem: UnitSystem;
  /** Always in cm. */
  height: number;
  /** Always in kg. */
  weightCurrent: number;
  activityLevel: ActivityLevel;
  /**
   * Always in kg. `src/lib/nutrition.ts#goalDirection` derives lose/maintain/
   * gain from comparing this to `weightCurrent` rather than storing a
   * separate choice that could disagree with it.
   */
  weightGoal: number;
  /** 0 when the derived direction is `maintain`. */
  weeklyRateKg: number;
}

const DEFAULT_DRAFT: OnboardingDraft = {
  gender: 'female',
  birthYear: new Date().getFullYear() - 28,
  notificationsEnabled: false,
  unitSystem: 'metric',
  height: 165,
  weightCurrent: 65,
  activityLevel: 'moderate',
  weightGoal: 65,
  weeklyRateKg: DEFAULT_WEEKLY_RATE_KG,
};

const ALL_STEP_KEYS = [
  'gender',
  'birthYear',
  'notifications',
  'unitSystem',
  'height',
  'weight',
  'activityLevel',
  'goal',
  'rate',
  'finalize',
] as const;

// A single-choice step advances itself the moment an option is tapped — a
// separate Continue below it would just be a second tap for the same choice.
// `finalize` also renders its own button rather than the generic footer.
const TAP_ADVANCE_STEPS = new Set<(typeof ALL_STEP_KEYS)[number]>([
  'gender',
  'notifications',
  'unitSystem',
  'activityLevel',
  'finalize',
]);

type StepKey = (typeof ALL_STEP_KEYS)[number];

/** The pace step only means something once there's a gap to close. */
function routeFor(target: OnboardingDraft): StepKey[] {
  return ALL_STEP_KEYS.filter((key) => key !== 'rate' || goalDirection(target) !== 'maintain');
}

export interface OnboardingWizardProps {
  onComplete: (draft: OnboardingDraft) => void;
}

/**
 * The 9-step body-stats wizard.
 *
 * One route holds every step rather than one expo-router screen per step, so
 * `stepIndex` and `draft` can live in one place instead of being threaded
 * through navigation params.
 */
export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [draft, setDraft] = useState<OnboardingDraft>(DEFAULT_DRAFT);
  // The route (which steps exist, and how many) is its own state rather than
  // a value derived fresh from `draft` on every render. Deriving it live
  // would make `rate` pop in and out of the array on every drag of the
  // target-weight wheel — and since the same `stepIndex` then means a
  // different step depending on whether that render's array happens to
  // include it, the wrong screen (`finalize`, one past `rate`) would flash
  // before the array settled back to the right shape. Recomputing only here,
  // at the moment a step is actually left, avoids that entirely.
  const [steps, setSteps] = useState<StepKey[]>(() => routeFor(DEFAULT_DRAFT));
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const currentStep = steps[stepIndex] ?? ALL_STEP_KEYS[0];

  function update<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function goBack() {
    setDirection('backward');
    setStepIndex((index) => Math.max(0, index - 1));
  }

  function goNext() {
    const nextSteps = routeFor(draft);
    setSteps(nextSteps);

    if (stepIndex === nextSteps.length - 1) {
      onComplete(draft);
      return;
    }

    setDirection('forward');
    setStepIndex((index) => index + 1);
  }

  return (
    <StepScreen
      stepIndex={stepIndex}
      totalSteps={steps.length}
      stepKey={currentStep}
      direction={direction}
      onBack={stepIndex > 0 ? goBack : undefined}
      onContinue={goNext}
      showContinue={!TAP_ADVANCE_STEPS.has(currentStep)}
      showHeader={currentStep !== 'finalize'}
      centerContent={currentStep === 'finalize'}
    >
      {currentStep === 'gender' && (
        <GenderStep
          value={draft.gender}
          onChange={(value) => {
            update('gender', value);
            goNext();
          }}
        />
      )}
      {currentStep === 'birthYear' && (
        <BirthYearStep
          value={draft.birthYear}
          onChange={(value) => update('birthYear', value)}
        />
      )}
      {currentStep === 'notifications' && (
        <NotificationsStep
          onChange={(value) => update('notificationsEnabled', value)}
          onDone={goNext}
        />
      )}
      {currentStep === 'unitSystem' && (
        <UnitSystemStep
          value={draft.unitSystem}
          onChange={(value) => {
            update('unitSystem', value);
            goNext();
          }}
        />
      )}
      {currentStep === 'height' && (
        <HeightStep
          unitSystem={draft.unitSystem}
          value={draft.height}
          onChange={(value) => update('height', value)}
        />
      )}
      {currentStep === 'weight' && (
        <WeightStep
          unitSystem={draft.unitSystem}
          value={draft.weightCurrent}
          onChange={(value) => {
            setDraft((previous) => ({
              ...previous,
              weightCurrent: value,
              // Keeps the target following current weight — i.e. "maintain"
              // — until the user sets their own target on the next step.
              weightGoal: previous.weightGoal === previous.weightCurrent
                ? value
                : previous.weightGoal,
            }));
          }}
        />
      )}
      {currentStep === 'activityLevel' && (
        <ActivityLevelStep
          value={draft.activityLevel}
          onChange={(value) => {
            update('activityLevel', value);
            goNext();
          }}
        />
      )}
      {currentStep === 'goal' && (
        <TargetWeightStep
          unitSystem={draft.unitSystem}
          value={draft.weightGoal}
          onChange={(value) => update('weightGoal', value)}
        />
      )}
      {currentStep === 'rate' && (
        <RateStep
          unitSystem={draft.unitSystem}
          value={draft.weeklyRateKg}
          onChange={(value) => update('weeklyRateKg', value)}
          weightCurrent={draft.weightCurrent}
          weightGoal={draft.weightGoal}
        />
      )}
      {currentStep === 'finalize' && <FinalizeStep draft={draft} onDone={goNext} />}
    </StepScreen>
  );
}
