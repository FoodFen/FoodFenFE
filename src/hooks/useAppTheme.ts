import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { useEffect } from 'react';

import { useSettingsStore } from '@/features/settings/store';

/**
 * Keep NativeWind's color scheme in sync with the stored preference.
 *
 * NativeWind owns the `dark:` variant and the `.dark` class that swaps the CSS
 * variables in `global.css`; this hook is the one place that tells it which
 * scheme to use.
 */
export function useAppTheme() {
  const theme = useSettingsStore((state) => state.theme);
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  return {
    /** The preference: light, dark, or follow the system. */
    preference: theme,
    /** What is actually being rendered right now. */
    resolved: colorScheme ?? 'light',
    isDark: colorScheme === 'dark',
  };
}
