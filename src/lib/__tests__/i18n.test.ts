import { translate } from '../i18n';

describe('translate', () => {
  it('returns the Vietnamese string for the default locale', () => {
    expect(translate('vi', 'common', 'continue')).toBe('Tiếp tục');
  });

  it('returns the English string once it has been translated', () => {
    expect(translate('en', 'common', 'continue')).toBe('Continue');
  });

  it('falls back to Vietnamese for a key English has not defined', () => {
    // Every current key is translated, so the fallback branch is exercised
    // here with a stubbed English dictionary rather than a real gap — this
    // keeps the test independent of how complete `en.ts` happens to be.
    jest.resetModules();
    jest.doMock('../i18n/en', () => ({ en: {} }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.doMock only takes effect on a `require` made after it, not a hoisted top-of-file `import`.
    const { translate: translateWithStubbedEn } = require('../i18n') as {
      translate: typeof translate;
    };

    expect(translateWithStubbedEn('en', 'common', 'continue')).toBe('Tiếp tục');

    jest.dontMock('../i18n/en');
    jest.resetModules();
  });
});
