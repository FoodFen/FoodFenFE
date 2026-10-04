import { api } from '@/api/client';
import {
  coinBundlesResponseSchema,
  questsResponseSchema,
  redeemCoinsResponseSchema,
} from '@/api/schemas';
import type { RemoteQuestsResponse, RemoteRedeemCoinsResponse } from '@/api/schemas';
import type { DateKey } from '@/lib/date';
import type { Locale } from '@/lib/i18n';

/**
 * Server-authoritative coins and quests — supersedes the old local-only quest
 * engine and the `POST /quests` / `PATCH /quests/{id}` / `POST
 * /coin-transactions` push contract in `docs/backend-contracts/sync.md`
 * (quests are now issued, evaluated and paid lazily on read; the client
 * never reports progress or completion).
 */
export const gamificationApi = {
  /**
   * `date` is the client's local day — lazily issues that day's quests, pays
   * newly completed ones. Each quest's title and description come back in
   * `language`.
   */
  quests: (
    date: DateKey,
    language: Locale,
    signal?: AbortSignal,
  ): Promise<RemoteQuestsResponse> =>
    api.get('quests', { query: { date, language }, schema: questsResponseSchema, signal }),

  /** The coin shop's redeemable bundles — prices and durations are the server's. */
  bundles: (signal?: AbortSignal) =>
    api.get('coins/bundles', { schema: coinBundlesResponseSchema, signal }),

  /** Spends coins for `days` of Premium. 409 when the balance is too low. */
  redeemCoins: (days: number): Promise<RemoteRedeemCoinsResponse> =>
    api.post('coins/redeem', { days }, { schema: redeemCoinsResponseSchema }),
};
