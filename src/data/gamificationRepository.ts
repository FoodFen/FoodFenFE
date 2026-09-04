import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { coinTransaction, quest, streak, subscription } from '@/db/schema';
import type { DateKey } from '@/lib/date';
import { shiftDateKey, todayKey } from '@/lib/date';
import { generateLocalId } from '@/lib/id';
import type {
  CoinReason,
  Quest,
  QuestType,
  Streak,
  Subscription,
  SubscriptionTier,
} from '@/types/models';

import { notDeleted, touch } from './sync';

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
  target: number;
  rewardCoins: number;
}

/** The daily quest set. Server-driven once a backend exists. */
export const DAILY_QUESTS: QuestDefinition[] = [
  { questType: 'log_all_meals', target: 3, rewardCoins: 30 },
  { questType: 'hit_calorie_goal', target: 1, rewardCoins: 50 },
  { questType: 'drink_water', target: 8, rewardCoins: 20 },
];

export function getQuests(userId: string, date: DateKey = todayKey()): Quest[] {
  return db
    .select()
    .from(quest)
    .where(and(eq(quest.userId, userId), eq(quest.questDate, date), notDeleted(quest)))
    .all();
}

/** Issue the day's quests, once. Safe to call on every app open. */
export function ensureDailyQuests(userId: string, date: DateKey = todayKey()): Quest[] {
  const existing = getQuests(userId, date);

  if (existing.length > 0) return existing;

  const rows: Quest[] = DAILY_QUESTS.map((definition) => ({
    id: generateLocalId('quest'),
    userId,
    questType: definition.questType,
    progress: 0,
    target: definition.target,
    rewardCoins: definition.rewardCoins,
    completed: false,
    questDate: date,
    remoteId: null,
    deletedAt: null,
    ...touch(),
  }));

  db.insert(quest).values(rows).run();

  return rows;
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

  const completed = progress >= existing.target;

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
