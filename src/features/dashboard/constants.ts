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

/** Millilitres one glass represents in the water section's glass row. */
export const GLASS_ML = 250;
