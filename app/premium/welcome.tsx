import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { usePremiumEndDate } from '@/features/premium/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatLongDate } from '@/lib/date';
import type { Translations } from '@/lib/i18n';
import { colorsFor } from '@/theme/colors';

type Perk = 'ai' | 'fiber' | 'custom' | 'early';

const PERKS: { id: Perk; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'ai', icon: 'sparkles-outline' },
  { id: 'fiber', icon: 'leaf-outline' },
  { id: 'custom', icon: 'create-outline' },
  { id: 'early', icon: 'rocket-outline' },
];

/**
 * Shown once a purchase or coin redemption turns Premium on. It is the only
 * route in the Premium stack, so `router.dismiss()` closes the whole modal
 * instead of falling back to the paywall underneath.
 */
export default function PremiumWelcomeScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const insets = useSafeAreaInsets();
  const { data: endDate } = usePremiumEndDate();

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 48, paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-3 pb-8">
          <MaterialCommunityIcons name="party-popper" size={64} color={colors.brand} />
          <Text variant="title" className="text-center text-3xl">
            {t('premiumWelcome', 'title')}
          </Text>
          <Text variant="body" tone="muted" className="text-center">
            {t('premiumWelcome', 'subtitle')}
          </Text>
          {endDate ? (
            <View className="rounded-pill bg-warning/15 px-3 py-1">
              <Text variant="label" tone="warning">
                {t('premiumWelcome', 'validUntil').replace('{date}', formatLongDate(endDate))}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-4">
          {PERKS.map((perk) => (
            <View key={perk.id} className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-soft">
                <Ionicons name={perk.icon} size={20} color={colors.brand} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="label">
                  {t('premiumWelcome', `${perk.id}Title` as keyof Translations['premiumWelcome'])}
                </Text>
                <Text variant="caption" tone="muted">
                  {t(
                    'premiumWelcome',
                    `${perk.id}Description` as keyof Translations['premiumWelcome'],
                  )}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        className="border-t border-border bg-surface px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button
          label={t('premiumWelcome', 'done')}
          onPress={() => router.dismiss()}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}
