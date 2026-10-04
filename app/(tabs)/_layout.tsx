// `Tabs` re-exported from `expo-router` is deprecated in SDK 57; `js-tabs` is
// the JS tab navigator's own entry point.
import { usePathname } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';

import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';
import { useQuestsPull, useRefreshQuests } from '@/features/gamification/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

/**
 * Three destinations — the dashboard, achievements, and stats — drawn by the
 * custom floating bar. Logging is not a tab: the bar's green button pushes the
 * meal modal and returns you to wherever you were. The header shortcuts to the
 * shop and settings live on the dashboard, not here.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  useQuestsPull();
  const pathname = usePathname();
  const refreshQuests = useRefreshQuests();
  useEffect(() => {
    void refreshQuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshQuests is a fresh closure every render; only a tab change should re-trigger
  }, [pathname]);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs', 'home') }} />
      <Tabs.Screen
        name="achievements"
        options={{ title: t('tabs', 'achievements') }}
      />
      <Tabs.Screen name="insights" options={{ title: t('tabs', 'insights') }} />
    </Tabs>
  );
}
