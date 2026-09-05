# Onboarding UI wizard — implementation plan (UI only)

Status: planning only, nothing implemented yet.

Scope for this plan: **UI shell + input collection only.** No schema,
migration, repository, or `createProfile` wiring. No BMI/results/loading
screens, no notification-scheduling logic. The wizard's only output is a
plain JS object handed to one callback — what happens to that object
(saving it) is explicitly out of scope, per your instruction.

## 1. Shape of the thing

One route, `app/(onboarding)/index.tsx` (already exists, gets rewritten —
not split into multiple expo-router screens, since you asked for "a screen
that contains around 9 mini screens"). It owns:

- `stepIndex` — which of the 9 mini-screens is showing
- `draft` — the answers collected so far
- renders, in this fixed frame, for every step:

```
┌─────────────────────────────┐
│  ←        ▓▓▓▓▓░░░░ 5/9│  ← progress bar (top)
│                              │
│      "What's your sex?"      │  ← question + input (middle,
│      [ Female ] [ Male ] …   │     scrollable if content is tall)
│                              │
├─────────────────────────────┤
│        [   Continue   ]      │  ← footer, fixed
└─────────────────────────────┘
```

A shared `StepScreen` wrapper (new, tiny) renders that frame; each of the 9
steps is just a question string + one input component dropped into the
middle.

## 2. The 9 steps → the 9 fields

Mapped straight from the UC-05 main flow, dropping the steps that aren't
user input (notification permission's *result* is input, the loading/BMR/
results/confirm steps are not — those are a different, already-flagged
piece of work):

| # | Step | Input widget | Field it fills |
|---|---|---|---|
| 1 | Sex | `ChipRow` (existing pattern) | `gender` |
| 2 | Birth year | wheel picker (new — see §3) | `birthYear` |
| 3 | Notification permission | copy + Enable/Skip buttons | `notificationsEnabled` |
| 4 | Units | `ChipRow`, 2 options | `unitSystem` |
| 5 | Height | wheel picker, cm or ft/in per step 4 | `height` (stored cm) |
| 6 | Current weight | wheel picker, kg or lb per step 4 | `weightCurrent` (stored kg) |
| 7 | Activity level | radio list (existing pattern) | `activityLevel` |
| 8 | Goal: Lose / Maintain / Gain | `ChipRow` + goal-weight wheel (hidden if Maintain) | `goalDirection`, `weightGoal` |
| 9 | Rate | `ChipRow` (existing pattern), **skipped entirely if step 8 = Maintain** | `weeklyRateKg` |

Final object, available in one place when step 9's Continue is pressed:

```ts
interface OnboardingDraft {
  gender: Gender;
  birthYear: number;
  notificationsEnabled: boolean;
  unitSystem: UnitSystem;
  height: number;          // always stored in cm
  weightCurrent: number;   // always stored in kg
  activityLevel: ActivityLevel;
  goalDirection: 'lose' | 'maintain' | 'gain';
  weightGoal: number;      // = weightCurrent when goalDirection is 'maintain'
  weeklyRateKg: number;    // 0 when goalDirection is 'maintain'
}
```

`gender`/`activityLevel`/`unitSystem` types are the existing ones from
`@/types/models` — nothing new there. `dietType` isn't part of this flow (the
UC's 9 steps don't ask for it), so it's simply absent from this object; if
diet type is still wanted before saving, that's a 10th step for a separate
ask.

The wizard takes one prop: `onComplete: (draft: OnboardingDraft) => void`.
The rewritten `index.tsx` for now passes a stub (e.g. logs it) instead of
calling `createProfile` — wiring that back up is the "database saving part"
you said you'd look at later.

## 3. The wheel picker — no library installed, two ways to get one

Use this library to implement: https://github.com/quidone/react-native-wheel-picker
- Look up the internet and learn how to use it properly.

Everything else (sex, units, activity, goal direction, rate) reuses the
existing `ChipRow`/radio-list patterns already in `BodyStatsForm.tsx` —
exported instead of duplicated, not rebuilt.

## 4. Height/weight unit conversion for steps 5–6

`units.weightFromKg`/`weightToKg` (kg↔lb) already exist in
`src/features/settings/store.ts` — step 6 reuses them as-is.

Height has no existing conversion. Rather than adding a new
`heightFromCm`/`heightToCm` pair to the settings store (a different layer,
and nothing else needs it yet), this plan adds one small private
cm↔ft/in pure function colocated in `HeightStep.tsx` — used only there,
nothing to export. If a settings-screen unit toggle later needs the same
conversion, promoting it to the shared store is a one-line move at that
point, not a redesign.

## 5. New files

```
src/components/onboarding/
  StepScreen.tsx        — progress bar + question/body/footer frame
  WheelPicker.tsx        — the react-native-wheel-picker based scroll wheel
  steps/
    GenderStep.tsx
    BirthYearStep.tsx
    NotificationsStep.tsx
    UnitSystemStep.tsx
    HeightStep.tsx
    WeightStep.tsx
    ActivityLevelStep.tsx
    GoalStep.tsx
    RateStep.tsx
src/components/ui/ProgressBar.tsx   — linear bar; ProgressRing is circular,
                                       doesn't fit a top progress bar
```

`app/(onboarding)/index.tsx` is rewritten to hold `stepIndex`/`draft` state
and render `StepScreen` + the step at `stepIndex` from an array, skipping
the rate step when direction is Maintain.

Nothing is added to `src/db/`, `src/data/`, or `src/features/profile/` —
this task doesn't touch them.

## 6. Sequencing

Same "one layer per turn" rule this repo already asks for — proposed order,
each its own turn once you say go:

1. `WheelPicker` + `ProgressBar` (the two genuinely new primitives)
2. `StepScreen` wrapper
3. The 9 step components (straightforward once 1–2 exist; reuse existing
   `ChipRow`/radio patterns for the non-wheel ones)
4. Wizard container rewiring `index.tsx`, wiring steps together with the
   skip-rate-on-Maintain rule and the `onComplete(draft)` stub

## 7. Things to note:
1. At step 3, after user tapped the Enable notification. Run the `Notifications.requestPermissionsAsync()` so that the app can start send the notification later down the line.
2. A back button only (with no step) is located at the top left beside the progress bar to allow the user to return to the previous step and re/edit their value.
3. The result of this feature is a completed object for later feats down the line. DO NOT coding further than this.