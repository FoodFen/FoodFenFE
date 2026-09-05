import { useState } from 'react';

import { ActivityLevelStep } from '@/components/onboarding/steps/ActivityLevelStep';
import { BirthYearStep } from '@/components/onboarding/steps/BirthYearStep';
import { GenderStep } from '@/components/onboarding/steps/GenderStep';
import { GoalStep } from '@/components/onboarding/steps/GoalStep';
import { HeightStep } from '@/components/onboarding/steps/HeightStep';
import { NotificationsStep } from '@/components/onboarding/steps/NotificationsStep';
import { RateStep } from '@/components/onboarding/steps/RateStep';
import { UnitSystemStep } from '@/components/onboarding/steps/UnitSystemStep';
import { WeightStep } from '@/components/onboarding/steps/WeightStep';
import { StepScreen } from '@/components/onboarding/StepScreen';
import type { GoalDirection } from '@/lib/nutrition';
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
  goalDirection: GoalDirection;
  /** Always in kg. Equal to `weightCurrent` when `goalDirection` is `maintain`. */
  weightGoal: number;
  /** 0 when `goalDirection` is `maintain`. */
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
  goalDirection: 'maintain',
  weightGoal: 65,
  weeklyRateKg: 0,
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
] as const;

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
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // The rate only means something when there's a direction to pursue.
  const steps = ALL_STEP_KEYS.filter(
    (key) => key !== 'rate' || draft.goalDirection !== 'maintain',
  );
  const currentStep = steps[stepIndex] ?? ALL_STEP_KEYS[0];

  function update<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function goBack() {
    setDirection('backward');
    setStepIndex((index) => Math.max(0, index - 1));
  }

  function goNext() {
    if (stepIndex === steps.length - 1) {
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
      showContinue={currentStep !== 'notifications'}
    >
      {currentStep === 'gender' && (
        <GenderStep value={draft.gender} onChange={(value) => update('gender', value)} />
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
          onChange={(value) => update('unitSystem', value)}
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
          onChange={(value) => update('weightCurrent', value)}
        />
      )}
      {currentStep === 'activityLevel' && (
        <ActivityLevelStep
          value={draft.activityLevel}
          onChange={(value) => update('activityLevel', value)}
        />
      )}
      {currentStep === 'goal' && (
        <GoalStep
          unitSystem={draft.unitSystem}
          direction={draft.goalDirection}
          weightGoal={draft.weightGoal}
          onChangeDirection={(direction) => {
            setDraft((previous) => ({
              ...previous,
              goalDirection: direction,
              weightGoal: direction === 'maintain' ? previous.weightCurrent : previous.weightGoal,
            }));
          }}
          onChangeWeightGoal={(value) => update('weightGoal', value)}
        />
      )}
      {currentStep === 'rate' && (
        <RateStep
          value={draft.weeklyRateKg}
          onChange={(value) => update('weeklyRateKg', value)}
          weightCurrent={draft.weightCurrent}
          weightGoal={draft.weightGoal}
        />
      )}
    </StepScreen>
  );
}
