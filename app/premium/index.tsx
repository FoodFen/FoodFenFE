import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import { usePaymentPlans } from '@/features/premium/queries';
import { useIsPremium } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import type { Translations } from '@/lib/i18n';
import { colorsFor } from '@/theme/colors';

// Placeholder — a free-to-use Pexels stock photo (Vietnamese rice noodle
// salad), not a real brand asset. Swap for a bundled asset or a real hero
// image before ship. https://www.pexels.com/photo/healthy-food-in-a-bowl-3297807/
const HERO_IMAGE_URL =
  'https://images.pexels.com/photos/3297807/pexels-photo-3297807.jpeg?auto=compress&cs=tinysrgb&w=1200';

type PlanId = 'monthly' | 'yearly';

/** 49000 → "49.000₫" — grouped by hand, since Hermes' Intl support varies by platform. */
function formatVnd(amount: number): string {
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}₫`;
}

/**
 * The Premium upsell popup. Reachable today from Settings → Upgrade to
 * Premium; the fiber/custom-ingredient locked cards elsewhere in the app
 * still don't route here (see their own "no paywall screen exists yet"
 * comments) — wiring those is a follow-up, not part of this screen.
 */
export default function PremiumScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const insets = useSafeAreaInsets();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');

  // Read once on mount: while the payment screen sits on top, this screen
  // stays mounted and `isPremium` flips — that must not trigger a redirect.
  const wasPremium = useRef(useIsPremium());

  useEffect(() => {
    if (wasPremium.current) router.replace('/premium/welcome');
  }, []);

  const { data: planData, isError, fetchStatus, refetch } = usePaymentPlans();

  const plans = [
    { id: 'monthly' as const, planType: 'monthly' as const },
    { id: 'yearly' as const, planType: 'annual' as const },
  ].flatMap(({ id, planType }) => {
    const priceVnd = planData?.plans.find((plan) => plan.planType === planType)?.priceVnd;
    if (priceVnd === undefined) return [];

    return [
      {
        id,
        label: t('premium', id),
        price: formatVnd(priceVnd),
        priceValue: priceVnd,
        period: t('premium', id === 'monthly' ? 'perMonth' : 'perYear'),
        badge: id === 'yearly' ? t('premium', 'bestValue') : undefined,
      },
    ];
  });
  const loadingPlans = plans.length === 0 && fetchStatus === 'fetching';
  const plansFailed = !loadingPlans && (isError || plans.length === 0);

  const benefits: {
    icon: keyof typeof Ionicons.glyphMap;
    titleKey: keyof Translations['premium'];
  }[] = [
    { icon: 'scan-outline', titleKey: 'benefitAiTitle' },
    { icon: 'leaf-outline', titleKey: 'benefitFiberTitle' },
    { icon: 'create-outline', titleKey: 'benefitCustomTitle' },
    { icon: 'sparkles-outline', titleKey: 'benefitEarlyTitle' },
    { icon: 'heart-outline', titleKey: 'benefitSupportTitle' },
  ];

  const selected = plans.find((plan) => plan.id === selectedPlan) ?? plans[0];

  const signedIn = useAuthStore((state) => state.session !== null);

  const goToPayment = () => {
    haptics.selection();
    if (!signedIn) {
      router.push('/sign-in');
      return;
    }
    if (!selected) return;
    router.push({
      pathname: '/premium/payment',
      params: {
        plan: selected.id,
        label: selected.label,
        price: selected.price,
        priceValue: String(selected.priceValue),
        period: selected.period,
      },
    });
  };

  return (
    <View className="flex-1 bg-bg">
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View>
          <Image
            source={{ uri: HERO_IMAGE_URL }}
            style={{ width: '100%', height: 260 }}
            contentFit="cover"
            transition={200}
          />

          <Pressable
            onPress={() => router.dismiss()}
            accessibilityRole="button"
            accessibilityLabel={t('common', 'cancel')}
            hitSlop={8}
            className="absolute h-9 w-9 items-center justify-center rounded-full bg-black/40 active:opacity-70"
            style={{ top: insets.top + 12, right: 16 }}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View className="gap-6 px-5 pb-6 pt-6">
          <View className="items-center gap-3">
            <View className="rounded-pill bg-warning/15 px-3 py-1">
              <Text variant="label" tone="warning">
                {t('common', 'premium').toUpperCase()}
              </Text>
            </View>
            <Text variant="title" className="text-center text-3xl">
              {t('premium', 'heroTitle')}
            </Text>
          </View>

          <View className="gap-3">
            {benefits.map((benefit) => (
              <View key={benefit.titleKey} className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-soft">
                  <Ionicons name={benefit.icon} size={18} color={colors.brand} />
                </View>
                <Text variant="label" className="flex-1">
                  {t('premium', benefit.titleKey)}
                </Text>
              </View>
            ))}
          </View>

          <View className="gap-3">
            {loadingPlans ? (
              <>
                <Skeleton className="h-[74px]" />
                <Skeleton className="h-[74px]" />
              </>
            ) : null}
            {plansFailed ? (
              <View className="items-center gap-2">
                <Text variant="body" tone="muted" className="text-center">
                  {t('premium', 'pricesError')}
                </Text>
                <Button
                  label={t('common', 'retry')}
                  variant="secondary"
                  size="sm"
                  onPress={() => void refetch()}
                />
              </View>
            ) : null}
            {plans.map((plan) => {
              const isSelected = plan.id === selectedPlan;

              return (
                <Pressable
                  key={plan.id}
                  onPress={() => {
                    haptics.selection();
                    setSelectedPlan(plan.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  className={cn(
                    'flex-row items-center justify-between rounded-card border-2 bg-surface p-4',
                    isSelected ? 'border-brand' : 'border-border',
                  )}
                >
                  <View className="gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Text variant="label">{plan.label}</Text>
                      {plan.badge ? (
                        <View className="rounded-pill bg-warning/15 px-2 py-0.5">
                          <Text variant="caption" tone="warning">
                            {plan.badge}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text variant="caption" tone="muted">
                      {plan.price}
                      {plan.period}
                    </Text>
                  </View>

                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isSelected ? colors.brand : colors.fgSubtle}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View
        className="gap-2 border-t border-border bg-surface px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button
          label={t('premium', 'continueButton')}
          onPress={goToPayment}
          disabled={signedIn && !selected}
          fullWidth
          size="lg"
        />
        <Text variant="caption" tone="subtle" className="text-center">
          {t('premium', 'finePrint')}
        </Text>
      </View>
    </View>
  );
}
