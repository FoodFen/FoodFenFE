import { isAiQuotaSpent } from '@/features/diary/aiQuota';

const slot = (remaining: number) => ({ limit: 3, remaining });

describe('isAiQuotaSpent', () => {
  it('is false while the quota has not loaded', () => {
    expect(isAiQuotaSpent(undefined, 'text')).toBe(false);
  });

  it('is false for unlimited quota even with zero remaining', () => {
    const quota = { unlimited: true, image: slot(0), text: slot(0), voice: slot(0) };

    expect(isAiQuotaSpent(quota, 'text')).toBe(false);
  });

  it('is false when the slot is null', () => {
    const quota = { unlimited: false, image: null, text: null, voice: null };

    expect(isAiQuotaSpent(quota, 'image')).toBe(false);
  });

  it('is false while tries remain', () => {
    const quota = { unlimited: false, image: slot(1), text: slot(2), voice: slot(3) };

    expect(isAiQuotaSpent(quota, 'image')).toBe(false);
  });

  it('is true only for the method that ran out', () => {
    const quota = { unlimited: false, image: slot(0), text: slot(2), voice: slot(0) };

    expect(isAiQuotaSpent(quota, 'image')).toBe(true);
    expect(isAiQuotaSpent(quota, 'text')).toBe(false);
    expect(isAiQuotaSpent(quota, 'voice')).toBe(true);
  });
});
