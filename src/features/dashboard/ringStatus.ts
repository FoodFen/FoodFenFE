import type { DiaryDay } from '@/types/models';

/**
 * The week strip's per-day status ring.
 *
 * Purely a function of calories logged versus that day's target — the "Ring
 * Colors Explained" screen is the spec. A day near or under target is `green`;
 * going far below target is `under` (a possible under-eating flag), and going
 * over moves it to yellow and then red. A day with nothing logged is `empty`
 * (a faint hairline ring), and a day that has not happened yet is `future`
 * (no ring at all).
 */

export type RingStatus = 'future' | 'empty' | 'under' | 'green' | 'yellow' | 'red';

/**
 * kcal below target before the ring turns "under". Tunable. Deliberately looser
 * than the +100/+200 over-thresholds: being somewhat under a deficit target is
 * fine, so only large shortfalls are flagged.
 */
export const RING_UNDER = 500;

/** kcal over target before the ring turns yellow. */
export const RING_YELLOW_OVER = 100;

/** kcal over target before the ring turns red. */
export const RING_RED_OVER = 200;

export function dayRingStatus(
  day: DiaryDay | undefined,
  { isFuture }: { isFuture: boolean },
): RingStatus {
  if (isFuture) return 'future';
  if (!day || day.entries.length === 0) return 'empty';

  const diff = day.totals.kcal - day.goal.targetKcal;

  if (diff < -RING_UNDER) return 'under';
  if (diff <= RING_YELLOW_OVER) return 'green';
  if (diff <= RING_RED_OVER) return 'yellow';

  return 'red';
}
