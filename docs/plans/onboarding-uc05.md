# UC-05 Onboarding — gap analysis & implementation plan

Status: planning only, nothing implemented yet.

## 1. Gap analysis — UC-05 vs current code

Current state: `app/(onboarding)/index.tsx` is a single screen. One
`react-hook-form` bound to `bodyStatsSchema`, rendering `BodyStatsForm`'s 4
grouped cards (about / weight / activity / diet), a live `GoalsPreviewCard`,
and one "Get started" button that calls `createProfile` and lets the root
layout's `Stack.Protected` guard swap to `(tabs)`.

| UC-05 step | Current code | Gap |
|---|---|---|
| 1. Gender | `BodyStatsForm` — `gender` chip row | none |
| 2. Birth year | `BodyStatsForm` — `birthYear` number `Input` | UI is a text field, not a scroll picker (see open question) |
| 3. Notification permission | — | **missing.** `expo-notifications` is installed but `requestPermissionsAsync` is called nowhere in the app |
| 4. Unit system ("What's your units?") | `user.unitSystem` column exists, defaults `'metric'`, `CreateUserInput.unitSystem` is accepted | **missing.** No screen collects it; nothing ever passes it, so it's always `'metric'`. Only weight (kg/lb) and energy (kcal/kJ) conversions exist in `settings/store.ts` — no height (cm/ft-in) or volume (ml/fl oz) conversion, needed to actually *display* imperial |
| 5. Height | `BodyStatsForm` — `height` number `Input` | text field, not a picker |
| 6. Current weight | `BodyStatsForm` — `weightCurrent` number `Input` | text field, not a picker |
| 7. Activity level | `BodyStatsForm` — `activityLevel` radio list | none |
| 8. Weight goal: Lose/Maintain/Gain (separate step) | Direction is *derived*, never asked — `goalDirection()` in `nutrition.ts` compares `weightGoal` vs `weightCurrent`. Today's single "Weight" card asks for a `weightGoal` number and a pace chip row (`weeklyRateKg`), no direction radio | **flow change**, not just a missing screen — see §2 |
| 9. Rate slider (if not Maintain) → compute `weight_goal` + target date | Pace already exists as a **discrete chip row** (0 / 0.25 / 0.5 / 0.75 / 1 kg/wk), not a continuous slider. `weeklyRateKg` is a magnitude input today, not something the app computes. No target-date projection exists anywhere | UC step is itself marked **unverified** in the source doc. Computing `weight_goal` *from* a rate needs a total-change amount or a horizon the UC doesn't specify — underspecified, flagged for you below |
| 10. Maintain → `weight_goal = weight_current` | Not automatic — user must type a matching number today | small logic gap, easy fix |
| 11. "Creating your plan…" loading screen, 0→100% ring | `ProgressRing` component exists (0–1 progress, animated) but is only used on the Today screen | **missing screen**, trivial to build — the calc is synchronous, so this is a deliberately faked delay per the UC ("Confirmed, new") |
| 12. BMR→TDEE→target→macros→`daily_goal` row | `calculateTargets()` in `nutrition.ts` + `createLocalUser()` do exactly this already | none |
| 13. Results: calorie ring, macro breakdown, **BMI gauge**, projected goal date | `GoalsPreviewCard` shows kcal/macros/water as text rows (no ring). `MacroBar` + `ProgressRing` exist and are reusable. **No BMI calculation anywhere in the codebase** (`grep -rn "bmi"` is empty). No goal-date projection exists | **missing**: BMI function + gauge, goal-date projection, richer results screen |
| 14. Confirm → Dashboard | Root layout guard already does this the moment `createProfile` runs | none |
| Business rule: 6 fields mandatory | `bodyStatsSchema` already requires gender, birthYear, height, weightCurrent, activityLevel, weightGoal | none |
| `diet_type` / `calorie_calc_mode` defaults if dropped | `schema.ts` already defaults `dietType: 'balanced'`, `calorieCalcMode: 'auto'` at the column level | none — already correct, and moot if the diet-type step is kept (see §3) |

## 2. Open question — step 8/9's data flow

Today: user types a **goal weight** (kg) directly; direction and the
resulting deficit/surplus are derived from it plus a discrete pace pick.
`weightGoal` is a required, non-null column and `calculateTargets()` takes it
as an input, not an output.

UC-05 step 9 describes the reverse: pick a direction, pick a rate, and the
*system* computes `weight_goal` and a target date. But a rate alone
(kg/week) can't produce a target weight without also knowing either a target
date or a total amount to change — the UC doesn't supply either, and its own
author flagged this exact step as unverified/carried-forward-from-v1.

Two ways to close this, both compatible with the existing schema (no
migration either way):

1. **Keep the number field** (lower risk, smaller diff): the new step 8
   becomes "Lose / Maintain / Gain" purely as framing chips that preselect a
   sign, immediately followed by the existing goal-weight number input (hidden
   entirely when "Maintain" is picked, auto-set to `weightCurrent`). Step 9's
   rate chip row is unchanged. No new formula needed anywhere.
2. **Drop the number field, add a target-date field**: direction + rate +
   a user-supplied target date computes `weight_goal` = `weightCurrent ±
   (rate × weeksUntilDate)`. This is a real new formula in `nutrition.ts` and
   a new "target date" step the UC also doesn't mention — bigger, speculative
   scope for a step the UC itself isn't sure about.

**I'd default to option 1** and flag it rather than build option 2 on spec.
Say so if you actually want option 2.

## 3. Other decisions this plan assumes (flag if wrong)

- **Diet-type step stays.** It's in the current flow, feeds
  `macroSplitFor()`, and the UC's fallback defaults only matter *if* you
  drop it — so keeping it is the no-formula-change, no-behavior-change
  choice.
- **Birth year / height / weight stay as `Input` text fields, not wheel
  pickers.** No picker/wheel dependency exists in `package.json`
  (`@react-native-community/slider`, `@react-native-picker/picker`, etc. are
  all absent). Building a custom scroll-wheel is a real new component;
  reusing the existing `Input` is zero new code and functionally identical.
  Flag this if the wheel-picker look is a hard requirement — it'd be a
  distinct, larger UI task.
- **Rate stays a chip row, not a literal slider.** Same reasoning — no
  slider dependency installed, the discrete rate picker already works and
  matches "turtle↔rabbit" in spirit (slow→fast options), just not a
  draggable control.

## 4. Implementation plan (once approved)

Ordered as separate layers per this repo's scope rule — each row below is
its own turn/PR, not one big change:

1. **`src/lib/nutrition.ts`** — add `bmiFromMetrics(heightCm, weightKg)` and
   a `bmiCategory()` classifier (Underweight <18.5, Healthy 18.5–24.9,
   Overweight 25–29.9, Obese ≥30). Pure functions, unit-tested like the rest
   of the file. No schema change — BMI is computed for display, never
   stored.
2. **`src/features/settings/store.ts`** — add height (cm↔ft/in) and water
   (ml↔fl oz) conversion helpers alongside the existing weight/energy ones,
   so the new unit-system step has something to actually switch.
3. **`src/lib/notifications.ts`** (new, small) — thin wrapper around
   `expo-notifications`'s `requestPermissionsAsync`, mirroring how
   `src/lib/haptics.ts` wraps its native module. Non-blocking: onboarding
   proceeds whether granted or denied.
4. **`src/features/onboarding/store.ts`** (new) — wizard state: current
   step index + accumulated form values, not persisted (killing the app
   mid-onboarding just restarts it, same as today).
5. **Route split** — `app/(onboarding)/` grows from 1 screen to the UC's
   sequence (gender+birth-year, notifications, units, height, weight,
   activity, goal-direction+weight, rate, loading, results), each a thin
   screen + a progress indicator, reusing `BodyStatsForm`'s existing
   `Field`/`ChipRow` pieces (exported, not duplicated) and the schema
   unchanged apart from the direction-framing chips from §2.
6. **Results screen** — extend/replace `GoalsPreviewCard`'s usage on this
   path with `ProgressRing` (calorie ring) + `MacroBar` (macro breakdown,
   already built for this exact shape) + a new small BMI gauge (another
   `ProgressRing` instance) + a goal-date line computed from
   `weeklyRateKg`/`goalDirection` (simple arithmetic, no new dependency).
7. **Loading screen** — `ProgressRing` driven by a fixed timed animation
   (the calculation itself is synchronous) between the last input step and
   results.

No changes needed to `src/db/schema.ts`, `drizzle/migrations/`, or
`userRepository.ts` under option 1 from §2 — every field the new flow
collects already has a column and a repository write path.

## 5. Questions for you before implementation starts

1. §2: keep the goal-weight number field (option 1), or actually want the
   rate→target-date→computed-weight-goal flow (option 2, more scope, one
   underspecified formula to invent)?
2. §3: are wheel/scroll pickers for birth year, height, weight a hard
   requirement, or is the existing text-`Input` styling acceptable?
3. §3: same question for the rate control — chip row (existing pattern) vs.
   a real draggable slider (new dependency)?
4. Notification-permission copy in the UC lists four specific reminder
   toggles (meal time, progress, motivational, water) — do you want four
   individual toggles built now, or one permission prompt with that copy as
   static text (toggles are a notifications-scheduling feature that doesn't
   exist yet either)?
