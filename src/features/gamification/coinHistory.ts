/** Pure rules for the coin history screen and the shop's idempotent redeem retry. */
import type { Translations } from '@/lib/i18n';

export type CoinReasonLabelKey = Exclude<
  keyof Translations['coinHistory'],
  'title' | 'empty' | 'loadError'
>;

const KNOWN_REASONS: ReadonlySet<string> = new Set<string>([
  'quest_completed',
  'streak_bonus',
  'purchase',
  'spend',
  'mascot_purchase',
  'adjustment',
  'quiz_daily',
  'quiz_practice',
]);

export function coinReasonLabelKey(reason: string): CoinReasonLabelKey {
  return KNOWN_REASONS.has(reason) ? (reason as CoinReasonLabelKey) : 'unknown';
}

export interface FailedRedeem {
  days: number;
  clientId: string;
}

export function redeemClientId(
  failed: FailedRedeem | null,
  days: number,
  generate: () => string,
): string {
  return failed?.days === days ? failed.clientId : generate();
}

/** A 409 is a definitive answer from the server, so only other failures may be replayed. */
export function retainFailedRedeem(
  days: number,
  clientId: string,
  status: number | undefined,
): FailedRedeem | null {
  return status === 409 ? null : { days, clientId };
}
