// `Tabs` re-exported from `expo-router` is deprecated in SDK 57; `js-tabs` is
// the JS tab navigator's own entry point.
import { Tabs } from 'expo-router/js-tabs';

import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';
import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

/**
 * Three destinations — the dashboard, achievements, and stats — drawn by the
 * custom floating bar. Logging is not a tab: the bar's green button pushes the
 * meal modal and returns you to wherever you were. The header shortcuts to the
 * shop and settings live on the dashboard, not here.
 */
export default function TabsLayout() {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="achievements" options={{ title: 'Achievements' }} />
      <Tabs.Screen name="insights" options={{ title: 'Stats' }} />
    </Tabs>
  );
}
