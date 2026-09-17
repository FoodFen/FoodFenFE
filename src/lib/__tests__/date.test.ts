import {
  calendarWeek,
  daysUntil,
  formatDayOfMonth,
  formatDiaryDate,
  formatTime,
  formatWeekdayInitial,
  fromDateKey,
  isFutureDate,
  lastNDays,
  shiftDateKey,
  toDateKey,
  withTime,
} from '../date';

// 2026-03-02 is a Monday — the same anchor `gamificationRepository.test.ts`
// uses for its weekly-quest tests.
const MONDAY = '2026-03-02';

describe('toDateKey / fromDateKey', () => {
  it('round-trips through local midnight regardless of time-of-day', () => {
    const lateNight = new Date(2026, 2, 2, 23, 30);

    expect(toDateKey(lateNight)).toBe(MONDAY);
    expect(fromDateKey(MONDAY).getHours()).toBe(0);
  });
});

describe('shiftDateKey', () => {
  it('crosses a month boundary without drifting a day via UTC', () => {
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDateKey(MONDAY, 1)).toBe('2026-03-03');
  });
});

describe('formatDiaryDate', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 2, 2, 9, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('labels today and yesterday specially', () => {
    expect(formatDiaryDate(MONDAY)).toBe('Today');
    expect(formatDiaryDate('2026-03-01')).toBe('Yesterday');
  });

  it('falls back to a weekday/day/month label otherwise', () => {
    expect(formatDiaryDate('2026-02-25')).toBe('Wed, 25 Feb');
  });
});

describe('formatWeekdayInitial / formatDayOfMonth', () => {
  it('reads the local calendar day, not the UTC one', () => {
    expect(formatWeekdayInitial(MONDAY)).toBe('M');
    expect(formatDayOfMonth(MONDAY)).toBe('2');
  });
});

describe('formatTime', () => {
  it('formats a Date, an epoch number and an ISO string to the same clock time', () => {
    const date = new Date(2026, 2, 2, 14, 5);

    expect(formatTime(date)).toBe('14:05');
    expect(formatTime(date.getTime())).toBe('14:05');
    expect(formatTime('2026-03-02T14:05:00')).toBe('14:05');
  });
});

describe('withTime', () => {
  it('applies the wall-clock hour/minute to the given day key, not to "now"', () => {
    const result = withTime(MONDAY, 8, 30);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(2);
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(30);
  });
});

describe('daysUntil / isFutureDate', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 2, 2, 9, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts forward as positive and backward as negative', () => {
    expect(daysUntil('2026-03-05')).toBe(3);
    expect(daysUntil('2026-03-01')).toBe(-1);
  });

  it('treats today as not-future', () => {
    expect(isFutureDate(MONDAY)).toBe(false);
    expect(isFutureDate('2026-03-05')).toBe(true);
  });
});

describe('lastNDays', () => {
  it('returns the N days ending at the given key, oldest first', () => {
    expect(lastNDays(3, MONDAY)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });
});

describe('calendarWeek', () => {
  it('returns the Monday-Sunday week containing the given key', () => {
    expect(calendarWeek('2026-03-04')).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);
  });
});
