import { heatmapLevel, loggingHeatmap } from '../selectors';

// 2026-03-08 is a Sunday.
const TODAY = '2026-03-08';

describe('heatmapLevel', () => {
  it('buckets a count into 0 through 4', () => {
    expect(heatmapLevel(0)).toBe(0);
    expect(heatmapLevel(1)).toBe(1);
    expect(heatmapLevel(2)).toBe(2);
    expect(heatmapLevel(4)).toBe(3);
    expect(heatmapLevel(9)).toBe(4);
  });
});

describe('loggingHeatmap', () => {
  it('returns full 7-cell columns, with today as the last real cell', () => {
    const weeks = loggingHeatmap({}, 4, TODAY);

    expect(weeks.every((column) => column.length === 7)).toBe(true);

    const cells = weeks.flat();
    const todayIndex = cells.findIndex((cell) => cell?.date === TODAY);

    expect(todayIndex).toBeGreaterThanOrEqual(0);
    expect(cells.slice(todayIndex + 1).every((cell) => cell === null)).toBe(true);
  });

  it('aligns each row to its real weekday, padding the first column when the window does not start on a Sunday', () => {
    // Today is a Sunday, so a 3-week-back start lands on a Monday — the first
    // column's Sunday slot (index 0) must be padding, not a real day.
    const weeks = loggingHeatmap({}, 3, TODAY);

    expect(weeks[0]?.[0]).toBeNull();
    expect(weeks[0]?.[1]?.date).toBeDefined();
  });

  it('carries each day count through to its cell', () => {
    const weeks = loggingHeatmap({ [TODAY]: 3 }, 1, TODAY);

    const cell = weeks.flat().find((entry) => entry?.date === TODAY);
    expect(cell?.count).toBe(3);
  });

  it('defaults an unlogged day in range to a zero count', () => {
    const weeks = loggingHeatmap({}, 1, TODAY);

    const cell = weeks.flat().find((entry) => entry?.date === TODAY);
    expect(cell?.count).toBe(0);
  });
});
