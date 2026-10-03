import type { RemoteAiQuotaResponse } from '@/api/schemas';

export type AiQuotaSlot = 'image' | 'text' | 'voice';

/**
 * True only when the cached quota positively says this method has no tries
 * left. Missing, unlimited or null-slot quota is "not known to be spent", so
 * the request still goes out and the server stays the authority.
 */
export function isAiQuotaSpent(
  quota: RemoteAiQuotaResponse | undefined,
  slot: AiQuotaSlot,
): boolean {
  if (!quota || quota.unlimited) return false;

  const entry = quota[slot];

  return entry !== null && entry.remaining <= 0;
}
