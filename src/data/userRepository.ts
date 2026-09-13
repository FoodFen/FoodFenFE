import { and, asc, desc, eq, lte } from 'drizzle-orm';

import { db } from '@/db/client';
import { dailyGoal, user } from '@/db/schema';
import type { DateKey } from '@/lib/date';
import { todayKey } from '@/lib/date';
import { generateLocalId } from '@/lib/id';
import { calculateTargets } from '@/lib/nutrition';
import type { DailyGoal, UserProfile } from '@/types/models';

import { notDeleted, touch } from './sync';

/**
 * The user row and their goal history.
 *
 * One local user, created by onboarding, existing whether or not an account
 * ever gets attached. Goals are append-only: changing a target writes a new
 * `daily_goal` row rather than editing the old one, so a past day still shows
 * what was being aimed for at the time.
 */

/** There is exactly one local user; onboarding creates it. */
export function getLocalUser(): UserProfile | undefined {
  return db.select().from(user).where(notDeleted(user)).limit(1).all()[0];
}

export interface CreateUserInput {
  gender: UserProfile['gender'];
  birthYear: number;
  height: number;
  weightCurrent: number;
  weightGoal: number;
  activityLevel: UserProfile['activityLevel'];
  dietType: UserProfile['dietType'];
  weeklyRateKg: number;
  unitSystem?: UserProfile['unitSystem'];
  displayName?: string;
}

/**
 * Create the local profile and its opening goal in one transaction.
 *
 * The two belong together: a user with no goal has nothing to measure a day
 * against, and every diary read would have to handle that hole.
 */
export function createLocalUser(input: CreateUserInput): {
  user: UserProfile;
  goal: DailyGoal;
} {
  const now = new Date();

  const row = {
    id: generateLocalId('user'),
    email: null,
    displayName: input.displayName ?? null,
    gender: input.gender,
    birthYear: input.birthYear,
    unitSystem: input.unitSystem ?? ('metric' as const),
    height: input.height,
    weightCurrent: input.weightCurrent,
    weightGoal: input.weightGoal,
    activityLevel: input.activityLevel,
    dietType: input.dietType,
    calorieCalcMode: 'auto' as const,
    subscriptionTier: 'free' as const,
    weeklyRateKg: input.weeklyRateKg,
    createdAt: now,
    remoteId: null,
    deletedAt: null,
    ...touch(now),
  };

  // One transaction: a crash between the two writes must not leave a profile
  // with no goal to measure a day against.
  return db.transaction(() => {
    db.insert(user).values(row).run();

    const goal = writeCalculatedGoal(row, todayKey(), now);

    return { user: row, goal };
  });
}

export function updateLocalUser(
  id: string,
  patch: Partial<Omit<UserProfile, 'id' | 'createdAt'>>,
): UserProfile {
  db.update(user)
    .set({ ...patch, ...touch() })
    .where(eq(user.id, id))
    .run();

  const updated = getLocalUser();

  if (!updated) throw new Error(`User ${id} disappeared during update.`);

  return updated;
}

/**
 * The goal in force on a given day: the newest row effective on or before it.
 *
 * Falls back to the earliest goal for dates *before* any goal existed. That
 * case is ordinary, not exceptional: onboarding writes the first goal effective
 * today, so scrolling back to yesterday on day one — or back-filling a meal
 * from last week — asks about a day the user had no target for. Answering with
 * their first target is the only useful answer, and far better than leaving
 * the diary unable to render the day at all.
 *
 * Returns undefined only when the user has no goals whatsoever, which cannot
 * happen after onboarding.
 */
export function getGoalForDate(
  userId: string,
  date: DateKey = todayKey(),
): DailyGoal | undefined {
  const inForce = db
    .select()
    .from(dailyGoal)
    .where(
      and(
        eq(dailyGoal.userId, userId),
        lte(dailyGoal.effectiveDate, date),
        notDeleted(dailyGoal),
      ),
    )
    .orderBy(desc(dailyGoal.effectiveDate))
    .limit(1)
    .all()[0];

  if (inForce) return inForce;

  return db
    .select()
    .from(dailyGoal)
    .where(and(eq(dailyGoal.userId, userId), notDeleted(dailyGoal)))
    .orderBy(asc(dailyGoal.effectiveDate))
    .limit(1)
    .all()[0];
}

export interface GoalTargets {
  targetKcal: number;
  targetCarbsG: number;
  targetProteinG: number;
  targetFatG: number;
  targetWaterMl: number;
}

/**
 * Set the targets that take effect on `effectiveDate`.
 *
 * Replaces the row for that exact date if one already exists — editing today's
 * goal twice should leave one row for today, not two — and otherwise appends,
 * leaving earlier days untouched.
 */
export function setGoal(
  userId: string,
  targets: GoalTargets,
  effectiveDate: DateKey = todayKey(),
): DailyGoal {
  const existing = db
    .select()
    .from(dailyGoal)
    .where(
      and(
        eq(dailyGoal.userId, userId),
        eq(dailyGoal.effectiveDate, effectiveDate),
        notDeleted(dailyGoal),
      ),
    )
    .limit(1)
    .all()[0];

  if (existing) {
    const updated = { ...existing, ...targets, ...touch() };

    db.update(dailyGoal).set(updated).where(eq(dailyGoal.id, existing.id)).run();

    return updated;
  }

  const row: DailyGoal = {
    id: generateLocalId('goal'),
    userId,
    ...targets,
    effectiveDate,
    remoteId: null,
    deletedAt: null,
    ...touch(),
  };

  db.insert(dailyGoal).values(row).run();

  return row;
}

/** Recompute targets from the profile and store them. Only for `auto` mode. */
export function writeCalculatedGoal(
  profile: Parameters<typeof calculateTargets>[0] & { id: string },
  effectiveDate: DateKey = todayKey(),
  now: Date = new Date(),
): DailyGoal {
  return setGoal(profile.id, calculateTargets(profile, now), effectiveDate);
}

/**
 * Keep goals consistent after a profile edit.
 *
 * An `auto` user's targets are a function of their body stats, so changing
 * those has to rewrite today's goal or the diary would keep measuring against
 * the old number. A `manual` user typed their targets deliberately and they
 * are left exactly as they are.
 */
export function refreshGoalIfAuto(profile: UserProfile): DailyGoal | undefined {
  if (profile.calorieCalcMode !== 'auto') return undefined;

  return writeCalculatedGoal(profile);
}

export function isPremium(profile: UserProfile | undefined): boolean {
  return profile?.subscriptionTier === 'premium';
}
