import { and, desc, eq, sql } from 'drizzle-orm';

import { gamificationApi } from '@/api/endpoints/gamification';
import type { RemoteQuestProgress } from '@/api/schemas';
import { db } from '@/db/client';
import { coinTransaction, quest, streak, subscription } from '@/db/schema';
import type { DateKey } from '@/lib/date';
import { calendarWeek, shiftDateKey, todayKey } from '@/lib/date';
import { generateLocalId } from '@/lib/id';
import type {
  CoinReason,
  PlanType,
  Quest,
  Streak,
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
} from '@/types/models';

import { notDeleted, touch, touchDeleted } from './sync';

/**
 * Streaks, quests, coins and subscription state.
 *
 * Quest progress and coin balance are server-authoritative
 * (`docs/superpowers/specs/2026-09-30-coins-quests-design.md`, BE repo): the
 * server issues, evaluates and pays quests lazily on `GET /quests?date=`; the
 * client never reports progress or completion. `quest`/`coin_transaction`
 * rows here are a read-through cache of that response, written by
 * `pullQuests`/`redeemCoinsForPremium`, never by local computation.
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

export function getQuests(userId: string, date: DateKey = todayKey()): Quest[] {
  return db
    .select()
    .from(quest)
    .where(and(eq(quest.userId, userId), eq(quest.questDate, date), notDeleted(quest)))
    .all();
}

/** Every quest active right now, from the local cache: today's daily set plus this week's weekly set. */
export function getActiveQuests(userId: string, today: DateKey = todayKey()): Quest[] {
  const weekStart = calendarWeek(today)[0] ?? today;
  const daily = getQuests(userId, today).filter((row) => row.cadence === 'daily');
  const weekly = getQuests(userId, weekStart).filter((row) => row.cadence === 'weekly');

  return [...daily, ...weekly];
}

function upsertQuest(userId: string, remote: RemoteQuestProgress): void {
  const existing = db
    .select()
    .from(quest)
    .where(and(eq(quest.userId, userId), eq(quest.remoteId, remote.id)))
    .limit(1)
    .all()[0];

  const values = {
    questType: remote.questType,
    progress: remote.progress,
    target: remote.target,
    rewardCoins: remote.rewardCoins,
    completed: remote.completed,
    cadence: remote.cadence,
    // Not returned by the server — it already applied its own ratio and sent
    // `completed` directly. Kept at 1 (the NOT NULL column's simple-case
    // default) since nothing here recomputes completion from it anymore.
    completionRatio: 1,
    questDate: remote.questDate,
    remoteId: remote.id,
    deletedAt: null,
    ...touch(),
  };

  if (existing) {
    db.update(quest).set(values).where(eq(quest.id, existing.id)).run();
  } else {
    db.insert(quest).values({ id: generateLocalId('quest'), userId, ...values }).run();
  }
}

/** Reconciles the local coin ledger's sum to the server's authoritative balance. */
export function reconcileCoinBalance(userId: string, serverBalance: number): void {
  const delta = serverBalance - getCoinBalance(userId);

  if (delta !== 0) addCoins(userId, delta, 'adjustment');
}

/**
 * Pulls that day's quests — the server lazily issues, evaluates and pays them
 * on this call, which is the only place coins are earned. Never awaited by a
 * screen directly — called from `readWithRefresh`/in the background after a
 * log, same non-blocking rule as every other server read in this app.
 */
export async function pullQuests(userId: string, date: DateKey): Promise<Quest[]> {
  const { balance, quests } = await gamificationApi.quests(date);

  for (const remote of quests) upsertQuest(userId, remote);
  reconcileCoinBalance(userId, balance);

  return getActiveQuests(userId, date);
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
    // `updatedAt` breaks ties when two rows share a `startDate` — same-day
    // stacked redemptions/renewals, which `startDate` alone can't order.
    .orderBy(desc(subscription.startDate), desc(subscription.updatedAt))
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

export interface CoinShopBundle {
  id: string;
  days: number;
  coinCost: number;
}

/** Coin cost is roughly a week of fully-cleared daily quests per redeemed week. */
export const COIN_SHOP_BUNDLES: CoinShopBundle[] = [
  { id: '10day', days: 10, coinCost: 600 },
  { id: '30day', days: 30, coinCost: 1500 },
];

/**
 * Spend coins for a premium bundle — server-authoritative: `POST
 * /coins/redeem` validates the balance, extends/starts the account's one
 * subscription row, and returns both. A 409 `ApiError` means insufficient
 * coins; the caller (`useRedeemCoins`) surfaces that.
 */
export async function redeemCoinsForPremium(userId: string, bundleId: string): Promise<void> {
  const bundle = COIN_SHOP_BUNDLES.find((row) => row.id === bundleId);
  if (!bundle) throw new Error(`Unknown coin shop bundle: ${bundleId}`);

  const { balance, subscription: remote } = await gamificationApi.redeemCoins(bundle.days);

  reconcileCoinBalance(userId, balance);

  startSubscription(userId, {
    planType: remote.planType,
    status: remote.status,
    startDate: remote.startDate,
    endDate: remote.endDate,
    price: remote.price,
  });
}

/**
 * Sign-out wipes the entitlement: the rows came from the account, so they
 * must not outlive its session. Sign-in re-pulls them via `GET /subscriptions/me`.
 */
export function clearSubscriptions(userId: string): void {
  db.update(subscription)
    .set(touchDeleted())
    .where(and(eq(subscription.userId, userId), notDeleted(subscription)))
    .run();
}

/** Quests and coins are a read-through cache of the account (see file header), so they leave with it. */
export function clearAccountState(userId: string): void {
  clearSubscriptions(userId);
  db.delete(quest).where(eq(quest.userId, userId)).run();
  db.delete(coinTransaction).where(eq(coinTransaction.userId, userId)).run();
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
