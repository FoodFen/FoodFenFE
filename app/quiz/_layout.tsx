import { Stack } from 'expo-router';

import { useTranslation } from '@/hooks/useTranslation';

// A quiz screen reached by replace/deep link must still have the chooser under it, or back exits to Home.
export const unstable_settings = { initialRouteName: 'index' };

export default function QuizLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: t('quiz', 'title') }} />
      <Stack.Screen name="practice" options={{ title: t('quiz', 'topicsHeading') }} />
      <Stack.Screen name="[id]" options={{ title: t('quiz', 'title') }} />
    </Stack>
  );
}
