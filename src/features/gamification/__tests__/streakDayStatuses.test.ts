import { streakDayStatuses } from '../selectors';

// 2026-03-02 is a Monday — the same anchor used elsewhere in this suite.
const TODAY = '2026-03-08';

describe('streakDayStatuses', () => {
  it('marks every day inactive when there is no streak yet', () => {
    const days = streakDayStatuses(undefined, TODAY);

    expect(days).toHaveLength(7);
    expect(days.every((day) => !day.active)).toBe(true);
    expect(days[6]?.date).toBe(TODAY);
  });

  it('marks the run of consecutive days ending at lastActiveDate as active', () => {
    const days = streakDayStatuses(
      { currentStreak: 3, lastActiveDate: '2026-03-07' },
      TODAY,
    );

    const byDate = Object.fromEntries(days.map((day) => [day.date, day.active]));

    expect(byDate['2026-03-05']).toBe(true);
    expect(byDate['2026-03-06']).toBe(true);
    expect(byDate['2026-03-07']).toBe(true);
    // Today has not been logged yet — outside the run.
    expect(byDate['2026-03-08']).toBe(false);
    expect(byDate['2026-03-04']).toBe(false);
  });

  it('clips a run longer than the 7-day window to just what is visible', () => {
    const days = streakDayStatuses(
      { currentStreak: 30, lastActiveDate: TODAY },
      TODAY,
    );

    expect(days.every((day) => day.active)).toBe(true);
  });

  it('treats a zero streak as no active days even with a stale lastActiveDate', () => {
    const days = streakDayStatuses(
      { currentStreak: 0, lastActiveDate: '2026-03-07' },
      TODAY,
    );

    expect(days.every((day) => !day.active)).toBe(true);
  });
});
