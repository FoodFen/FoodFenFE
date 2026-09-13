import { en } from './en';
import type { DeepPartial } from './en';
import { vi, type Translations } from './vi';

/**
 * Locale support.
 *
 * Vietnamese (`vi`) is the default and the only complete dictionary. English
 * (`en`) is scaffolded but deliberately empty until it is developed —
 * `translate()` falls back to Vietnamese for any key `en` doesn't have yet,
 * so switching to English never shows a blank string.
 */
export type Locale = 'vi' | 'en';

export const DEFAULT_LOCALE: Locale = 'vi';

const dictionaries: Record<Locale, DeepPartial<Translations>> = { vi, en };

export function translate<N extends keyof Translations>(
  locale: Locale,
  namespace: N,
  key: keyof Translations[N],
): string {
  const localized = dictionaries[locale][namespace] as Partial<Translations[N]> | undefined;

  return (localized?.[key] ?? vi[namespace][key]) as string;
}

export type { Translations };
