import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
// `Tabs` re-exported from `expo-router` is deprecated in SDK 57; `js-tabs` is
// the JS tab navigator's own entry point.
import { Tabs } from 'expo-router/js-tabs';
import { Pressable } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

/**
 * The three primary destinations, plus a center button that opens the logging
 * flow as a modal rather than a fourth tab — logging is an action, not a place,
 * and it has to return you to wherever you started.
 */
export default function TabsLayout() {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.fgSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Diary',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="log-action"
        options={{
          title: 'Log',
          tabBarIcon: ({ size }) => (
            <Ionicons name="add-circle" size={size + 12} color={colors.brand} />
          ),
          tabBarLabel: () => null,
          // `ref` and `onPress` are dropped from the forwarded props: the
          // navigator's ref type does not match `Pressable`'s, and its default
          // onPress would navigate to this tab instead of opening the modal.
          tabBarButton: ({ ref: _ref, onPress: _onPress, ...rest }) => (
            <Pressable
              {...rest}
              accessibilityRole="button"
              accessibilityLabel="Log food"
              onPress={() => {
                haptics.selection();
                router.push('/log/search');
              }}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
