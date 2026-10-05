import type { DateKey } from '@/lib/date';
import { fromDateKey, lastNDays, shiftDateKey, todayKey } from '@/lib/date';
import { progressFraction } from '@/lib/nutrition';
import type { Quest, Streak } from '@/types/models';

/**
 * What the UI shows as progress: the server's `completed` flag wins over the
 * raw numbers, because it applies the quest's `completionRatio` — a completed
 * quest can sit at `progress < target` (e.g. 80/100) and must still read as done.
 */
function displayProgress(quest: Quest): number {
  return quest.completed ? Math.max(quest.progress, quest.target) : quest.progress;
}

export function questProgressFraction(quest: Quest): number {
  return progressFraction(displayProgress(quest), quest.target);
}

/** Goal quests are a percent of a daily goal, not a count, so "0/100" would read wrong. */
export function questProgressLabel(quest: Quest): string {
  const progress = displayProgress(quest);

  return quest.unit === 'percent' ? `${progress}%` : `${progress}/${quest.target}`;
}

export interface StreakDay {
  date: DateKey;
  active: boolean;
}

/**
 * The last 7 calendar days, each marked whether it was part of the active
 * run, for the streak screen's day row.
 *
 * `recordActiveDay` guarantees `currentStreak` is exactly the number of
 * consecutive days ending at `lastActiveDate` — so the active run can be
 * derived from those two fields without a new query. A day the user has not
 * logged yet (typically "today") simply falls outside the run.
 */
export function streakDayStatuses(
  streakState: Pick<Streak, 'currentStreak' | 'lastActiveDate'> | undefined,
  today: DateKey = todayKey(),
): StreakDay[] {
  const days = lastNDays(7, today);

  const lastActiveDate = streakState?.lastActiveDate;

  if (!lastActiveDate || streakState.currentStreak <= 0) {
    return days.map((date) => ({ date, active: false }));
  }

  const runStart = shiftDateKey(lastActiveDate, -(streakState.currentStreak - 1));

  return days.map((date) => ({
    date,
    active: date >= runStart && date <= lastActiveDate,
  }));
}

export interface HeatmapCell {
  date: DateKey;
  count: number;
}

/** 0 (no entries) through 4 (heaviest), for the heatmap's cell shading. */
export function heatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/**
 * `weeks` full Sunday–Saturday columns ending in the week containing `today`,
 * each 7 cells (`null` outside the requested day range), for a GitHub-style
 * contribution grid.
 */
export function loggingHeatmap(
  counts: Record<DateKey, number>,
  weeks = 53,
  today: DateKey = todayKey(),
): (HeatmapCell | null)[][] {
  const totalDays = weeks * 7;
  const from = shiftDateKey(today, -(totalDays - 1));
  const leadingPad = fromDateKey(from).getDay();

  const cells: (HeatmapCell | null)[] = Array.from({ length: leadingPad }, () => null);

  for (const date of lastNDays(totalDays, today)) {
    cells.push({ date, count: counts[date] ?? 0 });
  }

  while (cells.length % 7 !== 0) cells.push(null);

  const columns: (HeatmapCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    columns.push(cells.slice(i, i + 7));
  }

  return columns;
}

/**
 * Whether this advance of a quest earns a toast: the first ever, then every
 * other one, and always the one that completes it — so routine progress
 * doesn't nag on every single log, but the mechanic is taught immediately and
 * the payoff is never missed.
 */
export function shouldAnnounce(count: number, completed: boolean): boolean {
  return count === 1 || count % 2 === 0 || completed;
}
