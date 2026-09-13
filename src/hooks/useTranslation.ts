import { useSettingsStore } from '@/features/settings/store';
import { translate, type Translations } from '@/lib/i18n';

/**
 * The app-wide translation hook, mirroring `useAppTheme`'s shape: read the
 * stored preference, expose the resolved value plus a setter.
 */
export function useTranslation() {
  const locale = useSettingsStore((state) => state.locale);
  const setLocale = useSettingsStore((state) => state.setLocale);

  function t<N extends keyof Translations>(namespace: N, key: keyof Translations[N]): string {
    return translate(locale, namespace, key);
  }

  return { t, locale, setLocale };
}
