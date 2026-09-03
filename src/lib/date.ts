import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';

/**
 * Diary dates.
 *
 * The diary is keyed by a local calendar day (`yyyy-MM-dd`), never a timestamp.
 * A meal logged at 11pm belongs to that day regardless of the user's timezone,
 * so every conversion here goes through local time — never `toISOString()`,
 * which would shift the date across the UTC boundary.
 */

/** `yyyy-MM-dd` in the device's local timezone. */
export type DateKey = string;

export function toDateKey(date: Date): DateKey {
  return format(date, 'yyyy-MM-dd');
}

export function fromDateKey(key: DateKey): Date {
  // `parseISO` on a date-only string yields local midnight, which is what we want.
  return startOfDay(parseISO(key));
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

export function shiftDateKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** "Today" / "Yesterday" / "Mon, 3 Mar" — the diary header label. */
export function formatDiaryDate(key: DateKey): string {
  const date = fromDateKey(key);

  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';

  return format(date, 'EEE, d MMM');
}

/** Short weekday initial, for the horizontal date strip. */
export function formatWeekdayInitial(key: DateKey): string {
  return format(fromDateKey(key), 'EEEEE');
}

export function formatDayOfMonth(key: DateKey): string {
  return format(fromDateKey(key), 'd');
}

export function formatTime(isoTimestamp: string): string {
  return format(parseISO(isoTimestamp), 'HH:mm');
}

export function isFutureDate(key: DateKey): boolean {
  return differenceInCalendarDays(fromDateKey(key), startOfDay(new Date())) > 0;
}

/** The `count` days ending at `endKey`, oldest first. */
export function lastNDays(count: number, endKey: DateKey = todayKey()): DateKey[] {
  const end = fromDateKey(endKey);

  return eachDayOfInterval({ start: subDays(end, count - 1), end }).map(toDateKey);
}

/** The seven days centred on `key`, for the date strip. */
export function weekAround(key: DateKey): DateKey[] {
  const center = fromDateKey(key);

  return eachDayOfInterval({
    start: subDays(center, 3),
    end: addDays(center, 3),
  }).map(toDateKey);
}
