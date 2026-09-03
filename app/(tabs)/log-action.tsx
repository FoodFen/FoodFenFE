import { Redirect } from 'expo-router';

/**
 * Placeholder for the center tab.
 *
 * The tab's `tabBarButton` intercepts the press and opens the logging modal, so
 * this screen is never shown. It exists because a `Tabs.Screen` must point at a
 * real route file; the redirect only fires if something navigates here directly
 * (a deep link, for instance).
 */
export default function LogActionTab() {
  return <Redirect href="/log/search" />;
}
