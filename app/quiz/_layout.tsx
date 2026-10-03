import { Stack } from 'expo-router';

import { useTranslation } from '@/hooks/useTranslation';

export default function QuizLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: t('quiz', 'title') }} />
      <Stack.Screen name="practice" options={{ title: t('quiz', 'topicsHeading') }} />
      <Stack.Screen name="[id]" options={{ title: t('quiz', 'title') }} />
    </Stack>
  );
}
