/**
 * Dashboard values that have no home in the schema yet.
 *
 * Each of these stands in for something the data model does not track. They
 * live together so the gaps are easy to find and remove once real sources
 * exist.
 */

/**
 * Daily active-energy goal shown on the "Calories burned" section. There is no
 * per-user burn goal in the data model, so this is a fixed placeholder until
 * one exists — or Health integration supplies a real figure.
 */
export const DASHBOARD_BURN_GOAL_KCAL = 260;

/**
 * Daily step target for the steps row's progress ring. Deliberately not the
 * popular "10,000 steps" figure — that traces to a 1965 Japanese pedometer
 * marketing name (manpo-kei, "10,000-step meter"), not a study. Later
 * epidemiological work (Lee et al., JAMA Intern Med 2019; Paluch et al.,
 * Lancet Public Health 2022) found mortality-risk benefit already levelling
 * off around 7,000-9,000 steps/day for many adult cohorts. There is no
 * per-user step goal in the data model, so this is a fixed figure until one
 * exists — same placeholder status as DASHBOARD_BURN_GOAL_KCAL above.
 */
export const DASHBOARD_STEP_GOAL = 8000;

/** Millilitres one glass represents in the water section's glass row. */
export const GLASS_ML = 250;
