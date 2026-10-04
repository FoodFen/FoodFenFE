import { shouldAnnounce } from '../selectors';

describe('shouldAnnounce', () => {
  it('announces the first advance', () => {
    expect(shouldAnnounce(1, false)).toBe(true);
  });

  it('stays quiet on the second, third, etc. odd advance', () => {
    expect(shouldAnnounce(3, false)).toBe(false);
    expect(shouldAnnounce(5, false)).toBe(false);
  });

  it('announces every even advance', () => {
    expect(shouldAnnounce(2, false)).toBe(true);
    expect(shouldAnnounce(4, false)).toBe(true);
  });

  it('always announces the advance that completes the quest, even on an odd count', () => {
    expect(shouldAnnounce(3, true)).toBe(true);
    expect(shouldAnnounce(7, true)).toBe(true);
  });
});
