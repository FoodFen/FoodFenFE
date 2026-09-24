import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { coinTransaction, quest, streak, subscription } from '@/db/schema';
import type { DateKey } from '@/lib/date';
import { calendarWeek, shiftDateKey, todayKey } from '@/lib/date';
import { generateLocalId } from '@/lib/id';
import type {
  CoinReason,
  DiaryDay,
  PlanType,
  Quest,
  QuestCadence,
  QuestType,
  Streak,
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
} from '@/types/models';

import { notDeleted, touch } from './sync';

/** Same as `GLASS_ML` in `src/features/dashboard/constants.ts` — `src/data/`
 * cannot import from `src/features/`, so the figure is mirrored, not shared. */
const WATER_CUP_ML = 250;

/**
 * Streaks, quests, coins and subscription state.
 *
 * The data layer only. Nothing in the UI reads these yet — they are here so
 * the schema is complete and the rules live somewhere testable, rather than
 * being invented later alongside the screens that show them.
 */

export function getStreak(userId: string): Streak | undefined {
  return db
    .select()
    .from(streak)
    .where(and(eq(streak.userId, userId), notDeleted(streak)))
    .limit(1)
    .all()[0];
}

/**
 * Advance the streak for a day the user logged something.
 *
 * Idempotent: logging a second meal on the same day must not count twice, so a
 * date equal to `lastActiveDate` is a no-op. Consecutive days extend the run,
 * and any gap resets it to 1 — the current day still counts, because the user
 * did log today.
 */
export function recordActiveDay(userId: string, date: DateKey = todayKey()): Streak {
  const existing = getStreak(userId);

  if (!existing) {
    const row: Streak = {
      id: generateLocalId('streak'),
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: date,
      remoteId: null,
      deletedAt: null,
      ...touch(),
    };

    db.insert(streak).values(row).run();

    return row;
  }

  if (existing.lastActiveDate === date) return existing;

  const isConsecutive =
    existing.lastActiveDate !== null && shiftDateKey(existing.lastActiveDate, 1) === date;

  const currentStreak = isConsecutive ? existing.currentStreak + 1 : 1;

  const updated: Streak = {
    ...existing,
    currentStreak,
    longestStreak: Math.max(existing.longestStreak, currentStreak),
    lastActiveDate: date,
    ...touch(),
  };

  db.update(streak).set(updated).where(eq(streak.id, existing.id)).run();

  return updated;
}

export interface QuestDefinition {
  questType: QuestType;
  cadence: QuestCadence;
  /**
   * The displayed denominator. For `hit_calorie_goal` this is a placeholder —
   * `ensureDailyQuests` resolves the real figure from that day's goal instead,
   * since the target varies per user and can drift day to day.
   */
  target: number;
  /** Fraction of `target` that counts as complete. `1` = the simple case. */
  completionRatio: number;
  rewardCoins: number;
}

/** The daily quest set. Server-driven once a backend exists. */
export const DAILY_QUESTS: QuestDefinition[] = [
  {
    questType: 'log_all_meals',
    cadence: 'daily',
    target: 3,
    completionRatio: 1,
    rewardCoins: 30,
  },
  // "Reach 90% of your calorie goal" (UC-22) — target is resolved per day below.
  {
    questType: 'hit_calorie_goal',
    cadence: 'daily',
    target: 2000,
    completionRatio: 0.9,
    rewardCoins: 50,
  },
  {
    questType: 'drink_water',
    cadence: 'daily',
    target: 8,
    completionRatio: 1,
    rewardCoins: 20,
  },
];

/** The weekly quest set — issued once per calendar week, not once per day. */
export const WEEKLY_QUESTS: QuestDefinition[] = [
  {
    questType: 'stay_active_week',
    cadence: 'weekly',
    target: 5,
    completionRatio: 1,
    rewardCoins: 40,
  },
];

export function getQuests(userId: string, date: DateKey = todayKey()): Quest[] {
  return db
    .select()
    .from(quest)
    .where(and(eq(quest.userId, userId), eq(quest.questDate, date), notDeleted(quest)))
    .all();
}

function insertQuests(
  userId: string,
  date: DateKey,
  definitions: QuestDefinition[],
  targetFor: (definition: QuestDefinition) => number,
): Quest[] {
  const rows: Quest[] = definitions.map((definition) => ({
    id: generateLocalId('quest'),
    userId,
    questType: definition.questType,
    progress: 0,
    target: targetFor(definition),
    rewardCoins: definition.rewardCoins,
    completed: false,
    cadence: definition.cadence,
    completionRatio: definition.completionRatio,
    questDate: date,
    remoteId: null,
    deletedAt: null,
    ...touch(),
  }));

  db.insert(quest).values(rows).run();

  return rows;
}

/**
 * Issue the day's quests, once. Safe to call on every app open.
 *
 * `hit_calorie_goal`'s target is resolved from `targetKcal` when given (the
 * caller already has the day's goal from `useDiaryDay`) — falling back to the
 * definition's placeholder only if it genuinely isn't available yet.
 */
export function ensureDailyQuests(
  userId: string,
  date: DateKey = todayKey(),
  targetKcal?: number,
): Quest[] {
  const existing = getQuests(userId, date).filter((row) => row.cadence === 'daily');

  if (existing.length > 0) return existing;

  return insertQuests(userId, date, DAILY_QUESTS, (definition) =>
    definition.questType === 'hit_calorie_goal' && targetKcal
      ? targetKcal
      : definition.target,
  );
}

/** Issue this week's quests, once per week rather than once per day. */
export function ensureWeeklyQuests(userId: string, weekStart: DateKey): Quest[] {
  const existing = getQuests(userId, weekStart).filter((row) => row.cadence === 'weekly');

  if (existing.length > 0) return existing;

  return insertQuests(
    userId,
    weekStart,
    WEEKLY_QUESTS,
    (definition) => definition.target,
  );
}

/** Every quest active right now: today's daily set plus this week's weekly set. */
export function getActiveQuests(
  userId: string,
  today: DateKey = todayKey(),
  targetKcal?: number,
): Quest[] {
  const daily = ensureDailyQuests(userId, today, targetKcal);
  const weekStart = calendarWeek(today)[0] ?? today;
  const weekly = ensureWeeklyQuests(userId, weekStart);

  return [...daily, ...weekly];
}

/**
 * Move a quest forward, awarding its coins the first time it completes.
 *
 * The completion check is inside this function rather than the caller's so the
 * reward can only ever be granted once, no matter how often progress is
 * reported.
 */
export function setQuestProgress(
  userId: string,
  questType: QuestType,
  progress: number,
  date: DateKey = todayKey(),
): Quest | undefined {
  const existing = getQuests(userId, date).find((row) => row.questType === questType);

  if (!existing || existing.completed) return existing;

  // Not always `progress >= target` — a quest's own `completionRatio` (e.g. 0.9
  // for "reach 90% of your calorie goal") decides how much of `target` counts.
  const completed = progress / existing.target >= existing.completionRatio;

  const updated: Quest = {
    ...existing,
    progress: Math.min(progress, existing.target),
    completed,
    ...touch(),
  };

  db.update(quest).set(updated).where(eq(quest.id, existing.id)).run();

  if (completed) {
    addCoins(userId, existing.rewardCoins, 'quest_completed');
  }

  return updated;
}

/**
 * Recompute every active quest's live progress and persist it — the "each bar
 * reads live from UC-11's aggregation"/"reads from STREAK" mapping in UC-22.
 *
 * Called right after a log completes (food, activity or water — UC-22's
 * trigger list), so the post-log interstitial and the challenges screen never
 * show stale numbers. Returns the updated rows so a caller doesn't need a
 * second read to display them immediately.
 */
export function evaluateQuestProgress(userId: string, day: DiaryDay): Quest[] {
  const active = getActiveQuests(userId, day.date, day.goal.targetKcal);

  return active
    .map((row) =>
      setQuestProgress(
        userId,
        row.questType,
        liveProgress(row, userId, day),
        row.questDate,
      ),
    )
    .filter((row): row is Quest => row !== undefined);
}

function liveProgress(row: Quest, userId: string, day: DiaryDay): number {
  switch (row.questType) {
    case 'log_all_meals':
      return day.entries.length;
    case 'hit_calorie_goal':
      return day.totals.kcal;
    case 'drink_water':
      return Math.floor(day.waterMl / WATER_CUP_ML);
    case 'stay_active_week':
      return getStreak(userId)?.currentStreak ?? 0;
    default:
      // log_breakfast / hit_protein_goal / log_weight — defined in the
      // schema, not in DAILY_QUESTS/WEEKLY_QUESTS, so never issued or
      // evaluated by this pass. Leave whatever progress they already have.
      return row.progress;
  }
}

export function addCoins(userId: string, amount: number, reason: CoinReason): void {
  db.insert(coinTransaction)
    .values({
      id: generateLocalId('coin'),
      userId,
      amount,
      reason,
      createdAt: new Date(),
      remoteId: null,
      deletedAt: null,
      ...touch(),
    })
    .run();
}

/** The balance is the sum of the ledger, never a stored figure. */
export function getCoinBalance(userId: string): number {
  const [row] = db
    .select({ balance: sql<number>`coalesce(sum(${coinTransaction.amount}), 0)` })
    .from(coinTransaction)
    .where(and(eq(coinTransaction.userId, userId), notDeleted(coinTransaction)))
    .all();

  return row?.balance ?? 0;
}

export function getSubscription(userId: string): Subscription | undefined {
  return db
    .select()
    .from(subscription)
    .where(and(eq(subscription.userId, userId), notDeleted(subscription)))
    .orderBy(desc(subscription.startDate))
    .limit(1)
    .all()[0];
}

/**
 * Which tier the user is on right now.
 *
 * Derived from the subscription row rather than trusted from `user.subscription_tier`
 * alone, so an expired subscription downgrades on its own without needing a
 * job to rewrite the user row.
 */
export function resolveTier(
  userId: string,
  today: DateKey = todayKey(),
): SubscriptionTier {
  const current = getSubscription(userId);

  if (!current) return 'free';
  if (current.status !== 'active' && current.status !== 'trial') return 'free';
  if (current.endDate !== null && current.endDate < today) return 'free';

  return 'premium';
}

export interface StartSubscriptionInput {
  planType: PlanType;
  status: SubscriptionStatus;
  startDate: DateKey;
  endDate: DateKey | null;
  price: number;
}

/**
 * Records a purchase, renewal, or plan change as a new row rather than an
 * update — `getSubscription` already picks the most recent by `startDate`,
 * so an older row never needs to be touched, just outranked.
 */
export function startSubscription(userId: string, input: StartSubscriptionInput): void {
  db.insert(subscription)
    .values({
      id: generateLocalId('subscription'),
      userId,
      planType: input.planType,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      price: input.price,
      remoteId: null,
      deletedAt: null,
      ...touch(),
    })
    .run();
}
