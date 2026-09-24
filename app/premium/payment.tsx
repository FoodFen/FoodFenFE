import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import * as gamification from '@/data/gamificationRepository';
import { useProfileStore } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { shiftDateKey, todayKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';
import type { PlanType } from '@/types/models';

/**
 * Card details for the plan chosen on the Premium popup.
 *
 * There is no payment processor or store IAP wired up yet — subscribing here
 * only writes a local `subscription` row (see `gamificationRepository.
 * startSubscription`) so `resolveTier()` reports Premium; no charge, no
 * receipt. A real purchase (react-native-iap / RevenueCat) and a
 * server-validated receipt have to replace this `setTimeout` before ship —
 * see `docs/backend-contracts/premium-entitlements.md`.
 */
export default function PremiumPaymentScreen() {
  const { plan, label, price, priceValue, period } = useLocalSearchParams<{
    plan: string;
    label: string;
    price: string;
    priceValue: string;
    period: string;
  }>();
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const profile = useProfileStore((state) => state.profile);

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const canSubmit =
    cardName.trim().length > 0 &&
    cardNumber.trim().length >= 12 &&
    expiry.trim().length >= 4 &&
    cvc.trim().length >= 3;

  const onSubscribe = () => {
    if (!profile) return;

    setIsProcessing(true);

    setTimeout(() => {
      const startDate = todayKey();
      const planType: PlanType = plan === 'yearly' ? 'annual' : 'monthly';

      gamification.startSubscription(profile.id, {
        planType,
        status: 'active',
        // Approximate — a real store receipt carries the actual renewal date.
        startDate,
        endDate: shiftDateKey(startDate, planType === 'annual' ? 365 : 30),
        price: Number(priceValue) || 0,
      });

      haptics.success();
      setIsProcessing(false);

      Alert.alert(
        t('premiumPayment', 'successTitle'),
        t('premiumPayment', 'successMessage'),
        [{ text: t('common', 'done'), onPress: () => router.dismiss() }],
      );
    }, 900);
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        title={t('premiumPayment', 'layoutTitle')}
        icon="arrow-back"
        onPress={() => router.back()}
        accessibilityLabel={t('common', 'back')}
      />

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Card className="gap-2">
          <Text variant="caption" tone="muted">
            {t('premiumPayment', 'orderSummary')}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text variant="label">{label}</Text>
            <Text variant="label">
              {price}
              {period}
            </Text>
          </View>
          <View className="flex-row items-center justify-between border-t border-border pt-2">
            <Text variant="body" tone="muted">
              {t('premiumPayment', 'totalToday')}
            </Text>
            <Text variant="heading">{price}</Text>
          </View>
        </Card>

        <Card className="gap-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="card-outline" size={16} color={colors.fgMuted} />
            <Text variant="caption" tone="muted">
              {t('premiumPayment', 'paymentDetails')}
            </Text>
          </View>

          <Input
            label={t('premiumPayment', 'cardholderName')}
            value={cardName}
            onChangeText={setCardName}
            autoCapitalize="words"
            textContentType="name"
          />

          <Input
            label={t('premiumPayment', 'cardNumber')}
            value={cardNumber}
            onChangeText={setCardNumber}
            keyboardType="number-pad"
            textContentType="creditCardNumber"
            maxLength={19}
          />

          <View className="flex-row gap-3">
            <Input
              containerClassName="flex-1"
              label={t('premiumPayment', 'expiry')}
              value={expiry}
              onChangeText={setExpiry}
              keyboardType="number-pad"
              placeholder="MM/YY"
              maxLength={5}
            />
            <Input
              containerClassName="flex-1"
              label={t('premiumPayment', 'cvc')}
              value={cvc}
              onChangeText={setCvc}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
          </View>
        </Card>

        <Button
          label={t('premiumPayment', 'subscribeButton')
            .replace('{price}', price ?? '')
            .replace('{period}', period ?? '')}
          onPress={onSubscribe}
          loading={isProcessing}
          disabled={!canSubmit}
          fullWidth
          size="lg"
        />

        <Text variant="caption" tone="subtle" className="text-center">
          {t('premiumPayment', 'terms')}
        </Text>
      </KeyboardAwareScrollView>
    </View>
  );
}
