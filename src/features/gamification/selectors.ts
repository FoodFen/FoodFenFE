import type { DateKey } from '@/lib/date';
import { fromDateKey, lastNDays, shiftDateKey, todayKey } from '@/lib/date';
import type { Quest, QuestType, Streak } from '@/types/models';

/**
 * Display copy for a quest, shared by the post-log interstitial and the
 * challenges screen.
 *
 * A `switch` rather than dynamic i18n indexing: `Quest.questType` is typed
 * over the full `QuestType` union (including `log_breakfast`/
 * `hit_protein_goal`/`log_weight`, none of which are ever issued by
 * `DAILY_QUESTS`/`WEEKLY_QUESTS`), but the `questTitles`/`questDescriptions`
 * i18n namespaces only define the 4 quest types actually in use.
 */

type ActiveQuestType =
  'log_all_meals' | 'hit_calorie_goal' | 'drink_water' | 'stay_active_week';

type Translate = (
  namespace: 'questTitles' | 'questDescriptions',
  key: ActiveQuestType,
) => string;

export function questTitle(t: Translate, questType: QuestType): string {
  switch (questType) {
    case 'log_all_meals':
    case 'hit_calorie_goal':
    case 'drink_water':
    case 'stay_active_week':
      return t('questTitles', questType);
    default:
      return questType;
  }
}

export function questDescription(t: Translate, quest: Quest): string {
  switch (quest.questType) {
    case 'log_all_meals':
    case 'drink_water':
    case 'stay_active_week':
      return t('questDescriptions', quest.questType).replace(
        '{target}',
        String(quest.target),
      );
    case 'hit_calorie_goal':
      return t('questDescriptions', quest.questType).replace(
        '{percent}',
        String(Math.round(quest.completionRatio * 100)),
      );
    default:
      return '';
  }
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
